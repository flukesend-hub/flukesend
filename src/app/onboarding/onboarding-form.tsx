"use client";

/*
  First run operator setup, styled from the design handoff. Captures the
  operation name, optional logo, brand color, default guest message, and
  retention. The logo can be added here or skipped and added later in Settings.
  The extended retention toggle is a paid add on and is presentational until
  billing exists.
*/
import { useActionState, useEffect, useState } from "react";
import { createOperator, type SetupState } from "./actions";
import { Swatches, Toggle } from "@/app/_ui/controls";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

// A working starter note per language, shown in the intro field so an operator
// begins from copy that already reads right and edits it to their own voice.
const INTRO_EXAMPLE: Record<Locale, string> = {
  en: "Thanks for spending the morning on the water with us. Your photos from the trip are ready below.",
  fr: "Merci d'avoir passé la matinée sur l'eau avec nous. Vos photos de la sortie sont disponibles ci-dessous.",
  es: "Gracias por pasar la mañana en el agua con nosotros. Tus fotos de la salida están disponibles abajo.",
};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createOperator,
    undefined,
  );
  const [brand, setBrand] = useState("#0b5563");
  const [retention, setRetention] = useState(7);
  const [extended, setExtended] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  // The intro message follows the language until the operator edits it: switch
  // to French and an untouched example becomes the French one, but their own
  // words are never overwritten.
  const [intro, setIntro] = useState(INTRO_EXAMPLE.en);
  const introEdited =
    intro !== INTRO_EXAMPLE.en && intro !== INTRO_EXAMPLE.fr && intro !== INTRO_EXAMPLE.es;
  const pickLocale = (l: Locale) => {
    if (!introEdited) setIntro(INTRO_EXAMPLE[l]);
    setLocale(l);
  };

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

  return (
    <form action={formAction}>
      <div className="fl-cols" style={{ marginTop: "24px" }}>
        <div className="fl-card">
          <h3 style={h3}>Operation</h3>
          <p className="fl-hint" style={{ margin: "0 0 16px" }}>
            This name leads every gallery and email a guest opens.
          </p>
          <div style={{ marginBottom: "16px" }}>
            <span className="fl-label-text">Guest language</span>
            <p className="fl-hint" style={{ margin: "0 0 8px" }}>
              The language your guests read. It sets every email and page they
              see. You can change it later in Branding.
            </p>
            <input type="hidden" name="guest_locale" value={locale} />
            <div style={{ display: "flex", gap: "8px" }}>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLocale(l)}
                  style={localeBtn(locale === l)}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="fl-label-text">Operation name</span>
            <input name="name" className="fl-input" placeholder="Enocean Tours" required />
          </label>
          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="fl-label-text">Logo (optional)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo preview" style={logoImg} />
              ) : null}
              <label style={dropzone}>
                <input
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onLogoChange}
                  style={{ display: "none" }}
                />
                {logoPreview
                  ? "Logo selected. It uploads when you create the workspace."
                  : "Add your logo now, or skip and add it later in Settings. PNG, JPG, WEBP or SVG, under 5 MB."}
              </label>
            </div>
          </label>
          <label style={{ display: "block" }}>
            <span className="fl-label-text">Default message to guests</span>
            <textarea
              name="default_message"
              className="fl-textarea"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
            />
          </label>
        </div>

        <div className="fl-card">
          <h3 style={h3}>Brand color</h3>
          <p className="fl-hint" style={{ margin: "0 0 16px" }}>
            Pick yours. It drives the gallery header and the review email band
            that guests see.
          </p>
          <div style={{ marginBottom: "18px" }}>
            <Swatches value={brand} onChange={setBrand} />
          </div>
          <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ background: brand, color: "#fff", padding: "20px 18px" }}>
              <div className="fl-display" style={{ fontSize: "15px", opacity: 0.95 }}>
                Your gallery header
              </div>
              <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                This is how your color reads to a guest
              </div>
            </div>
          </div>

          <h3 style={{ ...h3, margin: "22px 0 2px" }}>
            How long should we keep the photos?
          </h3>
          <p className="fl-hint" style={{ margin: "0 0 12px" }}>
            Each gallery stays live this long, then the photos come down.
          </p>
          <input type="hidden" name="retention_days" value={retention} />
          <div style={{ display: "flex", gap: "8px" }}>
            {[3, 5, 7].map((d) => (
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
          <div style={extRow}>
            <Toggle on={extended} onToggle={() => setExtended(!extended)} label="Extended retention" />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Extended retention, up to 90 days
            </span>
            <span style={badge}>Paid add on</span>
          </div>
        </div>
      </div>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "16px 0 0" }}>
          {state.error}
        </p>
      ) : null}

      <div style={{ marginTop: "22px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <button type="submit" disabled={pending} className="fl-btn">
          {pending ? "Creating..." : "Create workspace"}
        </button>
        <span style={{ fontSize: "12.5px", color: "var(--muted-2)", maxWidth: "48ch" }}>
          Base plan covers 1 to 7 days. Each send stamps its own expiry from
          this setting.
        </span>
      </div>
    </form>
  );
}

const h3: React.CSSProperties = { margin: "0 0 2px", fontSize: "15px", fontWeight: 600 };
const localeBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  cursor: "pointer",
  font: "inherit",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 0",
  borderRadius: "10px",
  border: `1px solid ${active ? "var(--signal)" : "var(--line-strong)"}`,
  background: active ? "var(--signal)" : "transparent",
  color: active ? "var(--signal-ink)" : "var(--text)",
});
const dropzone: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "12px",
  padding: "14px 16px",
  textAlign: "center",
  color: "var(--muted)",
  fontSize: "13px",
  cursor: "pointer",
  flex: 1,
};
const logoImg: React.CSSProperties = { height: "54px", width: "auto", flex: "0 0 auto" };
const extRow: React.CSSProperties = {
  marginTop: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "1px dashed var(--line-strong)",
  borderRadius: "12px",
  padding: "12px 14px",
};
const badge: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--signal-2)",
  border: "1px solid var(--signal-2)",
  borderRadius: "999px",
  padding: "3px 8px",
  marginLeft: "auto",
};
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
