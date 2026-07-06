"use client";

/*
  Admin operators table. Each row has a plan dropdown to set the operator's plan
  directly (free trial, or comp at a tier). Operators paying through Stripe show
  a read only "Paid" label so their subscription is never touched here. An Edit
  branding link opens the support editor for that operator. No em dashes.
*/
import { useState, useTransition } from "react";
import { setPlan, type AdminState } from "./actions";

export type OperatorRow = {
  operatorId: string;
  name: string;
  email: string;
  paid: boolean;
  tier: string | null;
  value: string;
};

const OPTIONS = [
  { value: "trial", label: "Free trial" },
  { value: "canceled", label: "No plan (must buy)" },
  { value: "single", label: "Comp: Single boat" },
  { value: "two", label: "Comp: Two boats" },
  { value: "fleet", label: "Comp: Fleet" },
];

export function AdminOperators({ rows }: { rows: OperatorRow[] }) {
  const [state, setState] = useState<AdminState>(undefined);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, start] = useTransition();

  function change(operatorId: string, plan: string) {
    setState(undefined);
    setSavingId(operatorId);
    start(async () => {
      const r = await setPlan(operatorId, plan);
      setState(r);
      setSavingId(null);
    });
  }

  return (
    <div className="fl-card" style={{ maxWidth: "760px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>
        Operators ({rows.length})
      </h3>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}

      {/* Stacked rows, not a table: the owner email is long and a fixed four
          column table overflows a phone. Each row reflows, name and controls
          side by side on desktop, controls wrapping under the name on mobile. */}
      <div>
        {rows.map((r) => (
          <div key={r.operatorId} style={rowWrap}>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{r.name}</div>
              <div style={{ color: "var(--muted)", fontSize: "12.5px", overflowWrap: "anywhere", marginTop: "2px" }}>
                {r.email || "No sign-in owner (demo)"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              {r.paid ? (
                <span style={{ color: "var(--muted)", fontSize: "13.5px" }}>Paid ({r.tier})</span>
              ) : (
                <select
                  className="fl-input"
                  style={{ fontSize: "13px", padding: "7px 9px", minWidth: "160px" }}
                  value={r.value}
                  disabled={savingId === r.operatorId}
                  onChange={(e) => change(r.operatorId, e.target.value)}
                >
                  {OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              <a href={`/admin/operators/${r.operatorId}`} className="fl-link" style={{ fontSize: "13.5px" }}>
                Edit branding
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const rowWrap: React.CSSProperties = {
  borderTop: "1px solid var(--line)",
  padding: "13px 4px",
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 16px",
  alignItems: "center",
  justifyContent: "space-between",
};
