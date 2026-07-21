/*
  Admin console for the Flukesend owner. Gated by requireAdmin (email
  allowlist). A slim tool shell, not a marketing page: wordmark, section name,
  actions, then straight into the numbers. Reads use the service role since
  this spans all operators.
*/
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorHealth, emptyHealth } from "@/lib/admin-health";
import { signout } from "@/app/auth/actions";
import { AdminOperators, type OperatorRow } from "./admin-operators";
import { InviteOperator } from "./invite-operator";

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [operatorsRes, membersRes, subsRes, usersRes, health] = await Promise.all([
    admin.from("operators").select("id, name, created_at").order("created_at", { ascending: true }),
    admin.from("operator_members").select("operator_id, user_id, role"),
    admin.from("subscriptions").select("operator_id, status, tier, stripe_customer_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    getOperatorHealth(admin),
  ]);

  const emailById = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  // The email on each card is the operator's own: the owner's. Without the role
  // filter this Map kept whichever member happened to be iterated last, so an
  // operator with team members could show a crew member's email instead. Prefer
  // the owner; fall back to any member only when no owner row exists.
  const ownerByOp = new Map<string, string>();
  for (const m of membersRes.data ?? []) {
    const email = emailById.get(m.user_id) ?? "";
    if (!email) continue;
    if (m.role === "owner" || !ownerByOp.has(m.operator_id)) ownerByOp.set(m.operator_id, email);
  }
  const subByOp = new Map((subsRes.data ?? []).map((s) => [s.operator_id, s]));

  const rows: OperatorRow[] = (operatorsRes.data ?? []).map((o) => {
    const s = subByOp.get(o.id);
    const paid = s?.status === "active" && !!s?.stripe_customer_id;
    const comped = s?.status === "active" && !s?.stripe_customer_id;
    let value = "trial";
    if (comped) value = s!.tier as string;
    else if (s?.status === "canceled") value = "canceled";
    return {
      operatorId: o.id,
      name: o.name,
      email: ownerByOp.get(o.id) ?? "",
      paid,
      tier: (s?.tier as string) ?? null,
      value,
      health: health.get(o.id) ?? emptyHealth(),
    };
  });

  return (
    <main style={{ padding: "0 24px 40px", maxWidth: "1060px", margin: "0 auto" }}>
      <header style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/flukesend-wordmark-black.png"
            alt="Flukesend"
            style={{ height: "20px", width: "auto", display: "block" }}
          />
          <span style={sectionTag}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <InviteOperator />
          <form action={signout}>
            <button type="submit" style={signoutBtn} title="Sign out">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AdminOperators rows={rows} />
    </main>
  );
}

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  padding: "16px 0 18px",
};
const sectionTag: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "var(--muted)",
  background: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "999px",
  padding: "3px 10px",
};
const signoutBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};
