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
  // Three independent reads, one round trip of latency. RLS scopes the
  // recipients count to this operator's deliveries.
  const [{ data: sub }, { count: transfers }, { count: emails }] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("operator_id", operatorId).maybeSingle(),
    supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .eq("operator_id", operatorId),
    supabase.from("recipients").select("*", { count: "exact", head: true }),
  ]);

  return {
    status: (sub?.status as TrialUsage["status"]) ?? "trial",
    transfers: transfers ?? 0,
    emails: emails ?? 0,
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
