/*
  Admin screen for the Flukesend owner. Gated by requireAdmin (email allowlist).
  Set any operator's plan inline and open the support branding editor. Reads use
  the service role since this spans all operators.
*/
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorHealth, emptyHealth } from "@/lib/admin-health";
import { signout } from "@/app/auth/actions";
import { AdminOperators, type OperatorRow } from "./admin-operators";

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [operatorsRes, membersRes, subsRes, usersRes, health] = await Promise.all([
    admin.from("operators").select("id, name, created_at").order("created_at", { ascending: true }),
    admin.from("operator_members").select("operator_id, user_id"),
    admin.from("subscriptions").select("operator_id, status, tier, stripe_customer_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    getOperatorHealth(admin),
  ]);

  const emailById = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const ownerByOp = new Map((membersRes.data ?? []).map((m) => [m.operator_id, emailById.get(m.user_id) ?? ""]));
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
    <main style={{ padding: "28px 24px", maxWidth: "1060px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <h1 className="fl-h1">Admin</h1>
          <p className="fl-muted" style={{ fontSize: "14px", margin: "0 0 20px" }}>
            Your fleet at a glance. Anything that needs you rises to the top.
          </p>
        </div>
        <form action={signout}>
          <button type="submit" className="fl-btn-ghost" style={{ flex: "0 0 auto" }}>
            Sign out
          </button>
        </form>
      </div>
      <AdminOperators rows={rows} />
    </main>
  );
}
