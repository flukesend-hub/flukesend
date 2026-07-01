/*
  Admin screen for the Flukesend owner. Gated by requireAdmin (email allowlist).
  Comp operators who pay outside the app, and see every operator's current plan
  at a glance. Reads use the service role since this spans all operators.
*/
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminForm } from "./admin-form";

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

  const rows = (operatorsRes.data ?? []).map((o) => {
    const s = subByOp.get(o.id);
    let plan = "Trial";
    if (s?.status === "active") plan = s.stripe_customer_id ? `Paid (${s.tier})` : `Comped (${s.tier})`;
    else if (s?.status === "canceled") plan = "Canceled";
    return { name: o.name, email: ownerByOp.get(o.id) ?? "", plan };
  });

  return (
    <main style={{ padding: "28px", maxWidth: "820px", margin: "0 auto" }}>
      <a href="/send" className="fl-link">&larr; Back to app</a>
      <h1 className="fl-h1" style={{ marginTop: "8px" }}>Admin</h1>
      <p className="fl-muted" style={{ fontSize: "14px", margin: 0 }}>
        Comp operators who pay outside the app.
      </p>

      <div style={{ marginTop: "20px" }}>
        <AdminForm />
      </div>

      <div className="fl-card" style={{ marginTop: "16px", maxWidth: "640px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>
          Operators ({rows.length})
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={cell}>Operator</th>
              <th style={cell}>Owner</th>
              <th style={cell}>Plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={cell}>{r.name}</td>
                <td style={{ ...cell, color: "var(--muted)" }}>{r.email}</td>
                <td style={cell}>{r.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const cell: React.CSSProperties = { padding: "8px 6px", verticalAlign: "top" };
