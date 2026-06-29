"use client";

/*
  The Transfers panel. Slides in from the right over whatever page you are on
  when you click Transfers in the nav. Loads recent sends on open. Clicking a
  send goes to its detail page; clicking the backdrop or Escape closes it.
*/
import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentSends, type RecentSend } from "./transfers-actions";

function captainLine(name: string | null) {
  if (!name) return "Trip";
  return /^captain\b/i.test(name) ? name : `Captain ${name}`;
}

export function TransfersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sends, setSends] = useState<RecentSend[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setSends(null);
    getRecentSends()
      .then(setSends)
      .catch(() => setSends([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ ...backdrop, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <aside
        style={{ ...panel, transform: open ? "translateX(0)" : "translateX(105%)" }}
        aria-hidden={!open}
      >
        <div style={head}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Recent sends</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href="/send" onClick={onClose} className="fl-btn" style={{ fontSize: "13px", padding: "8px 13px" }}>
              New send
            </Link>
            <button onClick={onClose} style={closeBtn} aria-label="Close">
              {"×"}
            </button>
          </div>
        </div>

        <div style={list}>
          {sends === null ? (
            <p style={muted}>Loading...</p>
          ) : sends.length ? (
            sends.map((d) => (
              <Link key={d.id} href={`/deliveries/${d.id}`} onClick={onClose} style={row}>
                <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>{d.date}</span>
                  <span style={{ fontSize: "12.5px", color: "var(--muted-2)" }}>
                    {captainLine(d.captain)}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px", color: "var(--muted)" }}>
                  {d.whales != null ? (
                    <span><b style={{ color: "var(--text)" }}>{d.whales}</b> whales</span>
                  ) : null}
                  <span><b style={{ color: "var(--text)" }}>{d.guests}</b> guests</span>
                </span>
              </Link>
            ))
          ) : (
            <p style={muted}>No sends yet.</p>
          )}
        </div>
      </aside>
    </>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(4,10,13,.55)",
  zIndex: 55,
  transition: "opacity .25s ease",
};
const panel: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100dvh",
  width: "min(440px, 100%)",
  background: "var(--panel)",
  borderLeft: "1px solid var(--line)",
  zIndex: 60,
  display: "flex",
  flexDirection: "column",
  transition: "transform .3s cubic-bezier(.22,.61,.36,1)",
  boxShadow: "-20px 0 50px rgba(0,0,0,.4)",
};
const head: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "18px 18px 14px",
  borderBottom: "1px solid var(--line)",
};
const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "14px 16px",
  overflowY: "auto",
};
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "13px 15px",
  borderRadius: "11px",
  border: "1px solid var(--line)",
  background: "var(--ink)",
  color: "var(--text)",
};
const muted: React.CSSProperties = { color: "var(--muted)", fontSize: "13.5px", margin: 0 };
const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--muted)",
  borderRadius: "9px",
  width: "32px",
  height: "32px",
  fontSize: "18px",
  cursor: "pointer",
  lineHeight: 1,
};
