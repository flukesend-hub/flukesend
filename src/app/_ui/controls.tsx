"use client";

/*
  Small shared operator controls from the design: the brand color swatch row
  (with a custom color input that carries the brand_color form value) and the
  pill toggle switch. Used by onboarding and settings.
*/

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
  return (
    <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", alignItems: "center" }}>
      {SWATCH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
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
      <input
        type="color"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="custom brand color"
        style={{
          width: 40,
          height: 36,
          borderRadius: 9,
          border: "1px solid var(--line-strong)",
          cursor: "pointer",
        }}
      />
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
        background: on ? "var(--signal)" : "rgba(255,255,255,.14)",
        border: `1px solid ${on ? "var(--signal)" : "rgba(255,255,255,.2)"}`,
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
