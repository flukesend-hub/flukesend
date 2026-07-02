"use client";

/*
  Trip times picker, dark workspace styling. The operator taps the departure
  times they actually run, grouped morning and afternoon. The chosen list
  drives the trip time dropdown on the send form and the guest QR form, so a
  guest can only pick a trip that really sails. Empty means every slot shows,
  the pre-configuration default. No em dashes anywhere.
*/
import { useState, useTransition } from "react";
import { updateTripTimes, type SettingsState } from "./actions";
import { TRIP_TIME_SLOTS, formatTripTime } from "@/lib/trip-times";

const MORNING = TRIP_TIME_SLOTS.filter((s) => Number(s.split(":")[0]) < 12);
const AFTERNOON = TRIP_TIME_SLOTS.filter((s) => Number(s.split(":")[0]) >= 12);

export function TripTimesPicker({ selected }: { selected: string[] }) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [state, setState] = useState<SettingsState>(undefined);
  const [pending, startTransition] = useTransition();

  function toggle(slot: string) {
    setState(undefined);
    setChosen((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  }

  function save() {
    setState(undefined);
    startTransition(async () => {
      setState(await updateTripTimes(chosen));
    });
  }

  const count = chosen.length;

  return (
    <div>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Tap the times your trips leave. These become the only choices on a send
        and on your guest sign-up QR, so nobody picks a trip you do not run.
        Leave it empty to show every slot.
      </p>

      {[
        { label: "Morning", slots: MORNING },
        { label: "Afternoon and evening", slots: AFTERNOON },
      ].map((group) => (
        <div key={group.label} style={{ marginBottom: "14px" }}>
          <span className="fl-label-text">{group.label}</span>
          <div style={chipWrap}>
            {group.slots.map((slot) => (
              <button key={slot} type="button" onClick={() => toggle(slot)} style={chip(chosen.includes(slot))}>
                {formatTripTime(slot)}
              </button>
            ))}
          </div>
        </div>
      ))}

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}

      <button type="button" onClick={save} disabled={pending} className="fl-btn">
        {pending ? "Saving..." : count ? `Save ${count} trip ${count === 1 ? "time" : "times"}` : "Save (show all times)"}
      </button>
    </div>
  );
}

const chipWrap: React.CSSProperties = {
  display: "flex",
  gap: "7px",
  flexWrap: "wrap",
  marginTop: "8px",
};
const chip = (on: boolean): React.CSSProperties => ({
  cursor: "pointer",
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 500,
  padding: "6px 11px",
  borderRadius: "999px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
  background: on ? "var(--signal)" : "transparent",
  color: on ? "var(--signal-ink)" : "var(--text)",
});
