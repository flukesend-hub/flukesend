/*
  The social icon row shared by the delivery and review emails. Renders one
  small monochrome icon per link the operator has set, each wrapped in a link.

  The icons are hosted in the public Supabase Storage bucket, the same always
  public origin the operator logo loads from. This is deliberate: an email can
  be generated from localhost, a preview deploy, or the production cron, and
  only a fixed public URL renders reliably in a recipient's mail client. Do not
  switch these back to a request derived origin. No em dashes anywhere.

  Returns an empty string when there are no links, so callers drop it in
  unconditionally.
*/
// From lib/html, not lib/email: this module also renders inside the client
// side Branding preview, so it must not pull in the server-only email sender.
import { escapeHtml } from "@/lib/html";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";

const ICON_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/app/social`;

export function socialFooterHtml(social: SocialLinks): string {
  const items = SOCIAL_PLATFORMS.map((p) => ({
    platform: p,
    url: social[p.column],
  })).filter((x): x is { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string } =>
    Boolean(x.url),
  );
  if (!items.length) return "";

  const cells = items
    .map(
      ({ platform, url }) =>
        `<td style="padding:0 7px"><a href="${escapeHtml(url)}" target="_blank" style="text-decoration:none"><img src="${ICON_BASE}/${platform.key}.png" width="22" height="22" alt="${escapeHtml(platform.label)}" style="display:block;border:0;opacity:.85" /></a></td>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>${cells}</tr></table>`;
}
