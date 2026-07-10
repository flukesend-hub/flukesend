"use client";

/*
  The interactive part of the guest gallery: the photo grid with a per photo
  download button, the save-everything action, and the post download note.

  Saving everything comes in two shapes:
  - Phones that can share files (iOS and most Android) get "Save all to
    Photos": the photos are fetched from their signed URLs with a progress
    count, then a second tap opens the share sheet, where Save Images lands
    them straight in the camera roll. The second tap exists because browsers
    only allow the share sheet from a fresh tap, not after a long fetch.
  - Everything else gets one zip through /g/[token]/zip. One click, one file.

  The downloaded event (the review ask trigger) fires exactly once either way:
  the zip route writes it server side, the share flow posts it after a
  successful share. Preview mode suppresses both.
*/
import { useEffect, useState } from "react";

type Photo = { id: string; name: string; url: string; thumbUrl: string; size: number };

type SaveState =
  | null
  | { phase: "fetching"; done: number; total: number }
  | { phase: "ready"; files: File[] }
  | { phase: "sharing" };

// Above this, holding every photo in page memory risks crashing a phone
// browser, so large galleries go straight to the zip.
const MAX_SHARE_BYTES = 250 * 1024 * 1024;

export function GalleryPhotos({
  token,
  brand,
  retentionDays,
  photos,
  reviewLinks,
  tip = null,
  reviewUnderTip = false,
  preview = false,
}: {
  token: string;
  brand: string;
  retentionDays: number;
  photos: Photo[];
  reviewLinks: { label: string; href: string }[];
  // When set, the tip block is the primary ask in the post-save slot, in place
  // of the review links. Resolved server side (both flags already checked).
  tip?: { firstName: string; verb: string; href: string } | null;
  // When the operator opted to also ask for a review, the review shows as a
  // quiet secondary link under the tip button (never a second big button).
  reviewUnderTip?: boolean;
  preview?: boolean;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [save, setSave] = useState<SaveState>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      // The share-to-Photos flow (fetch, then tap the share sheet) only makes
      // sense on a touch-first device saving to its camera roll. Desktops,
      // including macOS Safari which supports the share API, should get the
      // one-click zip instead. Gate on a coarse pointer so a Mac trackpad or a
      // mouse is treated as a desktop and never sees the phone flow.
      const touchFirst =
        typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      const probe = new File([new Uint8Array(1)], "probe.jpg", { type: "image/jpeg" });
      setCanShareFiles(
        touchFirst &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [probe] }),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  const totalBytes = photos.reduce((s, p) => s + (p.size || 0), 0);
  const shareable = canShareFiles && totalBytes <= MAX_SHARE_BYTES;
  const zipUrl = `/g/${token}/zip${preview ? "?preview=1" : ""}`;

  function downloadUrl(id: string) {
    return `/g/${token}/download?p=${id}${preview ? "&preview=1" : ""}`;
  }

  async function prepareShare() {
    setNote(null);
    setSave({ phase: "fetching", done: 0, total: photos.length });
    try {
      const files: File[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        files.push(new File([blob], p.name, { type: blob.type || "image/jpeg" }));
        setSave({ phase: "fetching", done: i + 1, total: photos.length });
      }
      setSave({ phase: "ready", files });
    } catch {
      setSave(null);
      setNote("Could not get the photos ready here.");
    }
  }

  async function shareNow(files: File[]) {
    setSave({ phase: "sharing" });
    try {
      await navigator.share({ files });
      setDownloaded(true);
      setSave(null);
      if (!preview) {
        fetch(`/g/${token}/download`, { method: "POST" }).catch(() => {
          // A missed event is not worth bothering the guest about.
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // Guest closed the share sheet. Keep the photos ready for another tap.
        setSave({ phase: "ready", files });
        return;
      }
      setSave(null);
      setNote("Sharing did not work here.");
    }
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {photos.map((p, i) => (
          <div key={p.id} style={card}>
            {/* Real img tags so the grid can lazy load: only the first few
                render up front, the rest as the guest scrolls, so a ten photo
                gallery paints fast instead of pulling every full size photo at
                once. The first row is eager so the top of the gallery is
                instant. Download stays full resolution via the arrow. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumbUrl}
              alt=""
              loading={i < 2 ? "eager" : "lazy"}
              decoding="async"
              style={tileImg}
            />
            <a
              href={downloadUrl(p.id)}
              onClick={() => setDownloaded(true)}
              style={{ ...dlBtn, background: brand }}
              aria-label={`Download ${p.name}`}
            >
              ↓
            </a>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12.5px", color: "#6b7a7d" }}>
          {photos.length} photos · live for {retentionDays} days
        </span>
        {shareable ? (
          save?.phase === "fetching" ? (
            <button disabled style={{ ...allBtn, background: brand, opacity: 0.75 }}>
              Getting photo {save.done} of {save.total}...
            </button>
          ) : save?.phase === "ready" ? (
            <button onClick={() => shareNow(save.files)} style={{ ...allBtn, background: brand }}>
              Ready. Tap to save {save.files.length} photos
            </button>
          ) : save?.phase === "sharing" ? (
            <button disabled style={{ ...allBtn, background: brand, opacity: 0.75 }}>
              Opening...
            </button>
          ) : (
            <button
              onClick={prepareShare}
              style={{ ...allBtn, background: brand, opacity: downloaded ? 0.7 : 1 }}
            >
              {downloaded ? "Saved" : "Save all to Photos"}
            </button>
          )
        ) : (
          <a
            href={zipUrl}
            onClick={() => setDownloaded(true)}
            style={{ ...allBtn, background: brand, opacity: downloaded ? 0.7 : 1, textDecoration: "none", display: "inline-block" }}
          >
            {downloaded ? "Downloaded" : "Download all photos"}
          </a>
        )}
      </div>

      {/* Zip is a fallback, not a standing option: it only appears if the
          Save to Photos flow actually fails, so the normal case is one button.
          It still logs the download event through the zip route. */}
      {note ? (
        <div style={{ marginTop: "10px", textAlign: "right" }}>
          <p style={{ fontSize: "12.5px", color: "#a04435", margin: "0 0 5px" }}>{note}</p>
          <a href={zipUrl} onClick={() => setDownloaded(true)} style={zipLink}>
            Download everything as a zip instead
          </a>
        </div>
      ) : null}

      {downloaded ? (
        <div className="fl-reveal" style={{ marginTop: "18px", borderTop: "1px solid #e7e0d4", paddingTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: tip || reviewLinks.length ? "14px" : "0" }}>
            <span style={{ ...check, background: brand }}>✓</span>
            <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#1c2b2e" }}>Saved to your phone.</span>
          </div>
          {tip ? (
            // The tip is the primary ask for this operator. One human, one
            // button; the payment provider is only a small grey cue, never a
            // logo, so the operator's brand stays the hero.
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "12px" }}>
              <span style={{ ...avatar, background: brand }}>
                {(tip.firstName.trim()[0] ?? "?").toUpperCase()}
              </span>
              <p style={{ fontSize: "14px", lineHeight: 1.55, color: "#46555a", margin: 0, maxWidth: "34ch" }}>
                Loved your trip? Your photos were shot by{" "}
                <strong style={{ color: "#1c2b2e" }}>{tip.firstName}</strong>.
              </p>
              <a
                href={tip.href}
                target="_blank"
                rel="noreferrer"
                style={{ ...reviewBtn, background: brand, color: "#fff", width: "100%", maxWidth: "320px" }}
              >
                Tip {tip.firstName}
              </a>
              <span style={{ fontSize: "12px", color: "#8a938f" }}>
                {tip.verb} · goes straight to {tip.firstName}
              </span>
              {reviewUnderTip && reviewLinks.length ? (
                // Secondary, quiet: a small review link under the tip, so the
                // tip stays the one primary button. Never a second big CTA.
                <div style={{ marginTop: "8px", fontSize: "13px", color: "#6b7a7d" }}>
                  Loved it?{" "}
                  {reviewLinks.map((l, i) => (
                    <span key={l.href}>
                      {i > 0 ? " · " : null}
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: brand, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px" }}
                      >
                        {l.label}
                      </a>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : reviewLinks.length ? (
            <>
              <p style={{ fontSize: "13.5px", lineHeight: 1.55, color: "#46555a", margin: "0 0 12px" }}>
                Loved the trip? A quick review means a lot to a small crew like ours.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {reviewLinks.map((l, i) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    style={
                      i === 0
                        ? { ...reviewBtn, background: brand, color: "#fff" }
                        : { ...reviewBtn, background: "transparent", color: brand, border: `1px solid ${brand}` }
                    }
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: "13px", color: "#46555a", margin: "0" }}>
              Thanks for spending the day on the water with us.
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}

const card: React.CSSProperties = {
  position: "relative",
  // Landscape tiles: wildlife photos are wide, so 4:3 shows much more of the
  // frame than a square would crop away.
  aspectRatio: "4 / 3",
  borderRadius: "11px",
  overflow: "hidden",
  background: "#e7e2d8",
};
const tileImg: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};
const dlBtn: React.CSSProperties = {
  position: "absolute",
  bottom: "7px",
  right: "7px",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 700,
  color: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,.3)",
};
const allBtn: React.CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  fontSize: "14.5px",
  cursor: "pointer",
  color: "#fff",
  border: 0,
  borderRadius: "12px",
  padding: "12px 20px",
};
const zipLink: React.CSSProperties = {
  fontSize: "12.5px",
  color: "#6b7a7d",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
const check: React.CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: "12px",
  flex: "0 0 auto",
};
const reviewBtn: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "14px",
  padding: "13px",
  borderRadius: "11px",
};
const avatar: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  fontSize: "19px",
};
