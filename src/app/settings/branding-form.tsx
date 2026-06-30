"use client";

/*
  Editable branding card, dark workspace styling. Logo (with replace), brand
  color swatches, default message, retention slider. Posts to updateBranding.
*/
import { useActionState, useEffect, useState } from "react";
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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Revoke the object URL when it is replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const shownLogo = logoPreview ?? logoUrl;

  return (
    <form action={formAction}>
      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Logo</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownLogo} alt={`${operatorName} logo`} style={logoImg} />
          ) : (
            <div style={{ ...logoChip, background: brand }}>
              {operatorName.slice(0, 7)}
            </div>
          )}
          <label style={replaceBox}>
            {logoPreview
              ? "New logo selected. Save branding to apply it."
              : "Replace logo. PNG, JPG, WEBP or SVG, under 5 MB."}
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoChange}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </label>

      <div style={{ marginBottom: "16px" }}>
        <span className="fl-label-text">Brand color</span>
        <Swatches value={brand} onChange={setBrand} />
        <div style={bannerPreview} aria-hidden="true">
          <div style={{ ...bannerBar, background: brand }}>
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt={`${operatorName} logo`} style={bannerLogo} />
            ) : (
              <span style={bannerBarText}>{operatorName}</span>
            )}
          </div>
          <div style={bannerCaption}>
            Email banner, gallery accent and buttons use this color.
          </div>
        </div>
      </div>

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
const bannerPreview: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid var(--line-strong)",
  borderRadius: "11px",
  overflow: "hidden",
};
const bannerBar: React.CSSProperties = {
  padding: "14px 16px",
  transition: "background .15s",
};
const bannerBarText: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "15px",
  color: "#fff",
};
const bannerLogo: React.CSSProperties = {
  height: "34px",
  width: "auto",
  display: "block",
};
const bannerCaption: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "12px",
  color: "var(--muted)",
  background: "var(--surface, transparent)",
};
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
