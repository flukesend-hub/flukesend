/*
  The gallery delivery email. Sent to each guest the moment an operator creates
  a send: branded, with their trip written as warm copy and a button to their
  personal tokened gallery. This is the "ship it" email, the front of the
  funnel that the download and review ask hang off.
*/
import "server-only";
import { escapeHtml } from "@/lib/email";

export type DeliveryEmailInput = {
  operatorName: string;
  brandColor: string;
  logoUrl: string | null;
  recipientName: string | null;
  tripLine: string;
  message: string;
  galleryUrl: string;
};

export function buildDeliveryEmail(input: DeliveryEmailInput): {
  subject: string;
  html: string;
} {
  const subject = `Your photos from ${input.operatorName}`;
  const hi = input.recipientName
    ? `Hi ${escapeHtml(input.recipientName)},`
    : "Hi there,";
  const brand = escapeHtml(input.brandColor);
  const url = escapeHtml(input.galleryUrl);

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(
        input.operatorName,
      )}" style="height:40px;width:auto;" />`
    : `<div style="font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(
        input.operatorName,
      )}</div>`;

  const tripLine = input.tripLine
    ? `<p style="margin:0 0 16px;color:#5f7882;">${escapeHtml(input.tripLine)}</p>`
    : "";

  const message = input.message
    ? `<p style="margin:0 0 16px;">${escapeHtml(input.message)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#faf8f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2b2e;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${brand};padding:24px;">${header}</div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;">${hi}</p>
        <p style="margin:0 0 16px;">Your photos are ready.</p>
        ${tripLine}
        ${message}
        <div style="margin:8px 0 20px;">
          <a href="${url}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:600;">View your photos</a>
        </div>
        <p style="margin:0;color:#8ba4ac;font-size:13px;">
          This link is just for you. Thank you, the team at ${escapeHtml(
            input.operatorName,
          )}
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}
