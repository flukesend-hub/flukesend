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

export const COPY_TOKENS = [
  { token: "{operator_name}", hint: "your company name" },
  { token: "{first_name}", hint: "the guest's first name" },
  { token: "{species}", hint: "what the trip saw" },
  { token: "{date}", hint: "the trip date" },
  { token: "{photographer_name}", hint: "the photographer" },
  { token: "{crew}", hint: "captain and crew" },
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
    hint: "The quiet line at the bottom of the email.",
    default:
      "This private link is just for you. Reply to this email any time, it reaches us directly. Thank you, the crew at {operator_name}.",
    limit: 240,
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
        copy_overrides?: unknown;
      }
    | null
    | undefined,
): {
  accentColor: string | null;
  headerTextColor: string | null;
  fontKey: string | null;
  copyOverrides: CopyOverrides | null;
} {
  return {
    accentColor: branding?.accent_color ?? null,
    headerTextColor: branding?.header_text_color ?? null,
    fontKey: branding?.font_key ?? null,
    copyOverrides: (branding?.copy_overrides ?? null) as CopyOverrides | null,
  };
}
