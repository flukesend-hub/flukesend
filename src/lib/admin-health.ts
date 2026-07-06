/*
  Per operator health and onboarding gaps for the admin support console. Runs a
  handful of cross operator aggregates with the service role client (admin spans
  every operator). Every read that can grow past 1000 rows pages through
  fetchAllRows, since this rollup covers the whole fleet and blows past the
  PostgREST row cap far sooner than any single operator's own dashboard.

  Health is the current calendar month (UTC), matching the operator's own
  analytics funnel. Gaps are existence checks: the loud one is an operator who
  is sending but has no review links, so photos go out and no review can ever
  fire, the silent failure that churns a pilot who thinks it does not work.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows, loadEventsForRecipients } from "@/lib/db-page";

export type OperatorHealth = {
  totalSends: number;
  sendsThisMonth: number;
  lastSendAt: string | null;
  reached: number;
  downloaded: number;
  reviewClicks: number;
  bounced: number;
  hasReviewLinks: boolean;
  hasLogo: boolean;
  hasCrew: boolean;
};

export function emptyHealth(): OperatorHealth {
  return {
    totalSends: 0,
    sendsThisMonth: 0,
    lastSendAt: null,
    reached: 0,
    downloaded: 0,
    reviewClicks: 0,
    bounced: 0,
    hasReviewLinks: false,
    hasLogo: false,
    hasCrew: false,
  };
}

type DeliveryRow = { id: string; operator_id: string; created_at: string };
type RecipientRow = {
  id: string;
  email_status: string | null;
  deliveries: { operator_id: string };
};
type OpIdRow = { operator_id: string };
type BrandRow = { operator_id: string; logo_url: string | null };

export async function getOperatorHealth(
  admin: SupabaseClient,
): Promise<Map<string, OperatorHealth>> {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  const [deliveries, recipients, dests, brandings, crews] = await Promise.all([
    fetchAllRows<DeliveryRow>((from, to) =>
      admin.from("deliveries").select("id, operator_id, created_at").order("id").range(from, to),
    ),
    fetchAllRows<RecipientRow>((from, to) =>
      admin
        .from("recipients")
        .select("id, email_status, deliveries!inner(operator_id, created_at)")
        .gte("deliveries.created_at", monthStart)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<OpIdRow>((from, to) =>
      admin.from("review_destinations").select("operator_id").order("operator_id").range(from, to),
    ),
    fetchAllRows<BrandRow>((from, to) =>
      admin.from("branding").select("operator_id, logo_url").order("operator_id").range(from, to),
    ),
    fetchAllRows<OpIdRow>((from, to) =>
      admin.from("crew_members").select("operator_id").order("operator_id").range(from, to),
    ),
  ]);

  const health = new Map<string, OperatorHealth>();
  const ensure = (id: string): OperatorHealth => {
    let h = health.get(id);
    if (!h) {
      h = emptyHealth();
      health.set(id, h);
    }
    return h;
  };

  // Deliveries: lifetime count, this month count, most recent send.
  for (const d of deliveries) {
    const h = ensure(d.operator_id);
    h.totalSends++;
    if (!h.lastSendAt || d.created_at > h.lastSendAt) h.lastSendAt = d.created_at;
    if (d.created_at >= monthStart) h.sendsThisMonth++;
  }

  // This month recipients: reached is everyone emailed minus known bounces, so
  // it lines up with the operator's own funnel. Also map recipient to operator
  // so the event pass can attribute downloads and review clicks.
  const recipientOperator = new Map<string, string>();
  for (const r of recipients) {
    const opId = r.deliveries.operator_id;
    recipientOperator.set(r.id, opId);
    const h = ensure(opId);
    if (r.email_status === "bounced") h.bounced++;
    else h.reached++;
  }

  // Distinct downloaders and review clickers per operator this month.
  const downloadedByOp = new Map<string, Set<string>>();
  const reviewByOp = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, op: string, rid: string) => {
    let set = m.get(op);
    if (!set) {
      set = new Set();
      m.set(op, set);
    }
    set.add(rid);
  };
  for (const e of await loadEventsForRecipients(admin, [...recipientOperator.keys()])) {
    const opId = recipientOperator.get(e.recipient_id);
    if (!opId) continue;
    if (e.type === "downloaded") add(downloadedByOp, opId, e.recipient_id);
    else if (e.type === "review_clicked") add(reviewByOp, opId, e.recipient_id);
  }
  for (const [opId, set] of downloadedByOp) ensure(opId).downloaded = set.size;
  for (const [opId, set] of reviewByOp) ensure(opId).reviewClicks = set.size;

  // Onboarding gap signals.
  for (const d of dests) ensure(d.operator_id).hasReviewLinks = true;
  for (const b of brandings) if (b.logo_url?.trim()) ensure(b.operator_id).hasLogo = true;
  for (const c of crews) ensure(c.operator_id).hasCrew = true;

  return health;
}
