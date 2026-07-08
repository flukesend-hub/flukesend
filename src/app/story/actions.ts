/*
  Story Builder data. Called from the client when a day is picked: returns that
  day's photos as signed thumbnails to choose the hero from. RLS scopes the
  deliveries and photos to the signed in operator; the thumbnails are signed with
  the service role since the photos bucket is private.
*/
"use server";

import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DayPhoto = { id: string; thumbUrl: string };

export async function getDayPhotos(date: string): Promise<DayPhoto[]> {
  if (!DATE_RE.test(date)) return [];
  const { supabase, operatorId } = await requireOperator();

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = new Date(new Date(dayStart).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: dels } = await supabase
    .from("deliveries")
    .select("id")
    .eq("operator_id", operatorId)
    .gte("trip_datetime", dayStart)
    .lt("trip_datetime", dayEnd);
  const ids = (dels ?? []).map((d) => d.id as string);
  if (!ids.length) return [];

  const { data: photos } = await supabase
    .from("photos")
    .select("id, storage_key, sort_order")
    .in("delivery_id", ids)
    .order("sort_order", { ascending: true });
  const rows = photos ?? [];
  if (!rows.length) return [];

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
  return rows
    .map((r, i) => ({ id: r.id as string, thumbUrl: thumbs[i]?.data?.signedUrl ?? "" }))
    .filter((p) => p.thumbUrl);
}
