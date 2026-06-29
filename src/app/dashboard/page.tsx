/*
  Protected operator home, dark workspace with the persistent nav. A user with
  no operator is sent to onboarding. RLS scopes every read to the user's own
  operator.
*/
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";

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

  const { data: branding } = await supabase
    .from("branding")
    .select("brand_color, default_message, retention_days, plan")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, created_at, trip_datetime, whale_count, captain_name, recipients(count)")
    .eq("operator_id", membership.operator_id)
    .order("created_at", { ascending: false })
    .limit(8);

  const brand = branding?.brand_color ?? "#0b5563";

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={shell}>
        <div className="fl-eyebrow">Workspace</div>
        <h1 className="fl-h1">{operator?.name ?? "Your operator"}</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
          Signed in as {user.email}
        </p>

        <div className="fl-side" style={{ gridTemplateColumns: "340px 1fr", marginTop: "22px" }}>
          <div className="fl-card">
            <h3 style={h3}>Your branding</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
              <RowBetween label="Brand color">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: brand, border: "1px solid rgba(255,255,255,.2)" }} />
                  {brand}
                </span>
              </RowBetween>
              <RowBetween label="Retention">
                <span style={{ fontSize: "13px" }}>{branding?.retention_days ?? 5} days</span>
              </RowBetween>
              <RowBetween label="Plan">
                <span style={{ fontSize: "13px", textTransform: "capitalize" }}>{branding?.plan ?? "base"}</span>
              </RowBetween>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "13px" }}>
                <div style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "5px" }}>Default message</div>
                <div style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>
                  {branding?.default_message || "No default message set."}
                </div>
              </div>
            </div>
          </div>

          <div className="fl-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Recent sends</h3>
              <Link href="/send" className="fl-btn" style={{ fontSize: "13.5px", padding: "9px 15px" }}>
                New send
              </Link>
            </div>
            {deliveries?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {deliveries.map((d) => {
                  const guests = (d.recipients as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                  const when = d.trip_datetime ?? d.created_at;
                  return (
                    <Link key={d.id} href={`/deliveries/${d.id}`} style={sendRow}>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>
                          {new Date(when).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        </span>
                        <span style={{ fontSize: "12.5px", color: "var(--muted-2)" }}>
                          {d.captain_name ? `Captain ${d.captain_name}` : "Trip"}
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12.5px", color: "var(--muted)" }}>
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
        </div>
      </main>
    </>
  );
}

function RowBetween({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>{label}</span>
      {children}
    </div>
  );
}

const shell: React.CSSProperties = { padding: "16px 28px 80px" };
const h3: React.CSSProperties = { margin: "0 0 14px", fontSize: "15px", fontWeight: 600 };
const sendRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  width: "100%",
  padding: "13px 15px",
  borderRadius: "11px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
  color: "var(--text)",
};
