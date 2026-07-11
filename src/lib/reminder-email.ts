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
import { fontPack, googleFontsHref, textTone, logoAlign } from "@/lib/brand-fonts";
import { t, asLocale } from "@/lib/i18n";

export type ReminderEmailInput = {
  operatorName: string;
  brandColor: string;
  // Branding tab look, shared with the delivery and review emails. Null or
  // absent means the default look, so this renders like today for operators
  // who set nothing.
  accentColor?: string | null;
  headerTextColor?: string | null;
  fontKey?: string | null;
  textTone?: string | null;
  logoAlign?: string | null;
  // The operator's guest language; null or absent renders English.
  guestLocale?: string | null;
  logoUrl: string | null;
  recipientName: string | null;
  // "today" or "tomorrow", computed from expires_at by the caller.
  expiresWhen: string;
  galleryUrl: string;
  social: SocialLinks;
  // "expiring" is the normal nudge. "fixed-link" is the make-good sent after
  // a reminder went out with a link that did not work: same button, new copy
  // owning the miss.
  variant?: "expiring" | "fixed-link";
};

export function buildReminderEmail(input: ReminderEmailInput): {
  subject: string;
  html: string;
} {
  const locale = asLocale(input.guestLocale);
  const fixedLink = input.variant === "fixed-link";
  const subject = fixedLink
    ? t(locale, "reminder.subject.fixed")
    : t(locale, "reminder.subject.expiring");
  const brand = escapeHtml(input.brandColor);
  const accent = escapeHtml(input.accentColor || input.brandColor);
  const headerTextColor = escapeHtml(input.headerTextColor || "#ffffff");
  const name = escapeHtml(input.operatorName);
  const url = escapeHtml(input.galleryUrl);
  const when = escapeHtml(input.expiresWhen);
  const pack = fontPack(input.fontKey);
  const display = pack.displayStack;
  const body = pack.bodyStack;
  const fontsHref = googleFontsHref(pack);
  const tone = textTone(input.textTone);
  const align = logoAlign(input.logoAlign);
  const headline = fixedLink
    ? t(locale, "reminder.headline.fixed")
    : t(locale, "reminder.headline.expiring");
  const bodyText = fixedLink
    ? t(locale, "reminder.body.fixed", { when })
    : t(locale, "reminder.body.expiring", { when });
  const preheader = fixedLink
    ? t(locale, "reminder.preheader.fixed")
    : t(locale, "reminder.preheader.expiring");
  // Greeting line only when we know the guest's name; no filler otherwise.
  const hiRow = input.recipientName
    ? `<p style="font-size:15px;line-height:1.55;margin:0 0 6px;color:${tone.body}">${t(locale, "email.greeting", { name: escapeHtml(input.recipientName) })}</p>`
    : "";

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:30px;width:auto;display:inline-block" />`
    : `<div style="font-family:${display};font-weight:600;font-size:19px;color:${headerTextColor};display:inline-block">${name}</div>`;

  const socialRow = socialFooterHtml(input.social);

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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:30px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e9e8;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:${brand};padding:20px 28px;text-align:${align}">${header}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px 6px">
                <h1 style="font-family:${display};font-weight:600;font-size:25px;line-height:1.25;margin:0 0 14px;color:${tone.ink}">${headline}</h1>
                ${hiRow}
                <p style="font-size:15px;line-height:1.55;margin:0 0 8px;color:${tone.body}">${bodyText}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 6px">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
                  <tr>
                    <td align="center" style="border-radius:12px;background:${accent}">
                      <a href="${url}" style="display:block;padding:15px 24px;font-family:${body};font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">${t(locale, "reminder.button")}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 28px;text-align:center">
                <p style="font-size:14.5px;line-height:1.6;font-weight:500;color:${tone.mid};margin:0">${t(locale, "reminder.signoff", { name })}</p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
            ${socialRow ? `<tr><td align="center" style="padding:18px 8px 4px">${socialRow}</td></tr>` : ""}
            <tr><td align="center" style="padding:${socialRow ? "4px" : "16px"} 8px 0">
              <p style="font-size:11px;color:#9aa6a8;margin:0">${t(locale, "email.sentBy", { name })}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
