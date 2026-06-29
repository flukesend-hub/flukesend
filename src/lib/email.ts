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

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { status: "skipped" };
  }

  const from =
    process.env.REVIEW_FROM_EMAIL || "Flukesend <reviews@flukesend.com>";
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
