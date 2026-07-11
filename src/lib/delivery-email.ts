/*
  The gallery delivery email. Sent to each guest the moment an operator
  creates a send: a brand colored header band with the operator's logo top
  left, a warm line, a quiet trip card (date and captain, species in bold,
  naturalist and photographer credited), and one button to their gallery.

  Look and voice come from the Branding tab: brand_color paints the header
  band, accent_color (when set) paints the button and trip card bar, the
  font pack picks the faces, and copy_overrides swaps the headline, button
  label, and sign-off (tokens substituted, then escaped). Nothing set means
  exactly today's default look.

  Light only on purpose. The email declares color-scheme light so dark mode
  clients keep it white instead of auto inverting it into a muddy mess. Inline
  styled, single column, safe for Apple Mail and Gmail. Client safe on purpose
  (no server-only): the Branding tab renders this exact builder as its live
  preview. No em dashes anywhere.
*/
import { escapeHtml } from "@/lib/html";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";
import { fontPack, googleFontsHref, textTone, logoAlign } from "@/lib/brand-fonts";
import {
  DELIVERY_COPY,
  copyValue,
  renderTokens,
  type CopyOverrides,
  type TokenContext,
} from "@/lib/brand-copy";

export type DeliveryEmailInput = {
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
  tripDate: string | null;
  captainName: string | null;
  naturalistName: string | null;
  photographerName: string | null;
  species: string[];
  message: string;
  galleryUrl: string;
  // How long the gallery stays up, so the email can set the expectation.
  retentionDays: number;
  social: SocialLinks;
};

export function buildDeliveryEmail(input: DeliveryEmailInput): {
  subject: string;
  html: string;
} {
  const subject = `Your photos from ${input.operatorName}`;
  const brand = escapeHtml(input.brandColor);
  const accent = escapeHtml(input.accentColor || input.brandColor);
  const headerText = escapeHtml(input.headerTextColor || "#ffffff");
  const name = escapeHtml(input.operatorName);
  const url = escapeHtml(input.galleryUrl);

  const pack = fontPack(input.fontKey);
  const display = pack.displayStack;
  const body = pack.bodyStack;
  const fontsHref = googleFontsHref(pack);
  const tone = textTone(input.textTone);
  const align = logoAlign(input.logoAlign);

  // The editable copy, tokens substituted then escaped. {first_name} is the
  // guest's first word so "Alex Rivera" greets as Alex.
  const ctx: TokenContext = {
    operatorName: input.operatorName,
    firstName: input.recipientName?.trim().split(/\s+/)[0] ?? null,
    species: input.species.length ? input.species.join(" and ") : null,
    date: input.tripDate,
    photographerName: input.photographerName,
    crew: [
      input.captainName ? `Captain ${input.captainName}` : null,
      input.naturalistName,
      input.photographerName,
    ]
      .filter(Boolean)
      .join(", ") || null,
  };
  const copy = Object.fromEntries(
    DELIVERY_COPY.map((f) => [
      f.key,
      escapeHtml(renderTokens(copyValue(input.copyOverrides, f), ctx)),
    ]),
  );

  // Greeting line only when we know the guest's name; no filler "Hi there,"
  // otherwise. The email opens straight with the operator's message instead.
  const hiRow = input.recipientName
    ? `<p style="font-size:15px;line-height:1.55;margin:0 0 14px;color:${tone.body}">Hi ${escapeHtml(input.recipientName)},</p>`
    : "";

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:inline-block" />`
    : `<div style="font-family:${display};font-weight:600;font-size:19px;color:${headerText};display:inline-block">${name}</div>`;

  const message = input.message
    ? `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:${tone.body}">${escapeHtml(input.message)}</p>`
    : "";

  // Trip card pieces. Each line only renders when it has something to say.
  const whenParts = [
    input.tripDate ? escapeHtml(input.tripDate) : null,
    input.captainName ? `with Captain ${escapeHtml(input.captainName)}` : null,
  ].filter(Boolean);
  const credits = [
    input.naturalistName ? `Naturalist ${escapeHtml(input.naturalistName)}` : null,
    input.photographerName ? `Photos by ${escapeHtml(input.photographerName)}` : null,
  ].filter(Boolean);
  const speciesText = input.species.length
    ? input.species.map((s) => escapeHtml(s)).join(", ")
    : "";

  const tripRows = [
    whenParts.length
      ? `<div style="font-size:13px;color:${tone.mid};margin-bottom:3px">${whenParts.join(" &middot; ")}</div>`
      : "",
    speciesText
      ? `<div style="font-size:14px;color:${tone.body}"><span style="font-weight:600;color:${tone.ink}">${speciesText}</span></div>`
      : "",
    credits.length
      ? `<div style="font-size:12.5px;color:${tone.mid};margin-top:5px">${credits.join(" &middot; ")}</div>`
      : "",
  ].join("");

  const socialRow = socialFooterHtml(input.social);

  const tripCard = tripRows
    ? `<tr><td style="padding:0 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;border-radius:12px;overflow:hidden">
          <tr>
            <td style="width:4px;background:${accent}"></td>
            <td style="padding:13px 16px">${tripRows}</td>
          </tr>
        </table>
      </td></tr>`
    : "";

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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your photos from the trip are ready to view and download.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px;text-align:${align}">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:${display};font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:${tone.ink}">${copy["delivery.headline"]}</h1>
                ${hiRow}
                ${message}
              </td>
            </tr>
            ${tripCard}
            <tr>
              <td style="padding:22px 28px 6px">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                  <tr>
                    <td align="center" style="border-radius:12px;background:${accent}">
                      <a href="${url}" style="display:block;padding:15px 24px;font-family:${body};font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">${copy["delivery.button"]}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 26px;text-align:center">
                <p style="font-size:14.5px;line-height:1.6;font-weight:500;color:${tone.mid};margin:0">Your gallery is up for ${input.retentionDays} days, save your photos while it lasts. ${copy["delivery.signoff"]}</p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
            ${socialRow ? `<tr><td align="center" style="padding:18px 8px 4px">${socialRow}</td></tr>` : ""}
            <tr><td align="center" style="padding:${socialRow ? "4px" : "16px"} 8px 0">
              <p style="font-size:11px;color:#9aa6a8;margin:0">Sent by ${name}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
