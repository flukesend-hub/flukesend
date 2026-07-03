/*
  In-app billing, dark workspace. Shows the operator's current plan and lets
  them subscribe (Stripe Checkout) or manage/cancel (Stripe portal). RLS lets a
  member read their own subscription row.
*/
import { requireOperator } from "@/lib/operator-session";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { PLANS } from "@/lib/plans";
import { getRecipientsUsed, monthlyQuota } from "@/lib/usage";
import { BillingClient } from "./billing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: checkout } = await searchParams;
  const { supabase, operatorId, operatorName } = await requireOperator();

  // Both reads fire together; usage is speculative (only shown on a paid
  // plan) but one spare head count beats a second serial wave.
  const [{ data: sub }, used] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, tier, billing_cycle")
      .eq("operator_id", operatorId)
      .maybeSingle(),
    getRecipientsUsed(supabase, operatorId),
  ]);
  const status = (sub?.status as "trial" | "active" | "canceled") ?? "trial";

  // Emails remaining this month, shown for operators on a paid plan.
  let quotaNote: string | null = null;
  if (status === "active" && sub?.tier) {
    const plan = PLANS[sub.tier as "single" | "two" | "fleet"];
    const q = monthlyQuota(used, plan.emailsPerMonth);
    quotaNote =
      q.remaining === null
        ? `Unlimited emails this month on your ${plan.displayName} plan.`
        : `${q.remaining} of ${q.limit} emails remaining this month (${q.used} used).`;
  }

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <main style={{ maxWidth: "920px", margin: "0 auto", padding: "16px 28px 80px" }}>
        <h1 className="fl-h1">Billing</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
          {status === "active"
            ? "You are on a paid plan. Manage or switch any time."
            : status === "canceled"
              ? "Your plan has ended. Pick a plan to keep sending."
              : "You are on the free trial. Pick a plan to keep sending past the trial."}
        </p>

        {quotaNote ? (
          <p style={{ color: "var(--text)", fontSize: "13.5px", margin: "10px 0 0", fontWeight: 500 }}>
            {quotaNote}
          </p>
        ) : null}

        {checkout === "success" ? (
          <div style={banner("ok")}>
            Payment received. Your plan is active. It can take a few seconds for the
            status to update.
          </div>
        ) : checkout === "canceled" ? (
          <div style={banner("warn")}>Checkout canceled. Nothing was charged.</div>
        ) : null}

        <BillingClient
          status={status}
          tier={(sub?.tier as "single" | "two" | "fleet" | null) ?? null}
          cycle={(sub?.billing_cycle as "monthly" | "yearly" | null) ?? null}
        />
      </main>
    </>
  );
}

function banner(kind: "ok" | "warn"): React.CSSProperties {
  const ok = kind === "ok";
  return {
    marginTop: "16px",
    padding: "12px 16px",
    borderRadius: "11px",
    fontSize: "13.5px",
    border: `1px solid ${ok ? "rgba(47,143,99,.4)" : "rgba(31,111,156,.45)"}`,
    background: ok ? "rgba(47,143,99,.12)" : "rgba(31,111,156,.14)",
    color: ok ? "#0f6e56" : "#1c3a52",
  };
}
