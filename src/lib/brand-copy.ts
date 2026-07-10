/*
  Editable guest facing copy for the Branding tab. Curated fields, not raw
  templates: each field has a label, a character limit that protects the
  layout, and today's template string as its default. Overrides live in
  branding.copy_overrides (field key to value; an absent key or a value equal
  to the default means the template default renders). Client safe: the
  workbench preview and the server email builders share this module.

  Tokens are the only dynamic insertion. Plain text plus the approved token
  list below, substituted at send time and HTML escaped after substitution,
  so no markup or script can ever ride in through operator copy.
*/

export type CopyOverrides = Record<string, string>;

// ---- Tokens ----

// label is the plain English name shown on the picker chips; example is what
// the fill-in might become, for the explainer line.
export const COPY_TOKENS = [
  { token: "{operator_name}", label: "Company name", example: "Enocean Tours" },
  { token: "{first_name}", label: "Guest's first name", example: "Alex" },
  { token: "{species}", label: "What the trip saw", example: "Humpback whales" },
  { token: "{date}", label: "Trip date", example: "July 10" },
  { token: "{photographer_name}", label: "Photographer", example: "Jordan" },
  { token: "{crew}", label: "Captain and crew", example: "Captain Ray, Maya" },
] as const;

export type TokenContext = {
  operatorName: string;
  firstName?: string | null;
  species?: string | null;
  date?: string | null;
  photographerName?: string | null;
  crew?: string | null;
};

// Substitute known tokens; a token with no value collapses to nothing and the
// leftover double spaces are tidied so the sentence still reads.
export function renderTokens(text: string, ctx: TokenContext): string {
  const values: Record<string, string> = {
    "{operator_name}": ctx.operatorName,
    "{first_name}": ctx.firstName ?? "",
    "{species}": ctx.species ?? "",
    "{date}": ctx.date ?? "",
    "{photographer_name}": ctx.photographerName ?? "",
    "{crew}": ctx.crew ?? "",
  };
  let out = text;
  for (const [token, value] of Object.entries(values)) {
    out = out.split(token).join(value);
  }
  return out.replace(/ {2,}/g, " ").replace(/ ([,.!])/g, "$1").trim();
}

// Anything shaped like a token that is not on the approved list. Save actions
// reject these with a clear message instead of letting them reach a guest.
export function findUnknownTokens(text: string): string[] {
  const known = new Set<string>(COPY_TOKENS.map((t) => t.token));
  const seen = new Set<string>();
  for (const m of text.matchAll(/\{[a-zA-Z0-9_]+\}/g)) {
    if (!known.has(m[0])) seen.add(m[0]);
  }
  return Array.from(seen);
}

// ---- Fields ----

export type CopyField = {
  key: string;
  label: string;
  hint?: string;
  default: string;
  limit: number;
  multiline?: boolean;
};

export const DELIVERY_COPY: CopyField[] = [
  {
    key: "delivery.headline",
    label: "Headline",
    default: "Your photos are ready",
    limit: 60,
  },
  {
    key: "delivery.button",
    label: "Button label",
    default: "View your photos",
    limit: 30,
  },
  {
    key: "delivery.signoff",
    label: "Sign-off",
    hint: "The closing line at the bottom, right after the gallery expiry note.",
    default: "Reply any time, it reaches us directly. Thank you, the crew at {operator_name}.",
    limit: 240,
    multiline: true,
  },
];

export const REVIEW_COPY: CopyField[] = [
  {
    key: "review.headline",
    label: "Headline",
    default: "So glad you got your photos",
    limit: 60,
  },
  {
    key: "review.ask",
    label: "The ask",
    hint: "The line that asks for the review, right above the buttons.",
    default:
      "If you have a moment, we would love to hear about your experience. A quick review helps us, and helps others find the whales.",
    limit: 240,
    multiline: true,
  },
  {
    key: "review.signoff",
    label: "Sign-off",
    default: "Thanks for joining us. Hope to see you on the water again soon. The crew at {operator_name}.",
    limit: 240,
    multiline: true,
  },
];

export const GALLERY_COPY: CopyField[] = [
  {
    key: "gallery.review_ask",
    label: "Review ask",
    hint: "Shown right after a guest saves their photos, above your review buttons.",
    default: "Loved the trip? A quick review means a lot to a small crew like ours.",
    limit: 140,
    multiline: true,
  },
  {
    key: "gallery.thanks",
    label: "Thank-you line",
    hint: "Shown after saving when there is no review or tip to ask for.",
    default: "Thanks for spending the day on the water with us.",
    limit: 140,
    multiline: true,
  },
];

// The override when one is set, the template default otherwise.
export function copyValue(
  overrides: CopyOverrides | null | undefined,
  field: CopyField,
): string {
  const v = overrides?.[field.key]?.trim();
  return v || field.default;
}

// The Branding tab fields off a branding row, in the shape the email builders
// take. One helper so every send path passes the same bag.
export function brandLookFromRow(
  branding:
    | {
        accent_color?: string | null;
        header_text_color?: string | null;
        font_key?: string | null;
        text_tone?: string | null;
        copy_overrides?: unknown;
      }
    | null
    | undefined,
): {
  accentColor: string | null;
  headerTextColor: string | null;
  fontKey: string | null;
  textTone: string | null;
  copyOverrides: CopyOverrides | null;
} {
  return {
    accentColor: branding?.accent_color ?? null,
    headerTextColor: branding?.header_text_color ?? null,
    fontKey: branding?.font_key ?? null,
    textTone: branding?.text_tone ?? null,
    copyOverrides: (branding?.copy_overrides ?? null) as CopyOverrides | null,
  };
}
