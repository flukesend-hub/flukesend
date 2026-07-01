/*
  Admin actions: comp an operator (unlimited free use) or remove a comp. Both
  are gated by requireAdmin and run with the service role, since they write
  another operator's subscription row across RLS. Comp is an upsert to
  active/tier with no Stripe ids; removing a comp deletes the row so they drop
  back to the free trial and can subscribe normally. Removing is refused when a
  real Stripe customer exists, so a paying subscription is never orphaned.
*/
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminState = { error?: string; ok?: string } | undefined;

const TIERS = ["single", "two", "fleet"] as const;

// Resolve an operator id from its owner's signup email.
async function operatorIdForEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const user = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) return null;
  const { data: membership } = await admin
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (membership?.operator_id as string) ?? null;
}

export async function compOperator(email: string, tier: string): Promise<AdminState> {
  await requireAdmin();
  const e = email.trim().toLowerCase();
  if (!e) return { error: "Enter the operator's signup email." };
  if (!(TIERS as readonly string[]).includes(tier)) return { error: "Pick a tier." };

  const admin = createAdminClient();
  const operatorId = await operatorIdForEmail(admin, e);
  if (!operatorId) {
    return { error: "No operator found for that email. They need to sign up first." };
  }
  const { error } = await admin
    .from("subscriptions")
    .upsert({ operator_id: operatorId, status: "active", tier }, { onConflict: "operator_id" });
  if (error) return { error: "Could not comp them. Try again." };

  revalidatePath("/admin");
  return { ok: `Comped as ${tier}. They now have unlimited free use.` };
}

export async function uncompOperator(email: string): Promise<AdminState> {
  await requireAdmin();
  const e = email.trim().toLowerCase();
  if (!e) return { error: "Enter the operator's signup email." };

  const admin = createAdminClient();
  const operatorId = await operatorIdForEmail(admin, e);
  if (!operatorId) return { error: "No operator found for that email." };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (sub?.stripe_customer_id) {
    return {
      error: "This operator has a real Stripe customer. Manage it in Stripe, not here.",
    };
  }

  await admin.from("subscriptions").delete().eq("operator_id", operatorId);
  revalidatePath("/admin");
  return { ok: "Comp removed. They are back on the free trial and can subscribe anytime." };
}
