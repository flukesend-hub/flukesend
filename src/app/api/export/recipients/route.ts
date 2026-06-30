/*
  Guest email export. An operator clicks Export in the Transfers drawer and this
  hands back a CSV of every guest they have ever sent photos to, ready to drop
  into a marketing email tool.

  Reads go through the RLS server client, so the download only ever contains the
  signed in operator's own recipients. Rows are deduplicated by email so the
  operator gets one contact per guest, with a trip count and the most recent
  trip date alongside it.
*/
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  email: string;
  name: string | null;
  created_at: string;
  deliveries: {
    trip_datetime: string | null;
    created_at: string;
  } | null;
};

type Contact = {
  email: string;
  name: string | null;
  trips: number;
  lastTrip: string; // ISO timestamp of the most recent trip
};

// Wrap a field for CSV: always quote, and double any embedded quotes. Quoting
// every field keeps commas, line breaks, and stray quotes in names safe.
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function isoDate(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Not signed in.", { status: 401 });
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return new Response("No operator.", { status: 403 });
  }

  // RLS already scopes recipients to this operator's deliveries; the inner join
  // and operator filter make that explicit and drop any orphaned rows.
  const { data, error } = await supabase
    .from("recipients")
    .select("email, name, created_at, deliveries!inner(operator_id, trip_datetime, created_at)")
    .eq("deliveries.operator_id", membership.operator_id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    return new Response("Could not build the export.", { status: 500 });
  }

  // Deduplicate by lowercased email. Keep the first name we see (rows come
  // newest first, so that is the most recent), count trips, and track the
  // latest trip date across all of a guest's sends.
  const byEmail = new Map<string, Contact>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const email = r.email.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    const tripTs = r.deliveries?.trip_datetime ?? r.deliveries?.created_at ?? r.created_at;

    const existing = byEmail.get(key);
    if (existing) {
      existing.trips += 1;
      if (new Date(tripTs) > new Date(existing.lastTrip)) {
        existing.lastTrip = tripTs;
      }
    } else {
      byEmail.set(key, {
        email,
        name: r.name?.trim() || null,
        trips: 1,
        lastTrip: tripTs,
      });
    }
  }

  const contacts = [...byEmail.values()].sort(
    (a, b) => new Date(b.lastTrip).getTime() - new Date(a.lastTrip).getTime(),
  );

  const header = ["email", "name", "trips", "last_trip"];
  const lines = [header.map(csvField).join(",")];
  for (const c of contacts) {
    lines.push(
      [
        csvField(c.email),
        csvField(c.name ?? ""),
        csvField(String(c.trips)),
        csvField(isoDate(c.lastTrip)),
      ].join(","),
    );
  }
  // Lead with a BOM so Excel reads the UTF-8 names correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";

  const filename = `flukesend-guest-emails-${isoDate(new Date().toISOString())}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
