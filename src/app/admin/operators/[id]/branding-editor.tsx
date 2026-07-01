"use client";

/*
  Support branding editor. Same fields the operator edits in Settings (logo,
  brand color, default message, retention, website and social links) but scoped
  to a chosen operator and saved through the admin action. No em dashes.
*/
import { useActionState, useEffect, useState } from "react";
import { adminUpdateBranding, type AdminState } from "../../actions";
import { Swatches } from "@/app/_ui/controls";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";

type Props = {
  operatorId: string;
  operatorName: string;
  logoUrl: string | null;
  brandColor: string;
  defaultMessage: string;
  retentionDays: number;
  social: SocialLinks;
};

export function BrandingEditor(props: Props) {
  const [state, formAction, pending] = useActionState<AdminState, FormData>(
    adminUpdateBranding,
    undefined,
  );
  const [brand, setBrand] = useState(props.brandColor);
  const [retention, setRetention] = useState(props.retentionDays);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const shownLogo = logoPreview ?? props.logoUrl;

  return (
    <form action={formAction} className="fl-card" style={{ maxWidth: "640px" }}>
      <input type="hidden" name="operator_id" value={props.operatorId} />
      <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600 }}>
        Branding for {props.operatorName}
      </h3>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Logo</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownLogo} alt="logo" style={{ height: "54px", width: "auto", flex: "0 0 auto" }} />
          ) : (
            <div style={{ width: 54, height: 54, borderRadius: 11, background: brand, flex: "0 0 auto" }} />
          )}
          <label style={replaceBox}>
            {logoPreview ? "New logo selected. Save to apply." : "Replace logo. PNG, JPG, WEBP or SVG, under 5 MB."}
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setLogoPreview(f ? URL.createObjectURL(f) : null);
              }}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </label>

      <div style={{ marginBottom: "16px" }}>
        <span className="fl-label-text">Brand color</span>
        <Swatches value={brand} onChange={setBrand} />
      </div>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">Default guest message</span>
        <textarea name="default_message" className="fl-textarea" defaultValue={props.defaultMessage} />
      </label>

      <label style={{ display: "block", marginBottom: "16px" }}>
        <span className="fl-label-text">How long to keep the photos?</span>
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

      <div style={{ marginBottom: "16px" }}>
        <span className="fl-label-text">Website and social links</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "82px", fontSize: "13px", color: "var(--muted)" }}>{p.label}</span>
              <input
                name={p.key}
                className="fl-input"
                style={{ flex: 1, fontSize: "13px", padding: "9px 11px", borderRadius: "9px" }}
                defaultValue={props.social[p.column] ?? ""}
                placeholder={p.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

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
const replaceBox: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "11px",
  padding: "11px 14px",
  color: "var(--muted)",
  fontSize: "12.5px",
  cursor: "pointer",
  flex: 1,
};
