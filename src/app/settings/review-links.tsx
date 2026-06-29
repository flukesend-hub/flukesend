"use client";

/*
  Review links manager. These become the buttons in the review email, so an
  operator can have one or several. The list is server data passed in; adding
  uses an action with inline validation, removing posts a small delete form per
  row.
*/
import { useActionState } from "react";
import {
  addReviewLink,
  deleteReviewLink,
  type SettingsState,
} from "./actions";

type Link = { id: string; label: string; url: string };

export function ReviewLinks({ links }: { links: Link[] }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    addReviewLink,
    undefined,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {links.length ? (
        <ul style={styles.list}>
          {links.map((link) => (
            <li key={link.id} style={styles.row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {link.label}
                </div>
                <div style={styles.url}>{link.url}</div>
              </div>
              <form action={deleteReviewLink}>
                <input type="hidden" name="id" value={link.id} />
                <button type="submit" style={styles.remove} aria-label="Remove link">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
          No review links yet. Add the places you want guests to leave a review.
        </p>
      )}

      <form action={formAction} style={styles.addForm}>
        <input
          name="label"
          placeholder="Leave us a Google review"
          style={{ ...styles.input, flex: "1 1 12rem" }}
        />
        <input
          name="url"
          placeholder="https://g.page/..."
          style={{ ...styles.input, flex: "2 1 14rem" }}
        />
        <button type="submit" disabled={pending} style={styles.addButton}>
          {pending ? "Adding..." : "Add link"}
        </button>
      </form>

      {state?.error ? <p style={styles.error}>{state.error}</p> : null}
      {state?.ok ? <p style={styles.ok}>{state.ok}</p> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    padding: "0.6rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    background: "white",
  },
  url: {
    color: "#64748b",
    fontSize: "0.8rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  addForm: { display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  input: {
    padding: "0.55rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "0.95rem",
  },
  addButton: {
    padding: "0.55rem 0.9rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#0b5563",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  remove: {
    padding: "0.35rem 0.6rem",
    borderRadius: "0.4rem",
    border: "1px solid #fecaca",
    background: "white",
    color: "#b91c1c",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  error: { color: "#b91c1c", fontSize: "0.85rem", margin: 0 },
  ok: { color: "#15803d", fontSize: "0.85rem", margin: 0 },
};
