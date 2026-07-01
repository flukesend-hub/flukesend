/*
  Admin actions. Set any operator's plan from the admin table, and edit an
  operator's branding for support. Everything is gated by requireAdmin and runs
  with the service role, since it writes other operators' rows across RLS.

  Plans: "trial" removes the subscription row (they fall back to the free trial
  and can subscribe in app); single/two/fleet comp them at that tier with no
  Stripe ids. Changing the plan is refused when a real Stripe customer exists,
  so a paying subscription is never orphaned.
*/
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { uploadOperatorLogo } from "@/lib/logo-upload";
import { SOCIAL_PLATFORMS, normalizeSocialUrl } from "@/lib/social";

export type AdminState = { error?: string; ok?: string } | undefined;

const PLANS = ["trial", "single", "two", "fleet"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function setPlan(operatorId: string, plan: string): Promise<AdminState> {
  await requireAdmin();
  if (!operatorId) return { error: "Missing operator." };
  if (!(PLANS as readonly string[]).includes(plan)) return { error: "Pick a valid plan." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (sub?.stripe_customer_id) {
    return { error: "This operator pays through Stripe. Manage their plan in Stripe." };
  }

  if (plan === "trial") {
    await admin.from("subscriptions").delete().eq("operator_id", operatorId);
  } else {
    const { error } = await admin
      .from("subscriptions")
      .upsert({ operator_id: operatorId, status: "active", tier: plan }, { onConflict: "operator_id" });
    if (error) return { error: "Could not update the plan. Try again." };
  }

  revalidatePath("/admin");
  return { ok: "Plan updated." };
}

// Edit an operator's branding for support. Same fields the operator can edit
// themselves (logo, color, default message, retention, website and socials),
// but scoped to any operator by id and written with the service role.
export async function adminUpdateBranding(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const operatorId = String(formData.get("operator_id") ?? "");
  if (!operatorId) return { error: "Missing operator." };

  const brandColor = (String(formData.get("brand_color") ?? "").trim() || "#0b5563").toLowerCase();
  const defaultMessage = String(formData.get("default_message") ?? "").trim();
  const retentionRaw = Number(formData.get("retention_days"));
  if (!HEX.test(brandColor)) return { error: "Pick a valid brand color." };
  const retentionDays = Number.isFinite(retentionRaw) ? Math.trunc(retentionRaw) : NaN;
  if (![1, 3, 7].includes(retentionDays)) return { error: "Pick 1, 3, or 7 days of retention." };

  const upload = await uploadOperatorLogo(operatorId, formData.get("logo"));
  if (!upload.ok) return { error: upload.error };

  const update: Record<string, unknown> = {
    brand_color: brandColor,
    default_message: defaultMessage,
    retention_days: retentionDays,
  };
  if (upload.logoUrl) update.logo_url = upload.logoUrl;
  for (const p of SOCIAL_PLATFORMS) {
    const r = normalizeSocialUrl(String(formData.get(p.key) ?? ""));
    if ("error" in r) return { error: `${p.label}: ${r.error}` };
    update[p.column] = r.url;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("branding").update(update).eq("operator_id", operatorId);
  if (error) return { error: "Could not save branding. Try again." };

  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin");
  return { ok: "Branding saved." };
}
