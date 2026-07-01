"use client";

/*
  Set a new password after arriving from a reset link. The recovery session is
  already set by /auth/callback, so this just posts the new password. No em
  dashes anywhere.
*/
import { useActionState } from "react";
import { updatePassword, type AuthState } from "@/app/auth/actions";

export function ResetForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={formAction} style={card}>
      <label style={{ display: "block", marginBottom: "14px" }}>
        <span className="fl-label-text">New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className="fl-input" />
      </label>
      <label style={{ display: "block", marginBottom: "18px" }}>
        <span className="fl-label-text">Confirm password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className="fl-input" />
      </label>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}

      <button type="submit" disabled={pending} className="fl-btn" style={{ width: "100%", padding: "12px" }}>
        {pending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}

const card: React.CSSProperties = {
  background: "linear-gradient(180deg,var(--panel),var(--panel) 60%,var(--ink-2))",
  border: "1px solid var(--line)",
  borderRadius: "18px",
  padding: "24px",
};
