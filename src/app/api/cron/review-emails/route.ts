/*
  Review email sweep. The ask now goes out instantly on download
  (lib/review-ask.ts); this job is the safety net that retries failed sends
  and picks up guests whose operator added review links after the download.
  It finds recipients who downloaded, are still pending, and are past the
  delay window, sends each the branded ask, and flips the status to sent so
  nothing double fires.

  Until Resend is wired (no API key yet) the send is skipped and the recipient
  stays pending, so this is safe to schedule now: it reports who is due without
  sending or mutating anything. Once a domain is verified those same recipients
  send for real.
*/
import { cronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildReviewEmail,
  reviewDelayCutoffISO,
  tripLine,
} from "@/lib/review-email";
import { brandLookFromRow } from "@/lib/brand-copy";
import { sendEmail } from "@/lib/email";
import { type SocialLinks } from "@/lib/social";
import { resolveFromAddress } from "@/lib/sender-domain";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

type OperatorContext = {
  operatorName: string;
  from: string;
  brandColor: string;
  look: ReturnType<typeof brandLookFromRow>;
  logoUrl: string | null;
  tripLine: string;
  tripDate: string | null;
  captainName: string | null;
  species: string[];
  reviewLinks: { id: string; label: string; url: string }[];
  replyTo: string | null;
  social: SocialLinks;
};

export async function GET(request: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is
  // set. We require it so the endpoint is not openly triggerable.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not set", { status: 503 });
  }
  if (!cronAuthorized(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = reviewDelayCutoffISO();
  // The canonical origin, used to build the tracked review link back to this
  // app. Not request.url's origin: Vercel invokes crons on the deployment URL,
  // which guests cannot open (deployment protection). See base-url.ts.
  const baseUrl = CANONICAL_ORIGIN;

  // Pending recipients that have at least one downloaded event.
  const { data: recips, error } = await admin
    .from("recipients")
    .select("id, email, name, token, delivery_id, events!inner(type, occurred_at)")
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
        "operator_id, trip_datetime, species, captain_name",
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
      .select(
        "logo_url, brand_color, accent_color, header_text_color, font_key, text_tone, logo_align, copy_overrides, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", delivery.operator_id)
      .maybeSingle();
    const { data: links } = await admin
      .from("review_destinations")
      .select("id, label, url, sort_order")
      .eq("operator_id", delivery.operator_id)
      .order("sort_order", { ascending: true });

    const ctx: OperatorContext = {
      operatorName: operator?.name ?? "your crew",
      from: await resolveFromAddress(
        delivery.operator_id as string,
        operator?.name ?? "your crew",
      ),
      brandColor: branding?.brand_color ?? "#0b5563",
      look: brandLookFromRow(branding),
      logoUrl: branding?.logo_url ?? null,
      tripLine: tripLine(delivery),
      tripDate: delivery.trip_datetime
        ? new Date(delivery.trip_datetime as string).toLocaleDateString("en-US", { dateStyle: "long" })
        : null,
      captainName: (delivery.captain_name as string | null) ?? null,
      species: (delivery.species ?? []) as string[],
      reviewLinks: (links ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url })),
      replyTo: branding?.reply_to_email ?? null,
      social: {
        website_url: branding?.website_url ?? null,
        facebook_url: branding?.facebook_url ?? null,
        instagram_url: branding?.instagram_url ?? null,
        tiktok_url: branding?.tiktok_url ?? null,
        youtube_url: branding?.youtube_url ?? null,
        x_url: branding?.x_url ?? null,
      },
    };
    contextByDelivery.set(deliveryId, ctx);
    return ctx;
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let noLinks = 0;

  for (const r of eligible) {
    const ctx = await loadContext(r.delivery_id);
    if (!ctx) {
      errors++;
      continue;
    }
    // Each guest gets exactly one review ask, so never spend it on an email
    // with no review buttons. Leave the recipient pending: once the operator
    // adds a review link in settings, the next run sends the real thing.
    if (!ctx.reviewLinks.length) {
      noLinks++;
      continue;
    }
    // Route each button through the tracking redirect so a tap is logged. Fall
    // back to the raw url only if we somehow have no base url.
    const trackedLinks = ctx.reviewLinks.map((l) => ({
      label: l.label,
      href: baseUrl ? `${baseUrl}/g/${r.token}/review?d=${l.id}` : l.url,
    }));
    const { subject, html } = buildReviewEmail({
      operatorName: ctx.operatorName,
      brandColor: ctx.brandColor,
      ...ctx.look,
      logoUrl: ctx.logoUrl,
      recipientName: r.name,
      tripLine: ctx.tripLine,
      tripDate: ctx.tripDate,
      captainName: ctx.captainName,
      species: ctx.species,
      reviewLinks: trackedLinks,
      social: ctx.social,
    });
    const result = await sendEmail(
      r.email,
      subject,
      html,
      ctx.from,
      ctx.replyTo,
    );
    if (result.status === "sent") {
      await admin
        .from("recipients")
        .update({ review_email_status: "sent", resend_email_id: result.ids[0] ?? null })
        .eq("id", r.id);
      sent++;
    } else if (result.status === "skipped") {
      // Resend not configured. Leave pending so it sends once wired.
      skipped++;
    } else {
      // Transient send failure. Leave pending to retry on the next run.
      console.error(
        `review email failed for recipient ${r.id}: ${"error" in result ? result.error : "unknown"}`,
      );
      errors++;
    }
  }

  if (noLinks) {
    console.error(
      `review cron: ${noLinks} eligible recipient(s) held because their operator has no review links configured`,
    );
  }

  return Response.json({
    eligible: eligible.length,
    sent,
    skipped,
    errors,
    noLinks,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
  });
}
