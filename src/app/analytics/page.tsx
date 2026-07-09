/*
  Operator analytics, dark workspace. The single plan includes full analytics:
  the month funnel, the trend, per boat and per employee breakdowns, and a CSV
  export. Reads go through the RLS server client, so the numbers are always this
  operator's own.
*/
import { requireOperator } from "@/lib/operator-session";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getAnalytics, getDeliveryRows } from "@/lib/analytics";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { supabase, operatorId, operatorName } = await requireOperator();

  // Both reads fire together; RLS keeps each scoped to this operator, and one
  // parallel wave beats two serial ones.
  const [data, allRows] = await Promise.all([
    getAnalytics(supabase, operatorId),
    getDeliveryRows(supabase, operatorId),
  ]);
  // The per trip table reuses the CSV export rows, newest first.
  const recentSends = allRows.slice(0, 12);

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

        <AnalyticsView data={data} recentSends={recentSends} />
      </main>
    </>
  );
}
