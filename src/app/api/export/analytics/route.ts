/*
  Analytics CSV export, full plans only (Offshore and Fleet). One row per send
  with its guest count, opens, downloads, and review asks. Reads go through the
  RLS server client, so the download only ever contains this operator's data.
*/
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getDeliveryRows } from "@/lib/analytics";

export const dynamic = "force-dynamic";

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
  const operatorId = membership.operator_id as string;

  const plan = PLANS[(await getPlan(supabase, operatorId)).tier];
  if (plan.analytics !== "full") {
    return new Response("CSV export is on the Offshore and Fleet plans.", { status: 403 });
  }

  const rows = await getDeliveryRows(supabase, operatorId);

  const header = [
    "trip_date",
    "boat",
    "captain",
    "naturalist",
    "photographer",
    "crew",
    "guests",
    "opened",
    "downloaded",
    "review_asks_sent",
    "review_clicks",
  ];
  const lines = [header.map(csvField).join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvField(r.date),
        csvField(r.boat),
        csvField(r.captain),
        csvField(r.naturalist),
        csvField(r.photographer),
        csvField(r.crew),
        csvField(String(r.guests)),
        csvField(String(r.opened)),
        csvField(String(r.downloaded)),
        csvField(String(r.reviewAsks)),
        csvField(String(r.reviewClicks)),
      ].join(","),
    );
  }
  // Lead with a BOM so Excel reads UTF-8 names correctly.
  const body = "﻿" + lines.join("\r\n") + "\r\n";

  const filename = `flukesend-analytics-${isoDate(new Date().toISOString())}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
