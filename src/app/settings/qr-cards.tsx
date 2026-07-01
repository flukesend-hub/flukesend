"use client";

/*
  The operator's single capture QR. The SVG is generated on the server and
  handed down as a string; here we render it and offer download and print.
  Download saves the SVG file; print opens a clean sheet the operator can tape
  up by the gangway. One code for the whole operation, not per boat.
*/

export function CaptureQr({
  operatorName,
  url,
  svg,
}: {
  operatorName: string;
  url: string | null;
  svg: string | null;
}) {
  function download() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${operatorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-signup-qr.svg`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function print() {
    if (!svg) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>${operatorName} sign-up QR</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#10221f}` +
        `h1{font-size:22px;margin:0 0 6px}p{color:#5f6b68;font-size:14px;margin:0 0 24px}` +
        `svg{width:320px;height:320px}</style></head><body>` +
        `<h1>${operatorName}</h1><p>Scan to get your trip photos</p>${svg}` +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        Print this once and show it aboard any boat. Guests scan it, pick their
        boat and trip time, and land in your next send. One code for the whole
        operation, so selling or swapping a boat never breaks it.
      </p>
      <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        {svg ? (
          <div
            style={{ background: "#fff", borderRadius: "12px", padding: "12px", width: "156px", height: "156px", flex: "0 0 auto" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>QR unavailable right now.</div>
        )}
        <div style={{ minWidth: "180px", flex: "1 1 auto" }}>
          {url ? (
            <div style={{ fontSize: "12px", color: "var(--muted)", wordBreak: "break-all", marginBottom: "12px" }}>
              {url}
            </div>
          ) : null}
          {svg ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={download} className="fl-btn-ghost" style={{ fontSize: "12.5px", padding: "8px 12px" }}>
                Download
              </button>
              <button type="button" onClick={print} className="fl-btn-ghost" style={{ fontSize: "12.5px", padding: "8px 12px" }}>
                Print
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
