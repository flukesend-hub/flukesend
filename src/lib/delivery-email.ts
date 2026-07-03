/*
  The gallery delivery email, redesigned. Sent to each guest the moment an
  operator creates a send: a brand colored header band with the operator's logo
  top left, a warm line, a quiet trip card (date and captain, species in bold,
  naturalist and photographer credited), and one button to their gallery.

  Light only on purpose. The email declares color-scheme light so dark mode
  clients keep it white instead of auto inverting it into a muddy mess. Inline
  styled, single column, safe for Apple Mail and Gmail. No em dashes anywhere.
*/
import "server-only";
import { escapeHtml } from "@/lib/email";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";

export type DeliveryEmailInput = {
  operatorName: string;
  brandColor: string;
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
  const name = escapeHtml(input.operatorName);
  const url = escapeHtml(input.galleryUrl);
  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hi there,";

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:block" />`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:19px;color:#ffffff">${name}</div>`;

  const message = input.message
    ? `<p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#33464a">${escapeHtml(input.message)}</p>`
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
      ? `<div style="font-size:13px;color:#6b7a7d;margin-bottom:3px">${whenParts.join(" &middot; ")}</div>`
      : "",
    speciesText
      ? `<div style="font-size:14px;color:#33464a"><span style="font-weight:600;color:#1c2b2e">${speciesText}</span></div>`
      : "",
    credits.length
      ? `<div style="font-size:12.5px;color:#6b7a7d;margin-top:5px">${credits.join(" &middot; ")}</div>`
      : "",
  ].join("");

  const socialRow = socialFooterHtml(input.social);

  const tripCard = tripRows
    ? `<tr><td style="padding:0 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;border-radius:12px;overflow:hidden">
          <tr>
            <td style="width:4px;background:${brand}"></td>
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
    <style>:root { color-scheme: light only; }</style>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1c2b2e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your photos from the trip are ready to view and download.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:#16241f">Your photos are ready</h1>
                <p style="font-size:15px;line-height:1.55;margin:0 0 14px;color:#33464a">${hi}</p>
                ${message}
              </td>
            </tr>
            ${tripCard}
            <tr>
              <td style="padding:22px 28px 6px">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                  <tr>
                    <td align="center" style="border-radius:12px;background:${brand}">
                      <a href="${url}" style="display:block;padding:15px 24px;font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">View your photos</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;text-align:center">
                <p style="font-size:12.5px;line-height:1.5;color:#8ba4ac;margin:0">Your gallery is up for ${input.retentionDays} days. Save your photos to your phone while they are there.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px">
                <p style="font-size:12.5px;line-height:1.5;color:#8ba4ac;margin:0">This private link is just for you. Reply to this email any time, it reaches us directly. Thank you, the crew at ${name}.</p>
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
