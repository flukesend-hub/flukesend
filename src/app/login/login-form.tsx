"use client";

/*
  Login and account creation in one card. A segmented toggle swaps which server
  action the form posts to. Dark operator styling from the design handoff.
*/
import { useActionState, useState } from "react";
import { login, signup, requestPasswordReset, type AuthState } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/browser";

type Mode = "login" | "signup" | "forgot";

async function signInWithGoogle() {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

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

      <button type="button" onClick={signInWithGoogle} style={googleBtn}>
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>

      <div style={dividerRow}>
        <span style={dividerLine} />
        <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>or</span>
        <span style={dividerLine} />
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

const googleBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "11px",
  font: "inherit",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text)",
  background: "#fff",
  border: "1px solid var(--line-strong)",
  borderRadius: "11px",
  cursor: "pointer",
};
const dividerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  margin: "16px 0",
};
const dividerLine: React.CSSProperties = {
  flex: 1,
  height: "1px",
  background: "var(--line)",
};
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
