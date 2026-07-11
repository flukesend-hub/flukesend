"use client";

/*
  The Branding workbench. Left column: the brand identity card (logo, colors,
  font pack, text darkness) and the active surface's editor, one sub tab per
  guest facing surface. Right column: a sticky live preview. The two emails
  render through the exact builders real sends use; the gallery preview is a
  faithful miniature that mirrors the real post-save logic, including whether
  this operator's guests see the tip button, the review buttons, or the plain
  thanks line. Editing is override, never required; every field restores to
  today's default.

  The email previews are the real HTML in a sandboxed iframe, scaled to fit.
  Fonts inside the iframes load through the @import the builders emit, the
  same one Apple Mail honors. No em dashes anywhere.
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
import { buildReviewEmail } from "@/lib/review-email";
import { FONT_PACKS, fontPack, TEXT_TONES, textTone, logoAlign, type LogoAlign } from "@/lib/brand-fonts";
import {
  COPY_TOKENS,
  DELIVERY_COPY,
  REVIEW_COPY,
  GALLERY_COPY,
  GALLERY_THANKS_DEFAULT,
  renderTokens,
  type CopyOverrides,
  type CopyField,
  type TokenContext,
} from "@/lib/brand-copy";
import { type SocialLinks } from "@/lib/social";
import { Swatches } from "@/app/_ui/controls";
import { SocialLinksForm } from "@/app/settings/social-links-form";
import {
  saveBrandLook,
  saveDeliveryCopy,
  saveReviewCopy,
  saveGalleryCopy,
  sendTestDelivery,
  sendTestReview,
  setReviewShowCrew,
  type BrandingState,
} from "./actions";
import { removeLogo } from "@/app/settings/actions";

type Initial = {
  logoUrl: string | null;
  brandColor: string;
  accentColor: string | null;
  headerTextColor: string | null;
  fontKey: string | null;
  textTone: string | null;
  logoAlign: string | null;
  copyOverrides: CopyOverrides;
  defaultMessage: string;
  retentionDays: number;
  sampleSpecies: string[];
  social: SocialLinks;
};

type Tips = {
  enabled: boolean;
  showReview: boolean;
  myTip: { firstName: string; verb: string; photoUrl: string | null } | null;
};

const ALL_FIELDS: CopyField[] = [...DELIVERY_COPY, ...REVIEW_COPY, ...GALLERY_COPY];

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
  { key: "delivery", label: "Delivery email" },
  { key: "review", label: "Review email" },
  { key: "gallery", label: "Gallery" },
  { key: "links", label: "Website and social" },
] as const;

export function BrandingWorkbench({
  operatorName,
  reviewLinks,
  tips,
  crew,
  reviewShowCrew,
  initial,
}: {
  operatorName: string;
  reviewLinks: { label: string }[];
  tips: Tips;
  crew: { firstName: string; photoUrl: string | null; show: boolean }[];
  reviewShowCrew: boolean;
  initial: Initial;
}) {
  // Only the shown crew appear on the email; the rest inform the caption. Cap
  // the preview at 6, matching the test send (real sends show only who was
  // aboard, which is naturally a handful).
  const shownFaces = crew.filter((c) => c.show).slice(0, 6);
  const hiddenNames = crew.filter((c) => !c.show).map((c) => c.firstName);
  const [showCrew, setShowCrew] = useState(reviewShowCrew);
  const [crewPending, startCrew] = useTransition();
  const [logoRemoving, startLogoRemove] = useTransition();
  const toggleCrew = () => {
    const next = !showCrew;
    setShowCrew(next);
    startCrew(async () => {
      const res = await setReviewShowCrew(next);
      if (res && "error" in res && res.error) setShowCrew(!next);
    });
  };
  // ---- Brand identity state ----
  const [brand, setBrand] = useState(initial.brandColor);
  const [accentOn, setAccentOn] = useState(Boolean(initial.accentColor));
  const [accent, setAccent] = useState(initial.accentColor ?? initial.brandColor);
  const [headerText, setHeaderText] = useState(initial.headerTextColor ?? "#ffffff");
  const [font, setFont] = useState(fontPack(initial.fontKey).key);
  const [tone, setTone] = useState(textTone(initial.textTone).key);
  const [align, setAlign] = useState<LogoAlign>(logoAlign(initial.logoAlign));
  // A data URL, not an object URL: the preview iframe is sandboxed into its
  // own origin and cannot fetch the parent's blob: URLs, but data: inlines.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const shownLogo = logoPreview ?? initial.logoUrl;

  // ---- Copy state across all surfaces, initialized to override or default ----
  const [copy, setCopy] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ALL_FIELDS.map((f) => [f.key, initial.copyOverrides[f.key] ?? f.default]),
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

  const [surface, setSurface] = useState<string>("delivery");

  // ---- Live previews: the real builders, the operator's real data ----
  const effectiveAccent = accentOn ? accent : brand;
  const sampleSpecies = initial.sampleSpecies.length
    ? initial.sampleSpecies
    : ["Humpback whales"];
  const today = new Date().toLocaleDateString("en-US", { dateStyle: "long" });

  const deliveryHtml = useMemo(() => {
    return buildDeliveryEmail({
      operatorName,
      brandColor: brand,
      accentColor: accentOn ? accent : null,
      headerTextColor: headerText,
      fontKey: font,
      textTone: tone,
      logoAlign: align,
      copyOverrides: copy,
      logoUrl: shownLogo,
      recipientName: "Alex Rivera",
      tripDate: today,
      captainName: "Ray",
      naturalistName: "Maya",
      photographerName: "Jordan",
      species: sampleSpecies,
      message: intro,
      galleryUrl: "#",
      retentionDays: initial.retentionDays,
      social: initial.social,
    }).html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorName, brand, accentOn, accent, headerText, font, tone, align, copy, shownLogo, intro, initial, today]);

  const reviewHtml = useMemo(() => {
    const links = reviewLinks.length ? reviewLinks : [{ label: "Leave a Google review" }];
    return buildReviewEmail({
      operatorName,
      brandColor: brand,
      accentColor: accentOn ? accent : null,
      headerTextColor: headerText,
      fontKey: font,
      textTone: tone,
      logoAlign: align,
      copyOverrides: copy,
      logoUrl: shownLogo,
      recipientName: "Alex",
      tripLine: `${today} with Captain Ray`,
      tripDate: today,
      captainName: "Ray",
      species: sampleSpecies,
      crew: shownFaces,
      showCrew,
      reviewLinks: links.map((l) => ({ label: l.label, href: "#" })),
      social: initial.social,
    }).html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorName, brand, accentOn, accent, headerText, font, tone, align, copy, shownLogo, reviewLinks, crew, showCrew, initial, today]);

  // The gallery preview's fill-ins, rendered with the same sample trip.
  const galleryCtx: TokenContext = {
    operatorName,
    firstName: "Alex",
    species: sampleSpecies.join(" and "),
    date: today,
    photographerName: "Jordan",
    crew: "Captain Ray",
  };
  const galleryReviewAsk = renderTokens(copy["gallery.review_ask"] ?? "", galleryCtx);
  const galleryThanks = GALLERY_THANKS_DEFAULT;

  // Scale the 600px email to the preview column. Keyed on surface because the
  // preview box unmounts on the gallery tab (which renders its own miniature)
  // and remounts as a fresh node when you return to an email tab, so the
  // observer has to re-attach. The width > 0 guard ignores the zero-width
  // measurement a detaching node reports, which would otherwise collapse the
  // scale to nothing and blank every email preview.
  // The email preview sizes to the real rendered height of the email, measured
  // from the iframe, so there is no empty space scrolling below a short email.
  // A sane default holds until the first measure lands (and while a new surface
  // reloads). Scripts stay blocked (no allow-scripts) so same-origin is safe.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewH, setPreviewH] = useState(980);
  const measurePreview = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const h = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0);
    if (h > 0) setPreviewH(h);
  };
  const previewBox = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const el = previewBox.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / 600));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [surface]);

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
  const [reviewState, reviewAction, reviewPending] = useActionState<BrandingState, FormData>(
    saveReviewCopy,
    undefined,
  );
  const [galleryState, galleryAction, galleryPending] = useActionState<BrandingState, FormData>(
    saveGalleryCopy,
    undefined,
  );
  const [testPending, startTest] = useTransition();
  const [testNote, setTestNote] = useState<BrandingState>(undefined);
  const lookDraft = {
    brandColor: brand,
    accentColor: accentOn ? accent : null,
    headerTextColor: headerText === "#ffffff" ? null : headerText,
    fontKey: font as string | null,
    textTone: tone as string | null,
    logoAlign: align as string | null,
  };
  const runTest = (which: "delivery" | "review") => {
    setTestNote(undefined);
    startTest(async () => {
      const res =
        which === "delivery"
          ? await sendTestDelivery({ ...lookDraft, copy, message: intro })
          : await sendTestReview({ ...lookDraft, copy });
      setTestNote(res);
    });
  };

  // One copy field by key, so each editor can lay fields out in the same
  // order they appear on the surface itself.
  const copyField = (key: string) => {
    const f = ALL_FIELDS.find((x) => x.key === key);
    if (!f) return null;
    return (
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
    );
  };

  const fillIns = (
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
  );

  const testRow = (which: "delivery" | "review", saving: boolean, saveLabel: string) => (
    <>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={saving} className="fl-btn">
          {saving ? "Saving..." : saveLabel}
        </button>
        <button type="button" onClick={() => runTest(which)} disabled={testPending} className="fl-btn-ghost">
          {testPending ? "Sending..." : "Send test to myself"}
        </button>
      </div>
      {testNote?.error ? <p style={{ ...errText, marginTop: "10px" }}>{testNote.error}</p> : null}
      {testNote?.ok ? <p style={{ ...okText, marginTop: "10px" }}>{testNote.ok}</p> : null}
    </>
  );

  // What the gallery preview's post-save slot will actually show, mirroring
  // resolveGalleryTip: tip when tips are on and this member has a link.
  const showTip = tips.enabled && tips.myTip;
  const pack = fontPack(font);

  return (
    <div className="fl-brandworkbench">
      {/* Font specimens for the picker and the gallery mini preview. */}
      <link rel="stylesheet" href={ALL_FAMILIES_HREF} />
      <style>{`
        /* Lock the branding route to the viewport: the page never scrolls, only
           each pane scrolls internally. So the editor scrolls under a fixed
           preview instead of the whole page drifting past it. */
        .fl-brandpage { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
        .fl-brandmain { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px 28px 0; }
        .fl-brandworkbench { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        .fl-brandgrid { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 22px; align-items: stretch; max-width: 1280px; flex: 1; min-height: 0; }
        .fl-brandcol { overflow-y: auto; min-height: 0; padding: 2px 10px 28px 0; }
        .fl-brandprev { overflow-y: auto; min-height: 0; padding-bottom: 28px; }
        @media (max-width: 980px) {
          .fl-brandpage { height: auto; display: block; overflow: visible; }
          .fl-brandmain { display: block; padding: 16px 20px 80px; }
          .fl-brandworkbench { display: block; }
          .fl-brandgrid { grid-template-columns: 1fr; max-width: 640px; }
          .fl-brandcol, .fl-brandprev { overflow: visible; padding: 0; }
        }
      `}</style>

      <div className="fl-brandgrid">
        <div className="fl-brandcol" style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
          {/* ---- Brand identity ---- */}
          <form action={lookAction} className="fl-card" style={{ padding: "18px" }}>
            <div style={cardTitle}>Brand identity</div>
            <p className="fl-hint" style={{ margin: "0 0 14px" }}>
              Shared by your emails and your gallery.
            </p>

            {/* Not a <label>: it wraps the file-picker <label> below, and
                nested labels are invalid and make the whole row a click target. */}
            <div style={{ display: "block", marginBottom: "14px" }}>
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
              {initial.logoUrl && !logoPreview ? (
                <button
                  type="button"
                  onClick={() => startLogoRemove(() => removeLogo())}
                  disabled={logoRemoving}
                  style={{ ...resetLink, marginTop: "8px" }}
                >
                  {logoRemoving ? "Removing..." : "Remove logo"}
                </button>
              ) : null}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <span className="fl-label-text">Logo placement</span>
              <p className="fl-hint" style={{ margin: "0 0 8px" }}>
                Where your logo sits in the header band (and the name, if you
                have no logo).
              </p>
              <input type="hidden" name="logo_align" value={align} />
              <div style={{ display: "flex", gap: "8px" }}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAlign(a)}
                    style={{
                      flex: 1,
                      font: "inherit",
                      fontSize: "13px",
                      fontWeight: 600,
                      textTransform: "capitalize",
                      padding: "9px 0",
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: align === a ? "var(--signal)" : "transparent",
                      color: align === a ? "var(--signal-ink)" : "var(--text)",
                      border: `1px solid ${align === a ? "var(--signal)" : "var(--line-strong)"}`,
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

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
                  onChange={(e) => setAccentOn(e.target.checked)}
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

            <div style={{ marginBottom: "16px" }}>
              <span className="fl-label-text">Text darkness</span>
              <p className="fl-hint" style={{ margin: "0 0 8px" }}>
                How dark the smaller email text reads. Bump it up if the gray
                feels too light for your brand.
              </p>
              <input type="hidden" name="text_tone" value={tone} />
              <div style={{ display: "flex", gap: "8px" }}>
                {TEXT_TONES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTone(t.key)}
                    style={{
                      flex: 1,
                      font: "inherit",
                      fontSize: "13px",
                      fontWeight: 600,
                      padding: "10px 0 8px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: tone === t.key ? "var(--signal)" : "transparent",
                      color: tone === t.key ? "var(--signal-ink)" : "var(--text)",
                      border: `1px solid ${tone === t.key ? "var(--signal)" : "var(--line-strong)"}`,
                    }}
                  >
                    {t.label}
                    <span
                      aria-hidden="true"
                      style={{ display: "flex", gap: "3px", justifyContent: "center", marginTop: "6px" }}
                    >
                      {[t.body, t.mid, t.quiet].map((c) => (
                        <span key={c} style={{ width: 14, height: 6, borderRadius: 3, background: c, border: "1px solid rgba(255,255,255,.25)" }} />
                      ))}
                    </span>
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
                onClick={() => {
                  // Clear the focused copy field and any test note when moving
                  // tabs, so a fill-in chip can't append to a now-hidden field
                  // and a stale "test sent" note doesn't bleed across surfaces.
                  setFocused(null);
                  setTestNote(undefined);
                  setSurface(s.key);
                }}
                style={{
                  font: "inherit",
                  fontSize: "13px",
                  fontWeight: surface === s.key ? 600 : 500,
                  padding: "8px 14px",
                  borderRadius: "999px",
                  cursor: "pointer",
                  background: surface === s.key ? "var(--signal)" : "transparent",
                  color: surface === s.key ? "var(--signal-ink)" : "var(--text)",
                  border: `1px solid ${surface === s.key ? "var(--signal)" : "var(--line-strong)"}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* ---- Delivery email wording ---- */}
          {surface === "delivery" ? (
            <form action={copyAction} className="fl-card" style={{ padding: "18px" }}>
              <div style={cardTitle}>Delivery email wording</div>
              <p className="fl-hint" style={{ margin: "0 0 14px" }}>
                The email each guest gets with their gallery link. Plain words
                plus the fill-ins below; we swap them in at send time.
              </p>

              {/* Fields in the order they appear in the email itself. */}
              {copyField("delivery.headline")}

              <label style={{ display: "block", marginBottom: "14px" }}>
                <span className="fl-label-text">Intro message</span>
                <p className="fl-hint" style={{ margin: "0 0 6px" }}>
                  Your default note to guests, shown under the headline. Each
                  send can still overwrite it.
                </p>
                <textarea
                  name="default_message"
                  className="fl-textarea"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  onFocus={() => setFocused(null)}
                />
              </label>

              {copyField("delivery.button")}
              {copyField("delivery.signoff")}
              {fillIns}
              {copyState?.error ? <p style={errText}>{copyState.error}</p> : null}
              {copyState?.ok ? <p style={okText}>{copyState.ok}</p> : null}
              {testRow("delivery", copyPending, "Save wording")}
            </form>
          ) : null}

          {/* ---- Review email wording ---- */}
          {surface === "review" ? (
            <form action={reviewAction} className="fl-card" style={{ padding: "18px" }}>
              <div style={cardTitle}>Review email wording</div>
              <p className="fl-hint" style={{ margin: "0 0 14px" }}>
                The follow-up that asks for a review after a guest saves their
                photos. The buttons are your review links, exactly as you named
                them; edit those under Settings.
              </p>
              {!reviewLinks.length ? (
                <p style={{ ...warnText, margin: "0 0 14px" }}>
                  You have no review links yet, so guests are not asked for
                  reviews at all. Add your Google or Tripadvisor link in
                  Settings; the preview shows a sample button until then.
                </p>
              ) : null}

              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "0 0 14px", marginBottom: "14px", borderBottom: "1px solid var(--line)" }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCrew}
                  onClick={toggleCrew}
                  disabled={crewPending}
                  style={{
                    width: "44px", height: "26px", borderRadius: "999px", flex: "0 0 auto",
                    background: showCrew ? "var(--signal)" : "var(--line-strong)",
                    border: 0, position: "relative", cursor: crewPending ? "default" : "pointer",
                    padding: 0, marginTop: "2px",
                  }}
                >
                  <span style={{ position: "absolute", top: "3px", left: showCrew ? "21px" : "3px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Show your crew&apos;s faces</div>
                  <p className="fl-hint" style={{ margin: "3px 0 0" }}>
                    Adds a row of the crew aboard, with their photos, above the
                    review buttons. Off by default: your review email already
                    converts, so turn it on and watch your numbers. Add photos
                    under Settings, Employees.
                  </p>
                </div>
              </div>

              {copyField("review.headline")}
              {copyField("review.ask")}
              {copyField("review.signoff")}
              {fillIns}
              {reviewState?.error ? <p style={errText}>{reviewState.error}</p> : null}
              {reviewState?.ok ? <p style={okText}>{reviewState.ok}</p> : null}
              {testRow("review", reviewPending, "Save wording")}
            </form>
          ) : null}

          {/* ---- Gallery wording ---- */}
          {surface === "gallery" ? (
            <form action={galleryAction} className="fl-card" style={{ padding: "18px" }}>
              <div style={cardTitle}>Gallery wording</div>
              <p className="fl-hint" style={{ margin: "0 0 14px" }}>
                The gallery headline and trip details are written from each
                send. These are the words you can shape, top to bottom the way a
                guest reads them.
              </p>

              <label style={{ display: "block", marginBottom: "14px" }}>
                <span className="fl-label-text">Intro message</span>
                <p className="fl-hint" style={{ margin: "0 0 6px" }}>
                  The note right above your photos, and the same line at the top
                  of your delivery email. Each send can still overwrite it.
                </p>
                <textarea
                  name="default_message"
                  className="fl-textarea"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  onFocus={() => setFocused(null)}
                />
              </label>

              {copyField("gallery.review_ask")}
              {fillIns}
              {galleryState?.error ? <p style={errText}>{galleryState.error}</p> : null}
              {galleryState?.ok ? <p style={okText}>{galleryState.ok}</p> : null}
              <button type="submit" disabled={galleryPending} className="fl-btn">
                {galleryPending ? "Saving..." : "Save wording"}
              </button>
            </form>
          ) : null}

          {/* ---- Website and social ---- */}
          {surface === "links" ? (
            <div className="fl-card" style={{ padding: "18px" }}>
              <div style={cardTitle}>Website and social links</div>
              <p className="fl-hint" style={{ margin: "0 0 14px" }}>
                Shown as the small icon row under both emails. The preview picks
                up changes after you save.
              </p>
              <SocialLinksForm links={initial.social} />
            </div>
          ) : null}
        </div>

        {/* ---- Live preview ---- */}
        <div className="fl-brandprev">
          <div className="fl-card" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px 10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                {surface === "review" ? "Review email" : surface === "gallery" ? "Gallery" : "Delivery email"} preview
              </span>
              <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>sample trip data</span>
            </div>

            {surface === "gallery" ? (
              <div style={{ maxWidth: "440px", margin: "0 auto" }}>
                <GalleryMini
                  operatorName={operatorName}
                  brand={brand}
                  accent={effectiveAccent}
                  displayStack={pack.displayStack}
                  logoAlign={align}
                  logo={shownLogo}
                  intro={intro}
                  species={sampleSpecies}
                  reviewLinks={reviewLinks}
                  reviewAsk={galleryReviewAsk}
                  thanks={galleryThanks}
                  tips={tips}
                />
              </div>
            ) : (
              <div ref={previewBox} style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)", background: "#fff", height: `${Math.round(previewH * scale)}px`, maxWidth: "600px", margin: "0 auto" }}>
                <iframe
                  ref={iframeRef}
                  title="Email preview"
                  sandbox="allow-same-origin"
                  srcDoc={surface === "review" ? reviewHtml : deliveryHtml}
                  onLoad={() => {
                    // Measure now, then again after fonts and the logo settle.
                    measurePreview();
                    window.setTimeout(measurePreview, 200);
                    window.setTimeout(measurePreview, 600);
                  }}
                  style={{
                    width: "600px",
                    height: `${previewH}px`,
                    border: 0,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    pointerEvents: "none",
                    background: "#fff",
                  }}
                />
              </div>
            )}
            {surface === "gallery" ? (
              <p className="fl-hint" style={{ margin: "10px 2px 0" }}>
                Shown as it lands after a guest saves their photos:{" "}
                {showTip
                  ? `the tip button${tips.showReview && reviewLinks.length ? " with the review links under it" : ""}, because tips are on and you have a tip link.`
                  : reviewLinks.length
                    ? "your review buttons, because tips are off for this send."
                    : "the thank-you line, because there are no review links and tips are off."}
              </p>
            ) : null}
            {surface === "review" && showCrew ? (
              <p className="fl-hint" style={{ margin: "10px 2px 0" }}>
                {shownFaces.length
                  ? `Showing the crew set to show: ${shownFaces.map((f) => f.firstName).join(", ")}.`
                  : "No crew are set to show yet."}
                {hiddenNames.length
                  ? ` Hidden right now: ${hiddenNames.join(", ")}. Turn anyone on under Settings, Employees.`
                  : ""}
                {" Each real send shows only the crew who were aboard."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// A faithful miniature of the guest gallery: hero, intro, a few placeholder
// photo tiles, and the real post-save slot logic (tip, review, or thanks).
function GalleryMini({
  operatorName,
  brand,
  accent,
  displayStack,
  logoAlign: align,
  logo,
  intro,
  species,
  reviewLinks,
  reviewAsk,
  thanks,
  tips,
}: {
  operatorName: string;
  brand: string;
  accent: string;
  displayStack: string;
  logoAlign: LogoAlign;
  logo: string | null;
  intro: string;
  species: string[];
  reviewLinks: { label: string }[];
  reviewAsk: string;
  thanks: string;
  tips: Tips;
}) {
  const showTip = tips.enabled && tips.myTip;
  const tipName = tips.myTip?.firstName ?? "Jordan";
  const tiles = ["#b9cdd4", "#9db4bd", "#c7d6d0", "#a8bfc9"];
  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)", background: "#faf8f4", color: "#1c2b2e" }}>
      <div style={{ background: brand, color: "#fff", padding: "18px 16px 16px" }}>
        <div style={{ textAlign: align }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={operatorName} style={{ height: "26px", display: "inline-block" }} />
          ) : (
            <div style={{ display: "inline-block", fontFamily: displayStack, fontSize: "14px", opacity: 0.96 }}>{operatorName}</div>
          )}
        </div>
        <div style={{ fontFamily: displayStack, fontWeight: 500, fontSize: "18px", lineHeight: 1.25, margin: "10px 0 5px", maxWidth: "18ch" }}>
          Your 10:00 AM trip with Captain Ray
        </div>
        <div style={{ fontSize: "10.5px", opacity: 0.85 }}>
          {species.join(" and ")} · photos by Jordan
        </div>
      </div>
      <div style={{ padding: "14px" }}>
        {intro ? (
          <p style={{ fontSize: "11.5px", lineHeight: 1.55, margin: "0 0 12px", color: "#33464a" }}>{intro}</p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {tiles.map((c, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: "8px", background: `linear-gradient(135deg, ${c}, #e7e2d8)` }}>
              <span
                style={{
                  position: "absolute",
                  bottom: 5,
                  right: 5,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: accent,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                ↓
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "12px", borderTop: "1px solid #e7e0d4", paddingTop: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: accent, color: "#fff", display: "grid", placeItems: "center", fontSize: "9px" }}>✓</span>
            <span style={{ fontSize: "11px", fontWeight: 600 }}>Saved to your phone.</span>
          </div>
          {showTip ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px" }}>
              {tips.myTip?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tips.myTip.photoUrl} alt={tipName} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", display: "block" }} />
              ) : (
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "14px" }}>
                  {(tipName[0] ?? "?").toUpperCase()}
                </span>
              )}
              <p style={{ fontSize: "10.5px", lineHeight: 1.5, color: "#46555a", margin: 0, maxWidth: "30ch" }}>
                Loved your trip? Your photos were shot by <strong style={{ color: "#1c2b2e" }}>{tipName}</strong>.
              </p>
              <span style={{ ...miniBtn, background: accent }}>Tip {tipName}</span>
              <span style={{ fontSize: "9.5px", color: "#8a938f" }}>
                {tips.myTip?.verb ?? "opens Venmo"} · goes straight to {tipName}
              </span>
              {tips.showReview && reviewLinks.length ? (
                <div style={{ fontSize: "10px", color: "#6b7a7d" }}>
                  Loved it?{" "}
                  {reviewLinks.map((l, i) => (
                    <span key={l.label}>
                      {i > 0 ? " · " : null}
                      <span style={{ color: accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px" }}>{l.label}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : reviewLinks.length ? (
            <>
              <p style={{ fontSize: "10.5px", lineHeight: 1.5, color: "#46555a", margin: "0 0 8px" }}>{reviewAsk}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {reviewLinks.map((l, i) => (
                  <span
                    key={l.label}
                    style={
                      i === 0
                        ? { ...miniBtn, background: accent }
                        : { ...miniBtn, background: "transparent", color: accent, border: `1px solid ${accent}` }
                    }
                  >
                    {l.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: "10.5px", color: "#46555a", margin: 0 }}>{thanks}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// One labeled copy field with a live counter and a restore link when it
// drifts from the default.
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
const warnText: React.CSSProperties = { color: "#b98a2f", fontSize: "12.5px" };
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
const miniBtn: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  fontWeight: 600,
  fontSize: "10.5px",
  padding: "8px",
  borderRadius: "8px",
  color: "#fff",
  width: "100%",
  boxSizing: "border-box",
};
