/*
  The gallery delivery email, styled from the design handoff. Sent to each guest
  the moment an operator creates a send: a brand colored header, the trip line,
  and a button to their personal gallery. Single column, inline styled, safe for
  Apple Mail and Gmail.
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
  const hi = input.recipientName ? `Hi ${escapeHtml(input.recipientName)},` : "Hi there,";
  const brand = escapeHtml(input.brandColor);
  const name = escapeHtml(input.operatorName);
  const url = escapeHtml(input.galleryUrl);

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${name}" style="height:34px;width:auto" />`
    : `<div style="font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:18px;color:#ffffff">${name}</div>`;

  const tripLine = input.tripLine
    ? `<p style="font-size:13.5px;margin:0 0 14px;color:#5f7882">${escapeHtml(input.tripLine)}</p>`
    : "";
  const message = input.message
    ? `<p style="font-size:14.5px;margin:0 0 20px;color:#33464a">${escapeHtml(input.message)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#faf8f4;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2b2e">
    <div style="max-width:560px;margin:0 auto;background:#faf8f4;border-radius:18px;overflow:hidden">
      <div style="background:${brand};padding:24px 26px">${header}</div>
      <div style="padding:28px 26px 30px">
        <p style="font-size:14.5px;margin:0 0 12px">${hi}</p>
        <p style="font-size:14.5px;margin:0 0 14px;color:#33464a">Your photos are ready.</p>
        ${tripLine}
        ${message}
        <a href="${url}" style="display:block;text-align:center;text-decoration:none;font-weight:600;font-size:14.5px;background:${brand};color:#ffffff;padding:14px;border-radius:11px">View your photos</a>
        <p style="font-size:12px;color:#8ba4ac;margin:18px 0 0">This link is just for you. Thank you, the team at ${name}.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, html };
}
