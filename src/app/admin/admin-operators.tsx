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

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            <th style={cell}>Operator</th>
            <th style={cell}>Owner</th>
            <th style={cell}>Plan</th>
            <th style={cell}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.operatorId} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={cell}>{r.name}</td>
              <td style={{ ...cell, color: "var(--muted)" }}>{r.email}</td>
              <td style={cell}>
                {r.paid ? (
                  <span style={{ color: "var(--muted)" }}>Paid ({r.tier})</span>
                ) : (
                  <select
                    className="fl-input"
                    style={{ fontSize: "13px", padding: "7px 9px", minWidth: "170px" }}
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
              </td>
              <td style={{ ...cell, textAlign: "right" }}>
                <a href={`/admin/operators/${r.operatorId}`} className="fl-link">
                  Edit branding
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cell: React.CSSProperties = { padding: "9px 6px", verticalAlign: "middle" };
