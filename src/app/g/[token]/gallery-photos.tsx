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
  preview = false,
}: {
  token: string;
  brand: string;
  retentionDays: number;
  photos: Photo[];
  reviewLinks: { label: string; href: string }[];
  preview?: boolean;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [save, setSave] = useState<SaveState>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array(1)], "probe.jpg", { type: "image/jpeg" });
      setCanShareFiles(
        typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }),
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
      setNote("Could not fetch the photos here. Try the zip download below, or reload the page.");
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
      setNote("Sharing did not work here. Use the zip download below instead.");
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

      {shareable ? (
        <div style={{ marginTop: "8px", textAlign: "right" }}>
          <a href={zipUrl} onClick={() => setDownloaded(true)} style={zipLink}>
            or download everything as a zip
          </a>
        </div>
      ) : null}

      {note ? (
        <p style={{ fontSize: "12.5px", color: "#a04435", margin: "10px 0 0", textAlign: "right" }}>
          {note}
        </p>
      ) : null}

      {downloaded ? (
        <div className="fl-reveal" style={{ marginTop: "18px", borderTop: "1px solid #e7e0d4", paddingTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: reviewLinks.length ? "12px" : "0" }}>
            <span style={{ ...check, background: brand }}>✓</span>
            <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#1c2b2e" }}>Saved to your phone.</span>
          </div>
          {reviewLinks.length ? (
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
