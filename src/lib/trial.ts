/*
  Free trial limits and usage. The trial allows up to TRIAL_TRANSFERS transfers,
  regardless of how many guest emails those transfers reach. Usage is counted
  live from the deliveries table (RLS scopes it to the operator), so there is no
  counter to keep in sync. "No subscription row" reads as trial.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tier } from "./stripe";

export const TRIAL_TRANSFERS = 3;

export type TrialUsage = {
  status: "trial" | "active" | "canceled";
  transfers: number;
};

export async function getTrialUsage(
  supabase: SupabaseClient,
  operatorId: string,
): Promise<TrialUsage> {
  // Two independent reads, one round trip of latency.
  const [{ data: sub }, { count: transfers }] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("operator_id", operatorId).maybeSingle(),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("operator_id", operatorId),
  ]);

  return {
    status: (sub?.status as TrialUsage["status"]) ?? "trial",
    transfers: transfers ?? 0,
  };
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
    // One plan today, so the tier is always "fleet" regardless of what a row
    // stores (a canceled row has a null tier). Feature and cap gating reads the
    // single plan; access itself is gated by status and the trial allowance.
    tier: "fleet",
  };
}
