/*
  Free trial limits and usage. The trial allows up to TRIAL_TRANSFERS transfers
  or TRIAL_EMAILS guest emails, whichever comes first. Usage is counted live
  from the deliveries and recipients tables (RLS scopes both to the operator),
  so there is no counter to keep in sync. "No subscription row" reads as trial.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tier } from "./stripe";

export const TRIAL_TRANSFERS = 3;
export const TRIAL_EMAILS = 30;

export type TrialUsage = {
  status: "trial" | "active" | "canceled";
  transfers: number;
  emails: number;
};

export async function getTrialUsage(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<TrialUsage> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("operator_id", operatorId)
    .maybeSingle();
  const status = (sub?.status as TrialUsage["status"]) ?? "trial";

  const { count: transfers } = await supabase
    .from("deliveries")
    .select("*", { count: "exact", head: true })
    .eq("operator_id", operatorId);

  // RLS scopes recipients to this operator's deliveries.
  const { count: emails } = await supabase
    .from("recipients")
    .select("*", { count: "exact", head: true });

  return { status, transfers: transfers ?? 0, emails: emails ?? 0 };
}

export type Plan = {
  status: "trial" | "active" | "canceled";
  tier: Tier;
};

// The operator's plan. No subscription row reads as trial on the entry tier.
export async function getPlan(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<Plan> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, tier")
    .eq("operator_id", operatorId)
    .maybeSingle();
  return {
    status: (data?.status as Plan["status"]) ?? "trial",
    tier: (data?.tier as Tier) ?? "single",
  };
}

// How many boats a plan allows. The tiers are named for boat count: single is
// one, two is two, fleet is unlimited. Only an active subscription unlocks more
// than one; trial and canceled operators get the entry level of one boat.
export function boatLimitFor(plan: Plan): number {
  if (plan.status !== "active") return 1;
  if (plan.tier === "fleet") return Infinity;
  if (plan.tier === "two") return 2;
  return 1;
}
