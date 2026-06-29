"use client";

/*
  The interactive part of the guest gallery: the photo grid with a per photo
  download button, a download all action, and the post download note. Each
  download hits our route, which streams the file and writes the downloaded
  event that triggers the review ask. Download all triggers each in turn.
*/
import { useState } from "react";

type Photo = { id: string; name: string; url: string };

export function GalleryPhotos({
  token,
  brand,
  retentionDays,
  photos,
}: {
  token: string;
  brand: string;
  retentionDays: number;
  photos: Photo[];
}) {
  const [downloaded, setDownloaded] = useState(false);

  function downloadUrl(id: string) {
    return `/g/${token}/download?p=${id}`;
  }

  async function downloadAll() {
    setDownloaded(true);
    for (const p of photos) {
      const a = document.createElement("a");
      a.href = downloadUrl(p.id);
      a.download = p.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {photos.map((p) => (
          <div key={p.id} style={{ ...card, backgroundImage: `url(${p.url})` }}>
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
        <button onClick={downloadAll} style={{ ...allBtn, background: brand, opacity: downloaded ? 0.7 : 1 }}>
          {downloaded ? "Downloaded" : "Download all photos"}
        </button>
      </div>

      {downloaded ? (
        <div style={{ marginTop: "18px", borderTop: "1px solid #e7e0d4", paddingTop: "16px", display: "flex", alignItems: "center", gap: "11px" }}>
          <span style={{ ...clock, borderColor: brand, color: brand }}>⏳</span>
          <span style={{ fontSize: "13px", color: "#46555a" }}>
            Saved. We will send you a quick note this evening in case you want to
            share how the trip went.
          </span>
        </div>
      ) : null}
    </>
  );
}

const card: React.CSSProperties = {
  position: "relative",
  aspectRatio: "1",
  borderRadius: "11px",
  overflow: "hidden",
  background: "#e7e2d8",
  backgroundSize: "cover",
  backgroundPosition: "center",
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
const clock: React.CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  border: "2px solid",
  display: "grid",
  placeItems: "center",
  fontSize: "14px",
  flex: "0 0 auto",
};
