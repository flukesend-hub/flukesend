/*
  The instant review ask. Called (via next/server after) from every download
  path the moment a guest has their photos, which is when the ask converts
  best. The nightly cron stays as the safety net: it retries anything that
  fails here and picks up guests whose operator added review links late.

  Concurrency: a guest tapping ten photo downloads fires this ten times, so
  the status flip is an atomic claim (update ... where status = 'pending')
  and only the winner sends. On a failed send the claim is released so the
  cron retries.
*/
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReviewEmail, tripLine } from "@/lib/review-email";
import { brandLookFromRow } from "@/lib/brand-copy";
import { resolveAboardCrew } from "@/lib/crew";
import { sendEmail } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";

export async function sendReviewAskAfterDownload(
  recipientId: string,
  baseUrl: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: r } = await admin
    .from("recipients")
    .select("id, email, name, token, review_email_status, delivery_id")
    .eq("id", recipientId)
    .maybeSingle();
  if (!r || r.review_email_status !== "pending") {
    return;
  }

  const { data: delivery } = await admin
    .from("deliveries")
    .select("operator_id, trip_datetime, species, captain_name, naturalist_name, photographer_name, crew_names")
    .eq("id", r.delivery_id)
    .maybeSingle();
  if (!delivery) {
    return;
  }

  // Never spend the one ask on an email with no review buttons. Left pending,
  // the nightly sweep sends it once the operator adds a link.
  const { data: links } = await admin
    .from("review_destinations")
    .select("id, label, url, sort_order")
    .eq("operator_id", delivery.operator_id)
    .order("sort_order", { ascending: true });
  if (!links?.length) {
    return;
  }

  // Atomic claim: only one concurrent download wins the right to send.
  const { data: claimed } = await admin
    .from("recipients")
    .update({ review_email_status: "sent" })
    .eq("id", r.id)
    .eq("review_email_status", "pending")
    .select("id");
  if (!claimed?.length) {
    return;
  }

  const [{ data: operator }, { data: branding }] = await Promise.all([
    admin.from("operators").select("name").eq("id", delivery.operator_id).maybeSingle(),
    admin
      .from("branding")
      .select(
        "logo_url, brand_color, accent_color, header_text_color, font_key, text_tone, logo_align, copy_overrides, review_show_crew, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", delivery.operator_id)
      .maybeSingle(),
  ]);

  const showCrew = Boolean(branding?.review_show_crew);
  const crew = showCrew
    ? await resolveAboardCrew(admin, delivery.operator_id as string, delivery)
    : [];

  const trackedLinks = links.map((l) => ({
    label: l.label as string,
    href: `${baseUrl}/g/${r.token}/review?d=${l.id}`,
  }));
  const { subject, html } = buildReviewEmail({
    operatorName: operator?.name ?? "your crew",
    brandColor: branding?.brand_color ?? "#0b5563",
    ...brandLookFromRow(branding),
    logoUrl: branding?.logo_url ?? null,
    recipientName: (r.name as string | null) ?? null,
    tripLine: tripLine(delivery),
    tripDate: delivery.trip_datetime
      ? new Date(delivery.trip_datetime as string).toLocaleDateString("en-US", { dateStyle: "long" })
      : null,
    captainName: (delivery.captain_name as string | null) ?? null,
    species: (delivery.species ?? []) as string[],
    crew,
    showCrew,
    reviewLinks: trackedLinks,
    social: {
      website_url: branding?.website_url ?? null,
      facebook_url: branding?.facebook_url ?? null,
      instagram_url: branding?.instagram_url ?? null,
      tiktok_url: branding?.tiktok_url ?? null,
      youtube_url: branding?.youtube_url ?? null,
      x_url: branding?.x_url ?? null,
    },
  });

  const from = await resolveFromAddress(
    delivery.operator_id as string,
    operator?.name ?? "your crew",
  );
  const result = await sendEmail(
    r.email as string,
    subject,
    html,
    from,
    branding?.reply_to_email ?? null,
  );
  if (result.status === "sent" && result.ids[0]) {
    // Track the review email's id so the webhook can report a bounce of the
    // ask itself onto the guest row.
    const { error: idErr } = await admin
      .from("recipients")
      .update({ resend_email_id: result.ids[0] })
      .eq("id", r.id);
    if (idErr) {
      console.error(`instant review ask: storing resend id for ${r.id} failed: ${idErr.message}`);
    }
  }
  if (result.status !== "sent") {
    // Release the claim so the nightly sweep retries (covers both hard
    // failures and Resend not being configured).
    const { error: relErr } = await admin
      .from("recipients")
      .update({ review_email_status: "pending" })
      .eq("id", r.id);
    if (relErr) {
      console.error(
        `instant review ask: failed to release claim for recipient ${r.id}: ${relErr.message}`,
      );
    } else if (result.status === "error") {
      console.error(
        `instant review ask failed for recipient ${r.id}, released for cron retry`,
      );
    }
  }
}
