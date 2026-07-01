/*
  Operator analytics, dark workspace. Basic plans (Inshore) see the current
  month funnel only. Full plans (Offshore, Fleet) also get the trend, per boat
  and per employee breakdowns, and a CSV export. Reads go through the RLS server
  client, so the numbers are always this operator's own.
*/
import { requireOperator } from "@/lib/operator-session";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getPlan } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getAnalytics, getDeliveryRows } from "@/lib/analytics";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { supabase, operatorId, operatorName } = await requireOperator();

  // All three fire together. The per trip rows are fetched speculatively and
  // dropped for basic plans; RLS keeps every read scoped either way, and one
  // parallel wave beats three serial ones.
  const [planInfo, data, allRows] = await Promise.all([
    getPlan(supabase, operatorId),
    getAnalytics(supabase, operatorId),
    getDeliveryRows(supabase, operatorId),
  ]);
  const plan = PLANS[planInfo.tier];
  const isFull = plan.analytics === "full";
  // The per trip table reuses the CSV export rows, newest first. Full plan
  // only, like the other breakdowns.
  const recentSends = isFull ? allRows.slice(0, 12) : [];

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div className="fl-eyebrow">Analytics</div>
        <h1 className="fl-h1" style={{ fontSize: "32px" }}>
          {data.monthLabel}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
          How your sends move from a guest reached to a photo downloaded to a
          review ask, plus the guests captured by QR.
        </p>

        <AnalyticsView
          data={data}
          recentSends={recentSends}
          isFull={isFull}
          planName={plan.displayName}
        />
      </main>
    </>
  );
}
