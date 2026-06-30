/*
  Shared operator logo upload. Validates an optional logo file from a form and
  stores it under the operator's folder in the branding bucket, replacing any
  existing file so only one logo is ever kept. Uses the service role admin
  client because writing to Storage is a trusted server operation; files are
  namespaced under the operator id so one operator can never touch another's.
  Used by both onboarding (first logo) and settings (replace logo).
*/
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export type LogoUploadResult =
  | { ok: true; logoUrl: string | null }
  | { ok: false; error: string };

// Returns the public URL for a stored logo, or null when no file was provided.
// A non-empty file that fails validation returns an error instead.
export async function uploadOperatorLogo(
  operatorId: string,
  file: FormDataEntryValue | null,
): Promise<LogoUploadResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, logoUrl: null };
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { ok: false, error: "Logo must be a PNG, JPG, WEBP, or SVG." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be under 5 MB." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.storage.from("branding").list(operatorId);
  if (existing && existing.length) {
    await admin.storage
      .from("branding")
      .remove(existing.map((f) => `${operatorId}/${f.name}`));
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const path = `${operatorId}/logo.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("branding")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    return { ok: false, error: "Could not upload the logo. Try again." };
  }

  const { data: pub } = admin.storage.from("branding").getPublicUrl(path);
  // Cache bust so a replaced logo shows right away instead of the old cached one.
  return { ok: true, logoUrl: `${pub.publicUrl}?v=${Date.now()}` };
}
