"use client";

/*
  Editable branding: logo, brand color, default guest message, retention. Same
  fields as onboarding, but here they update the existing branding row and add a
  logo. Current values come in as props so the form is prefilled.
*/
import { useActionState } from "react";
import { updateBranding, type SettingsState } from "./actions";

type Props = {
  logoUrl: string | null;
  brandColor: string;
  defaultMessage: string;
  retentionDays: number;
};

export function BrandingForm({
  logoUrl,
  brandColor,
  defaultMessage,
  retentionDays,
}: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    updateBranding,
    undefined,
  );

  return (
    <form action={formAction} style={styles.form}>
      <label style={styles.label}>
        Logo
        <span style={styles.hint}>
          PNG, JPG, WEBP, or SVG, under 5 MB. Shows in the gallery and review
          email.
        </span>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Current logo"
            style={{ height: "44px", width: "auto", marginBottom: "0.25rem" }}
          />
        ) : (
          <span style={styles.hint}>No logo yet.</span>
        )}
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ fontSize: "0.85rem" }}
        />
      </label>

      <label style={styles.label}>
        Brand color
        <input
          name="brand_color"
          type="color"
          defaultValue={brandColor}
          style={styles.color}
        />
      </label>

      <label style={styles.label}>
        Default guest message
        <textarea
          name="default_message"
          rows={3}
          defaultValue={defaultMessage}
          style={styles.textarea}
        />
      </label>

      <label style={styles.label}>
        Retention days
        <span style={styles.hint}>Base plan allows 3 to 10 days.</span>
        <input
          name="retention_days"
          type="number"
          min={3}
          max={10}
          defaultValue={retentionDays}
          required
          style={styles.input}
        />
      </label>

      {state?.error ? <p style={styles.error}>{state.error}</p> : null}
      {state?.ok ? <p style={styles.ok}>{state.ok}</p> : null}

      <button type="submit" disabled={pending} style={styles.button}>
        {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#334155",
  },
  hint: { fontWeight: 400, color: "#64748b", fontSize: "0.8rem" },
  input: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
  },
  textarea: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
    resize: "vertical",
    fontFamily: "inherit",
  },
  color: {
    width: "3rem",
    height: "2.4rem",
    padding: 0,
    border: "1px solid #cbd5e1",
    borderRadius: "0.5rem",
    background: "none",
    cursor: "pointer",
  },
  error: { color: "#b91c1c", fontSize: "0.85rem", margin: 0 },
  ok: { color: "#15803d", fontSize: "0.85rem", margin: 0 },
  button: {
    padding: "0.7rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#0b5563",
    color: "white",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
  },
};
