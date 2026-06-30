"use client";

/*
  Editable branding card, dark workspace styling. Logo (with replace), brand
  color swatches, default message, retention slider. Posts to updateBranding.
*/
import { useActionState, useState } from "react";
import { updateBranding, type SettingsState } from "./actions";
import { Swatches } from "@/app/_ui/controls";

type Props = {
  operatorName: string;
  logoUrl: string | null;
  brandColor: string;
  defaultMessage: string;
  retentionDays: number;
};

export function BrandingForm({
  operatorName,
  logoUrl,
  brandColor,
  defaultMessage,
  retentionDays,
}: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateBranding,
    undefined,
  );
  const [brand, setBrand] = useState(brandColor);
  const [retention, setRetention] = useState(retentionDays);

  return (
    <form action={formAction} className="fl-card">
      <h3 style={h3}>Branding</h3>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Logo</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${operatorName} logo`} style={logoImg} />
          ) : (
            <div style={{ ...logoChip, background: brand }}>
              {operatorName.slice(0, 7)}
            </div>
          )}
          <label style={replaceBox}>
            Replace logo. PNG, JPG, WEBP or SVG, under 5 MB.
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: "none" }}
            />
          </label>
        </div>
      </label>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Brand color</span>
        <Swatches value={brand} onChange={setBrand} />
      </label>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Default guest message</span>
        <textarea name="default_message" className="fl-textarea" defaultValue={defaultMessage} />
      </label>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">How long should we keep the photos?</span>
        <input type="hidden" name="retention_days" value={retention} />
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRetention(d)}
              style={retBtn(retention === d)}
            >
              {d} {d === 1 ? "day" : "days"}
            </button>
          ))}
        </div>
      </label>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}

      <button type="submit" disabled={pending} className="fl-btn">
        {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}

const h3: React.CSSProperties = { margin: "0 0 16px", fontSize: "15px", fontWeight: 600 };
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
const logoImg: React.CSSProperties = { height: "54px", width: "auto", flex: "0 0 auto" };
const logoChip: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 11,
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: 11,
  color: "#fff",
  flex: "0 0 auto",
  textTransform: "capitalize",
  overflow: "hidden",
};
const replaceBox: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "11px",
  padding: "11px 14px",
  color: "var(--muted)",
  fontSize: "12.5px",
  cursor: "pointer",
  flex: 1,
};
