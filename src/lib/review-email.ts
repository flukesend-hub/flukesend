/*
  The branded review ask. Built and sent server side by the nightly job. The
  actual send goes through Resend, which is wired only once a sending domain is
  verified, so sendReviewEmail returns "skipped" when no API key is set. That
  keeps the job safe to run early: it finds who is due without sending or
  marking anything, and the same recipients send for real once Resend is live.

  No review gating: every guest who downloads gets asked, and the tip jar (when
  it exists) stays separate from these buttons, per the FTC rules in the spec.
*/
import "server-only";

// How long after a download we wait before asking for a review. The job only
// picks up recipients whose earliest download is older than this.
export const REVIEW_DELAY_HOURS = 3;

export function reviewDelayCutoffISO(now: number = Date.now()) {
  return new Date(now - REVIEW_DELAY_HOURS * 60 * 60 * 1000).toISOString();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ReviewEmailInput = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  recipientName: string | null;
  tripLine: string;
  reviewLinks: { label: string; url: string }[];
};

export function buildReviewEmail(input: ReviewEmailInput): {
  subject: string;
  html: string;
} {
  const subject = `How was your trip with ${input.operatorName}?`;
  const hi = input.recipientName
    ? `Hi ${escapeHtml(input.recipientName)},`
    : "Hi there,";
  const brand = escapeHtml(input.brandColor);

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(
        input.operatorName,
      )}" style="height:40px;width:auto;" />`
    : `<div style="font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(
        input.operatorName,
      )}</div>`;

  const buttons = input.reviewLinks
    .map(
      (l) =>
        `<a href="${escapeHtml(
          l.url,
        )}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;margin:6px 8px 0 0;">${escapeHtml(
          l.label,
        )}</a>`,
    )
    .join("");

  const tripLine = input.tripLine
    ? `<p style="margin:0 0 16px;color:#5f7882;">${escapeHtml(input.tripLine)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#faf8f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2b2e;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${brand};padding:24px;">${header}</div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;">${hi}</p>
        <p style="margin:0 0 16px;">
          Thanks again for spending the day with ${escapeHtml(input.operatorName)}.
          We hope you love your photos.
        </p>
        ${tripLine}
        <p style="margin:0 0 12px;">
          If you have a minute, a quick review really helps a small crew like ours.
        </p>
        <div style="margin:8px 0 20px;">${buttons}</div>
        <p style="margin:0;color:#8ba4ac;font-size:13px;">
          Thank you, the team at ${escapeHtml(input.operatorName)}
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

export type SendResult =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "error"; error: string };

export async function sendReviewEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Resend not wired yet. Caller leaves the recipient pending so it sends for
    // real once a domain is verified and the key is set.
    return { status: "skipped" };
  }

  const from = process.env.REVIEW_FROM_EMAIL || "Flukesend <reviews@flukesend.com>";
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
    return { status: "error", error: e instanceof Error ? e.message : "send failed" };
  }
}
