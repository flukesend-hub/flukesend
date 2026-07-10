"use client";

/*
  The operator level tip switch, owner only: a policy decision about whether the
  gallery may show a "Tip your photographer" button. When it is on, each
  photographer still has to add their own payment link before anything shows.

  A second switch, visible only while tips are on, lets the operator also ask for
  a review under the tip (a quiet secondary link, not a competing button). Off by
  default: the tip is the single primary ask. Crew see a read only explanation.
*/
import { useState, useTransition } from "react";
import { setTipsEnabled, setTipsShowReview } from "./actions";

export function TipsToggle({
  enabled,
  showReview,
  isOwner,
}: {
  enabled: boolean;
  showReview: boolean;
  isOwner: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [withReview, setWithReview] = useState(showReview);

  if (!isOwner) {
    return (
      <p className="fl-hint" style={{ margin: 0 }}>
        Tips are {enabled ? "on" : "off"} for your operation. Only the account
        owner can change this. When it is on, add your own payment link below and
        tips go straight to you.
      </p>
    );
  }

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        Show a &quot;Tip your photographer&quot; button on the gallery after a
        guest saves their photos. Each photographer adds their own payment link
        (below), and tips go directly to them. Flukesend never touches the money.
      </p>

      <Switch
        label={(v) => (v ? "Tips are on" : "Tips are off")}
        value={on}
        onChange={async (next) => {
          setOn(next);
          const res = await setTipsEnabled(next);
          if (res && "error" in res && res.error) {
            setOn(!next);
            return res.error;
          }
          return null;
        }}
      />

      {on ? (
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
          <p className="fl-hint" style={{ margin: "0 0 10px" }}>
            Also ask for a review, shown as a small link under the tip. Off keeps
            the tip as the only ask.
          </p>
          <Switch
            label={(v) => (v ? "Review shown under the tip" : "Tip only")}
            value={withReview}
            onChange={async (next) => {
              setWithReview(next);
              const res = await setTipsShowReview(next);
              if (res && "error" in res && res.error) {
                setWithReview(!next);
                return res.error;
              }
              return null;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

// A labelled switch. onChange returns an error string to roll back, or null.
function Switch({
  label,
  value,
  onChange,
}: {
  label: (v: boolean) => string;
  value: boolean;
  onChange: (next: boolean) => Promise<string | null>;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={pending}
        onClick={() => {
          setNote(null);
          start(async () => {
            const err = await onChange(!value);
            if (err) setNote(err);
          });
        }}
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
            background: value ? "var(--signal)" : "var(--line-strong)",
            position: "relative",
            transition: "background .2s",
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: value ? "21px" : "3px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left .2s",
            }}
          />
        </span>
        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text)" }}>{label(value)}</span>
      </button>
      {note ? <p style={{ color: "var(--bad)", fontSize: "13px", margin: "10px 0 0" }}>{note}</p> : null}
    </div>
  );
}
