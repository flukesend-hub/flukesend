/*
  The one place that talks to Resend. Both the gallery delivery email and the
  nightly review email send through here. Gated on RESEND_API_KEY: with no key
  it returns "skipped" instead of sending, so the rest of the app runs fine
  before email is wired.
*/
import "server-only";

export type SendResult =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "error"; error: string };

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromAddress?: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { status: "skipped" };
  }

  const from =
    fromAddress ||
    process.env.REVIEW_FROM_EMAIL ||
    "Flukesend <reviews@flukesend.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { status: "error", error: `${res.status} ${body.slice(0, 200)}` };
    }
    return { status: "sent" };
  } catch (e) {
    return {
      status: "error",
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
