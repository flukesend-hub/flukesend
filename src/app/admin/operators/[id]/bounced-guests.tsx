"use client";

/*
  Support panel for bounced guest emails. One row per bounced recipient with an
  inline corrected-address field. Saving fixes the address and, while the
  gallery is still live, resends their delivery email in the same move; on an
  expired send the address is saved for the export list and the button says so.
*/
import { useState, useTransition } from "react";
import { adminFixBouncedEmail, type AdminState } from "../../actions";

export type BouncedGuest = {
  recipientId: string;
  email: string;
  tripLabel: string;
  expired: boolean;
};

export function BouncedGuests({ guests }: { guests: BouncedGuest[] }) {
  const [state, setState] = useState<AdminState>(undefined);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  if (!guests.length) return null;

  function fix(recipientId: string) {
    const draft = (drafts[recipientId] ?? "").trim();
    setState(undefined);
    setSavingId(recipientId);
    start(async () => {
      const r = await adminFixBouncedEmail(recipientId, draft);
      setState(r);
      setSavingId(null);
    });
  }

  return (
    <section id="bounced" className="fl-card" style={{ marginTop: "18px", borderColor: "rgba(194,83,63,.28)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600 }}>
        Bounced emails ({guests.length})
      </h3>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        These guests never got their photos. Type the corrected address and save;
        while the gallery is live the delivery email goes out again automatically.
      </p>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 10px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 10px" }}>{state.ok}</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {guests.map((g) => (
          <div key={g.recipientId} style={row}>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--bad)", overflowWrap: "anywhere" }}>
                {g.email}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted-2)" }}>
                {g.tripLabel}
                {g.expired ? " · gallery expired, save only" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: "1 1 260px" }}>
              <input
                type="email"
                placeholder="corrected address"
                className="fl-input"
                style={{ flex: "1 1 180px", fontSize: "13px" }}
                value={drafts[g.recipientId] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [g.recipientId]: e.target.value }))}
              />
              <button
                type="button"
                className="fl-btn"
                disabled={savingId === g.recipientId || !(drafts[g.recipientId] ?? "").trim()}
                onClick={() => fix(g.recipientId)}
                style={{ flex: "0 0 auto" }}
              >
                {savingId === g.recipientId
                  ? "Saving..."
                  : g.expired
                    ? "Save address"
                    : "Save and resend"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const row: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  flexWrap: "wrap",
  border: "1px solid var(--line)",
  borderRadius: "11px",
  padding: "11px 13px",
};
