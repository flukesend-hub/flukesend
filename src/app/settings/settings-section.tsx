"use client";

/*
  A collapsible settings section. Collapsed it shows just a title, a one line
  summary of its current state, and an optional status chip, so the settings
  page reads as a calm checklist instead of a wall of open forms. Children are
  kept mounted and hidden when collapsed so any in-progress form input is not
  lost on toggle. No em dashes anywhere.
*/
import { useId, useState } from "react";

type Chip = { label: string; tone: "good" | "muted" } | null;

export function SettingsSection({
  title,
  summary,
  chip = null,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  chip?: Chip;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="fl-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        style={headerBtn}
      >
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "block", fontSize: "15px", fontWeight: 600 }}>{title}</span>
          <span style={{ display: "block", fontSize: "12.5px", color: "var(--muted)", marginTop: "3px" }}>
            {summary}
          </span>
        </span>
        {chip ? <span style={chipStyle(chip.tone)}>{chip.label}</span> : null}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flex: "0 0 auto" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={bodyId} style={{ display: open ? "block" : "none", borderTop: "1px solid var(--line)", padding: "18px" }}>
        {children}
      </div>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "16px 18px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  font: "inherit",
  color: "var(--text)",
};
const chipStyle = (tone: "good" | "muted"): React.CSSProperties => ({
  flex: "0 0 auto",
  fontSize: "11.5px",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: "999px",
  color: tone === "good" ? "var(--good)" : "var(--muted)",
  background: tone === "good" ? "rgba(34,160,90,.12)" : "var(--line)",
});
