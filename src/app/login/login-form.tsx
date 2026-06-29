"use client";

/*
  Login and account creation in one form. A mode toggle swaps which server
  action the form posts to, so the markup and useActionState wiring stay shared.
  Errors (and the "check your inbox" note) come back as action state.
*/
import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "@/app/auth/actions";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} style={styles.form}>
      <label style={styles.label}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          style={styles.input}
        />
      </label>

      {state?.error ? <p style={styles.error}>{state.error}</p> : null}

      <button type="submit" disabled={pending} style={styles.button}>
        {pending
          ? "Working..."
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        style={styles.toggle}
      >
        {mode === "login"
          ? "Need an account? Create one"
          : "Already have an account? Log in"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
  },
  error: { color: "#b91c1c", fontSize: "0.85rem", margin: 0 },
  button: {
    padding: "0.7rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#0b5563",
    color: "white",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
  },
  toggle: {
    background: "none",
    border: "none",
    color: "#0b5563",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
};
