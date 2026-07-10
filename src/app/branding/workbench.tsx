"use client";

/*
  The Branding workbench. Left column: the brand identity card (logo, colors,
  font pack) and the active surface's copy editor. Right column: a sticky live
  preview, rendered by the exact builder the real sends use, so what the
  operator sees is what the guest gets. Editing is override, never required;
  every field resets to today's default.

  The preview is the real email HTML in a sandboxed iframe, scaled to fit its
  column. Fonts inside the iframe load through the @import line the builder
  emits, the same one Apple Mail honors. No em dashes anywhere.
*/
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { FONT_PACKS, fontPack } from "@/lib/brand-fonts";
import {
  COPY_TOKENS,
  DELIVERY_COPY,
  type CopyOverrides,
  type CopyField,
} from "@/lib/brand-copy";
import { type SocialLinks } from "@/lib/social";
import { Swatches } from "@/app/_ui/controls";
import {
  saveBrandLook,
  saveDeliveryCopy,
  sendTestDelivery,
  type BrandingState,
} from "./actions";

type Initial = {
  logoUrl: string | null;
  brandColor: string;
  accentColor: string | null;
  headerTextColor: string | null;
  fontKey: string | null;
  copyOverrides: CopyOverrides;
  defaultMessage: string;
  retentionDays: number;
  sampleSpecies: string[];
  social: SocialLinks;
};

// All pack families in one stylesheet so the font picker can show real
// specimens without loading fonts one by one.
const ALL_FAMILIES_HREF = `https://fonts.googleapis.com/css2?${FONT_PACKS.filter(
  (p) => p.googleFamilies,
)
  .map((p) => `family=${p.googleFamilies}`)
  .join("&")}&display=swap`;

// WCAG-ish relative luminance, for the low contrast warning only.
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = [
  { key: "delivery", label: "Delivery email", ready: true },
  { key: "review", label: "Review email", ready: false },
  { key: "gallery", label: "Gallery", ready: false },
  { key: "links", label: "Website and social", ready: false },
] as const;

