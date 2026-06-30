"use client";

/*
  Small shared operator controls from the design: the brand color swatch row
  (presets plus a custom color editor that opens on demand and confirms with a
  Done button) and the pill toggle switch. The chosen color rides along in a
  hidden field so it posts whether it is a preset or a custom pick. Used by
  onboarding and settings.
*/
import { useState } from "react";

export const SWATCH_COLORS = ["#0b5563", "#13405c", "#1f5d4c", "#7a3b2e", "#3a3357"];

export function Swatches({
  value,
  onChange,
  name = "brand_color",
}: {
  value: string;
  onChange: (c: string) => void;
  name?: string;
}) {
  const [editing, setEditing] = useState(false);
  const isPreset = SWATCH_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", alignItems: "center" }}>
        {SWATCH_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => {
              onChange(c);
              setEditing(false);
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              cursor: "pointer",
              background: c,
              border: `2px solid ${value.toLowerCase() === c ? "var(--text)" : "transparent"}`,
              outline: "none",
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => setEditing((o) => !o)}
          aria-expanded={editing}
          title="Custom color"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            height: 32,
            padding: "0 11px",
            borderRadius: 9,
            cursor: "pointer",
            background: "transparent",
            border: `2px solid ${!isPreset ? "var(--text)" : "var(--line-strong)"}`,
            font: "inherit",
            fontSize: "12.5px",
            color: "var(--text)",
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 5,
              background: value,
              border: "1px solid rgba(0,0,0,.15)",
            }}
          />
          Custom
        </button>
      </div>

      {/* The chosen color always posts, preset or custom. */}
      <input type="hidden" name={name} value={value} />

      {editing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            border: "1px solid var(--line-strong)",
            borderRadius: "11px",
            background: "var(--ink-2)",
            width: "fit-content",
          }}
        >
          <span style={{ position: "relative", width: 40, height: 36, flex: "0 0 auto" }}>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label="custom brand color"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 9,
                border: "1px solid var(--line-strong)",
                cursor: "pointer",
                padding: 0,
              }}
            />
            {/* Hints that the square opens the color picker. Clicks pass through. */}
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.55))",
              }}
            >
              <path d="m2 22 1-1h3l9-9" />
              <path d="M3 21v-3l9-9" />
              <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
            </svg>
          </span>
          <span style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>
            {value.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="fl-btn"
            style={{ fontSize: "13px", padding: "7px 14px" }}
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={on}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        background: on ? "var(--signal)" : "var(--line-strong)",
        border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
        position: "relative",
        cursor: "pointer",
        flex: "0 0 auto",
        padding: 0,
        transition: "background .2s,border-color .2s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? "22px" : "2px",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.35)",
        }}
      />
    </button>
  );
}
