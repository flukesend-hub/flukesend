/*
  The branded review ask. Built and sent the moment a guest downloads, with the
  nightly job as the retry net. Shares the delivery email's shell so the two
  read as one brand: white body, a bordered card, the brand colored header band
  with the operator's logo, and the social links in a footer below the card.
  One button per review link (first solid, the rest outlined). No review
  gating: every guest who downloads is asked.

  Look and voice come from the Branding tab, same as the delivery email:
  accent_color paints the buttons, the font pack picks the faces, text_tone
  sets the grays, and copy_overrides swaps the headline, ask line, and
  sign-off (tokens substituted, then escaped). Client safe on purpose (no
  server-only): the Branding tab renders this exact builder as its live
  preview. Sending lives with the callers via lib/email.
*/
import { escapeHtml } from "@/lib/html";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";
import { fontPack, googleFontsHref, textTone, logoAlign } from "@/lib/brand-fonts";
import { crewAvatarHtml } from "@/lib/avatar";
import {
  REVIEW_COPY,
  copyValue,
  renderTokens,
  type CopyOverrides,
  type TokenContext,
} from "@/lib/brand-copy";

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
  // Branding tab overrides; null or absent means the default look.
  accentColor?: string | null;
  headerTextColor?: string | null;
  fontKey?: string | null;
  textTone?: string | null;
  logoAlign?: string | null;
  copyOverrides?: CopyOverrides | null;
  logoUrl: string | null;
  recipientName: string | null;
  // Small date and captain reference for the bottom of the email.
  tripLine: string;
  // For the {date} and {crew} fill-ins in editable copy.
  tripDate?: string | null;
  captainName?: string | null;
  // The trip's species, pluralized into the body sentence.
  species: string[];
  // The crew aboard this send (first name + optional photo), shown as a face
  // row above the buttons only when showCrew is on. Empty renders nothing.
  crew?: { firstName: string; photoUrl: string | null }[];
  showCrew?: boolean;
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
  const accent = escapeHtml(input.accentColor || input.brandColor);
  const headerTextColor = escapeHtml(input.headerTextColor || "#ffffff");
  const name = escapeHtml(input.operatorName);

  const pack = fontPack(input.fontKey);
  const display = pack.displayStack;
  const body = pack.bodyStack;
  const fontsHref = googleFontsHref(pack);
  const tone = textTone(input.textTone);
  const align = logoAlign(input.logoAlign);

  const ctx: TokenContext = {
    operatorName: input.operatorName,
    firstName: input.recipientName?.trim().split(/\s+/)[0] ?? null,
    species: input.species.length ? input.species.join(" and ") : null,
    date: input.tripDate ?? null,
    photographerName: null,
    crew: input.captainName ? `Captain ${input.captainName}` : null,
  };
  const copy = Object.fromEntries(
    REVIEW_COPY.map((f) => [
      f.key,
      escapeHtml(renderTokens(copyValue(input.copyOverrides, f), ctx)),
    ]),
  );

  // Greet by name when we have one; otherwise skip the greeting entirely
  // rather than a filler "Hi there," and open straight with the sentence.
  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)}, we` : "We";
  const seen = escapeHtml(speciesSentence(input.species));

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:inline-block" />`
    : `<div style="font-family:${display};font-weight:600;font-size:19px;color:${headerTextColor};display:inline-block">${name}</div>`;

  const socialRow = socialFooterHtml(input.social);

  // The crew face row, above the buttons, only when the operator turned it on
  // and someone aboard is visible. Each face is a circle (photo or initials)
  // with the first name beneath; scales cleanly from one person to several.
  const crew = (input.crew ?? []).filter((c) => c.firstName);
  const crewRow =
    input.showCrew && crew.length
      ? `<tr><td style="padding:2px 28px 10px">
          <div style="font-size:12.5px;color:${tone.quiet};text-align:center;margin:0 0 12px">Your crew today</div>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>${crew
            .map(
              (c) =>
                `<td style="padding:0 10px;text-align:center;vertical-align:top">${crewAvatarHtml(c.firstName, c.photoUrl, 52)}<div style="font-size:12.5px;color:${tone.mid};margin-top:7px">${escapeHtml(c.firstName)}</div></td>`,
            )
            .join("")}</tr></table>
        </td></tr>`
      : "";

  // Every review button is the same solid accent, full width. A plain stack of
  // block anchors (not flex) so they render identically in the inbox and in the
  // preview; the margin gives the spacing flex used to.
  const buttons = input.reviewLinks
    .map(
      (l, i) =>
        `<a href="${escapeHtml(l.href)}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14px;background:${accent};color:#ffffff;padding:14px;border-radius:11px;margin-top:${i === 0 ? "0" : "9px"}">${escapeHtml(l.label)}</a>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>${fontsHref ? `@import url('${fontsHref}');` : ""}:root { color-scheme: light only; }</style>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:${body};color:#1c2b2e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px;text-align:${align}">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:${display};font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:${tone.ink}">${copy["review.headline"]}</h1>
                <p style="font-size:15px;color:${tone.body};margin:0 0 14px;line-height:1.55">${hi} hope you had an amazing time out on the water with us.${seen}</p>
                <p style="font-size:15px;color:${tone.body};margin:0 0 18px;line-height:1.55">${copy["review.ask"]}</p>
              </td>
            </tr>
            ${crewRow}
            <tr>
              <td style="padding:0 28px 6px">${buttons}</td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;text-align:center">
                <p style="font-size:14.5px;line-height:1.6;font-weight:500;color:${tone.mid};margin:0">${copy["review.signoff"]}</p>
                ${input.tripLine ? `<p style="font-size:12px;color:${tone.quiet};margin:8px 0 0">${escapeHtml(input.tripLine)}</p>` : ""}
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
