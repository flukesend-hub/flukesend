"use client";

/*
  The guest's "Share your sighting" block, in the gallery body (never in the
  post-save review slot, so it never competes with the review ask). The card is
  forced to exist on every gallery; the guest chooses whether to post it.

  A phone that can share files gets a Share button that opens the native share
  sheet with the card image; the pre-filled caption sits beside it with a Copy
  button, since Instagram will not accept a caption from the share sheet and the
  guest pastes it. Desktop, with no file share, gets Download plus the same
  copyable caption. The card image is preloaded into a File so the Share tap is
  instant (iOS only allows the share sheet from a fresh tap, not after a fetch).
*/
import { useEffect, useState } from "react";

export function ShareSighting({
  cardUrl,
  caption,
  brand,
  accent,
}: {
  cardUrl: string;
  caption: string;
  brand: string;
  accent?: string;
}) {
  const ui = accent || brand;
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Same gate as the photo save: a touch-first device that can share files.
  useEffect(() => {
    try {
      const touchFirst =
        typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
      setCanShareFiles(
        touchFirst && typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  // Preload the card as a File so the Share tap fires the share sheet with no
  // await in between. The preview <img> already fetched the PNG, so this reuses
  // the cached render rather than rendering the card twice.
  useEffect(() => {
    let alive = true;
    fetch(cardUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setFile(new File([b], "my-sighting.png", { type: "image/png" }));
      })
      .catch(() => {
        // No preloaded file: the button stays in its preparing state, and the
        // caption + preview still work, so the block is never fully broken.
      });
    return () => {
      alive = false;
    };
  }, [cardUrl]);

  async function share() {
    if (!file) return;
    setNote(null);
    try {
      await navigator.share({ files: [file], text: caption });
      setShared(true);
    } catch (e) {
      // Guest dismissed the share sheet: not an error, nothing to say.
      if (e instanceof Error && e.name === "AbortError") return;
      setNote("Sharing did not work here. Try Download instead.");
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = "my-sighting.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote("Could not copy here. Select the caption and copy it.");
    }
  }

  return (
    <div style={{ marginTop: "22px", borderTop: "1px solid #e7e0d4", paddingTop: "20px" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color: "#1c2b2e", marginBottom: "4px" }}>
        Share your sighting
      </div>
      <p style={{ fontSize: "13px", color: "#6b7a7d", margin: "0 0 14px", lineHeight: 1.5 }}>
        A card for your story. Post it and let people know who took you out.
      </p>

      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto", width: "132px", aspectRatio: "9 / 16", borderRadius: "12px", overflow: "hidden", background: "#e7e2d8", border: "1px solid #e7e0d4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardUrl} alt="Your sighting card" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>

        <div style={{ flex: "1 1 220px", minWidth: "220px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {canShareFiles ? (
            <button type="button" onClick={share} disabled={!file} style={{ ...btn, background: ui, opacity: file ? 1 : 0.7 }}>
              {shared ? "Shared" : file ? "Share" : "Preparing..."}
            </button>
          ) : (
            <button type="button" onClick={download} style={{ ...btn, background: ui }}>
              Download card
            </button>
          )}

          <div style={{ background: "#fbf9f4", border: "1px solid #ece5d8", borderRadius: "10px", padding: "10px 12px" }}>
            <div style={{ fontSize: "13px", color: "#46555a", lineHeight: 1.5 }}>{caption}</div>
            <button
              type="button"
              onClick={copyCaption}
              style={{ marginTop: "8px", font: "inherit", fontSize: "12.5px", fontWeight: 600, color: ui, background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              {copied ? "Caption copied" : "Copy caption"}
            </button>
          </div>

          {note ? <p style={{ fontSize: "12.5px", color: "#a04435", margin: 0 }}>{note}</p> : null}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  fontSize: "14.5px",
  cursor: "pointer",
  color: "#fff",
  border: 0,
  borderRadius: "12px",
  padding: "12px 20px",
  textAlign: "center",
};
