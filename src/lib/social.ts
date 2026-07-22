/*
  The website and social platforms an operator can link. Shared by the settings
  form and the email footer so the set and the column names never drift. Each
  platform maps to one nullable text column on branding. Order here is the order
  they render in settings and in the email footer.

  No em dashes anywhere.
*/

export type SocialKey =
  | "website"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x";

export type SocialColumn =
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "tiktok_url"
  | "youtube_url"
  | "x_url";

export type SocialPlatform = {
  key: SocialKey;
  column: SocialColumn;
  label: string;
  placeholder: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "website", column: "website_url", label: "Website", placeholder: "yourtours.com" },
  { key: "facebook", column: "facebook_url", label: "Facebook", placeholder: "facebook.com/yourtours" },
  { key: "instagram", column: "instagram_url", label: "Instagram", placeholder: "instagram.com/yourtours" },
  { key: "tiktok", column: "tiktok_url", label: "TikTok", placeholder: "tiktok.com/@yourtours" },
  { key: "youtube", column: "youtube_url", label: "YouTube", placeholder: "youtube.com/@yourtours" },
  { key: "x", column: "x_url", label: "X", placeholder: "x.com/yourtours" },
];

// A branding row holds these as optional strings. Subset type so callers that
// only read the social columns do not need the whole row shape.
export type SocialLinks = Partial<Record<SocialColumn, string | null>>;

// The operator's Instagram handle ("@name") derived from their Instagram link,
// for tagging in a guest's pre-filled share caption. Null when there is no
// Instagram link or it is not parseable, so the caption just drops the tag.
export function instagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const seg = u.pathname.split("/").filter(Boolean)[0];
    const handle = seg?.replace(/^@/, "").trim();
    return handle ? `@${handle}` : null;
  } catch {
    return null;
  }
}

// Normalize one entered value. Blank becomes null (the operator cleared it).
// A bare host gets https:// so "yourtours.com" is accepted. Returns an error
// string when it cannot be parsed as a URL.
export function normalizeSocialUrl(
  raw: string,
): { url: string | null } | { error: string } {
  const value = raw.trim();
  if (!value) return { url: null };
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return { error: "Enter a valid link." };
    return { url: parsed.toString() };
  } catch {
    return { error: "Enter a valid link." };
  }
}
