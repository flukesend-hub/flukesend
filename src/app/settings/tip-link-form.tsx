"use client";

/*
  A photographer's own tip link. Editable only by them (the action is scoped to
  the caller's own membership row). Pick a provider, paste a handle in whatever
  shape, and the live preview shows the exact link a guest would open, so they
  can confirm it is right before saving. Optional and always editable; blank
  clears it. Tips go straight to the photographer; Flukesend never sees the money.
*/
import { useActionState, useState } from "react";
import { updateMyTipLink, type SettingsState } from "./actions";
import { TIP_PROVIDERS, buildTipUrl, normalizeTipHandle, type TipProvider } from "@/lib/tips";

export function TipLinkForm({
  displayName,
  provider,
  handle,
}: {
  displayName: string | null;
  provider: TipProvider | null;
  handle: string | null;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateMyTipLink, undefined);
  const [prov, setProv] = useState<TipProvider>(provider ?? "venmo");
  const [raw, setRaw] = useState(handle ?? "");

  const clean = normalizeTipHandle(raw);
  const preview = clean ? buildTipUrl(prov, clean) : null;
  const providerMeta = TIP_PROVIDERS.find((p) => p.key === prov)!;

  return (
    <form action={formAction}>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        This is your personal link. Tips go straight to you; Flukesend never sees
        the money. It only shows to guests once the account owner turns tips on.
      </p>

      <label style={{ display: "block", marginBottom: "14px" }}>
        <span className="fl-label-text">Your name (shown as &quot;Tip Jake&quot;)</span>
        <input
          name="display_name"
          defaultValue={displayName ?? ""}
          placeholder="First name"
          className="fl-input"
          maxLength={60}
        />
      </label>

      <span className="fl-label-text">Where tips go</span>
      <div style={{ display: "inline-flex", flexWrap: "wrap", border: "1px solid var(--line-strong)", borderRadius: "12px", overflow: "hidden", marginBottom: "14px" }}>
        {TIP_PROVIDERS.map((p) => {
          const on = prov === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setProv(p.key)}
              style={{
                font: "inherit",
                fontSize: "13.5px",
                padding: "10px 16px",
                border: 0,
                cursor: "pointer",
                background: on ? "var(--signal)" : "#fff",
                color: on ? "#fff" : "var(--muted)",
                fontWeight: on ? 600 : 500,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* The chosen provider rides along in a hidden field, since the visible
          picker is buttons, not a native input. */}
      <input type="hidden" name="tip_provider" value={prov} />

      <label style={{ display: "block", marginBottom: "12px" }}>
        <span className="fl-label-text">Your handle</span>
        <input
          name="tip_handle"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={providerMeta.hint}
          className="fl-input"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>

      <div style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "16px", minHeight: "18px" }}>
        {preview ? (
          <>
            Guests will open:{" "}
            <span style={{ color: "var(--signal-2)", fontWeight: 600, wordBreak: "break-all" }}>{preview}</span>
          </>
        ) : (
          "Paste a handle, a $cashtag, or a full link. The exact link shows here."
        )}
      </div>

      {state?.error ? <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 10px" }}>{state.error}</p> : null}
      {state?.ok ? <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 10px" }}>{state.ok}</p> : null}

      <button type="submit" disabled={pending} className="fl-btn" style={{ fontSize: "13.5px" }}>
        {pending ? "Saving..." : "Save tip link"}
      </button>
    </form>
  );
}
