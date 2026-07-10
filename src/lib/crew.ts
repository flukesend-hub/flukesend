/*
  Resolve the crew aboard a send into faces for the review email. The send
  stores its people by name (captain, naturalist, photographer, and the crew
  list); we match those to the roster to pick up each person's photo and their
  show-to-guests flag. Ordered captain, naturalist, photographer, then the rest,
  deduped. Anyone hidden is dropped; anyone not on the roster still shows with
  an initials circle. Server only (reads through the admin client).
*/
import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

export type CrewFace = { firstName: string; photoUrl: string | null };

type Admin = ReturnType<typeof createAdminClient>;

type AboardSend = {
  captain_name?: string | null;
  naturalist_name?: string | null;
  photographer_name?: string | null;
  crew_names?: string[] | null;
};

export async function resolveAboardCrew(
  admin: Admin,
  operatorId: string,
  d: AboardSend,
): Promise<CrewFace[]> {
  const ordered = [
    d.captain_name,
    d.naturalist_name,
    d.photographer_name,
    ...(d.crew_names ?? []),
  ].filter((n): n is string => Boolean(n && n.trim()));

  const seen = new Set<string>();
  const names = ordered.filter((n) => {
    const k = n.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!names.length) return [];

  const { data: rows } = await admin
    .from("crew_members")
    .select("name, photo_url, show_to_guests")
    .eq("operator_id", operatorId)
    .in("name", names);
  const byName = new Map<string, { photoUrl: string | null; show: boolean }>();
  for (const r of rows ?? []) {
    byName.set((r.name as string).trim().toLowerCase(), {
      photoUrl: (r.photo_url as string | null) ?? null,
      show: r.show_to_guests !== false,
    });
  }

  const faces: CrewFace[] = [];
  for (const n of names) {
    const meta = byName.get(n.trim().toLowerCase());
    // Hidden crew are dropped; a typed name not on the roster still shows.
    if (meta && meta.show === false) continue;
    faces.push({ firstName: n.trim().split(/\s+/)[0], photoUrl: meta?.photoUrl ?? null });
  }
  return faces;
}
