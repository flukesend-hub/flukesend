/*
  The expiring-soon reminder. One nudge to a guest who has their gallery link
  but has not downloaded, sent shortly before the gallery expires. Every
  recovered download fires the review ask, so this email directly buys the
  operator more reviews.

  Same visual language as the delivery email: brand colored header band with
  the logo, one headline, one button. Light only, inline styled, no em dashes.
*/
import "server-only";
import { escapeHtml } from "@/lib/email";
import { socialFooterHtml } from "@/lib/email-social";
import { type SocialLinks } from "@/lib/social";

export type ReminderEmailInput = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  recipientName: string | null;
  // "today" or "tomorrow", computed from expires_at by the caller.
  expiresWhen: string;
  galleryUrl: string;
  social: SocialLinks;
};

export function buildReminderEmail(input: ReminderEmailInput): {
  subject: string;
  html: string;
} {
  const subject = "Don't let the whale slip away";
  const brand = escapeHtml(input.brandColor);
  const name = escapeHtml(input.operatorName);
  const url = escapeHtml(input.galleryUrl);
  const when = escapeHtml(input.expiresWhen);
  // Greeting line only when we know the guest's name; no filler otherwise.
  const hiRow = input.recipientName
    ? `<p style="font-size:15px;line-height:1.55;margin:0 0 6px;color:#33464a">Hi ${escapeHtml(input.recipientName)},</p>`
    : "";

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:block" />`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:19px;color:#ffffff">${name}</div>`;

  const socialRow = socialFooterHtml(input.social);

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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your trip photos are still waiting. Save them before the gallery closes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:#16241f">Don't let the whale slip away</h1>
                ${hiRow}
                <p style="font-size:15px;line-height:1.55;margin:0 0 8px;color:#33464a">The photos from your trip are still waiting, but not for much longer. Your gallery closes ${when}. Make sure to download your photos to your phone before it does.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 6px">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                  <tr>
                    <td align="center" style="border-radius:12px;background:${brand}">
                      <a href="${url}" style="display:block;padding:15px 24px;font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">Save your photos</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px">
                <p style="font-size:12.5px;line-height:1.5;color:#8ba4ac;margin:0">This private link is just for you. Reply any time, it reaches us directly. Thank you, the crew at ${name}.</p>
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
