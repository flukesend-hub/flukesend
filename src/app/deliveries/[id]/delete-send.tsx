"use client";

/*
  The delete control on the send detail page. Two step: the quiet link arms a
  confirm row that spells out what deleting means before anything happens. On
  success the server action redirects to /send.
*/
import { useState } from "react";
import { deleteDelivery } from "./actions";

export function DeleteSend({ deliveryId }: { deliveryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await deleteDelivery(deliveryId);
    // A successful delete redirects to /send, so a value here means failure.
    if (res?.error) {
      setError(res.error);
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "16px" }}>
      {confirming ? (
        <div style={confirmBox}>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>
            Delete this send for good? Every guest&apos;s gallery link stops
            working, the photos are removed from storage, and it disappears
            from your analytics. This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button onClick={run} disabled={busy} style={dangerBtn}>
              {busy ? "Deleting..." : "Yes, delete it"}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={busy}
              className="fl-btn-ghost"
              style={{ padding: "8px 14px", fontSize: "13px" }}
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p style={{ color: "var(--bad)", fontSize: "12.5px", margin: "8px 0 0" }}>{error}</p>
          ) : null}
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} style={quietDanger}>
          Delete this send
        </button>
      )}
    </div>
  );
}

const quietDanger: React.CSSProperties = {
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 500,
  color: "var(--bad)",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
const confirmBox: React.CSSProperties = {
  border: "1px solid var(--bad)",
  borderRadius: "12px",
  padding: "12px 14px",
};
const dangerBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "13px",
  fontWeight: 600,
  color: "#fff",
  background: "var(--bad)",
  border: "none",
  borderRadius: "9px",
  padding: "8px 14px",
  cursor: "pointer",
};
