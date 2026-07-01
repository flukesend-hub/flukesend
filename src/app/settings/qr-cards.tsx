"use client";

/*
  The operator's single capture QR, rendered as a PNG image generated on the
  server and handed down as a data URL. A real <img> is the right call on a
  phone: the operator can press and hold it to save it straight to their photos,
  and Download saves a .png (not an .svg, which phones do not treat as a photo).
  One code for the whole operation, not per boat.
*/

export function CaptureQr({
  operatorName,
  dataUrl,
}: {
  operatorName: string;
  dataUrl: string | null;
}) {
  const fileBase = operatorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "operator";

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileBase}-signup-qr.png`;
    a.click();
  }

  function print() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>${operatorName} sign-up QR</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#10221f}` +
        `h1{font-size:22px;margin:0 0 6px}p{color:#5f6b68;font-size:14px;margin:0 0 24px}` +
        `img{width:320px;height:320px}</style></head><body>` +
        `<h1>${operatorName}</h1><p>Scan to get your trip photos</p>` +
        `<img src="${dataUrl}" alt="Sign-up QR" onload="window.focus();window.print()"/>` +
        `</body></html>`,
    );
    w.document.close();
  }

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Save this to your phone or print it, and show it aboard. Guests scan it,
        pick their trip, and land in your next send. One code for the whole
        operation, so selling or swapping a boat never breaks it.
      </p>

      {dataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={`${operatorName} sign-up QR`}
            width={200}
            height={200}
            style={{ display: "block", width: "200px", height: "200px", background: "#fff", borderRadius: "10px", border: "1px solid var(--line)" }}
          />
          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "10px 0 14px", maxWidth: "34ch", lineHeight: 1.45 }}>
            On your phone, press and hold the code to save it to your photos, or
            tap Download.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={download} className="fl-btn-ghost" style={{ fontSize: "12.5px", padding: "8px 14px" }}>
              Download
            </button>
            <button type="button" onClick={print} className="fl-btn-ghost" style={{ fontSize: "12.5px", padding: "8px 14px" }}>
              Print
            </button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>QR unavailable right now.</div>
      )}
    </div>
  );
}
