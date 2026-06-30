/*
  The social icon row shared by the delivery and review emails. Renders one
  small monochrome icon per link the operator has set, each wrapped in a link.
  The icons are static PNGs under public/email/social, referenced by absolute
  URL so email clients (which do not render inline SVG) can load them.

  Returns an empty string when there is no base URL or no links, so callers can
  drop it in unconditionally. No em dashes anywhere.
*/
import { escapeHtml } from "@/lib/email";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";

export function socialFooterHtml(
  baseUrl: string,
  social: SocialLinks,
): string {
  if (!baseUrl) return "";
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
        `<td style="padding:0 7px"><a href="${escapeHtml(url)}" target="_blank" style="text-decoration:none"><img src="${escapeHtml(baseUrl)}/email/social/${platform.key}.png" width="22" height="22" alt="${escapeHtml(platform.label)}" style="display:block;border:0;opacity:.85" /></a></td>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr>${cells}</tr></table>`;
}
