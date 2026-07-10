"use client";

/*
  The operator level tip switch. Owner only: a policy decision about whether the
  gallery may show a "Tip your photographer" button at all. When it is on, each
  photographer still has to add their own payment link before anything shows;
  the two flags together gate the button. Crew see a read only explanation.
*/
import { useState, useTransition } from "react";
import { setTipsEnabled } from "./actions";

export function TipsToggle({ enabled, isOwner }: { enabled: boolean; isOwner: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <p className="fl-hint" style={{ margin: 0 }}>
        Tips are {enabled ? "on" : "off"} for your operation. Only the account
        owner can change this. When it is on, add your own payment link below and
        tips go straight to you.
      </p>
    );
  }

  function toggle() {
    const next = !on;
    setOn(next);
    setNote(null);
    start(async () => {
      const res = await setTipsEnabled(next);
      if (res && "error" in res && res.error) {
        setOn(!next);
        setNote(res.error);
      }
    });
  }

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        Show a &quot;Tip your photographer&quot; button on the gallery after a
        guest saves their photos. Each photographer adds their own payment link
        (below), and tips go directly to them. Flukesend never touches the money.
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: pending ? "default" : "pointer",
          font: "inherit",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "44px",
            height: "26px",
            borderRadius: "999px",
            background: on ? "var(--signal)" : "var(--line-strong)",
            position: "relative",
            transition: "background .2s",
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: on ? "21px" : "3px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left .2s",
            }}
          />
        </span>
        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text)" }}>
          {on ? "Tips are on" : "Tips are off"}
        </span>
      </button>
      {note ? <p style={{ color: "var(--bad)", fontSize: "13px", margin: "10px 0 0" }}>{note}</p> : null}
    </div>
  );
}
