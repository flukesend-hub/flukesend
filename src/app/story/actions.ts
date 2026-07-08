/*
  Story Builder data. Called when a day is picked: returns that day's trips, each
  with its departure time, its sightings, and its photos as signed thumbnails, so
  the builder can let the operator toggle which trips to include and pick the hero
  from the included ones. RLS scopes deliveries and photos to the signed in
  operator; thumbnails are signed with the service role since the bucket is private.
*/
"use server";

import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DayPhoto = { id: string; thumbUrl: string };
export type DayTrip = { id: string; timeLabel: string; species: string[]; photos: DayPhoto[] };
export type PostUrl = { id: string; url: string; filename: string };

export async function getDay(date: string): Promise<DayTrip[]> {
  if (!DATE_RE.test(date)) return [];
  const { supabase, operatorId } = await requireOperator();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: dels } = await supabase
    .from("deliveries")
    .select("id, trip_datetime, species")
    .eq("operator_id", operatorId)
    .gte("trip_datetime", dayStart)
    .lt("trip_datetime", dayEnd)
    .order("trip_datetime", { ascending: true });
  const deliveries = dels ?? [];
  if (!deliveries.length) return [];
  const ids = deliveries.map((d) => d.id as string);

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_key, delivery_id, sort_order")
    .in("delivery_id", ids)
    .order("sort_order", { ascending: true });
  const rows = photos ?? [];

  const admin = createAdminClient();
  const thumbs = await Promise.all(
    rows.map((r) =>
      admin.storage
        .from("photos")
        .createSignedUrl(r.storage_key as string, 3600, {
          transform: { width: 400, height: 400, resize: "cover", quality: 65 },
        }),
    ),
  );
  const photosByDelivery = new Map<string, DayPhoto[]>();
  rows.forEach((r, i) => {
    const url = thumbs[i]?.data?.signedUrl;
    if (!url) return;
    const key = r.delivery_id as string;
    const arr = photosByDelivery.get(key) ?? [];
    arr.push({ id: r.id as string, thumbUrl: url });
    photosByDelivery.set(key, arr);
  });

  return deliveries.map((d) => ({
    id: d.id as string,
    timeLabel: d.trip_datetime
      ? new Date(d.trip_datetime as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
      : "Trip",
    species: ((d.species ?? []) as string[]).map((s) => s.trim()).filter(Boolean),
    photos: photosByDelivery.get(d.id as string) ?? [],
  }));
}

// Full resolution signed URLs for the photos the operator chose to post. The
// day grid only carries 400px thumbnails, which are too small for Instagram, so
// Post mode signs the originals just for the selected ids at save time (not for
// the whole day up front). The ids come from the client, so the read goes
// through the RLS client: any id that is not one of this operator's own photos
// simply returns nothing.
export async function getPostUrls(ids: string[]): Promise<PostUrl[]> {
  const clean = [...new Set(ids)].filter((id) => typeof id === "string" && id.length > 0).slice(0, 10);
  if (!clean.length) return [];
  const { supabase } = await requireOperator();

  const { data: rows } = await supabase
    .from("photos")
    .select("id, storage_key, filename")
    .in("id", clean);
  const photos = rows ?? [];
  if (!photos.length) return [];

  const admin = createAdminClient();
  const signed = await Promise.all(
    photos.map((p) =>
      admin.storage.from("photos").createSignedUrl(p.storage_key as string, 600),
    ),
  );
  const out: PostUrl[] = [];
  photos.forEach((p, i) => {
    const url = signed[i]?.data?.signedUrl;
    if (!url) return;
    const raw = (p.filename as string | null) || `photo-${(p.id as string).slice(0, 8)}.jpg`;
    out.push({ id: p.id as string, url, filename: raw.replace(/[\r\n"\\]/g, "") });
  });
  return out;
}
