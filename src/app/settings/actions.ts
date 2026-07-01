/*
  Operator settings actions: edit branding, upload a logo, and manage review
  links. Branding and review-link writes go through the RLS client because a
  member is allowed those by policy. The logo upload uses the service role admin
  client because writing to Storage is a trusted server operation; files are
  namespaced under the operator id so one operator can never touch another's.
*/
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadOperatorLogo } from "@/lib/logo-upload";
import { isCrewRole } from "@/lib/roles";
import { SOCIAL_PLATFORMS, normalizeSocialUrl } from "@/lib/social";
import { normalizeSpecies } from "@/lib/species";

export type SettingsState =
  | { error?: string; ok?: string; upgrade?: boolean }
  | undefined;

const HEX = /^#[0-9a-fA-F]{6}$/;

// Resolve the signed in user and the operator they belong to. Bounces to login
// or onboarding if either is missing, so callers can assume both exist.
async function resolveOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  return { supabase, operatorId: membership.operator_id as string };
}

export async function updateBranding(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const brandColor = (
    String(formData.get("brand_color") ?? "").trim() || "#0b5563"
  ).toLowerCase();
  const defaultMessage = String(formData.get("default_message") ?? "").trim();
  const retentionRaw = Number(formData.get("retention_days"));

  if (!HEX.test(brandColor)) {
    return { error: "Pick a valid brand color." };
  }
  const retentionDays = Number.isFinite(retentionRaw)
    ? Math.trunc(retentionRaw)
    : NaN;
  if (![1, 3, 7].includes(retentionDays)) {
    return { error: "Pick 1, 3, or 7 days of retention." };
  }

  // Logo is optional on save. When present, replace whatever is in the
  // operator's folder so only one logo is ever kept.
  const upload = await uploadOperatorLogo(operatorId, formData.get("logo"));
  if (!upload.ok) {
    return { error: upload.error };
  }

  const update: Record<string, unknown> = {
    brand_color: brandColor,
    default_message: defaultMessage,
    retention_days: retentionDays,
  };
  if (upload.logoUrl) {
    update.logo_url = upload.logoUrl;
  }

  const { error } = await supabase
    .from("branding")
    .update(update)
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your branding. Try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: "Branding saved." };
}

// Website and the social links. Each platform maps to one branding column. A
// blank field clears that link; a bare host gets https:// added for the
// operator. The whole save fails with one message if any link cannot be parsed.
export async function updateSocialLinks(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const update: Record<string, string | null> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const result = normalizeSocialUrl(String(formData.get(platform.key) ?? ""));
    if ("error" in result) {
      return { error: `${platform.label}: ${result.error}` };
    }
    update[platform.column] = result.url;
  }

  const { error } = await supabase
    .from("branding")
    .update(update)
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your links. Try again." };
  }

  revalidatePath("/settings");
  return { ok: "Links saved." };
}

// The operator's species list, picked from the catalog or typed in. Saved to
// branding.species_options and shown as the pills on the send form.
export async function updateSpecies(species: string[]): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();
  const clean = normalizeSpecies(species);
  const { error } = await supabase
    .from("branding")
    .update({ species_options: clean })
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your species list. Try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/send");
  return { ok: "Species saved." };
}

export async function removeLogo(): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  const admin = createAdminClient();
  const { data: existing } = await admin.storage
    .from("branding")
    .list(operatorId);
  if (existing && existing.length) {
    await admin.storage
      .from("branding")
      .remove(existing.map((f) => `${operatorId}/${f.name}`));
  }
  await supabase
    .from("branding")
    .update({ logo_url: null })
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function addReviewLink(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();

  const label = String(formData.get("label") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();

  if (!label) {
    return { error: "Enter a label for the link." };
  }
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    new URL(url);
  } catch {
    return { error: "Enter a valid URL." };
  }

  // New links go to the end of the list.
  const { data: last } = await supabase
    .from("review_destinations")
    .select("sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("review_destinations")
    .insert({ operator_id: operatorId, label, url, sort_order: sortOrder });
  if (error) {
    return { error: "Could not add the link. Try again." };
  }

  revalidatePath("/settings");
  return { ok: "Link added." };
}

export async function deleteReviewLink(formData: FormData): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  // RLS already scopes this to the operator; the operator_id match is belt and
  // suspenders.
  await supabase
    .from("review_destinations")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
}

// Boats and crew roster. Both are simple named lists scoped to the operator.
// extra lets a caller seed columns beyond name/sort_order (crew uses it to give
// a new person a starting role).
async function addNamed(
  table: "boats" | "crew_members",
  formData: FormData,
  extra: Record<string, unknown> = {},
): Promise<SettingsState> {
  const { supabase, operatorId } = await resolveOperator();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a name." };
  }
  const { data: last } = await supabase
    .from(table)
    .select("sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from(table)
    .insert({ operator_id: operatorId, name, sort_order: sortOrder, ...extra });
  if (error) {
    return { error: "Could not add it. Try again." };
  }
  revalidatePath("/settings");
  revalidatePath("/send");
  return { ok: "Added." };
}

// Replace a crew member's role tags. Roles drive which send dropdown the person
// appears in. Unknown values are dropped so only the four known roles persist.
export async function setCrewRoles(id: string, roles: string[]): Promise<void> {
  const { supabase, operatorId } = await resolveOperator();
  if (!id) {
    return;
  }
  const clean = Array.from(new Set(roles.filter(isCrewRole)));
  await supabase
    .from("crew_members")
    .update({ roles: clean })
    .eq("id", id)
    .eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/send");
}

async function deleteNamed(table: "boats" | "crew_members", formData: FormData) {
  const { supabase, operatorId } = await resolveOperator();
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  await supabase.from(table).delete().eq("id", id).eq("operator_id", operatorId);
  revalidatePath("/settings");
  revalidatePath("/send");
}

export async function addBoat(_prev: SettingsState, formData: FormData) {
  // Boats are unlimited on every plan, so there is no gate here anymore.
  return addNamed("boats", formData);
}
export async function deleteBoat(formData: FormData) {
  return deleteNamed("boats", formData);
}
export async function addCrew(_prev: SettingsState, formData: FormData) {
  // A new person starts with no roles; the operator tags what they do.
  return addNamed("crew_members", formData, { roles: [] });
}
export async function deleteCrew(formData: FormData) {
  return deleteNamed("crew_members", formData);
}
