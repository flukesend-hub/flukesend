/*
  The branded review ask, styled from the design handoff. Built and sent by the
  nightly job. Same brand color and trip details as the gallery, a warm line,
  and one button per review link (first solid, the rest outlined). No review
  gating: every guest who downloads is asked. The tip jar is a later Stripe bolt
  on and is deliberately not in this email yet.
*/
import "server-only";
import { escapeHtml, sendEmail, operatorFromAddress } from "@/lib/email";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";

// How long after a download we wait before asking for a review. Set to 0 so the
// job asks every guest who has downloaded since the last run, with no hold back.
// The cron runs twice a day (14:00 and 03:00 UTC, which is 7 AM and 8 PM Pacific
// in summer), so a guest gets their ask at the next 7 AM or 8 PM after they
// download. Raise this if a gap after the download is wanted again.
export const REVIEW_DELAY_HOURS = 0;

export function reviewDelayCutoffISO(now: number = Date.now()) {
  return new Date(now - REVIEW_DELAY_HOURS * 60 * 60 * 1000).toISOString();
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
  const subject = `How was your trip with ${input.operatorName}?`;
  const brand = escapeHtml(input.brandColor);
  const name = escapeHtml(input.operatorName);

  const intro = input.tripLine
    ? `It was a good one out there, ${escapeHtml(input.tripLine)}. `
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
        <div style="font-family:'Fraunces',Georgia,serif;font-size:22px;margin:16px 0 12px;line-height:1.25">Hope the trip made your day</div>
        <p style="font-size:14px;color:#46555a;margin:0 0 16px">${intro}If you have a minute, a short review helps a small crew like ours more than you would guess.</p>
        <div style="display:flex;flex-direction:column;gap:9px">${buttons}</div>
        ${socialRow ? `<div style="margin:20px 0 0">${socialRow}</div>` : ""}
        <p style="font-size:11.5px;color:#9aa6a8;margin:18px 0 0;text-align:center">You got this because you downloaded photos from your trip. One note only, we will not chase you.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}

export async function sendReviewEmail(
  to: string,
  subject: string,
  html: string,
  operatorName: string,
  replyTo?: string | null,
) {
  return sendEmail(to, subject, html, operatorFromAddress(operatorName), replyTo);
}
