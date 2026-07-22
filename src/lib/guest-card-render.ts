/*
  Resolves a gallery into its rendered guest sighting card. Shared by the card
  route (the preview and the per tile download) and the zip route (which bundles
  the PNG with the photos), so every path paints the exact same card. Returns
  null when there is no usable hero photo: a thin trip has no card anywhere
  rather than a broken one.
*/
import "server-only";
import type { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStoryFonts, STORY_W, STORY_H } from "@/lib/story-card";
import { guestCardImage } from "@/lib/guest-card";
import type { GalleryData } from "@/lib/gallery";

// trip_datetime is the naive local departure clock tagged +00; the rest of the
// app renders it in UTC, so format in UTC too.
const TZ = "UTC";

export async function renderGuestCard(data: GalleryData): Promise<ImageResponse | null> {
  const { delivery, operator, branding } = data;

  const admin = createAdminClient();
  // Hero: the first photo by the operator's own ordering, the lead of the send.
  const { data: photos } = await admin
    .from("photos")
    .select("storage_key")
    .eq("delivery_id", delivery.id)
    .order("sort_order", { ascending: true })
    .limit(1);
  const heroKey = (photos?.[0]?.storage_key as string | undefined) ?? null;
  // No usable photo: nothing worth showing, so skip rather than render broken.
  if (!heroKey) return null;

  // Sign the hero resized to the card frame, not the original: the composite
  // only needs 1080x1920 pixels, and pulling a multi MB original into the
  // renderer on every request is what made the preview slow. The transform is
  // the same Supabase Pro feature the gallery thumbs use; if signing it fails,
  // fall back to the full photo so the card still renders.
  const { data: resized } = await admin.storage.from("photos").createSignedUrl(heroKey, 600, {
    transform: { width: STORY_W, height: STORY_H, resize: "cover", quality: 80 },
  });
  let heroUrl = resized?.signedUrl ?? null;
  if (!heroUrl) {
    const { data: signed } = await admin.storage.from("photos").createSignedUrl(heroKey, 600);
    heroUrl = signed?.signedUrl ?? null;
  }
  if (!heroUrl) return null;

  const dateText = delivery.trip_datetime
    ? new Date(delivery.trip_datetime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ })
    : null;

  return guestCardImage({
    operatorName: operator.name,
    logoUrl: branding?.logo_url ?? null,
    brandColor: branding?.brand_color || "#0b5563",
    species: (delivery.species ?? []) as string[],
    dateText,
    heroUrl,
    fonts: await loadStoryFonts(),
  });
}
