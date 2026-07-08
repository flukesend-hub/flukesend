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
