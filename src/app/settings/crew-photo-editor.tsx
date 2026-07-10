"use client";

/*
  Circular photo editor for a crew member, like a profile-picture cropper. The
  operator drags to reposition and slides to zoom inside a round viewport, then
  we export a small square JPEG from a canvas. Two wins: the upload is tiny
  (well under the server-action body limit, which a raw phone photo would blow
  past), and the face is already cropped and centered the way they want, so it
  reads right in every circle including the emails. No em dashes anywhere.
*/
import { useEffect, useRef, useState } from "react";

const BOX = 240; // on-screen circular viewport, px
const OUT = 512; // exported square, px

export function CrewPhotoEditor({
  file,
  name,
  saving,
  onSave,
  onCancel,
}: {
  file: File;
  name: string;
  saving: boolean;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      // Cover: smallest scale that fills the circle, then center.
      const cover = Math.max(BOX / im.naturalWidth, BOX / im.naturalHeight);
      setImg(im);
      setMinScale(cover);
      setScale(cover);
      setPos({ x: (BOX - im.naturalWidth * cover) / 2, y: (BOX - im.naturalHeight * cover) / 2 });
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;
  const clamp = (x: number, y: number, ww: number, hh: number) => ({
    x: Math.min(0, Math.max(BOX - ww, x)),
    y: Math.min(0, Math.max(BOX - hh, y)),
  });

  // Keep the image covering the circle whenever the zoom changes.
  useEffect(() => {
    if (img) setPos((p) => clamp(p.x, p.y, w, h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, img]);

  function save() {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const f = OUT / BOX;
    ctx.fillStyle = "#e7e2d8";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, pos.x * f, pos.y * f, w * f, h * f);
    c.toBlob((b) => b && onSave(b), "image/jpeg", 0.85);
  }

  return (
    <div style={backdrop} role="dialog" aria-modal="true">
      <div style={panel}>
        <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "3px" }}>Position {name}&apos;s photo</div>
        <p className="fl-hint" style={{ margin: "0 0 14px" }}>Drag to move, slide to zoom.</p>
        <div
          ref={boxRef}
          onPointerDown={(e) => {
            boxRef.current?.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setPos(clamp(drag.current.px + (e.clientX - drag.current.x), drag.current.py + (e.clientY - drag.current.y), w, h));
          }}
          onPointerUp={(e) => {
            drag.current = null;
            try {
              boxRef.current?.releasePointerCapture(e.pointerId);
            } catch {}
          }}
          style={{ width: BOX, height: BOX, borderRadius: "50%", overflow: "hidden", position: "relative", margin: "0 auto", background: "#e7e2d8", cursor: "grab", touchAction: "none" }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ position: "absolute", left: 0, top: 0, width: `${w}px`, height: `${h}px`, transform: `translate(${pos.x}px, ${pos.y}px)`, userSelect: "none", pointerEvents: "none" }}
            />
          ) : null}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.45)", borderRadius: "50%", pointerEvents: "none" }} />
        </div>
        <input
          type="range"
          min={minScale}
          max={minScale * 3}
          step="0.01"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          aria-label="zoom"
          style={{ width: BOX, display: "block", margin: "16px auto 0" }}
        />
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px" }}>
          <button type="button" className="fl-btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="fl-btn" onClick={save} disabled={saving || !img}>
            {saving ? "Saving..." : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.55)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
  padding: "20px",
};
const panel: React.CSSProperties = {
  background: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "16px",
  padding: "20px",
  width: "min(320px, 100%)",
};
