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

// Date and captain reference, shared by the instant ask and the nightly
// sweep. Rendered as a small quiet line at the bottom of the email, not in
// the body copy, where a mid sentence date breaks the flow.
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
  return parts.join(" ");
}

// Species always read plural in the body ("Orcas and Humpback whales"), with
// an and-join so it reads as a sentence rather than a list.
function pluralize(name: string): string {
  const n = name.trim();
  if (!n || /s$/i.test(n)) return n;
  return `${n}s`;
}

export function speciesSentence(species: string[] | null): string {
  const plurals = (species ?? []).map(pluralize).filter(Boolean);
  if (!plurals.length) return "";
  const joined =
    plurals.length === 1
      ? plurals[0]
      : plurals.length === 2
        ? `${plurals[0]} and ${plurals[1]}`
        : `${plurals.slice(0, -1).join(", ")}, and ${plurals[plurals.length - 1]}`;
  return ` It was a good one out there. ${joined}!`;
}

export type ReviewEmailInput = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  recipientName: string | null;
  // Small date and captain reference for the bottom of the email.
  tripLine: string;
  // The trip's species, pluralized into the body sentence.
  species: string[];
  // href is the tracked redirect through /g/[token]/review, not the raw
  // destination, so a tap is logged before the guest lands on Google.
  reviewLinks: { label: string; href: string }[];
  social: SocialLinks;
};

export function buildReviewEmail(input: ReviewEmailInput): {
  subject: string;
  html: string;
} {
  // Casual and evocative, like a text from the crew who took them out. Names
  // the thing they came for, carries a curiosity hook, and does not telegraph
  // a review request, so it gets opened. Opens are the funnel's biggest leak.
  const subject = "How about those whales?";
  const brand = escapeHtml(input.brandColor);
  const name = escapeHtml(input.operatorName);

  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hi there,";
  const seen = escapeHtml(speciesSentence(input.species));

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
        <p style="font-size:14px;color:#46555a;margin:0 0 14px;line-height:1.6">${hi} We hope you had an amazing time out on the water with us.${seen}</p>
        <p style="font-size:14px;color:#46555a;margin:0 0 18px;line-height:1.6">If you have a moment, we would love to hear about your experience. A quick review helps us, and helps others find the whales.</p>
        <div style="display:flex;flex-direction:column;gap:9px">${buttons}</div>
        ${socialRow ? `<div style="margin:20px 0 0">${socialRow}</div>` : ""}
        <p style="font-size:14px;color:#46555a;margin:20px 0 2px;line-height:1.6">Thanks for joining us. Hope to see you on the water again soon.</p>
        <p style="font-size:13px;color:#6b7a7d;margin:0">The crew at ${name}</p>
        ${input.tripLine ? `<p style="font-size:11.5px;color:#9aa6a8;margin:14px 0 0">${escapeHtml(input.tripLine)}</p>` : ""}
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
