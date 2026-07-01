/*
  Admin screen for the Flukesend owner. Gated by requireAdmin (email allowlist).
  Set any operator's plan inline and open the support branding editor. Reads use
  the service role since this spans all operators.
*/
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminOperators, type OperatorRow } from "./admin-operators";

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [operatorsRes, membersRes, subsRes, usersRes] = await Promise.all([
    admin.from("operators").select("id, name, created_at").order("created_at", { ascending: true }),
    admin.from("operator_members").select("operator_id, user_id"),
    admin.from("subscriptions").select("operator_id, status, tier, stripe_customer_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const ownerByOp = new Map((membersRes.data ?? []).map((m) => [m.operator_id, emailById.get(m.user_id) ?? ""]));
  const subByOp = new Map((subsRes.data ?? []).map((s) => [s.operator_id, s]));

  const rows: OperatorRow[] = (operatorsRes.data ?? []).map((o) => {
    const s = subByOp.get(o.id);
    const paid = s?.status === "active" && !!s?.stripe_customer_id;
    const comped = s?.status === "active" && !s?.stripe_customer_id;
    return {
      operatorId: o.id,
      name: o.name,
      email: ownerByOp.get(o.id) ?? "",
      paid,
      tier: (s?.tier as string) ?? null,
      value: comped ? (s!.tier as string) : "trial",
    };
  });

  return (
    <main style={{ padding: "28px", maxWidth: "820px", margin: "0 auto" }}>
      <a href="/send" className="fl-link">&larr; Back to app</a>
      <h1 className="fl-h1" style={{ marginTop: "8px" }}>Admin</h1>
      <p className="fl-muted" style={{ fontSize: "14px", margin: "0 0 20px" }}>
        Set each operator&apos;s plan, or edit their branding for support.
      </p>
      <AdminOperators rows={rows} />
    </main>
  );
}
