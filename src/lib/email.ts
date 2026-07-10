/*
  The one place that talks to Resend. Both the gallery delivery email and the
  nightly review email send through here. Gated on RESEND_API_KEY: with no key
  it returns "skipped" instead of sending, so the rest of the app runs fine
  before email is wired.
*/
import "server-only";

// escapeHtml lives in lib/html (client safe, used by the branding previews
// too); re-exported here so the many existing imports keep working.
export { escapeHtml } from "@/lib/html";

// On success, ids are the Resend email ids in send order (one for a single
// send, one per message for a batch). The webhook uses them to report what
// happened to each email after we hand it off.
export type SendResult =
  | { status: "sent"; ids: (string | null)[] }
  | { status: "skipped" }
  | { status: "error"; error: string };

// White label the From header so guests see the operator, not Flukesend. The
// company name is the display name and a slug of it is the local part at our
// verified sending domain (Enocean Tours becomes
// "Enocean Tours" <enoceantours@flukesend.com>). The domain stays flukesend.com
// because that is the Resend verified sender; a per operator custom domain is a
// later upgrade. Falls back to a neutral local part when the name has no usable
// characters.
const FROM_DOMAIN = "flukesend.com";

export function operatorFromAddress(operatorName: string): string {
  const name = (operatorName || "").trim() || "Your crew";
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) || "crew";
  const display = name.replace(/["\\\r\n]/g, " ").trim();
  return `"${display}" <${slug}@${FROM_DOMAIN}>`;
}

// Resend throttles at roughly 2 requests per second and returns 429 over
// that. Rate limited and 5xx responses are worth retrying; anything else
// (bad address, bad payload) is not.
function retryable(status: number) {
  return status === 429 || status >= 500;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postResend(
  path: string,
  key: string,
  body: unknown,
  label: string,
): Promise<SendResult> {
  let lastError = "send failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await wait(attempt * 1000);
    }
    try {
      const res = await fetch(`https://api.resend.com${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Single send responds { id }, batch responds { data: [{ id }, ...] }
        // in message order. Ids are best effort; a parse failure never turns
        // a delivered send into an error.
        let ids: (string | null)[] = [];
        try {
          const json = (await res.json()) as { id?: string; data?: { id?: string }[] };
          ids = json.data ? json.data.map((d) => d.id ?? null) : [json.id ?? null];
        } catch {
          ids = [];
        }
        return { status: "sent", ids };
      }
      const text = await res.text();
      lastError = `${res.status} ${text.slice(0, 200)}`;
      if (!retryable(res.status)) {
        break;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "send failed";
    }
  }
  console.error(`Resend ${path} failed for ${label}: ${lastError}`);
  return { status: "error", error: lastError };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromAddress?: string,
  replyTo?: string | null,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { status: "skipped" };
  }

  const from =
    fromAddress ||
    process.env.REVIEW_FROM_EMAIL ||
    "Flukesend <reviews@flukesend.com>";
  // Route replies to the operator's own inbox (the email they signed up with),
  // so a guest who hits reply reaches the operator, not our send only address.
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) {
    payload.reply_to = replyTo;
  }
  return postResend("/emails", key, payload, to);
}

export type BatchEmail = { to: string; subject: string; html: string };

// One batch call delivers up to 100 emails and counts as a single request
// against the rate limit, so a full boat of guests goes out in one shot
// instead of a burst of per guest calls that trip the 2 per second cap.
export async function sendEmailBatch(
  emails: BatchEmail[],
  fromAddress: string,
  replyTo?: string | null,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { status: "skipped" };
  }
  if (!emails.length) {
    return { status: "sent", ids: [] };
  }
  const payload = emails.map((e) => {
    const item: Record<string, unknown> = {
      from: fromAddress,
      to: e.to,
      subject: e.subject,
      html: e.html,
    };
    if (replyTo) {
      item.reply_to = replyTo;
    }
    return item;
  });
  return postResend("/emails/batch", key, payload, `batch of ${emails.length}`);
}
