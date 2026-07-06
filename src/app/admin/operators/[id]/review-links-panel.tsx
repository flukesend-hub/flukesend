"use client";

/*
  Support editor for an operator's review links. This is the switch that turns
  their review engine on: with zero links, photos still go out but no review
  ask can ever fire, so the admin triage card points here. Add takes a label
  and URL; the first link's button renders solid in the review email.
*/
import { useRef, useState, useTransition } from "react";
import { adminAddReviewLink, adminDeleteReviewLink, type AdminState } from "../../actions";

export type ReviewLink = { id: string; label: string; url: string };

export function ReviewLinksPanel({
  operatorId,
  links,
}: {
  operatorId: string;
  links: ReviewLink[];
}) {
  const [state, setState] = useState<AdminState>(undefined);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function add(formData: FormData) {
    setState(undefined);
    setBusy(true);
    start(async () => {
      const r = await adminAddReviewLink(operatorId, formData);
      setState(r);
      setBusy(false);
      if (r?.ok) formRef.current?.reset();
    });
  }

  function remove(id: string) {
    setState(undefined);
    start(async () => {
      setState(await adminDeleteReviewLink(operatorId, id));
    });
  }

  return (
    <section id="review-links" className="fl-card" style={{ marginTop: "18px" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600 }}>Review links</h3>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        The buttons in their review ask email. No links means the review engine
        is off: guests get photos but are never asked. The first link renders as
        the solid button.
      </p>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 10px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 10px" }}>{state.ok}</p>
      ) : null}

      {links.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          {links.map((l) => (
            <div key={l.id} style={linkRow}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "13.5px" }}>{l.label}</div>
                <div style={{ fontSize: "12px", color: "var(--muted-2)", overflowWrap: "anywhere" }}>{l.url}</div>
              </div>
              <button type="button" onClick={() => remove(l.id)} className="fl-btn-ghost" style={{ fontSize: "12.5px", flex: "0 0 auto" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: "13px", color: "var(--bad)", margin: "0 0 14px", fontWeight: 600 }}>
          No review links yet. The review engine is off for this operator.
        </p>
      )}

      <form ref={formRef} action={add} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input
          name="label"
          placeholder="Label, e.g. Leave us a Google Review"
          className="fl-input"
          style={{ flex: "1 1 220px", fontSize: "13px" }}
          required
        />
        <input
          name="url"
          placeholder="https://g.page/r/..."
          className="fl-input"
          style={{ flex: "1 1 220px", fontSize: "13px" }}
          required
        />
        <button type="submit" className="fl-btn" disabled={busy} style={{ flex: "0 0 auto" }}>
          {busy ? "Adding..." : "Add link"}
        </button>
      </form>
    </section>
  );
}

const linkRow: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  border: "1px solid var(--line)",
  borderRadius: "11px",
  padding: "10px 13px",
};
