/*
  The branded review ask. Built and sent the moment a guest downloads, with the
  nightly job as the retry net. Shares the delivery email's shell so the two
  read as one brand: white body, a bordered card, the brand colored header band
  with the operator's logo, and the social links in a footer below the card. A
  warm line and one button per review link (first solid, the rest outlined). No
  review gating: every guest who downloads is asked.
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

  // Greet by name when we have one; otherwise skip the greeting entirely
  // rather than a filler "Hi there," and open straight with the sentence.
  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)}, we` : "We";
  const seen = escapeHtml(speciesSentence(input.species));

  // Same shell as the delivery email so the two reads as one brand: white
  // body, a bordered card, the brand colored header band with the logo, and
  // the social links pushed down into a footer below the card.
  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:block" />`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:19px;color:#ffffff">${name}</div>`;

  const socialRow = socialFooterHtml(input.social);

  const buttons = input.reviewLinks
    .map((l, i) =>
      i === 0
        ? `<a href="${escapeHtml(l.href)}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;background:${brand};color:#ffffff;padding:13px;border-radius:11px">${escapeHtml(l.label)}</a>`
        : `<a href="${escapeHtml(l.href)}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;background:transparent;color:${brand};border:1px solid ${brand};padding:12px;border-radius:11px">${escapeHtml(l.label)}</a>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>:root { color-scheme: light only; }</style>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1c2b2e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:#16241f">So glad you got your photos</h1>
                <p style="font-size:15px;color:#33464a;margin:0 0 14px;line-height:1.55">${hi} hope you had an amazing time out on the water with us.${seen}</p>
                <p style="font-size:15px;color:#33464a;margin:0 0 18px;line-height:1.55">If you have a moment, we would love to hear about your experience. A quick review helps us, and helps others find the whales.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 6px">
                <div style="display:flex;flex-direction:column;gap:9px">${buttons}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px">
                <p style="font-size:12.5px;line-height:1.5;color:#8ba4ac;margin:0 0 2px">Thanks for joining us. Hope to see you on the water again soon. The crew at ${name}.</p>
                ${input.tripLine ? `<p style="font-size:11.5px;color:#9aa6a8;margin:8px 0 0">${escapeHtml(input.tripLine)}</p>` : ""}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
            ${socialRow ? `<tr><td align="center" style="padding:18px 8px 4px">${socialRow}</td></tr>` : ""}
            <tr><td align="center" style="padding:${socialRow ? "4px" : "16px"} 8px 0">
              <p style="font-size:11px;color:#9aa6a8;margin:0">Sent by ${name}, delivered with Flukesend</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
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
