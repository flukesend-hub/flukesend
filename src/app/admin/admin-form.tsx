"use client";

/*
  Admin comp form. Type an operator's signup email, pick a tier, and comp or
  remove the comp. Calls the server actions directly. No em dashes anywhere.
*/
import { useState, useTransition } from "react";
import { compOperator, uncompOperator, type AdminState } from "./actions";

const TIERS = [
  { key: "fleet", label: "Fleet (unlimited)" },
  { key: "two", label: "Two boats" },
  { key: "single", label: "Single boat" },
];

export function AdminForm() {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("fleet");
  const [state, setState] = useState<AdminState>(undefined);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<AdminState>) {
    setState(undefined);
    start(async () => setState(await fn()));
  }

  return (
    <div className="fl-card" style={{ maxWidth: "640px" }}>
      <h3 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600 }}>Comp an operator</h3>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Comp gives unlimited free use (paying outside the app, extended trial).
        Removing it drops them to the free trial so they can subscribe in app.
      </p>

      <label style={{ display: "block", marginBottom: "12px" }}>
        <span className="fl-label-text">Operator signup email</span>
        <input
          className="fl-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@theirtours.com"
          autoComplete="off"
        />
      </label>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Tier</span>
        <select className="fl-input" value={tier} onChange={(e) => setTier(e.target.value)}>
          {TIERS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          className="fl-btn"
          disabled={pending}
          onClick={() => run(() => compOperator(email, tier))}
        >
          {pending ? "Working..." : "Comp"}
        </button>
        <button
          type="button"
          className="fl-btn-ghost"
          disabled={pending}
          onClick={() => run(() => uncompOperator(email))}
        >
          Remove comp
        </button>
      </div>
    </div>
  );
}
