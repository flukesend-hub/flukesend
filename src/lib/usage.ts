/*
  Monthly recipient usage. The usage table holds one row per operator per
  calendar month with recipients_used, the customer facing "emails" number for
  that period. Reads go through whatever client is passed (RLS lets an operator
  read their own rows); the increment is server only and goes through the admin
  client, since guest facing captures will later credit the same counter.

  The unit is recipients, not raw emails. See plans.ts for why.
*/
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

// The period key for a date, e.g. "2026-06". UTC based so it does not drift
// with the server timezone.
export function currentPeriod(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Recipients this operator has used in the given period (default: now).
export async function getRecipientsUsed(
  supabase: SupabaseClient,
  operatorId: string,
  period: string = currentPeriod(),
): Promise<number> {
  const { data } = await supabase
    .from("usage")
    .select("recipients_used")
    .eq("operator_id", operatorId)
    .eq("period", period)
    .maybeSingle();
  return data?.recipients_used ?? 0;
}

// Add to the operator's counter for the period. Atomic: the increment happens
// inside Postgres via a security definer function, so concurrent sends cannot
// clobber each other. Admin client only.
export async function incrementRecipientsUsed(
  operatorId: string,
  count: number,
  period: string = currentPeriod(),
): Promise<void> {
  if (count <= 0) return;
  const admin = createAdminClient();
  await admin.rpc("increment_recipients_used", {
    p_operator_id: operatorId,
    p_period: period,
    p_count: count,
  });
}

export type MonthlyQuota = {
  used: number;
  limit: number | null;
  // Recipients still allowed this month, or null when the plan is unlimited.
  remaining: number | null;
};

// Combine the operator's usage with a plan's monthly cap into a quota view for
// the /send and /billing screens.
export function monthlyQuota(used: number, limit: number | null): MonthlyQuota {
  if (limit === null) return { used, limit: null, remaining: null };
  return { used, limit, remaining: Math.max(0, limit - used) };
}
