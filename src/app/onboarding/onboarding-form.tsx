"use client";

/*
  First run operator setup. Captures the operator name plus the branding
  defaults that flow into every gallery and review email later: brand color, the
  default guest message, and how many days a delivery stays live. Logo upload
  and review links come in the next slice.
*/
import { useActionState } from "react";
import { createOperator, type SetupState } from "./actions";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    createOperator,
    undefined,
  );

  return (
    <form action={formAction} style={styles.form}>
      <label style={styles.label}>
        Operation name
        <input
          name="name"
          type="text"
          required
          placeholder="Enocean Tours"
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Brand color
        <span style={styles.hint}>
          Drives your gallery header and the review email band.
        </span>
        <input
          name="brand_color"
          type="color"
          defaultValue="#0b5563"
          style={styles.color}
        />
      </label>

      <label style={styles.label}>
        Default guest message
        <span style={styles.hint}>
          The warm note guests see. You can override it per send later.
        </span>
        <textarea
          name="default_message"
          rows={3}
          placeholder="Thanks for joining us out on the water. Here are your photos."
          style={styles.textarea}
        />
      </label>

      <label style={styles.label}>
        Retention days
        <span style={styles.hint}>
          How long each delivery stays live. Base plan allows 3 to 10 days.
        </span>
        <input
          name="retention_days"
          type="number"
          min={3}
          max={10}
          defaultValue={5}
          required
          style={styles.input}
        />
      </label>

      {state?.error ? <p style={styles.error}>{state.error}</p> : null}

      <button type="submit" disabled={pending} style={styles.button}>
        {pending ? "Saving..." : "Create operator"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#334155",
  },
  hint: { fontWeight: 400, color: "#64748b", fontSize: "0.8rem" },
  input: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
  },
  textarea: {
    padding: "0.6rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1rem",
    resize: "vertical",
    fontFamily: "inherit",
  },
  color: {
    width: "3rem",
    height: "2.4rem",
    padding: 0,
    border: "1px solid #cbd5e1",
    borderRadius: "0.5rem",
    background: "none",
    cursor: "pointer",
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
};
