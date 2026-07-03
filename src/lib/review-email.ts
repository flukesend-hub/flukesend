/*
  The branded review ask, styled from the design handoff. Built and sent by the
  nightly job. Same brand color and trip details as the gallery, a warm line,
  and one button per review link (first solid, the rest outlined). No review
  gating: every guest who downloads is asked. The tip jar is a later Stripe bolt
  on and is deliberately not in this email yet.
*/
import "server-only";
import { escapeHtml, sendEmail } from "@/lib/email";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";

// How long after a download the nightly sweep waits before asking. The ask now
// goes out immediately on download (lib/review-ask.ts); the cron is the safety
// net that retries failed sends and catches operators who added review links
// after their guests downloaded. Zero keeps the sweep immediate too.
export const REVIEW_DELAY_HOURS = 0;

export function reviewDelayCutoffISO(now: number = Date.now()) {
  return new Date(now - REVIEW_DELAY_HOURS * 60 * 60 * 1000).toISOString();
}

// The one line trip summary used in the review email, shared by the instant
// ask and the nightly sweep.
export function tripLine(d: {
  trip_datetime: string | null;
  species: string[] | null;
  captain_name: string | null;
}): string {
  const parts: string[] = [];
  if (d.trip_datetime) {
    parts.push(
      new Date(d.trip_datetime).toLocaleDateString("en-US", { dateStyle: "long" }),
    );
  }
  if (d.captain_name) parts.push(`with Captain ${d.captain_name}`);
  let line = parts.join(" ");
  if (d.species?.length) line += (line ? ". " : "") + d.species.join(", ");
  return line;
}

export type ReviewEmailInput = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  recipientName: string | null;
  tripLine: string;
  // href is the tracked redirect through /g/[token]/review, not the raw
  // destination, so a tap is logged before the guest lands on Google.
  reviewLinks: { label: string; href: string }[];
  social: SocialLinks;
};

export function buildReviewEmail(input: ReviewEmailInput): {
  subject: string;
  html: string;
} {
  // Gratitude first, no operator name (the sender already shows it) and no
  // survey framing, so it reads as a warm note rather than a review demand.
  // That lifts opens, which is where the funnel leaks most.
  const subject = "Thanks for spending the day on the water with us";
  const brand = escapeHtml(input.brandColor);
  const name = escapeHtml(input.operatorName);

  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hi there,";
  const tripSentence = input.tripLine
    ? ` It was a good one out there, ${escapeHtml(input.tripLine)}.`
    : "";

  const socialRow = socialFooterHtml(input.social);

  const buttons = input.reviewLinks
    .map((l, i) =>
      i === 0
        ? `<a href="${escapeHtml(l.href)}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;background:${brand};color:#ffffff;padding:13px;border-radius:11px">${escapeHtml(l.label)}</a>`
        : `<a href="${escapeHtml(l.href)}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;background:transparent;color:${brand};border:1px solid ${brand};padding:12px;border-radius:11px">${escapeHtml(l.label)}</a>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#faf8f4;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2b2e">
    <div style="max-width:560px;margin:0 auto;background:#faf8f4;border-radius:18px;overflow:hidden">
      <div style="height:7px;background:${brand}"></div>
      <div style="padding:28px 26px 30px">
        <div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:17px;color:${brand}">${name}</div>
        <div style="font-family:'Fraunces',Georgia,serif;font-size:22px;margin:16px 0 14px;line-height:1.25">So glad you got your photos</div>
        <p style="font-size:14px;color:#46555a;margin:0 0 14px;line-height:1.6">${hi} We hope you had an amazing time out on the water with us.${tripSentence}</p>
        <p style="font-size:14px;color:#46555a;margin:0 0 18px;line-height:1.6">If you have a moment, we would love to hear about your experience. A quick review helps us, and helps others find the whales.</p>
        <div style="display:flex;flex-direction:column;gap:9px">${buttons}</div>
        ${socialRow ? `<div style="margin:20px 0 0">${socialRow}</div>` : ""}
        <p style="font-size:14px;color:#46555a;margin:20px 0 2px;line-height:1.6">Thanks for joining us. Hope to see you on the water again soon.</p>
        <p style="font-size:13px;color:#6b7a7d;margin:0">The crew at ${name}</p>
        <p style="font-size:11.5px;color:#9aa6a8;margin:18px 0 0;text-align:center">You got this because you downloaded photos from your trip. One note only, we will not chase you.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

// from is the full From header, resolved by the caller (white label domain
// when the operator has one verified, shared flukesend.com sender otherwise).
export async function sendReviewEmail(
  to: string,
  subject: string,
  html: string,
  from: string,
  replyTo?: string | null,
) {
  return sendEmail(to, subject, html, from, replyTo);
}
