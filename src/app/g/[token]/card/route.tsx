/*
  The guest sighting card render, one per gallery. Public, reached by the
  recipient token exactly like the gallery page: guests are not signed in, so
  the lookup runs with the service role, scoped to the token. Signs the hero
  photo just long enough to compose the PNG. A 404 (no gallery, expired, or no
  usable photo) is the signal for the gallery to quietly hide the share card,
  so a thin trip never shows something broken.
*/
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStoryFonts } from "@/lib/story-card";
import { guestCardImage } from "@/lib/guest-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// trip_datetime is the naive local departure clock tagged +00; the rest of the
// app renders it in UTC, so format in UTC too.
const TZ = "UTC";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data || isExpired(data.delivery.expires_at)) {
    return new Response("Not found", { status: 404 });
  }
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

  let heroUrl: string | null = null;
  if (heroKey) {
    const { data: signed } = await admin.storage.from("photos").createSignedUrl(heroKey, 600);
    heroUrl = signed?.signedUrl ?? null;
  }
  // No usable photo: nothing worth showing, so skip rather than render broken.
  if (!heroUrl) {
    return new Response("No card", { status: 404 });
  }

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