export function BrandingWorkbench({
  operatorName,
  initial,
}: {
  operatorName: string;
  initial: Initial;
}) {
  // ---- Brand identity state ----
  const [brand, setBrand] = useState(initial.brandColor);
  const [accentOn, setAccentOn] = useState(Boolean(initial.accentColor));
  const [accent, setAccent] = useState(initial.accentColor ?? initial.brandColor);
  const [headerText, setHeaderText] = useState(initial.headerTextColor ?? "#ffffff");
  const [font, setFont] = useState(fontPack(initial.fontKey).key);
  // A data URL, not an object URL: the preview iframe is sandboxed into its
  // own origin and cannot fetch the parent's blob: URLs, but data: inlines.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const shownLogo = logoPreview ?? initial.logoUrl;

  // ---- Copy state, initialized to override or default ----
  const [copy, setCopy] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      DELIVERY_COPY.map((f) => [f.key, initial.copyOverrides[f.key] ?? f.default]),
    ),
  );
  const [intro, setIntro] = useState(initial.defaultMessage);

  // Fill-in chips insert into the last focused copy field, at the caret.
  // Until the operator has clicked into a field the chips stay inert, so a
  // stray tap can never dump a token somewhere surprising.
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const insertToken = (token: string) => {
    if (!focused) return;
    const el = fieldRefs.current[focused];
    const current = copy[focused] ?? "";
    const at = el ? (el.selectionStart ?? current.length) : current.length;
    // Pad with spaces so a mid-sentence drop reads as a word, not a squeeze.
    const before = current.slice(0, at);
    const after = current.slice(at);
    const piece = `${before && !/\s$/.test(before) ? " " : ""}${token}${after && !/^\s/.test(after) ? " " : ""}`;
    const next = `${before}${piece}${after}`;
    setCopy((c) => ({ ...c, [focused]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length + piece.length, before.length + piece.length);
    });
  };

  // ---- The live preview: the real builder, the operator's real data ----
  const effectiveAccent = accentOn ? accent : brand;
  const previewHtml = useMemo(() => {
    return buildDeliveryEmail({
      operatorName,
      brandColor: brand,
      accentColor: accentOn ? accent : null,
      headerTextColor: headerText,
      fontKey: font,
      copyOverrides: copy,
      logoUrl: shownLogo,
      recipientName: "Alex Rivera",
      tripDate: new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
      captainName: "Ray",
      naturalistName: "Maya",
      photographerName: "Jordan",
      species: initial.sampleSpecies.length ? initial.sampleSpecies : ["Humpback whales"],
      message: intro,
      galleryUrl: "#",
      retentionDays: initial.retentionDays,
      social: initial.social,
    }).html;
  }, [operatorName, brand, accentOn, accent, headerText, font, copy, shownLogo, intro, initial]);

  // Scale the 600px email to the preview column.
  const previewBox = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 600)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Warnings ----
  const warnings: string[] = [];
  if (!shownLogo && contrast(brand, headerText) < 3) {
    warnings.push("Your name may be hard to read on the header color. Try a lighter text color or a darker header.");
  }
  if (contrast(effectiveAccent, "#ffffff") < 3) {
    warnings.push("White button text may be hard to read on this accent color. Try a darker accent.");
  }

  // ---- Actions ----
  const [lookState, lookAction, lookPending] = useActionState<BrandingState, FormData>(
    saveBrandLook,
    undefined,
  );
  const [copyState, copyAction, copyPending] = useActionState<BrandingState, FormData>(
    saveDeliveryCopy,
    undefined,
  );
  const [testPending, startTest] = useTransition();
  const [testNote, setTestNote] = useState<BrandingState>(undefined);
  const runTest = () => {
    setTestNote(undefined);
    startTest(async () => {
      const res = await sendTestDelivery({
        brandColor: brand,
        accentColor: accentOn ? accent : null,
        headerTextColor: headerText === "#ffffff" ? null : headerText,
        fontKey: font,
        copy,
        message: intro,
      });
      setTestNote(res);
    });
  };

  const [surface, setSurface] = useState<string>("delivery");

  return (
    <div>
      {/* Font specimens for the picker. The preview iframe loads its own. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={ALL_FAMILIES_HREF} />
      <style>{`
        .fl-brandgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 440px); gap: 18px; align-items: start; }
        .fl-brandprev { position: sticky; top: 84px; }
        @media (max-width: 980px) {
          .fl-brandgrid { grid-template-columns: 1fr; }
          .fl-brandprev { position: static; }
        }
      `}</style>

      <div className="fl-brandgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
          {/* ---- Brand identity ---- */}
          <form action={lookAction} className="fl-card" style={{ padding: "18px" }}>
            <div style={cardTitle}>Brand identity</div>
            <p className="fl-hint" style={{ margin: "0 0 14px" }}>
              Shared by your emails and your gallery.
            </p>

            <label style={{ display: "block", marginBottom: "14px" }}>
              <span className="fl-label-text">Logo</span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {shownLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownLogo} alt={`${operatorName} logo`} style={{ height: "44px", width: "auto", flex: "0 0 auto" }} />
                ) : (
                  <div style={{ ...logoChip, background: brand }}>{operatorName.slice(0, 7)}</div>
                )}
                <label style={replaceBox}>
                  {logoPreview ? "New logo selected. Save to apply it." : "Replace logo. PNG, JPG or WEBP, under 5 MB."}
                  <input
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        setLogoPreview(null);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setLogoPreview(String(reader.result));
                      reader.readAsDataURL(f);
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </label>

            <div style={{ marginBottom: "14px" }}>
              <span className="fl-label-text">Brand color</span>
              <p className="fl-hint" style={{ margin: "0 0 8px" }}>Paints the header band on emails and the gallery.</p>
              <Swatches value={brand} onChange={setBrand} name="brand_color" />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={accentOn}
                  onChange={(e) => {
                    setAccentOn(e.target.checked);
                    if (e.target.checked && accent === brand) setAccent(brand);
                  }}
                />
                <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Separate accent color</span>
                <span className="fl-hint" style={{ margin: 0 }}>buttons and highlights</span>
              </label>
              {accentOn ? (
                <div style={{ marginTop: "10px" }}>
                  <Swatches value={accent} onChange={setAccent} name="accent_color" />
                </div>
              ) : (
                <input type="hidden" name="accent_color" value="" />
              )}
            </div>

            {!shownLogo ? (
              <div style={{ marginBottom: "14px" }}>
                <span className="fl-label-text">Header text color</span>
                <p className="fl-hint" style={{ margin: "0 0 8px" }}>
                  With no logo, your name shows in type on the header band.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="color"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    aria-label="header text color"
                    style={{ width: 40, height: 32, borderRadius: 8, border: "1px solid var(--line-strong)", cursor: "pointer", padding: 0 }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{headerText.toUpperCase()}</span>
                  {headerText.toLowerCase() !== "#ffffff" ? (
                    <button type="button" onClick={() => setHeaderText("#ffffff")} style={resetLink}>Restore default</button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <input type="hidden" name="header_text_color" value={headerText.toLowerCase() === "#ffffff" ? "" : headerText} />

            <div style={{ marginBottom: "16px" }}>
              <span className="fl-label-text">Font</span>
              <p className="fl-hint" style={{ margin: "0 0 8px" }}>
                Fully applies on your gallery page and in Apple Mail. Other inbox
                apps use their own fonts and fall back gracefully.
              </p>
              <input type="hidden" name="font_key" value={font} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
                {FONT_PACKS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFont(p.key)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "11px",
                      cursor: "pointer",
                      background: font === p.key ? "var(--signal)" : "transparent",
                      color: font === p.key ? "var(--signal-ink)" : "var(--text)",
                      border: `1px solid ${font === p.key ? "var(--signal)" : "var(--line-strong)"}`,
                    }}
                  >
                    <span style={{ display: "block", fontFamily: p.displayStack, fontSize: "16px", fontWeight: 600 }}>
                      {p.label}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", opacity: 0.75, marginTop: "2px" }}>{p.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {warnings.map((w) => (
              <p key={w} style={{ color: "#b98a2f", fontSize: "12.5px", margin: "0 0 10px" }}>{w}</p>
            ))}
            {lookState?.error ? <p style={errText}>{lookState.error}</p> : null}
            {lookState?.ok ? <p style={okText}>{lookState.ok}</p> : null}
            <button type="submit" disabled={lookPending} className="fl-btn">
              {lookPending ? "Saving..." : "Save brand identity"}
            </button>
          </form>

          {/* ---- Surface sub tabs ---- */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {SURFACES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!s.ready}
                onClick={() => s.ready && setSurface(s.key)}
                style={{
                  font: "inherit",
                  fontSize: "13px",
                  fontWeight: surface === s.key ? 600 : 500,
                  padding: "8px 14px",
                  borderRadius: "999px",
                  cursor: s.ready ? "pointer" : "default",
                  background: surface === s.key ? "var(--signal)" : "transparent",
                  color: surface === s.key ? "var(--signal-ink)" : s.ready ? "var(--text)" : "var(--muted)",
                  border: `1px solid ${surface === s.key ? "var(--signal)" : "var(--line-strong)"}`,
                  opacity: s.ready ? 1 : 0.6,
                }}
              >
                {s.label}
                {!s.ready ? <span style={{ fontSize: "10.5px", marginLeft: "6px", opacity: 0.8 }}>soon</span> : null}
              </button>
            ))}
          </div>

          {/* ---- Delivery email copy ---- */}
          {surface === "delivery" ? (
            <form action={copyAction} className="fl-card" style={{ padding: "18px" }}>
              <div style={cardTitle}>Delivery email wording</div>
              <p className="fl-hint" style={{ margin: "0 0 14px" }}>
                The email each guest gets with their gallery link. Plain words
                plus the tokens below; we swap them in at send time.
              </p>

              {DELIVERY_COPY.map((f) => (
                <CopyInput
                  key={f.key}
                  field={f}
                  value={copy[f.key] ?? f.default}
                  onChange={(v) => setCopy((c) => ({ ...c, [f.key]: v }))}
                  onFocus={() => setFocused(f.key)}
                  refFn={(el) => {
                    fieldRefs.current[f.key] = el;
                  }}
                />
              ))}

              <label style={{ display: "block", marginBottom: "14px" }}>
                <span className="fl-label-text">Intro message</span>
                <p className="fl-hint" style={{ margin: "0 0 6px" }}>
                  Your default note to guests. Each send can still overwrite it.
                </p>
                <textarea
                  name="default_message"
                  className="fl-textarea"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  onFocus={() => setFocused(null)}
                />
              </label>

              <div style={{ background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "11px", padding: "12px 13px", marginBottom: "16px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: "3px" }}>Fill-ins</div>
                <p className="fl-hint" style={{ margin: "0 0 9px" }}>
                  {focused
                    ? "Tap one to drop it into the field you are editing. On every send we swap it for the real thing, so Guest's first name becomes Alex, and What the trip saw becomes Humpback whales. Watch the preview to see it filled in."
                    : "Click into a field above first, then tap one to drop it in. On every send we swap it for the real thing, so Guest's first name becomes Alex, and What the trip saw becomes Humpback whales."}
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {COPY_TOKENS.map((t) => (
                    <button
                      key={t.token}
                      type="button"
                      onClick={() => insertToken(t.token)}
                      disabled={!focused}
                      title={`${t.token} becomes something like "${t.example}"`}
                      style={{ ...tokenChip, opacity: focused ? 1 : 0.45, cursor: focused ? "pointer" : "default" }}
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {copyState?.error ? <p style={errText}>{copyState.error}</p> : null}
              {copyState?.ok ? <p style={okText}>{copyState.ok}</p> : null}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" disabled={copyPending} className="fl-btn">
                  {copyPending ? "Saving..." : "Save wording"}
                </button>
                <button type="button" onClick={runTest} disabled={testPending} className="fl-btn-ghost">
                  {testPending ? "Sending..." : "Send test to myself"}
                </button>
              </div>
              {testNote?.error ? <p style={{ ...errText, marginTop: "10px" }}>{testNote.error}</p> : null}
              {testNote?.ok ? <p style={{ ...okText, marginTop: "10px" }}>{testNote.ok}</p> : null}
            </form>
          ) : null}
        </div>

        {/* ---- Live preview ---- */}
        <div className="fl-brandprev">
          <div className="fl-card" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px 10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Live preview</span>
              <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>sample trip data</span>
            </div>
            <div ref={previewBox} style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)", background: "#fff", height: `${Math.round(980 * scale)}px` }}>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={previewHtml}
                style={{
                  width: "600px",
                  height: "980px",
                  border: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                  background: "#fff",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One labeled copy field with a live counter and a reset when it drifts from
// the default.
function CopyInput({
  field,
  value,
  onChange,
  onFocus,
  refFn,
}: {
  field: CopyField;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  refFn: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const changed = value.trim() !== field.default;
  const over = value.length > field.limit;
  return (
    <label style={{ display: "block", marginBottom: "14px" }}>
      <span style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span className="fl-label-text">{field.label}</span>
        {changed ? (
          <button
            type="button"
            onClick={() => onChange(field.default)}
            title="Put back the standard Flukesend wording"
            style={resetLink}
          >
            Restore default
          </button>
        ) : null}
        <span style={{ marginLeft: "auto", fontSize: "11px", color: over ? "var(--bad)" : "var(--muted)" }}>
          {value.length}/{field.limit}
        </span>
      </span>
      {field.hint ? <p className="fl-hint" style={{ margin: "0 0 6px" }}>{field.hint}</p> : null}
      {field.multiline ? (
        <textarea
          name={field.key}
          className="fl-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          ref={refFn}
        />
      ) : (
        <input
          name={field.key}
          className="fl-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          ref={refFn}
        />
      )}
    </label>
  );
}

const cardTitle: React.CSSProperties = { fontSize: "15px", fontWeight: 600, marginBottom: "4px" };
const errText: React.CSSProperties = { color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" };
const okText: React.CSSProperties = { color: "var(--good)", fontSize: "13px", margin: "0 0 12px" };
const resetLink: React.CSSProperties = {
  font: "inherit",
  fontSize: "11.5px",
  color: "var(--muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};
const tokenChip: React.CSSProperties = {
  font: "inherit",
  fontSize: "12px",
  fontVariantNumeric: "tabular-nums",
  padding: "4px 9px",
  borderRadius: "999px",
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};
const logoChip: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  fontWeight: 600,
  fontSize: 10,
  color: "#fff",
  flex: "0 0 auto",
  textTransform: "capitalize",
  overflow: "hidden",
};
const replaceBox: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "11px",
  padding: "10px 13px",
  color: "var(--muted)",
  fontSize: "12.5px",
  cursor: "pointer",
  flex: 1,
};
