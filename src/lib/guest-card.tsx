/*
  The guest sighting card: a shareable, guest-voice Instagram Story (1080x1920)
  that ships with every gallery. The words are the guest's own ("Today I saw
  humpback whales with {operator}"), the operator's logo and name ride along so
  their brand travels with every share. Full bleed hero with a scrim so the copy
  reads on any photo. Shares the same next/og pipeline and fonts as the operator
  story card; this is a second template, not a second pipeline.

  Template driven on purpose: guestCardImage is the one default. More templates
  can slot in later (a picker lives in the future Branding tab) without a rewrite.
*/
import "server-only";
import { ImageResponse } from "next/og";
import { STORY_W, STORY_H, pluralizeSpecies, loadStoryFonts, type StoryFont } from "@/lib/story-card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GalleryData } from "@/lib/gallery";

const INK = "#ffffff";
const SOFT = "rgba(255,255,255,0.82)";

export type GuestCardInput = {
  operatorName: string;
  logoUrl: string | null;
  brandColor: string;
  species: string[]; // raw, pluralized here
  dateText: string | null; // subtle, optional
  heroUrl: string | null;
  fonts?: StoryFont[];
};

// The guest-voice species line: names only, pluralized. Every species is
// shown ("Humpback Whales, Common Dolphins, Orcas & Blue Whales"), and the
// headline font shrinks to fit (headlineFontSize) so a full sighting reads in
// the guest's voice without ever bleeding off the card. Null when there are no
// species (the caller shows the fallback line).
export function speciesHeadline(species: string[]): string | null {
  const names = pluralizeSpecies(species);
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// The headline size steps down as the list grows, so one species stays big and
// bold and four or five still fit cleanly in the same space. The copy block is
// bottom anchored, so the attribution and date never move: only the headline
// scales within its own area.
function headlineFontSize(species: string[]): number {
  const n = pluralizeSpecies(species).length;
  if (n >= 5) return 46;
  if (n === 4) return 54;
  if (n === 3) return 64;
  if (n === 2) return 78;
  return 92;
}

// The pre-filled caption for the guest's share sheet, in their own voice, with
// the operator named and their Instagram tagged when we have it. Lower cased
// species read naturally mid sentence ("Today I saw humpback whales..."). No
// species falls back to the on-the-water line, so it is never empty.
export function guestShareCaption(
  species: string[],
  operatorName: string,
  handle: string | null,
): string {
  const names = pluralizeSpecies(species).map((s) => s.toLowerCase());
  let phrase: string | null = null;
  if (names.length === 1) phrase = names[0];
  else if (names.length === 2) phrase = `${names[0]} and ${names[1]}`;
  else if (names.length >= 3) phrase = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  const lead = phrase
    ? `Today I saw ${phrase} with ${operatorName}! 🐋`
    : `Today I was on the water with ${operatorName}! 🐋`;
  return handle ? `${lead} ${handle}` : lead;
}

// Build the gallery's story card from its data: first photo as the hero,
// signed just for the render, plus the operator's brand and the trip's species.
// Returns null when there is no usable photo, so callers skip it cleanly. Shared
// by the /card route (served) and the zip route (bytes), so the card is built
// one way everywhere.
export async function buildGuestCard(data: GalleryData): Promise<ImageResponse | null> {
  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("photos")
    .select("storage_key")
    .eq("delivery_id", data.delivery.id)
    .order("sort_order", { ascending: true })
    .limit(1);
  const heroKey = (photos?.[0]?.storage_key as string | undefined) ?? null;
  if (!heroKey) return null;

  // Sign the hero resized to the card frame, not the full resolution original.
  // The render only needs a 1080x1920 cover, so pulling the multi-megabyte
  // original just slowed every card down. Same Supabase transform the gallery
  // thumbnails use.
  const { data: signed } = await admin.storage.from("photos").createSignedUrl(heroKey, 600, {
    transform: { width: 1080, height: 1920, resize: "cover", quality: 80 },
  });
  const heroUrl = signed?.signedUrl ?? null;
  if (!heroUrl) return null;

  const dateText = data.delivery.trip_datetime
    ? new Date(data.delivery.trip_datetime).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  return guestCardImage({
    operatorName: data.operator.name,
    logoUrl: data.branding?.logo_url ?? null,
    brandColor: data.branding?.brand_color || "#0b5563",
    species: (data.delivery.species ?? []) as string[],
    dateText,
    heroUrl,
    fonts: await loadStoryFonts(),
  });
}

export function guestCardImage(input: GuestCardInput): ImageResponse {
  const fontFamily = input.fonts ? "Archivo" : "sans-serif";
  const headline = speciesHeadline(input.species);
  // Guest voice, first person. With species it is a real sighting; without, a
  // still-branded fallback so a thin trip never renders an empty species slot.
  const eyebrow = headline ? "Today I saw" : "Today I was";
  const bigLine = headline ?? "On the water";
  const bigSize = headlineFontSize(input.species);

  return new ImageResponse(
    (
      <div style={{ width: STORY_W, height: STORY_H, display: "flex", position: "relative", background: input.brandColor, color: INK, fontFamily }}>
        {/* Full bleed hero: the photo is the card. Cover, so it fills the story
            frame; the operator's ordering already put the lead photo first. */}
        {input.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={input.heroUrl} width={STORY_W} height={STORY_H} style={{ position: "absolute", inset: 0, width: STORY_W, height: STORY_H, objectFit: "cover", display: "block" }} alt="" />
        ) : null}

        {/* Top scrim so a logo in the corner reads on a bright sky. */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)" }} />
        {/* Bottom scrim so the guest copy reads on any photo. */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1180, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.9) 100%)" }} />

        {/* Operator logo, small, top-left, inside the story-safe top band. No
            logo means no corner mark: the name still rides in the copy below,
            so branding travels either way and nothing renders broken. */}
        {input.logoUrl ? (
          <div style={{ position: "absolute", top: 150, left: 72, display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={input.logoUrl} height={78} style={{ height: 78, objectFit: "contain" }} alt="" />
          </div>
        ) : null}

        {/* Guest copy, bottom, inside the story-safe band (clear of the reply
            bar). Eyebrow, the sighting in big type, then the attribution. */}
        <div style={{ position: "absolute", left: 72, right: 72, bottom: 300, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: 8, textTransform: "uppercase", color: SOFT, marginBottom: 18 }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: bigSize, fontWeight: 700, lineHeight: 1.04, marginBottom: 26, maxWidth: 936 }}>{bigLine}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>with {input.operatorName}</div>
          {input.dateText ? (
            <div style={{ display: "flex", marginTop: 20, fontSize: 26, fontWeight: 500, letterSpacing: 5, textTransform: "uppercase", color: "rgba(255,255,255,0.68)" }}>{input.dateText}</div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: STORY_W,
      height: STORY_H,
      fonts: input.fonts,
      // Safe to cache briefly: the PNG has no signed URL baked into it.
      headers: { "cache-control": "private, max-age=600" },
    },
  );
}
