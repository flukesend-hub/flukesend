/*
  Story Builder render. Given a day (?d=YYYY-MM-DD) and an optional hero photo
  (?hero=<photoId>), draws the day's card: the sightings unioned across every
  trip that day, and the chosen hero as the photo of the day. Operator only.
  Reads go through the RLS client, so a day or a hero from another operator
  simply returns nothing; the hero is only signed once confirmed to belong to
  one of this operator's trips that day.
*/
import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStoryFonts, storyCardImage } from "@/lib/story-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "UTC";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { supabase, operatorId } = await requireOperator();
  const url = new URL(request.url);
  const d = url.searchParams.get("d") ?? "";
  const heroId = url.searchParams.get("hero");
  // Optional subset of the day's trips to include, e.g. just the 3pm departure.
  // Absent means the whole day.
  const tParam = url.searchParams.get("t");
  const wanted = tParam ? new Set(tParam.split(",").filter(Boolean)) : null;
  // A slideshow frame labels the hero "Photos from today" instead of the single
  // card's "Photo of the day".
  const label = url.searchParams.get("kind") === "slideshow" ? "Photos from today" : "Photo of the day";
  if (!DATE_RE.test(d)) {
    return new Response("Bad date", { status: 400 });
  }

  const dayStart = `${d}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  // The operator's trips on that UTC day.
  const { data: dels } = await supabase
    .from("deliveries")
    .select("id, species, species_counts, trip_datetime")
    .eq("operator_id", operatorId)
    .gte("trip_datetime", dayStart)
    .lt("trip_datetime", dayEnd)
    .order("trip_datetime", { ascending: true });
  const dayDeliveries = dels ?? [];
  if (!dayDeliveries.length) {
    return new Response("No trips that day", { status: 404 });
  }
  // Restrict to the requested trips when a valid subset is given; any unknown id
  // is simply ignored (the filter only keeps this operator's own day trips), and
  // an empty result falls back to the whole day.
  const filtered = wanted ? dayDeliveries.filter((x) => wanted.has(x.id as string)) : dayDeliveries;
  const deliveries = filtered.length ? filtered : dayDeliveries;
  const deliveryIds = deliveries.map((x) => x.id as string);

  // Union of species across the selected trips, keeping first-seen order.
  const seen = new Set<string>();
  const species: string[] = [];
  for (const dv of deliveries) {
    for (const raw of ((dv.species ?? []) as string[])) {
      const s = raw.trim();
      const k = s.toLowerCase();
      if (s && !seen.has(k)) {
        seen.add(k);
        species.push(s);
      }
    }
  }

  // Take the HIGHEST per-trip count for each species across the selected trips,
  // not the sum: the same animals are often seen on more than one trip, so a sum
  // would badly overstate the day. The most seen at once is the honest number. A
  // species with no number on any trip simply has no count.
  const countByKey = new Map<string, number>();
  for (const dv of deliveries) {
    const sc = (dv.species_counts ?? {}) as Record<string, unknown>;
    for (const [name, val] of Object.entries(sc)) {
      const k = name.trim().toLowerCase();
      const n = Number(val);
      if (k && Number.isFinite(n) && n > 0) countByKey.set(k, Math.max(countByKey.get(k) ?? 0, n));
    }
  }
  const counts: Record<string, number> = {};
  for (const s of species) {
    const n = countByKey.get(s.toLowerCase());
    if (n && n > 0) counts[s] = n;
  }

  // Photos across the day, for hero validation and default.
  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_key, sort_order")
    .in("delivery_id", deliveryIds)
    .order("sort_order", { ascending: true });
  const rows = photos ?? [];
  const hero = (heroId && rows.find((p) => p.id === heroId)) || rows[0] || null;

  let heroUrl: string | null = null;
  if (hero?.storage_key) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage.from("photos").createSignedUrl(hero.storage_key as string, 600);
    heroUrl = signed?.signedUrl ?? null;
  }

  const [{ data: branding }, { data: operator }] = await Promise.all([
    supabase.from("branding").select("brand_color, logo_url, website_url").eq("operator_id", operatorId).maybeSingle(),
    supabase.from("operators").select("name").eq("id", operatorId).maybeSingle(),
  ]);
  const website = ((branding?.website_url as string | null) ?? "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/.*$/, "");

  // A single-trip day shows its departure time; a multi-trip day shows the date only.
  const single = deliveries.length === 1 && !!deliveries[0].trip_datetime;
  const dateText = new Date(dayStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
  const timeText = single
    ? new Date(deliveries[0].trip_datetime as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })
    : null;

  return storyCardImage({
    brandColor: (branding?.brand_color as string) || "#0b5563",
    logoUrl: (branding?.logo_url as string | null) ?? null,
    operatorName: (operator?.name as string) || "",
    website,
    species,
    counts,
    dateText,
    timeText,
    heroUrl,
    label,
    fonts: await loadStoryFonts(),
  });
}
