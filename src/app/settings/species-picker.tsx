"use client";

/*
  Species picker, dark workspace styling. The operator selects the species they
  actually see from the West Coast catalog, grouped by kind, and can add their
  own for anything not listed. The chosen list is saved to branding and becomes
  the pills on the send form. No em dashes anywhere.
*/
import { useState, useTransition } from "react";
import { updateSpecies, type SettingsState } from "./actions";
import { SPECIES_CATALOG, ALL_CATALOG_SPECIES } from "@/lib/species";

export function SpeciesPicker({ selected }: { selected: string[] }) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [custom, setCustom] = useState("");
  const [state, setState] = useState<SettingsState>(undefined);
  const [pending, startTransition] = useTransition();

  const has = (name: string) =>
    chosen.some((c) => c.toLowerCase() === name.toLowerCase());

  function toggle(name: string) {
    setState(undefined);
    setChosen((prev) =>
      has(name)
        ? prev.filter((c) => c.toLowerCase() !== name.toLowerCase())
        : [...prev, name],
    );
  }

  function addCustom() {
    const name = custom.trim();
    if (!name || has(name)) {
      setCustom("");
      return;
    }
    setState(undefined);
    setChosen((prev) => [...prev, name]);
    setCustom("");
  }

  // Species the operator typed that are not in the catalog, shown so they can
  // be seen and removed even though no catalog chip represents them.
  const customChosen = chosen.filter(
    (c) => !ALL_CATALOG_SPECIES.some((s) => s.toLowerCase() === c.toLowerCase()),
  );

  function save() {
    setState(undefined);
    startTransition(async () => {
      const result = await updateSpecies(chosen);
      setState(result);
    });
  }

  return (
    <div className="fl-card">
      <h3 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600 }}>Species</h3>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Pick the species you see on your trips. These become the pills you tap on
        a send. Add your own for anything not listed.
      </p>

      {SPECIES_CATALOG.map((group) => (
        <div key={group.label} style={{ marginBottom: "14px" }}>
          <span className="fl-label-text">{group.label}</span>
          <div style={chipWrap}>
            {group.items.map((name) => (
              <button key={name} type="button" onClick={() => toggle(name)} style={chip(has(name))}>
                {name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {customChosen.length ? (
        <div style={{ marginBottom: "14px" }}>
          <span className="fl-label-text">Your own</span>
          <div style={chipWrap}>
            {customChosen.map((name) => (
              <button key={name} type="button" onClick={() => toggle(name)} style={chip(true)}>
                {name} <span style={{ opacity: 0.7 }}>{"×"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          className="fl-input"
          style={{ flex: 1, fontSize: "13px", padding: "9px 11px", borderRadius: "9px" }}
          placeholder="Add your own species"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" onClick={addCustom} className="fl-btn-ghost" style={{ flex: "0 0 auto" }}>
          Add
        </button>
      </div>

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "0 0 12px" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "0 0 12px" }}>{state.ok}</p>
      ) : null}

      <button type="button" onClick={save} disabled={pending} className="fl-btn">
        {pending ? "Saving..." : "Save species"}
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
