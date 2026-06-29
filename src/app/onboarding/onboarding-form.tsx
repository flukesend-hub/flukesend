"use client";

/*
  First run operator setup, styled from the design handoff. Captures the
  operation name, brand color, default guest message, and retention. The logo is
  added later in Settings, so here it is a visual placeholder only. The extended
  retention toggle is a paid add on and is presentational until billing exists.
*/
import { useActionState, useState } from "react";
import { createOperator, type SetupState } from "./actions";
import { Swatches, Toggle } from "@/app/_ui/controls";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createOperator,
    undefined,
  );
  const [brand, setBrand] = useState("#0b5563");
  const [retention, setRetention] = useState(5);
  const [extended, setExtended] = useState(false);

  return (
    <form action={formAction}>
      <div className="fl-cols" style={{ marginTop: "24px" }}>
        <div className="fl-card">
          <h3 style={h3}>Operation</h3>
          <p className="fl-hint" style={{ margin: "0 0 16px" }}>
            This name leads every gallery and email a guest opens.
          </p>
          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="fl-label-text">Operation name</span>
            <input name="name" className="fl-input" placeholder="Enocean Tours" required />
          </label>
          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="fl-label-text">Logo</span>
            <div style={dropzone}>You can add your logo in Settings after setup.</div>
          </label>
          <label style={{ display: "block" }}>
            <span className="fl-label-text">Default message to guests</span>
            <textarea
              name="default_message"
              className="fl-textarea"
              defaultValue="Thanks for spending the morning on the water with us. Your photos from the trip are ready below."
            />
          </label>
        </div>

        <div className="fl-card">
          <h3 style={h3}>Brand color</h3>
          <p className="fl-hint" style={{ margin: "0 0 16px" }}>
            Pick yours. It drives the gallery header and the review email band
            that guests see.
          </p>
          <div style={{ marginBottom: "18px" }}>
            <Swatches value={brand} onChange={setBrand} />
          </div>
          <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ background: brand, color: "#fff", padding: "20px 18px" }}>
              <div className="fl-display" style={{ fontSize: "15px", opacity: 0.95 }}>
                Your gallery header
              </div>
              <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                This is how your color reads to a guest
              </div>
            </div>
          </div>

          <h3 style={{ ...h3, margin: "22px 0 2px" }}>Photo retention</h3>
          <p className="fl-hint" style={{ margin: "0 0 14px" }}>
            How long galleries stay live before photos are deleted. Longer means
            more storage on us.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min={3}
              max={10}
              name="retention_days"
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="fl-display" style={{ fontSize: "22px", minWidth: "92px" }}>
              <span style={{ color: "var(--signal)" }}>{retention}</span> days
            </span>
          </div>
          <div style={extRow}>
            <Toggle on={extended} onToggle={() => setExtended(!extended)} label="Extended retention" />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Extended retention, up to 90 days
            </span>
            <span style={badge}>Paid add on</span>
          </div>
        </div>
      </div>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "16px 0 0" }}>
          {state.error}
        </p>
      ) : null}

      <div style={{ marginTop: "22px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <button type="submit" disabled={pending} className="fl-btn">
          {pending ? "Creating..." : "Create workspace"}
        </button>
        <span style={{ fontSize: "12.5px", color: "var(--muted-2)", maxWidth: "48ch" }}>
          Base plan covers 3 to 10 days. Each send stamps its own expiry from
          this setting.
        </span>
      </div>
    </form>
  );
}

const h3: React.CSSProperties = { margin: "0 0 2px", fontSize: "15px", fontWeight: 600 };
const dropzone: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "12px",
  padding: "18px",
  textAlign: "center",
  color: "var(--muted)",
  fontSize: "13px",
};
const extRow: React.CSSProperties = {
  marginTop: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  border: "1px dashed var(--line-strong)",
  borderRadius: "12px",
  padding: "12px 14px",
};
const badge: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--signal)",
  border: "1px solid var(--signal)",
  borderRadius: "999px",
  padding: "3px 8px",
  marginLeft: "auto",
};
