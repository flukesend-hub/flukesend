"use client";

/*
  A simple named-list manager, reused for boats and for the crew roster. Existing
  items show as rows with a remove control; the add row appends a new one. The
  add and delete server actions are passed in by the settings page.
*/
import { useActionState } from "react";
import type { SettingsState } from "./actions";

type Item = { id: string; name: string };

export function RosterList({
  title,
  hint,
  placeholder,
  addLabel,
  emptyLabel,
  items,
  addAction,
  deleteAction,
  limit = Infinity,
  upgradeNote = "",
}: {
  title: string;
  hint: string;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  items: Item[];
  addAction: (prev: SettingsState, fd: FormData) => Promise<SettingsState>;
  deleteAction: (fd: FormData) => void | Promise<void>;
  limit?: number;
  upgradeNote?: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    addAction,
    undefined,
  );

  return (
    <div>
      <h4 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600 }}>{title}</h4>
      <p className="fl-hint" style={{ margin: "0 0 12px" }}>
        {hint}
      </p>

      {items.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "12px" }}>
          {items.map((it) => (
            <div key={it.id} style={row}>
              <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{it.name}</span>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={it.id} />
                <button type="submit" title="Remove" style={removeBtn}>
                  {"×"}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: "0 0 12px" }}>
          {emptyLabel}
        </p>
      )}

      {items.length >= limit ? (
        <div style={upgradeBox}>
          <span style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.45 }}>
            {upgradeNote || "Your plan is at its limit. Upgrade to add more."}
          </span>
          <a href="/billing" className="fl-btn" style={{ flex: "0 0 auto", textDecoration: "none", whiteSpace: "nowrap" }}>
            See plans
          </a>
        </div>
      ) : (
        <form action={formAction} style={{ display: "flex", gap: "8px" }}>
          <input name="name" className="fl-input" style={{ fontSize: "13px", padding: "9px 11px" }} placeholder={placeholder} />
          <button type="submit" disabled={pending} className="fl-btn-ghost" style={{ flex: "0 0 auto" }}>
            {pending ? "Adding..." : addLabel}
          </button>
        </form>
      )}
      {state?.upgrade ? (
        <div style={{ ...upgradeBox, marginTop: "8px" }}>
          <span style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.45 }}>{state.error}</span>
          <a href="/billing" className="fl-btn" style={{ flex: "0 0 auto", textDecoration: "none", whiteSpace: "nowrap" }}>
            See plans
          </a>
        </div>
      ) : state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "12.5px", margin: "8px 0 0" }}>{state.error}</p>
      ) : null}
    </div>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
};
const upgradeBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "11px",
  border: "1px solid rgba(63,122,77,.45)",
  background: "rgba(63,122,77,.12)",
};
const removeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--muted)",
  borderRadius: "8px",
  cursor: "pointer",
  width: "34px",
  height: "30px",
  fontSize: "16px",
};
