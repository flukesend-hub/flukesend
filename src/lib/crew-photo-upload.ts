/*
  Crew photo upload. Stores a staff headshot in the public branding bucket
  under crew/{operatorId}/{crewId}.{ext}, the same public-URL setup as the
  logo, so the emails can render it. Service role because Storage writes are a
  trusted server operation; the path is namespaced under the operator id so one
  operator can never touch another's. Any prior photo for this crew id (any
  extension) is removed so only one is kept.
*/
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_CREW_PHOTO_BYTES = 5 * 1024 * 1024;
export const CREW_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type CrewPhotoResult =
  | { ok: true; photoUrl: string }
  | { ok: false; error: string };

async function removeExisting(operatorId: string, crewId: string) {
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("branding").list(`crew/${operatorId}`);
  const stale = (files ?? [])
    .filter((f) => f.name.startsWith(`${crewId}.`))
    .map((f) => `crew/${operatorId}/${f.name}`);
  if (stale.length) {
    await admin.storage.from("branding").remove(stale);
  }
}

export async function uploadCrewPhoto(
  operatorId: string,
  crewId: string,
  file: FormDataEntryValue | null,
): Promise<CrewPhotoResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a photo." };
  }
  if (!CREW_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: "Photo must be a PNG, JPG, or WEBP." };
  }
  if (file.size > MAX_CREW_PHOTO_BYTES) {
    return { ok: false, error: "Photo must be under 5 MB." };
  }

  await removeExisting(operatorId, crewId);

  const admin = createAdminClient();
  const ext = file.type.split("/")[1];
  const path = `crew/${operatorId}/${crewId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("branding")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) {
    return { ok: false, error: "Could not upload the photo. Try again." };
  }
  const { data: pub } = admin.storage.from("branding").getPublicUrl(path);
  // Cache bust so a replaced photo shows right away.
  return { ok: true, photoUrl: `${pub.publicUrl}?v=${Date.now()}` };
}

export async function removeCrewPhotoFiles(operatorId: string, crewId: string) {
  await removeExisting(operatorId, crewId);
}
