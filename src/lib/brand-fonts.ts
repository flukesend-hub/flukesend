/*
  The curated font pack for the Branding tab. Five hand picked pairings, each
  a display face for headlines plus a body face, mapped to real CSS stacks
  with safe fallbacks. Client safe: the workbench preview and the server email
  builders both read from here.

  Reality check on email: most inbox apps (Gmail especially) strip web fonts
  and fall back to the stack, so the pack fully lands on the gallery page and
  in Apple Mail, and degrades gracefully everywhere else. The @import line the
  builders emit is what Apple Mail honors.
*/

export type FontKey = "classic" | "modern" | "story" | "rounded" | "bold";

export type FontPack = {
  key: FontKey;
  label: string;
  // One line of flavor for the picker.
  note: string;
  // Headline face and body face as full CSS stacks.
  displayStack: string;
  bodyStack: string;
  // The Google Fonts css2 families parameter, or null for system only.
  googleFamilies: string | null;
};

export const FONT_PACKS: FontPack[] = [
  {
    key: "classic",
    label: "Classic",
    note: "Fraunces and Inter, the Flukesend default",
    displayStack: "'Fraunces', Georgia, serif",
    bodyStack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    googleFamilies: "Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600",
  },
  {
    key: "modern",
    label: "Modern",
    note: "Inter throughout, clean and quiet",
    displayStack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    bodyStack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    googleFamilies: "Inter:wght@400;500;600;700",
  },
  {
    key: "story",
    label: "Storybook",
    note: "Lora, a warm bookish serif",
    displayStack: "'Lora', Georgia, serif",
    bodyStack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    googleFamilies: "Lora:wght@500;600&family=Inter:wght@400;500;600",
  },
  {
    key: "rounded",
    label: "Rounded",
    note: "Nunito, soft and friendly",
    displayStack: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
    bodyStack: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
    googleFamilies: "Nunito:wght@400;600;700",
  },
  {
    key: "bold",
    label: "Bold",
    note: "Montserrat headlines, confident and wide",
    displayStack: "'Montserrat', 'Arial Black', system-ui, sans-serif",
    bodyStack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    googleFamilies: "Montserrat:wght@500;600;700&family=Inter:wght@400;500;600",
  },
];

export function isFontKey(v: unknown): v is FontKey {
  return typeof v === "string" && FONT_PACKS.some((p) => p.key === v);
}

// Null, unknown, or unset all mean the default look.
export function fontPack(key: string | null | undefined): FontPack {
  return FONT_PACKS.find((p) => p.key === key) ?? FONT_PACKS[0];
}

export function googleFontsHref(pack: FontPack): string | null {
  return pack.googleFamilies
    ? `https://fonts.googleapis.com/css2?family=${pack.googleFamilies}&display=swap`
    : null;
}
