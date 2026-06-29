/*
  Protected operator home, the "Transfers" view. Just the recent sends, full
  width. Branding lives in Settings, so it is not duplicated here. A user with
  no operator is sent to onboarding.
*/
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";

function captainLine(name: string | null) {
  if (!name) return "Trip";
  return /^captain\b/i.test(name) ? name : `Captain ${name}`;
}

export default async function DashboardPage() {
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

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, created_at, trip_datetime, whale_count, captain_name, recipients(count)")
    .eq("operator_id", membership.operator_id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div className="fl-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Recent sends</h2>
            <Link href="/send" className="fl-btn" style={{ fontSize: "13.5px", padding: "9px 15px" }}>
              New send
            </Link>
          </div>

          {deliveries?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {deliveries.map((d, i) => {
                const guests = (d.recipients as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                const when = d.trip_datetime ?? d.created_at;
                return (
                  <Link
                    key={d.id}
                    href={`/deliveries/${d.id}`}
                    className="fl-slide-row"
                    style={{
                      ...sendRow,
                      animation: "fl-slide-in .5s cubic-bezier(.22,.61,.36,1) both",
                      animationDelay: `${Math.min(i, 12) * 45}ms`,
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>
                        {new Date(when).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                      <span style={{ fontSize: "12.5px", color: "var(--muted-2)" }}>
                        {captainLine(d.captain_name)}
                      </span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12.5px", color: "var(--muted)" }}>
                      {d.whale_count != null ? (
                        <span><b style={{ color: "var(--text)" }}>{d.whale_count}</b> whales</span>
                      ) : null}
                      <span><b style={{ color: "var(--text)" }}>{guests}</b> guests</span>
                      <span style={{ color: "var(--muted-2)" }}>{"›"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "13.5px" }}>
              No sends yet. Create your first one.
            </p>
          )}
        </div>
      </main>
    </>
  );
}

const sendRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  width: "100%",
  padding: "14px 16px",
  borderRadius: "11px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
  color: "var(--text)",
};
