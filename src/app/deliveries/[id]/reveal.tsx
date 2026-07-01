"use client";

/*
  "See what's inside" reveal for the send-created page, WeTransfer style. Starts
  collapsed; clicking shows the trip details and guest list. No em dashes.
*/
import { useState } from "react";

export function Reveal({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "16px" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "block",
          margin: "0 auto",
          font: "inherit",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--signal-2)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {open ? "Hide details" : label}
      </button>
      {open ? <div style={{ marginTop: "18px" }}>{children}</div> : null}
    </div>
  );
}
