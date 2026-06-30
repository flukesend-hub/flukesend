/*
  Nightly review email job. Vercel Cron calls this on an evening cadence. It
  finds recipients who downloaded their photos, are still pending, and are past
  the delay window, sends each the operator's branded review ask, and flips the
  status to sent so nothing double fires.

  Until Resend is wired (no API key yet) the send is skipped and the recipient
  stays pending, so this is safe to schedule now: it reports who is due without
  sending or mutating anything. Once a domain is verified those same recipients
  send for real.
*/
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildReviewEmail,
  reviewDelayCutoffISO,
  sendReviewEmail,
} from "@/lib/review-email";

type OperatorContext = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  tripLine: string;
  reviewLinks: { label: string; url: string }[];
  replyTo: string | null;
};

function tripLine(d: {
  trip_datetime: string | null;
  whale_count: number | null;
  species: string[] | null;
  captain_name: string | null;
}) {
  const parts: string[] = [];
  if (d.trip_datetime) {
    parts.push(
      new Date(d.trip_datetime).toLocaleDateString("en-US", { dateStyle: "long" }),
    );
  }
  if (d.captain_name) parts.push(`with Captain ${d.captain_name}`);
  const wildlife: string[] = [];
  if (d.whale_count != null)
    wildlife.push(`${d.whale_count} whale${d.whale_count === 1 ? "" : "s"}`);
  if (d.species?.length) wildlife.push(d.species.join(", "));
  let line = parts.join(" ");
  if (wildlife.length) line += (line ? ". " : "") + wildlife.join(", ");
  return line;
}

export async function GET(request: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is
  // set. We require it so the endpoint is not openly triggerable.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not set", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = reviewDelayCutoffISO();

  // Pending recipients that have at least one downloaded event.
  const { data: recips, error } = await admin
    .from("recipients")
    .select("id, email, name, delivery_id, events!inner(type, occurred_at)")
    .eq("review_email_status", "pending")
    .eq("events.type", "downloaded");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Eligible: earliest download is older than the delay window.
  const eligible = (recips ?? []).filter((r) => {
    const downloads = (r.events as { type: string; occurred_at: string }[]).filter(
      (e) => e.type === "downloaded",
    );
    if (!downloads.length) return false;
    const earliest = downloads.reduce(
      (min, e) => (e.occurred_at < min ? e.occurred_at : min),
      downloads[0].occurred_at,
    );
    return earliest <= cutoff;
  });

  const contextByDelivery = new Map<string, OperatorContext | null>();
  async function loadContext(deliveryId: string): Promise<OperatorContext | null> {
    if (contextByDelivery.has(deliveryId)) {
      return contextByDelivery.get(deliveryId)!;
    }
    const { data: delivery } = await admin
      .from("deliveries")
      .select(
        "operator_id, trip_datetime, whale_count, species, captain_name",
      )
      .eq("id", deliveryId)
      .maybeSingle();
    if (!delivery) {
      contextByDelivery.set(deliveryId, null);
      return null;
    }
    const { data: operator } = await admin
      .from("operators")
      .select("name")
      .eq("id", delivery.operator_id)
      .maybeSingle();
    const { data: branding } = await admin
      .from("branding")
      .select("logo_url, brand_color, reply_to_email")
      .eq("operator_id", delivery.operator_id)
      .maybeSingle();
    const { data: links } = await admin
      .from("review_destinations")
      .select("label, url, sort_order")
      .eq("operator_id", delivery.operator_id)
      .order("sort_order", { ascending: true });

    const ctx: OperatorContext = {
      operatorName: operator?.name ?? "your crew",
      brandColor: branding?.brand_color ?? "#0b5563",
      logoUrl: branding?.logo_url ?? null,
      tripLine: tripLine(delivery),
      reviewLinks: (links ?? []).map((l) => ({ label: l.label, url: l.url })),
      replyTo: branding?.reply_to_email ?? null,
    };
    contextByDelivery.set(deliveryId, ctx);
    return ctx;
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of eligible) {
    const ctx = await loadContext(r.delivery_id);
    if (!ctx) {
      errors++;
      continue;
    }
    const { subject, html } = buildReviewEmail({
      operatorName: ctx.operatorName,
      brandColor: ctx.brandColor,
      logoUrl: ctx.logoUrl,
      recipientName: r.name,
      tripLine: ctx.tripLine,
      reviewLinks: ctx.reviewLinks,
    });
    const result = await sendReviewEmail(
      r.email,
      subject,
      html,
      ctx.operatorName,
      ctx.replyTo,
    );
    if (result.status === "sent") {
      await admin
        .from("recipients")
        .update({ review_email_status: "sent" })
        .eq("id", r.id);
      sent++;
    } else if (result.status === "skipped") {
      // Resend not configured. Leave pending so it sends once wired.
      skipped++;
    } else {
      // Transient send failure. Leave pending to retry on the next run.
      errors++;
    }
  }

  return Response.json({
    eligible: eligible.length,
    sent,
    skipped,
    errors,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
  });
}
