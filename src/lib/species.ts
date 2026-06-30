/*
  The marine species catalog for the US West Coast, shared by the settings
  species picker and the send form. An operator picks the species they actually
  see into branding.species_options; the send form shows those as pills. When an
  operator has not chosen any yet, the send form falls back to DEFAULT_SPECIES so
  it is never empty.

  Names are display ready. Operators can also add their own beyond this list, so
  the catalog is a convenience, not a fixed vocabulary. No em dashes anywhere.
*/

export type SpeciesGroup = { label: string; items: string[] };

// Grouped for the settings picker. Spans California through the Pacific
// Northwest, the whole US West Coast.
export const SPECIES_CATALOG: SpeciesGroup[] = [
  {
    label: "Whales",
    items: [
      "Gray whale",
      "Humpback whale",
      "Blue whale",
      "Fin whale",
      "Minke whale",
      "Sperm whale",
      "Orca",
      "Short-finned pilot whale",
    ],
  },
  {
    label: "Dolphins and porpoises",
    items: [
      "Common dolphin",
      "Pacific white-sided dolphin",
      "Risso's dolphin",
      "Bottlenose dolphin",
      "Northern right whale dolphin",
      "Dall's porpoise",
      "Harbor porpoise",
    ],
  },
  {
    label: "Seals and sea lions",
    items: [
      "California sea lion",
      "Steller sea lion",
      "Harbor seal",
      "Northern elephant seal",
      "Northern fur seal",
    ],
  },
  {
    label: "Otters",
    items: ["Sea otter"],
  },
];

// Flat list of every catalog name, handy for membership checks.
export const ALL_CATALOG_SPECIES: string[] = SPECIES_CATALOG.flatMap(
  (g) => g.items,
);

// Fallback pills when an operator has not set their own list yet.
export const DEFAULT_SPECIES: string[] = [
  "Gray whale",
  "Humpback whale",
  "Blue whale",
  "Orca",
  "Common dolphin",
  "Pacific white-sided dolphin",
  "Risso's dolphin",
  "Sea otter",
];

const MAX_SPECIES = 60;
const MAX_NAME_LEN = 60;

// Trim, drop blanks, dedupe case insensitively (keeping first spelling), and
// cap the count and each name length. Used by the settings save action and any
// other writer so the stored list never drifts into junk.
export function normalizeSpecies(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = raw.trim().slice(0, MAX_NAME_LEN);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= MAX_SPECIES) break;
  }
  return out;
}

// The list the send form should show: the operator's own list, or the default
// when they have not chosen any.
export function speciesForSend(options: string[] | null | undefined): string[] {
  const own = options ? normalizeSpecies(options) : [];
  return own.length ? own : DEFAULT_SPECIES;
}
