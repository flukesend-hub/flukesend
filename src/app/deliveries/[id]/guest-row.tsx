"use client";

/*
  A guest on the Send created page. Shows the email with a pencil to fix it
  inline, a Resend button that re-sends the gallery delivery email, and a Copy
  link button for that guest's personal gallery URL.
*/
import { useState } from "react";
import { resendDelivery, updateRecipientEmail } from "./actions";

export function GuestRow({
  id,
  email: initialEmail,
  galleryUrl,
}: {
  id: string;
  email: string;
  galleryUrl: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [draft, setDraft] = useState(initialEmail);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "resend">("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setBusy("save");
    setNote(null);
    const res = await updateRecipientEmail(id, draft);
    setBusy("");
    if ("error" in res) {
      setNote({ text: res.error, ok: false });
      return;
    }
    setEmail(res.email ?? draft);
    setEditing(false);
  }

  async function resend() {
    setBusy("resend");
    setNote(null);
    const res = await resendDelivery(id);
    setBusy("");
    setNote("error" in res ? { text: res.error, ok: false } : { text: "Resent", ok: true });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setNote({ text: "Link copied", ok: true });
    } catch {
      setNote({ text: "Could not copy", ok: false });
    }
  }

  return (
    <div style={card}>
      <div style={top}>
        {editing ? (
          <div style={{ display: "flex", gap: "8px", flex: 1, flexWrap: "wrap" }}>
            <input
              className="fl-input"
              style={{ flex: "1 1 200px", fontSize: "13.5px", padding: "8px 11px" }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              type="email"
              autoFocus
            />
            <button onClick={save} disabled={busy === "save"} className="fl-btn" style={smallBtn}>
              {busy === "save" ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setDraft(email);
                setEditing(false);
                setNote(null);
              }}
              className="fl-btn-ghost"
              style={{ padding: "7px 12px" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span style={emailText}>{email}</span>
            <div style={actions}>
              <button onClick={() => setEditing(true)} style={iconBtn} title="Edit email" aria-label="Edit email">
                <Pencil />
              </button>
              <button onClick={resend} disabled={busy === "resend"} style={actionBtn}>
                {busy === "resend" ? "Sending..." : "Resend"}
              </button>
              <button onClick={copy} style={actionBtn}>
                Copy link
              </button>
            </div>
          </>
        )}
      </div>
      {note ? (
        <span style={{ fontSize: "12px", color: note.ok ? "var(--good)" : "var(--bad)" }}>
          {note.text}
        </span>
      ) : null}
    </div>
  );
}

function Pencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
};
const top: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};
const emailText: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "14px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const actions: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", flex: "0 0 auto" };
const actionBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--text)",
  background: "transparent",
  border: "1px solid var(--line-strong)",
  borderRadius: "8px",
  padding: "6px 11px",
  cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: "30px",
  height: "30px",
  color: "var(--muted)",
  background: "transparent",
  border: "1px solid var(--line-strong)",
  borderRadius: "8px",
  cursor: "pointer",
};
const smallBtn: React.CSSProperties = { fontSize: "13px", padding: "7px 14px" };
