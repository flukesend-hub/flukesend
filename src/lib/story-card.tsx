/*
  The story card renderer, shared by the per-send "Download story card" button
  and the Story Builder tab. Draws a 1080x1920 Instagram story in the operator's
  own brand: their logo on the brand band, a hero "photo of the day", then the
  date, an optional trip time, the species sighted as bordered pills, and their
  website. Callers resolve the operator's brand, the hero photo signed URL, and
  the copy; this file only paints.
*/
import "server-only";
import { ImageResponse } from "next/og";

export const STORY_W = 1080;
export const STORY_H = 1920;

const INK = "#f7f6f3";
const SOFT = "rgba(247,246,243,0.72)";

// Trim and pluralize each species, matching the source design.
export function pluralizeSpecies(list: string[]): string[] {
  return list
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/s$/i.test(s) ? s : `${s}s`));
}

export type StoryFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };

async function fetchOneWeight(weight: 500 | 600 | 700): Promise<StoryFont | null> {
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wght@${weight}`, {
    // An older UA makes Google serve a ttf, which Satori can read (not woff2).
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)" },
  });
  const css = await cssRes.text();
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!url) return null;
  const data = await (await fetch(url)).arrayBuffer();
  return { name: "Archivo", data, weight, style: "normal" };
}

// Fetching Archivo from Google is the slow part of a render, so load it once per
// server instance and reuse it: hero swaps then only pay the image composite.
// Cached on success only, so a failed load falls back to the built in font and
// retries on the next render. The three weights load in parallel.
let fontCache: StoryFont[] | undefined;
let fontInflight: Promise<StoryFont[] | undefined> | undefined;
export async function loadStoryFonts(): Promise<StoryFont[] | undefined> {
  if (fontCache) return fontCache;
  if (!fontInflight) {
    fontInflight = (async () => {
      try {
        const loaded = await Promise.all(([500, 600, 700] as const).map(fetchOneWeight));
        const good = loaded.filter((f): f is StoryFont => f !== null);
        if (good.length === 3) {
          fontCache = good;
          return good;
        }
        return undefined;
      } catch {
        return undefined;
      } finally {
        fontInflight = undefined;
      }
    })();
  }
  return fontInflight;
}

export type StoryCardInput = {
  brandColor: string;
  logoUrl: string | null;
  operatorName: string;
  website: string; // display form, no scheme
  species: string[]; // raw, pluralized here
  dateText: string;
  timeText: string | null; // shown only for a single trip day
  heroUrl: string | null;
  fonts?: StoryFont[];
  // Overlay label on the hero. Single card says "Photo of the day"; a slideshow
  // frame says "Photos from today".
  label?: string;
  // Optional head count per species, keyed by the same (trimmed) names as
  // species. When any species has a count, the sightings show the number to the
  // left of each pill; with no counts at all it falls back to the plain pills.
  counts?: Record<string, number>;
};

export function storyCardImage(input: StoryCardInput): ImageResponse {
  const brand = input.brandColor || "#0b5563";
  // Each sighting keeps its pluralized label and its optional count together, so
  // the count can sit beside the right pill. Counts are looked up by the trimmed
  // species name, matching how the caller keys them.
  const sightings = input.species
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((s) => {
      const n = Number(input.counts?.[s]);
      return {
        label: /s$/i.test(s) ? s : `${s}s`,
        count: Number.isFinite(n) && n > 0 ? n : null,
      };
    });
  const anyCount = sightings.some((x) => x.count !== null);
  const fontFamily = input.fonts ? "Archivo" : "sans-serif";

  return new ImageResponse(
    (
      <div style={{ width: STORY_W, height: STORY_H, display: "flex", flexDirection: "column", background: brand, color: INK, fontFamily }}>
        {/* Operator logo banner, on the brand color where their logo is built to sit. */}
        <div style={{ height: 268, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 60px" }}>
          {input.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={input.logoUrl} height={150} style={{ objectFit: "contain" }} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: 1, textAlign: "center" }}>{input.operatorName}</div>
          )}
        </div>

        {/* Hero photo, natural aspect, full bleed, never cropped. */}
        <div style={{ flex: "0 0 auto", display: "flex", position: "relative", overflow: "hidden" }}>
          {input.heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={input.heroUrl} width={STORY_W} style={{ display: "block" }} alt="" />
          ) : null}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 240, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)" }} />
          <div style={{ position: "absolute", left: 64, bottom: 44, display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase" }}>{input.label ?? "Photo of the day"}</div>
        </div>

        {/* Date, trip time, species, website, sitting just under the hero. */}
        <div style={{ flex: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "48px 64px 64px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700 }}>{input.dateText}</div>
            {input.timeText ? (
              <div style={{ display: "flex", marginTop: 16, fontSize: 28, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase", color: SOFT }}>{input.timeText}</div>
            ) : null}
          </div>

          {sightings.length ? (
            anyCount ? (
              // With counts: rows of a right-aligned number beside the species,
              // so the numbers and names line up. No boxes.
              <div style={{ display: "flex", justifyContent: "center", marginTop: 40, maxWidth: 940 }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {sightings.map(({ label, count }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", margin: "11px 0" }}>
                      <div style={{ display: "flex", width: 130, justifyContent: "flex-end", paddingRight: 28, fontSize: 42, fontWeight: 700 }}>{count !== null ? String(count) : ""}</div>
                      <div style={{ display: "flex", fontSize: 40, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // No counts: the plain species names, centered, no boxes.
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
                {sightings.map(({ label }) => (
                  <div key={label} style={{ display: "flex", margin: "8px 0", fontSize: 40, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                ))}
              </div>
            )
          ) : null}

          {input.website ? (
            <div style={{ display: "flex", marginTop: 44, fontSize: 30, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", color: SOFT }}>{input.website}</div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: STORY_W,
      height: STORY_H,
      fonts: input.fonts,
      // Let the browser reuse the rendered card so re-picking a hero already
      // viewed is instant. The PNG has no signed URL baked in, so caching it
      // briefly is safe.
      headers: { "cache-control": "private, max-age=600" },
    },
  );
}
