/*
  Per-send story card: the "Download story card" button on the send confirmation
  page. A quick path into the same render the Story Builder uses, scoped to one
  trip. Operator only: the delivery is read through the RLS client scoped to the
  signed in operator, and the private hero photo is signed with the service role
  just for the render. An optional ?p=<photoId> picks a hero other than the first.
*/
import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { HERO_H, STORY_W, loadStoryFonts, storyCardImage } from "@/lib/story-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// trip_datetime is stored as the naive local departure clock time tagged +00 (a
// 9am trip is 09:00:00+00) and the rest of the app renders it in UTC, so format
// in UTC too: a 9am trip reads "9:00 AM" rather than being timezone shifted.
const TZ = "UTC";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, operatorId } = await requireOperator();

  // RLS scopes this to the operator's own sends; a foreign id comes back empty.
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, species, trip_datetime")
    .eq("id", id)
    .maybeSingle();
  if (!delivery) {
    return new Response("Not found", { status: 404 });
  }

  const [{ data: branding }, { data: operator }, { data: photos }] = await Promise.all([
    supabase.from("branding").select("brand_color, logo_url, website_url").eq("operator_id", operatorId).maybeSingle(),
    supabase.from("operators").select("name").eq("id", operatorId).maybeSingle(),
    supabase.from("photos").select("id, storage_key").eq("delivery_id", id).order("sort_order", { ascending: true }),
  ]);

  // Hero: the requested photo if it belongs to this send, else the first one.
  const wanted = new URL(request.url).searchParams.get("p");
  const rows = photos ?? [];
  const hero = (wanted && rows.find((p) => p.id === wanted)) || rows[0] || null;

  let heroUrl: string | null = null;
  if (hero?.storage_key) {
    const admin = createAdminClient();
    // Sign the hero resized to the card's hero box, not the full resolution
    // original: the box letterboxes with objectFit contain, so "contain" keeps
    // the whole photo uncropped and the render only fetches what it draws. If
    // the transform signing ever fails, fall back to the full-size URL so the
    // card still renders.
    const key = hero.storage_key as string;
    const { data: signed } = await admin.storage.from("photos").createSignedUrl(key, 600, {
      transform: { width: STORY_W, height: HERO_H, resize: "contain", quality: 80 },
    });
    heroUrl = signed?.signedUrl ?? null;
    if (!heroUrl) {
      const { data: full } = await admin.storage.from("photos").createSignedUrl(key, 600);
      heroUrl = full?.signedUrl ?? null;
    }
  }

  const trip = delivery.trip_datetime ? new Date(delivery.trip_datetime as string) : null;
  const website = ((branding?.website_url as string | null) ?? "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/.*$/, "");

  return storyCardImage({
    brandColor: (branding?.brand_color as string) || "#0b5563",
    logoUrl: (branding?.logo_url as string | null) ?? null,
    operatorName: (operator?.name as string) || "",
    website,
    species: (delivery.species ?? []) as string[],
    dateText: trip ? trip.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ }) : "",
    timeText: trip ? trip.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : null,
    heroUrl,
    fonts: await loadStoryFonts(),
  });
}
