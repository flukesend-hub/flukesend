/*
  Expiring-soon reminders. Daily sweep for recipients whose gallery closes
  within the window, who never downloaded, and who have not been nudged before.
  One reminder per guest, ever. Every recovered download fires the instant
  review ask downstream, so this cron directly feeds the review engine.

  Eligibility, all of which must hold:
  - delivery expires within REMINDER_WINDOW_HOURS but has not expired yet
  - the recipient has no downloaded event
  - reminder_sent_at is null (never double nudge)
  - the email did not bounce (never nudge a dead address)
  - the operator is on the paid plan (which includes the reminder)

  ?dry=1 reports who would be nudged without sending anything.
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/cron-auth";
import { fetchAllRows } from "@/lib/db-page";
import { sendEmail } from "@/lib/email";
import { buildReminderEmail } from "@/lib/reminder-email";
import { brandLookFromRow } from "@/lib/brand-copy";
import { resolveFromAddress } from "@/lib/sender-domain";
import { PLANS } from "@/lib/plans";
import { CANONICAL_ORIGIN } from "@/lib/base-url";
import { t, asLocale } from "@/lib/i18n";

export const maxDuration = 300;

const REMINDER_WINDOW_HOURS = 36;

type OperatorContext = {
  allowed: boolean;
  operatorName: string;
  from: string;
  brandColor: string;
  look: ReturnType<typeof brandLookFromRow>;
  logoUrl: string | null;
  replyTo: string | null;
  social: Record<string, string | null>;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not set", { status: 503 });
  }
  if (!cronAuthorized(request, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  // Not request.url's origin: Vercel invokes crons on the deployment URL,
  // which guests cannot open (deployment protection). See base-url.ts.
  const baseUrl = CANONICAL_ORIGIN;

  const admin = createAdminClient();
  const now = Date.now();
  const windowEnd = new Date(now + REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const summary = {
    dry,
    deliveriesInWindow: 0,
    eligible: 0,
    sent: 0,
    skippedPlan: 0,
    skippedBounced: 0,
    errors: [] as string[],
    wouldRemind: [] as string[],
  };

  // Galleries closing soon but still open.
  const { data: dels, error: dErr } = await admin
    .from("deliveries")
    .select("id, operator_id, expires_at")
    .gt("expires_at", new Date(now).toISOString())
    .lte("expires_at", windowEnd)
    .is("cleaned_at", null)
    .limit(500);
  if (dErr) {
    return Response.json({ error: dErr.message }, { status: 500 });
  }
  summary.deliveriesInWindow = dels?.length ?? 0;
  if (!dels?.length) {
    return Response.json(summary);
  }

  // Operator context, cached per operator: plan gate, branding, from header.
  const ctxByOperator = new Map<string, OperatorContext>();
  async function loadContext(operatorId: string): Promise<OperatorContext> {
    const cached = ctxByOperator.get(operatorId);
    if (cached) return cached;
    const [{ data: sub }, { data: operator }, { data: branding }] = await Promise.all([
      admin.from("subscriptions").select("tier").eq("operator_id", operatorId).maybeSingle(),
      admin.from("operators").select("name").eq("id", operatorId).maybeSingle(),
      admin
        .from("branding")
        .select(
          "logo_url, brand_color, accent_color, header_text_color, font_key, text_tone, logo_align, guest_locale, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
        )
        .eq("operator_id", operatorId)
        .maybeSingle(),
    ]);
    // One paid plan, which includes reminders. Operators actually on it have a
    // tier set; trials and canceled (null tier) do not, and stay excluded.
    const onPlan = Boolean(sub?.tier);
    const name = operator?.name ?? "your crew";
    const ctx: OperatorContext = {
      allowed: onPlan && PLANS.fleet.expiryReminder,
      operatorName: name,
      from: await resolveFromAddress(operatorId, name),
      brandColor: branding?.brand_color ?? "#0b5563",
      look: brandLookFromRow(branding),
      logoUrl: branding?.logo_url ?? null,
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
    ctxByOperator.set(operatorId, ctx);
    return ctx;
  }

  for (const d of dels) {
    // Guests on this delivery who were never nudged.
    const { data: recips, error: rErr } = await admin
      .from("recipients")
      .select("id, email, name, token, email_status")
      .eq("delivery_id", d.id)
      .is("reminder_sent_at", null);
    if (rErr) {
      summary.errors.push(`recipients query failed for ${d.id}: ${rErr.message}`);
      continue;
    }
    if (!recips?.length) continue;

    // Who already downloaded. Paged past the 1000 row cap: every photo
    // download is its own event, so a big delivery's downloaders can clear
    // 1000 rows, and a truncated read would nudge guests who already saved
    // their photos. On a failed page, skip the delivery rather than risk
    // that; tomorrow's run retries.
    let downloaded: Set<string>;
    try {
      const evs = await fetchAllRows<{ id: string; recipient_id: string }>((from, to) =>
        admin
          .from("events")
          .select("id, recipient_id")
          .eq("type", "downloaded")
          .in("recipient_id", recips.map((r) => r.id))
          .order("id")
          .range(from, to),
      );
      downloaded = new Set(evs.map((e) => e.recipient_id));
    } catch (e) {
      summary.errors.push(
        `events query failed for ${d.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    const pending = recips.filter((r) => !downloaded.has(r.id));
    if (!pending.length) continue;

    const ctx = await loadContext(d.operator_id as string);
    if (!ctx.allowed) {
      summary.skippedPlan += pending.length;
      continue;
    }

    // "today" when the gallery closes within 24h, "tomorrow" otherwise,
    // rendered in the operator's guest language.
    const locale = asLocale(ctx.look.guestLocale);
    const hoursLeft = (new Date(d.expires_at as string).getTime() - now) / 3600000;
    const isToday = hoursLeft <= 24;
    const expiresWhen = t(locale, isToday ? "time.today" : "time.tomorrow");

    for (const r of pending) {
      if (r.email_status === "bounced" || r.email_status === "complained") {
        summary.skippedBounced++;
        continue;
      }
      summary.eligible++;
      if (dry) {
        summary.wouldRemind.push(`${r.email} (${ctx.operatorName}, expires ${expiresWhen})`);
        continue;
      }

      const { subject, html } = buildReminderEmail({
        operatorName: ctx.operatorName,
        brandColor: ctx.brandColor,
        ...ctx.look,
        logoUrl: ctx.logoUrl,
        recipientName: (r.name as string | null) ?? null,
        expiresWhen,
        galleryUrl: `${baseUrl}/g/${r.token}`,
        social: ctx.social,
      });
      const result = await sendEmail(r.email as string, subject, html, ctx.from, ctx.replyTo);
      if (result.status === "sent") {
        const { error: upErr } = await admin
          .from("recipients")
          .update({
            reminder_sent_at: new Date().toISOString(),
            resend_email_id: result.ids[0] ?? null,
          })
          .eq("id", r.id);
        if (upErr) {
          summary.errors.push(`stamp failed for ${r.id}: ${upErr.message}`);
        }
        summary.sent++;
      } else if (result.status === "error") {
        // Left unstamped, retried on the next run while still in window.
        summary.errors.push(`send failed for ${r.id}: ${result.error}`);
      }
    }
  }

  for (const e of summary.errors) {
    console.error(`expiry reminders: ${e}`);
  }
  return Response.json(summary);
}
