"use client";

/*
  Simple FAQ accordion for the marketing pages. Light theme. Each question
  toggles open. The trigger is the "?" style help section the landing/pricing
  pages drop in.
*/
import { useState } from "react";

export type QA = { q: string; a: string };

export function Faq({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={card}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={trigger}
              aria-expanded={isOpen}
            >
              <span style={qStyle}>{item.q}</span>
              <span style={{ ...icon, transform: isOpen ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {isOpen ? <p style={answer}>{item.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece7dd",
  borderRadius: "14px",
  padding: "4px 18px",
};
const trigger: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  width: "100%",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  padding: "16px 0",
  textAlign: "left",
  font: "inherit",
};
const qStyle: React.CSSProperties = { fontSize: "15.5px", fontWeight: 600, color: "#10221f" };
const icon: React.CSSProperties = {
  fontSize: "22px",
  color: "#35662f",
  flex: "0 0 auto",
  transition: "transform .2s ease",
  lineHeight: 1,
};
const answer: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "14.5px",
  lineHeight: 1.6,
  color: "#5f6b68",
  maxWidth: "62ch",
};
