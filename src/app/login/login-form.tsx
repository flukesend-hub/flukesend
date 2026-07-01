"use client";

/*
  Login and account creation in one card. A segmented toggle swaps which server
  action the form posts to. Dark operator styling from the design handoff.
*/
import { useActionState, useState } from "react";
import { login, signup, requestPasswordReset, type AuthState } from "@/app/auth/actions";

type Mode = "login" | "signup" | "forgot";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const action =
    mode === "forgot" ? requestPasswordReset : mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  if (mode === "forgot") {
    return (
      <div
        style={{
          background: "linear-gradient(180deg,var(--panel),var(--panel) 60%,var(--ink-2))",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          padding: "24px",
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 600 }}>Reset your password</h2>
        <p className="fl-hint" style={{ margin: "0 0 16px" }}>
          Enter your email and we will send a reset link.
        </p>
        <form action={formAction}>
          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="fl-label-text">Email</span>
            <input name="email" type="email" autoComplete="email" required className="fl-input" />
          </label>
          {state?.error ? (
            <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
          ) : null}
          <button type="submit" disabled={pending} className="fl-btn" style={{ width: "100%", padding: "12px" }}>
            {pending ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode("login")}
          className="fl-link"
          style={{ display: "block", margin: "14px auto 0" }}
        >
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg,var(--panel),var(--panel) 60%,var(--ink-2))",
        border: "1px solid var(--line)",
        borderRadius: "18px",
        padding: "24px",
      }}
    >
      <div style={tabsWrap}>
        <button type="button" onClick={() => setMode("login")} style={tab(mode === "login")}>
          Log in
        </button>
        <button type="button" onClick={() => setMode("signup")} style={tab(mode === "signup")}>
          Create account
        </button>
      </div>

      <form action={formAction}>
        <label style={{ display: "block", marginBottom: "14px" }}>
          <span className="fl-label-text">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="fl-input"
          />
        </label>
        <label style={{ display: "block", marginBottom: "18px" }}>
          <span className="fl-label-text">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : undefined}
            className="fl-input"
          />
        </label>

        {mode === "login" ? (
          <div style={{ textAlign: "right", marginTop: "-8px", marginBottom: "16px" }}>
            <button type="button" onClick={() => setMode("forgot")} className="fl-link">
              Forgot password?
            </button>
          </div>
        ) : null}

        {state?.error ? (
          <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>
            {state.error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className="fl-btn" style={{ width: "100%", padding: "12px" }}>
          {pending ? "Working..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p
        style={{
          textAlign: "center",
          color: "var(--muted-2)",
          fontSize: "12px",
          margin: "14px 0 0",
        }}
      >
        {mode === "login"
          ? "New here? Switch to create account above."
          : "Already have an account? Switch to log in above."}
      </p>
    </div>
  );
}

const tabsWrap: React.CSSProperties = {
  display: "flex",
  padding: "4px",
  gap: "4px",
  background: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "11px",
  marginBottom: "20px",
};

function tab(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    font: "inherit",
    fontSize: "13.5px",
    fontWeight: active ? 600 : 500,
    color: active ? "var(--signal-ink)" : "var(--muted)",
    background: active ? "var(--signal)" : "transparent",
    border: 0,
    borderRadius: "8px",
    padding: "8px",
    cursor: "pointer",
  };
}
