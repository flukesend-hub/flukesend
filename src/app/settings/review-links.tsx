"use client";

/*
  Review links manager, dark workspace. Existing links show as rows with a
  remove control; the add row appends a new one. These become the buttons in
  the review email. The per send override toggle is presentational; sends
  already accept a custom message.
*/
import { useActionState, useState } from "react";
import { addReviewLink, deleteReviewLink, type SettingsState } from "./actions";
import { Toggle } from "@/app/_ui/controls";

type LinkRow = { id: string; label: string; url: string };

export function ReviewLinks({ links }: { links: LinkRow[] }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    addReviewLink,
    undefined,
  );
  const [override, setOverride] = useState(true);

  return (
    <div className="fl-card">
      <h3 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600 }}>Review links</h3>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Add one or several. These become the buttons in the review email.
      </p>

      {links.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          {links.map((link) => (
            <div key={link.id} style={rowGrid}>
              <input className="fl-input" style={rowInput} value={link.label} readOnly />
              <input className="fl-input" style={rowInput} value={link.url} readOnly />
              <form action={deleteReviewLink}>
                <input type="hidden" name="id" value={link.id} />
                <button type="submit" title="Remove" style={removeBtn}>
                  {"×"}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: "0 0 14px" }}>
          No review links yet.
        </p>
      )}

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "8px" }}>
          <input name="label" className="fl-input" style={rowInput} placeholder="Label" />
          <input name="url" className="fl-input" style={rowInput} placeholder="Link" />
        </div>
        <button type="submit" disabled={pending} className="fl-btn-ghost" style={{ alignSelf: "flex-start" }}>
          {pending ? "Adding..." : "Add another"}
        </button>
      </form>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "10px 0 0" }}>{state.error}</p>
      ) : null}

      <div style={overrideRow}>
        <Toggle on={override} onToggle={() => setOverride(!override)} label="Per send override" />
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
          Let each send override the default message
        </span>
      </div>
    </div>
  );
}

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.4fr auto",
  gap: "8px",
};
const rowInput: React.CSSProperties = { fontSize: "13px", padding: "9px 11px", borderRadius: "9px" };
const removeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--muted)",
  borderRadius: "9px",
  cursor: "pointer",
  width: "40px",
  height: "100%",
  fontSize: "17px",
};
const overrideRow: React.CSSProperties = {
  marginTop: "24px",
  borderTop: "1px solid var(--line)",
  paddingTop: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
};
