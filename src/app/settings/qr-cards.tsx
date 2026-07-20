"use client";

/*
  The operator's capture QR codes, rendered as PNG images generated on the
  server and handed down as data URLs. A real <img> is the right call on a
  phone: the operator can press and hold it to save it straight to their photos,
  and Save/Print downloads a .png (not an .svg, which phones do not treat as a
  photo).

  With more than one boat, each boat gets its own code in its own color, so the
  crew grabs the right one and a guest who scans it is locked to that boat and
  never picks the wrong one. The operator wide code stays as the catch-all.
*/

type BoatQr = { boatName: string; dataUrl: string | null; color: string };

const NEUTRAL = "#55606a";

// Turn a PNG data URL into a File without fetch, so it works everywhere.
function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

function QrCard({
  title,
  subtitle,
  dataUrl,
  color,
  fileBase,
  shareTitle,
}: {
  title: string;
  subtitle: string;
  dataUrl: string | null;
  color: string;
  fileBase: string;
  shareTitle: string;
}) {
  // On a phone, open the native share sheet where "Save Image" puts the code in
  // the photo library. On a desktop (no file share), just download it.
  async function save() {
    if (!dataUrl) return;
    const file = dataUrlToFile(dataUrl, `${fileBase}-signup-qr.png`);
    const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: shareTitle });
      } catch {
        // User dismissed the share sheet, or it failed. Nothing to do.
      }
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileBase}-signup-qr.png`;
    a.click();
  }

  function print() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    // Escape the title before it lands in the print window's HTML.
    const safe = title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><html><head><title>${safe} sign-up QR</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#10221f}` +
        `h1{font-size:22px;margin:0 0 6px}p{color:#5f6b68;font-size:14px;margin:0 0 24px}` +
        `img{width:320px;height:320px}</style></head><body>` +
        `<h1>${safe}</h1><p>Scan to get your trip photos</p>` +
        `<img src="${dataUrl}" alt="Sign-up QR" onload="window.focus();window.print()"/>` +
        `</body></html>`,
    );
    w.document.close();
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderTop: `4px solid ${color}`,
        borderRadius: "12px",
        padding: "16px 16px 18px",
        background: "var(--card, #fff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flex: "0 0 auto" }} />
        <span style={{ fontSize: "15px", fontWeight: 700, color }}>{title}</span>
      </div>

      {dataUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={`${title} sign-up QR`}
            width={170}
            height={170}
            style={{ display: "block", width: "170px", height: "170px", background: "#fff", borderRadius: "10px", border: `2px solid ${color}`, padding: "6px", boxSizing: "content-box" }}
          />
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "12px 0 12px", maxWidth: "30ch", lineHeight: 1.45 }}>
            {subtitle}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={save} className="fl-btn-ghost" style={{ fontSize: "12.5px", padding: "8px 14px" }}>
              Save to phone
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

export function CaptureQrs({
  operatorName,
  operatorDataUrl,
  boats,
}: {
  operatorName: string;
  operatorDataUrl: string | null;
  boats: BoatQr[];
}) {
  const opFileBase = operatorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "operator";
  const perBoat = boats.length > 0;

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        {perBoat
          ? "Each boat has its own code in its own color. Save the right one to that boat, and show it aboard. Guests scan it, pick their trip time, and land in your next send, already on the correct boat. The Operator code below works for any boat, for charters or a boat without its own code yet."
          : "Save this to your phone or print it, and show it aboard. Guests scan it, pick their trip, and land in your next send. One code for the whole operation, so selling or swapping a boat never breaks it."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
        {boats.map((b, i) => (
          <QrCard
            key={`${b.boatName}-${i}`}
            title={b.boatName}
            subtitle="Show this one aboard this boat. Guests who scan it are already set to this boat."
            dataUrl={b.dataUrl}
            color={b.color}
            fileBase={`${opFileBase}-${b.boatName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "boat"}`}
            shareTitle={`${b.boatName} sign-up QR`}
          />
        ))}

        <QrCard
          title={perBoat ? "Operator (any boat)" : operatorName}
          subtitle={
            perBoat
              ? "Guests pick their own boat and trip. Use this for charters or a boat without its own code yet."
              : "Tap Save to phone and choose Save Image to put it in your photos. Or press and hold the code and pick Save to Photos."
          }
          dataUrl={operatorDataUrl}
          color={NEUTRAL}
          fileBase={opFileBase}
          shareTitle={`${operatorName} sign-up QR`}
        />
      </div>
    </div>
  );
}
