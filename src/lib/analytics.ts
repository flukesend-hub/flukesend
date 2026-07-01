/*
  Analytics aggregation. Everything is read through the passed RLS server client,
  so a dashboard only ever sees the signed in operator's own data; the operator
  id is also filtered explicitly for clarity. Reads are bounded to a rolling
  window and aggregated in JS, which is plenty at operator scale. If a single
  operator ever grows to tens of thousands of sends, these move to admin side SQL
  aggregates, still scoped by operator_id.

  The funnel steps come straight from existing tables and events:
    sends       deliveries created in the period
    reached     recipients on those deliveries (the guests emailed)
    opened      recipients with an 'opened' gallery event
    downloaded  recipients with a 'downloaded' event
    reviewAsks  recipients whose review email has been sent
    captured    guests self captured by QR in the period
  There is no bounce or true delivered signal yet; that arrives with the email
  provider webhook, so "reached" is the count of guests emailed.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Funnel = {
  sends: number;
  reached: number;
  opened: number;
  downloaded: number;
  reviewAsks: number;
  reviewClicks: number;
  captured: number;
};

export type TrendPoint = {
  key: string;
  label: string;
  sends: number;
  reached: number;
  downloaded: number;
};

export type GroupRow = {
  name: string;
  sends: number;
  reached: number;
  downloaded: number;
};

export type Analytics = {
  monthKey: string;
  monthLabel: string;
  month: Funnel;
  trend: TrendPoint[];
  byBoat: GroupRow[];
  byPhotographer: GroupRow[];
  windowMonths: number;
};

// Shape of a recipient row with its delivery joined (to-one via the FK).
type RecipientRow = {
  id: string;
  delivery_id: string;
  review_email_status: string;
  deliveries: {
    operator_id: string;
    created_at: string;
    boat_name: string | null;
    captain_name: string | null;
    naturalist_name: string | null;
    photographer_name: string | null;
    crew_names: string[] | null;
  };
};

const WINDOW_MONTHS = 6;
const NO_BOAT = "No boat";

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

// Photographer attribution for a delivery. The email credits each person once
// by their top role (captain outranks photographer), so a captain who also
// shoots lands on the delivery as captain with photographer_name empty. The
// roster still knows everyone's roles, so attribution reads them: anyone
// credited on the send who carries the photographer role counts, alongside an
// explicitly credited photographer.
function photographersFor(
  d: RecipientRow["deliveries"],
  photographerNames: Set<string>,
): string[] {
  const out = new Set<string>();
  const explicit = d.photographer_name?.trim();
  if (explicit) out.add(explicit);
  for (const n of [d.captain_name, d.naturalist_name, ...(d.crew_names ?? [])]) {
    const clean = n?.trim();
    if (clean && photographerNames.has(clean)) out.add(clean);
  }
  return [...out];
}

async function rosterPhotographers(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<Set<string>> {
  const { data: crew } = await supabase
    .from("crew_members")
    .select("name, roles")
    .eq("operator_id", operatorId);
  return new Set(
    (crew ?? [])
      .filter((c) => ((c.roles ?? []) as string[]).includes("photographer"))
      .map((c) => (c.name as string).trim())
      .filter(Boolean),
  );
}


export async function getAnalytics(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<Analytics> {
  const now = new Date();
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth(); // 0 based

  const keys: string[] = [];
  for (let i = WINDOW_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(cy, cm - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const currentKey = keys[keys.length - 1];
  const windowStart = new Date(Date.UTC(cy, cm - (WINDOW_MONTHS - 1), 1)).toISOString();

  // Recipients with their delivery joined, and the QR captures, fetched
  // together. RLS scopes both to this operator; the explicit operator filter
  // and the window keep the join tight.
  const [{ data: recRaw }, { data: capRaw }, photographerNames] = await Promise.all([
    supabase
      .from("recipients")
      .select(
        "id, delivery_id, review_email_status, deliveries!inner(operator_id, created_at, boat_name, captain_name, naturalist_name, photographer_name, crew_names)",
      )
      .eq("deliveries.operator_id", operatorId)
      .gte("deliveries.created_at", windowStart)
      .limit(100000),
    supabase.from("captured_guests").select("captured_at").gte("captured_at", windowStart).limit(100000),
    rosterPhotographers(supabase, operatorId),
  ]);
  const recipients = (recRaw ?? []) as unknown as RecipientRow[];

  // Which recipients opened and downloaded. Fetched by id in chunks so a busy
  // operator's list never blows the query length.
  const opened = new Set<string>();
  const downloaded = new Set<string>();
  const reviewClicked = new Set<string>();
  const recipientIds = recipients.map((r) => r.id);
  for (const chunk of chunks(recipientIds, 500)) {
    const { data: evs } = await supabase
      .from("events")
      .select("recipient_id, type")
      .in("recipient_id", chunk);
    for (const e of evs ?? []) {
      if (e.type === "opened") opened.add(e.recipient_id as string);
      else if (e.type === "downloaded") downloaded.add(e.recipient_id as string);
      else if (e.type === "review_clicked") reviewClicked.add(e.recipient_id as string);
    }
  }

  const capturedByMonth = new Map<string, number>();
  for (const c of capRaw ?? []) {
    const k = monthKey(c.captured_at as string);
    capturedByMonth.set(k, (capturedByMonth.get(k) ?? 0) + 1);
  }

  // Per delivery info, derived from the recipient rows (every delivery has at
  // least one recipient, so nothing is missed).
  type Del = { key: string; boat: string; photographers: string[] };
  const delById = new Map<string, Del>();
  for (const r of recipients) {
    if (!delById.has(r.delivery_id)) {
      delById.set(r.delivery_id, {
        key: monthKey(r.deliveries.created_at),
        boat: r.deliveries.boat_name?.trim() || NO_BOAT,
        photographers: photographersFor(r.deliveries, photographerNames),
      });
    }
  }

  // Current month funnel.
  let sends = 0;
  for (const d of delById.values()) if (d.key === currentKey) sends++;
  const monthRecs = recipients.filter((r) => delById.get(r.delivery_id)!.key === currentKey);
  const month: Funnel = {
    sends,
    reached: monthRecs.length,
    opened: monthRecs.filter((r) => opened.has(r.id)).length,
    downloaded: monthRecs.filter((r) => downloaded.has(r.id)).length,
    reviewAsks: monthRecs.filter((r) => r.review_email_status === "sent").length,
    reviewClicks: monthRecs.filter((r) => reviewClicked.has(r.id)).length,
    captured: capturedByMonth.get(currentKey) ?? 0,
  };

  // Trend by month across the window.
  const trend: TrendPoint[] = keys.map((k) => {
    let s = 0;
    for (const d of delById.values()) if (d.key === k) s++;
    const rs = recipients.filter((r) => delById.get(r.delivery_id)!.key === k);
    return {
      key: k,
      label: monthLabel(k),
      sends: s,
      reached: rs.length,
      downloaded: rs.filter((r) => downloaded.has(r.id)).length,
    };
  });

  // Per boat and per photographer across the whole window. Sends where
  // nobody aboard shoots stay out of the photographer table.
  const byBoat = groupBy(recipients, delById, downloaded, (d) => [d.boat]);
  const byPhotographer = groupBy(recipients, delById, downloaded, (d) => d.photographers);

  return {
    monthKey: currentKey,
    monthLabel: monthLabel(currentKey),
    month,
    trend,
    byBoat,
    byPhotographer,
    windowMonths: WINDOW_MONTHS,
  };
}

// Group recipients and their deliveries by a key derived from each delivery.
// keysOf may return no keys to leave a delivery out of the table entirely.
// sends counts distinct deliveries.
function groupBy(
  recipients: RecipientRow[],
  delById: Map<string, { key: string; boat: string; photographers: string[] }>,
  downloaded: Set<string>,
  keysOf: (d: { boat: string; photographers: string[] }) => string[],
): GroupRow[] {
  const map = new Map<string, { reached: number; downloaded: number; delIds: Set<string> }>();
  const ensure = (name: string) => {
    let g = map.get(name);
    if (!g) {
      g = { reached: 0, downloaded: 0, delIds: new Set() };
      map.set(name, g);
    }
    return g;
  };
  for (const [id, d] of delById) {
    for (const name of keysOf(d)) ensure(name).delIds.add(id);
  }
  for (const r of recipients) {
    const d = delById.get(r.delivery_id)!;
    const isDown = downloaded.has(r.id);
    for (const name of keysOf(d)) {
      const g = ensure(name);
      g.reached++;
      if (isDown) g.downloaded++;
    }
  }
  return [...map.entries()]
    .map(([name, g]) => ({ name, sends: g.delIds.size, reached: g.reached, downloaded: g.downloaded }))
    .sort((a, b) => b.reached - a.reached);
}

// Per delivery rows for the CSV export, all time. Same joins, no window.
export type DeliveryRow = {
  date: string;
  boat: string;
  captain: string;
  naturalist: string;
  photographer: string;
  crew: string;
  guests: number;
  opened: number;
  downloaded: number;
  reviewAsks: number;
  reviewClicks: number;
};

export async function getDeliveryRows(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<DeliveryRow[]> {
  const [{ data: recRaw }, photographerNames] = await Promise.all([
    supabase
      .from("recipients")
      .select(
        "id, delivery_id, review_email_status, deliveries!inner(operator_id, created_at, trip_datetime, boat_name, captain_name, naturalist_name, photographer_name, crew_names)",
      )
      .eq("deliveries.operator_id", operatorId)
      .order("delivery_id", { ascending: false })
      .limit(100000),
    rosterPhotographers(supabase, operatorId),
  ]);
  const recipients = (recRaw ?? []) as unknown as (RecipientRow & {
    deliveries: RecipientRow["deliveries"] & { trip_datetime: string | null };
  })[];

  const opened = new Set<string>();
  const downloaded = new Set<string>();
  const reviewClicked = new Set<string>();
  const recipientIds = recipients.map((r) => r.id);
  for (const chunk of chunks(recipientIds, 500)) {
    const { data: evs } = await supabase
      .from("events")
      .select("recipient_id, type")
      .in("recipient_id", chunk);
    for (const e of evs ?? []) {
      if (e.type === "opened") opened.add(e.recipient_id as string);
      else if (e.type === "downloaded") downloaded.add(e.recipient_id as string);
      else if (e.type === "review_clicked") reviewClicked.add(e.recipient_id as string);
    }
  }

  type Agg = {
    date: string;
    boat: string;
    captain: string;
    naturalist: string;
    photographer: string;
    crew: string;
    guests: number;
    opened: number;
    downloaded: number;
    reviewAsks: number;
    reviewClicks: number;
  };
  const byDelivery = new Map<string, Agg>();
  for (const r of recipients) {
    const d = r.deliveries;
    let agg = byDelivery.get(r.delivery_id);
    if (!agg) {
      agg = {
        date: (d.trip_datetime ?? d.created_at).slice(0, 10),
        boat: d.boat_name?.trim() || NO_BOAT,
        captain: d.captain_name?.trim() || "",
        naturalist: d.naturalist_name?.trim() || "",
        // Same roster-role attribution as the on-page table, so the CSV
        // credits a captain who also shoots.
        photographer: photographersFor(d, photographerNames).join(" | "),
        crew: (d.crew_names ?? []).join(" | "),
        guests: 0,
        opened: 0,
        downloaded: 0,
        reviewAsks: 0,
        reviewClicks: 0,
      };
      byDelivery.set(r.delivery_id, agg);
    }
    agg.guests++;
    if (opened.has(r.id)) agg.opened++;
    if (downloaded.has(r.id)) agg.downloaded++;
    if (r.review_email_status === "sent") agg.reviewAsks++;
    if (reviewClicked.has(r.id)) agg.reviewClicks++;
  }

  return [...byDelivery.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}
