/*
  Reconcile late QR sign-ups. Guests sometimes scan the capture QR after their
  trip, once the send for that trip has already gone out, so their captured_guests
  row never gets consumed and they never receive their gallery. This sweep, for
  PAST trips only, heals that:

  - If the captured email was already reached for that same trip, the row is just
    redundant, so it is consumed (no email).
  - Otherwise, if exactly one send exists for that trip (date and departure time),
    the guest is added to it and emailed their gallery, then the row is consumed.
  - Anything with no matching send, several matching sends, or an expired gallery
    is left for a manual "Send now" and reported.

  Today and future trips are never touched: a guest signing up now, before the
  operator has created today's send, is simply pending and must stay that way.

  ?dry=1 reports what it would do without adding recipients, sending, or consuming.
  ?operator=<id> scopes the run to one operator (used for a one time backfill).
  Bearer CRON_SECRET, same as the other crons.
*/
import { cronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { brandLookFromRow } from "@/lib/brand-copy";
import { incrementRecipientsUsed } from "@/lib/usage";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

export const maxDuration = 300;

type OperatorCtx = {
  operatorName: string;
  from: string;
  brandColor: string;
  look: ReturnType<typeof brandLookFromRow>;
  logoUrl: string | null;
  retentionDays: number;
  defaultMessage: string;
  replyTo: string | null;
  social: Record<string, string | null>;
};

function utcDate(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10);
}
function utcHHMM(ts: string): string {
  return new Date(ts).toISOString().slice(11, 16);
}
function fmtTripDate(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET not set", { status: 503 });
  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const onlyOperator = url.searchParams.get("operator");
  // Not request.url's origin: Vercel invokes crons on the deployment URL,
  // which guests cannot open (deployment protection). See base-url.ts.
  const baseUrl = CANONICAL_ORIGIN;
  const admin = createAdminClient();
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10); // UTC date; never touch >= today

  const summary = {
    dry,
    scanned: 0,
    consumedRedundant: 0,
    recovered: 0,
    skippedExpired: 0,
    needsManual: 0,
    errors: [] as string[],
    recoveredList: [] as string[],
    manualList: [] as string[],
  };

  // Everything runs inside one guard: a single bad row, or an unexpected throw
  // anywhere, is reported as JSON instead of collapsing the whole sweep into a
  // bare 500. The sweep is idempotent (consumed rows are skipped next time), so
  // returning a partial summary and letting the next run finish is safe.
  try {
  // Un-consumed captures for past trips only.
  let query = admin
    .from("captured_guests")
    .select("id, operator_id, email, name, trip_date, trip_time")
    .is("consumed_at", null)
    .lt("trip_date", today)
    .not("trip_date", "is", null);
  if (onlyOperator) query = query.eq("operator_id", onlyOperator);
  const { data: caps, error } = await query;
  if (error) {
    summary.errors.push(`scan failed: ${error.message}`);
    return Response.json(summary);
  }
  summary.scanned = caps?.length ?? 0;

  const ctxCache = new Map<string, OperatorCtx>();
  async function loadCtx(operatorId: string): Promise<OperatorCtx> {
    const cached = ctxCache.get(operatorId);
    if (cached) return cached;
    const [{ data: operator }, { data: branding }] = await Promise.all([
      admin.from("operators").select("name").eq("id", operatorId).maybeSingle(),
      admin
        .from("branding")
        .select("retention_days, brand_color, accent_color, header_text_color, font_key, copy_overrides, logo_url, default_message, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url")
        .eq("operator_id", operatorId)
        .maybeSingle(),
    ]);
    const name = (operator?.name as string) ?? "your crew";
    const ctx: OperatorCtx = {
      operatorName: name,
      from: await resolveFromAddress(operatorId, name),
      brandColor: (branding?.brand_color as string) ?? "#0b5563",
      look: brandLookFromRow(branding),
      logoUrl: (branding?.logo_url as string | null) ?? null,
      retentionDays: (branding?.retention_days as number | null) ?? 7,
      defaultMessage: (branding?.default_message as string | null) ?? "",
      replyTo: (branding?.reply_to_email as string | null) ?? null,
      social: {
        website_url: (branding?.website_url as string | null) ?? null,
        facebook_url: (branding?.facebook_url as string | null) ?? null,
        instagram_url: (branding?.instagram_url as string | null) ?? null,
        tiktok_url: (branding?.tiktok_url as string | null) ?? null,
        youtube_url: (branding?.youtube_url as string | null) ?? null,
        x_url: (branding?.x_url as string | null) ?? null,
      },
    };
    ctxCache.set(operatorId, ctx);
    return ctx;
  }

  for (const cap of caps ?? []) {
   try {
    const operatorId = cap.operator_id as string;
    const email = (cap.email as string).toLowerCase();
    const tripDate = cap.trip_date as string;
    const tripTime = cap.trip_time as string | null;

    // 1. Already reached for THIS trip? Then the row is redundant, consume it.
    const { data: reached, error: reachedErr } = await admin
      .from("recipients")
      .select("id, deliveries!inner(operator_id, trip_datetime)")
      .eq("deliveries.operator_id", operatorId)
      .ilike("email", email);
    if (reachedErr) {
      // Cannot tell if the guest was already reached, so do not risk a duplicate
      // send. Leave the row for the next run and report it.
      summary.errors.push(`reached lookup failed for ${email} (${tripDate}): ${reachedErr.message}`);
      continue;
    }
    const reachedThisTrip = (reached ?? []).some((r) => {
      const dt = (r as unknown as { deliveries: { trip_datetime: string | null } }).deliveries?.trip_datetime;
      return dt ? utcDate(dt) === tripDate : false;
    });
    if (reachedThisTrip) {
      if (!dry) {
        await admin.from("captured_guests").update({ consumed_at: new Date().toISOString() }).eq("id", cap.id);
      }
      summary.consumedRedundant++;
      continue;
    }

    if (!tripTime) {
      summary.needsManual++;
      summary.manualList.push(`${email} (${tripDate}, no trip time)`);
      continue;
    }

    // 2. Find the send that matches this trip's date and departure time.
    const dayStart = `${tripDate}T00:00:00.000Z`;
    const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: dels, error: delsErr } = await admin
      .from("deliveries")
      .select("id, trip_datetime, expires_at, species, captain_name, naturalist_name, photographer_name, custom_message")
      .eq("operator_id", operatorId)
      .gte("trip_datetime", dayStart)
      .lt("trip_datetime", dayEnd);
    if (delsErr) {
      summary.errors.push(`send lookup failed for ${email} (${tripDate} ${tripTime}): ${delsErr.message}`);
      continue;
    }
    const matches = (dels ?? []).filter((d) => d.trip_datetime && utcHHMM(d.trip_datetime as string) === tripTime);
    if (matches.length !== 1) {
      summary.needsManual++;
      summary.manualList.push(`${email} (${tripDate} ${tripTime}, ${matches.length} matching sends)`);
      continue;
    }
    const delivery = matches[0];

    // Do not email a dead gallery: an expired send needs a fresh send, not a
    // recovery link. Leave it for manual handling.
    if (delivery.expires_at && new Date(delivery.expires_at as string).getTime() < now) {
      summary.skippedExpired++;
      summary.manualList.push(`${email} (${tripDate} ${tripTime}, gallery expired)`);
      continue;
    }

    if (dry) {
      summary.recovered++;
      summary.recoveredList.push(`${email} -> ${tripDate} ${tripTime}`);
      continue;
    }

    // Add the guest to the matching send, email their gallery, consume the row.
    const { data: inserted, error: insErr } = await admin
      .from("recipients")
      .insert({ delivery_id: delivery.id, email, name: (cap.name as string | null) ?? null })
      .select("id, token")
      .single();
    if (insErr || !inserted) {
      summary.errors.push(`insert failed for ${email}: ${insErr?.message ?? "no row"}`);
      continue;
    }

    const ctx = await loadCtx(operatorId);
    const { subject, html } = buildDeliveryEmail({
      operatorName: ctx.operatorName,
      brandColor: ctx.brandColor,
      ...ctx.look,
      logoUrl: ctx.logoUrl,
      retentionDays: ctx.retentionDays,
      recipientName: (cap.name as string | null) ?? null,
      tripDate: fmtTripDate(delivery.trip_datetime as string | null),
      captainName: delivery.captain_name as string | null,
      naturalistName: delivery.naturalist_name as string | null,
      photographerName: delivery.photographer_name as string | null,
      species: (delivery.species ?? []) as string[],
      message: (delivery.custom_message as string | null) || ctx.defaultMessage || "",
      galleryUrl: `${baseUrl}/g/${inserted.token}`,
      social: ctx.social,
    });
    const result = await sendEmail(email, subject, html, ctx.from, ctx.replyTo);
    if (result.status === "sent") {
      await admin.from("recipients").update({ resend_email_id: result.ids[0] ?? null }).eq("id", inserted.id);
    } else if (result.status === "error") {
      summary.errors.push(`send failed for ${email}: ${result.error}`);
    }
    await incrementRecipientsUsed(operatorId, 1);

    // Consume every past-trip un-consumed row for this email so a guest is not
    // recovered twice from a second late scan.
    await admin
      .from("captured_guests")
      .update({ consumed_at: new Date().toISOString() })
      .eq("operator_id", operatorId)
      .is("consumed_at", null)
      .lt("trip_date", today)
      .ilike("email", email);

    summary.recovered++;
    summary.recoveredList.push(email);
   } catch (rowErr) {
     // One bad row never kills the sweep. Report it and move on; the row stays
     // un-consumed, so the next run retries it.
     const who = `${(cap.email as string) ?? "?"} (${(cap.trip_date as string) ?? "?"})`;
     summary.errors.push(`row failed for ${who}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`);
   }
  }

  return Response.json(summary);
  } catch (err) {
    // Anything unexpected surfaces as readable JSON, not a bare 500, so the run
    // can be diagnosed. Partial progress above is preserved in the summary.
    summary.errors.push(`sweep failed: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json(summary);
  }
}
