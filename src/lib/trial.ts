/*
  Free trial limits and usage. The trial allows up to TRIAL_TRANSFERS transfers
  or TRIAL_EMAILS guest emails, whichever comes first. Usage is counted live
  from the deliveries and recipients tables (RLS scopes both to the operator),
  so there is no counter to keep in sync. "No subscription row" reads as trial.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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
