"use client";

/*
  Photo retention, split out of the old branding card now that look and voice
  live on the Branding tab. Retention is a mechanics setting, not a look, so
  it stays here in Settings. Three fixed choices, posted to updateRetention.
*/
import { useActionState, useState } from "react";
import { updateRetention, type SettingsState } from "./actions";

export function RetentionForm({ retentionDays }: { retentionDays: number }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateRetention,
    undefined,
  );
  const [retention, setRetention] = useState(retentionDays);

  return (
    <form action={formAction}>
      <p className="fl-hint" style={{ margin: "0 0 12px" }}>
        How long each gallery stays up after a send. Guests are reminded to
        save before it expires.
      </p>
      <input type="hidden" name="retention_days" value={retention} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {[3, 5, 7].map((d) => (
          <button key={d} type="button" onClick={() => setRetention(d)} style={retBtn(retention === d)}>
            {d} days
          </button>
        ))}
      </div>
      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}
      <button type="submit" disabled={pending} className="fl-btn">
        {pending ? "Saving..." : "Save retention"}
      </button>
    </form>
  );
}

const retBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  cursor: "pointer",
  font: "inherit",
  fontSize: "14px",
  fontWeight: 600,
  padding: "11px 0",
  borderRadius: "10px",
  border: `1px solid ${active ? "var(--signal)" : "var(--line-strong)"}`,
  background: active ? "var(--signal)" : "transparent",
  color: active ? "var(--signal-ink)" : "var(--text)",
});
