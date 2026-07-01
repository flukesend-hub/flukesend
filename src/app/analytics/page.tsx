/*
  Operator analytics, dark workspace. Basic plans (Inshore) see the current
  month funnel only. Full plans (Offshore, Fleet) also get the trend, per boat
  and per employee breakdowns, and a CSV export. Reads go through the RLS server
  client, so the numbers are always this operator's own.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getPlan } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getAnalytics } from "@/lib/analytics";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, operators(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  const operator = membership.operators as unknown as { name: string } | null;
  const operatorId = membership.operator_id as string;

  const plan = PLANS[(await getPlan(supabase, operatorId)).tier];
  const isFull = plan.analytics === "full";

  const data = await getAnalytics(supabase, operatorId);

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div className="fl-eyebrow">Analytics</div>
        <h1 className="fl-h1" style={{ fontSize: "32px" }}>
          {data.monthLabel}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
          How your sends move from a guest reached to a photo downloaded to a
          review ask, plus the guests captured by QR.
        </p>

        <AnalyticsView data={data} isFull={isFull} planName={plan.displayName} />
      </main>
    </>
  );
}
