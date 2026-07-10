"use client";

/*
  Correct a send's trip details after it has gone out. This is operator side
  only: it fixes the delivery record (what the operator sees and what the
  analytics count), so a misclicked species or the wrong crew can be put right
  without re-sending anything to guests. The controls mirror the send form's
  trip step, pre-filled from the delivery, so editing feels like the original
  entry. Saving credits crew the same way a new send does (one name per role,
  by their top role).
*/
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CREW_ROLES, topRole } from "@/lib/roles";
import { formatTripTime } from "@/lib/trip-times";
import { updateTripDetails } from "./actions";

type Boat = { id: string; name: string };
type Crew = { name: string; roles: string[] };

export function EditTripDetails({
  deliveryId,
  tripDatetime,
  species: initSpecies,
  speciesCounts: initCounts,
  boatName,
  captainName,
  naturalistName,
  photographerName,
  crewNames,
  boats,
  crew,
  speciesOptions,
  tripTimes,
}: {
  deliveryId: string;
  tripDatetime: string | null;
  species: string[];
  speciesCounts: Record<string, number>;
  boatName: string | null;
  captainName: string | null;
  naturalistName: string | null;
  photographerName: string | null;
  crewNames: string[];
  boats: Boat[];
  crew: Crew[];
  speciesOptions: string[];
  tripTimes: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Split the stored trip datetime into a date and a slot time, read in UTC to
  // match how the rest of the app treats trip_datetime (the story card and day
  // grouping are all UTC), so the value round-trips unchanged.
  const initDate = useMemo(() => {
    if (!tripDatetime) return "";
    const d = new Date(tripDatetime);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }, [tripDatetime]);
  const initTime = useMemo(() => {
    if (!tripDatetime) return "";
    const d = new Date(tripDatetime);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }, [tripDatetime]);

  // Which roster people were aboard: anyone whose name is credited on the
  // delivery in any role. Names no longer on the roster are dropped on save.
  const initAboard = useMemo(() => {
    const credited = new Set(
      [captainName, naturalistName, photographerName, ...(crewNames ?? [])]
        .filter(Boolean)
        .map((n) => (n as string).trim()),
    );
    return crew.filter((c) => credited.has(c.name.trim())).map((c) => c.name);
  }, [captainName, naturalistName, photographerName, crewNames, crew]);

  const [tripDate, setTripDate] = useState(initDate);
  const [tripTime, setTripTime] = useState(initTime);
  const [boat, setBoat] = useState<string>(
    boats.find((b) => b.name === boatName)?.id ?? (boats.length === 1 ? boats[0].id : ""),
  );
  const [species, setSpecies] = useState<string[]>(initSpecies);
  const [counts, setCounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initCounts ?? {})) out[k] = String(v);
    return out;
  });
  const [aboard, setAboard] = useState<string[]>(initAboard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTripDate(initDate);
    setTripTime(initTime);
    setBoat(boats.find((b) => b.name === boatName)?.id ?? (boats.length === 1 ? boats[0].id : ""));
    setSpecies(initSpecies);
    const c: Record<string, string> = {};
    for (const [k, v] of Object.entries(initCounts ?? {})) c[k] = String(v);
    setCounts(c);
    setAboard(initAboard);
    setError(null);
  }

  function toggleSpecies(name: string) {
    setSpecies((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
    setCounts((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }
  function toggleAboard(name: string) {
    setAboard((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    // Credit each aboard person once, by their top role, exactly like a send.
    const credited = crew
      .filter((c) => aboard.includes(c.name))
      .map((c) => ({ name: c.name, role: topRole(c.roles) }));
    const nameForRole = (role: string) => credited.find((c) => c.role === role)?.name ?? null;
    const cleanCounts: Record<string, number> = {};
    for (const name of species) {
      const n = Math.floor(Number(counts[name] ?? ""));
      if (Number.isFinite(n) && n > 0) cleanCounts[name] = n;
    }
    const res = await updateTripDetails(deliveryId, {
      tripDatetime: tripDate ? (tripTime ? `${tripDate}T${tripTime}` : `${tripDate}T00:00`) : null,
      species,
      speciesCounts: cleanCounts,
      boatName: boats.find((b) => b.id === boat)?.name ?? null,
      captainName: nameForRole("captain"),
      naturalistName: nameForRole("naturalist"),
      photographerName: nameForRole("photographer"),
      crewNames: credited.filter((c) => c.role === "crew").map((c) => c.name),
    });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fl-link" style={{ fontSize: "12.5px", fontWeight: 600 }}>
        Edit
      </button>
    );
  }

  return (
    <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <p className="fl-hint" style={{ margin: 0 }}>
        Fixes the trip details on your side and in analytics. Guests are not
        emailed again.
      </p>

      <label style={{ display: "block" }}>
        <span className="fl-label-text">Trip date</span>
        <input type="date" className="fl-input" style={{ maxWidth: "220px" }} value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
      </label>

      {boats.length > 1 ? (
        <div>
          <span className="fl-label-text">Boat</span>
          <div style={{ display: "inline-flex", flexWrap: "wrap", border: "1px solid var(--line-strong)", borderRadius: "12px", overflow: "hidden" }}>
            {boats.map((b) => {
              const on = boat === b.id;
              return (
                <button key={b.id} type="button" onClick={() => setBoat(on ? "" : b.id)} style={{ font: "inherit", fontSize: "13.5px", padding: "10px 18px", border: 0, cursor: "pointer", background: on ? "var(--signal)" : "#fff", color: on ? "#fff" : "var(--muted)", fontWeight: on ? 600 : 500 }}>
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <span className="fl-label-text">Trip time</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {tripTimes.map((slot) => {
            const on = tripTime === slot;
            return (
              <button key={slot} type="button" onClick={() => setTripTime(on ? "" : slot)} style={pill(on)}>
                {formatTripTime(slot)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="fl-label-text">Species seen</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {speciesOptions.map((name) => (
            <button key={name} type="button" onClick={() => toggleSpecies(name)} style={pill(species.includes(name))}>
              {name}
            </button>
          ))}
        </div>
        {species.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {species.map((name) => (
              <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid var(--line)", background: "var(--ink-2)", borderRadius: "10px", padding: "5px 6px 5px 11px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{name}</span>
                <input type="number" inputMode="numeric" min={0} placeholder="how many" value={counts[name] ?? ""} onChange={(e) => setCounts((prev) => ({ ...prev, [name]: e.target.value }))} style={countInput} />
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {crew.length ? (
        <div>
          <span className="fl-label-text">Crew mentions</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {crew.map((c) => {
              const on = aboard.includes(c.name);
              const credited = topRole(c.roles);
              const label = CREW_ROLES.find((r) => r.key === credited)?.label ?? "No role set";
              return (
                <label key={c.name} style={crewRow(on)}>
                  <input type="checkbox" checked={on} onChange={() => toggleAboard(c.name)} style={{ width: "16px", height: "16px", accentColor: "var(--signal)", flex: "0 0 auto" }} />
                  <span style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--muted)", flex: "0 0 auto" }}>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p style={{ color: "var(--bad)", fontSize: "13px", margin: 0 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button type="button" onClick={save} disabled={busy} className="fl-btn" style={{ padding: "10px 18px", fontSize: "13.5px" }}>
          {busy ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="fl-btn-ghost"
          style={{ padding: "10px 16px", fontSize: "13.5px" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const pill = (on: boolean): React.CSSProperties => ({
  font: "inherit",
  fontSize: "12.5px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
  background: on ? "var(--signal)" : "#fff",
  color: on ? "var(--signal-ink)" : "var(--muted)",
  borderRadius: "999px",
  padding: "6px 12px",
  cursor: "pointer",
  fontWeight: on ? 600 : 500,
});
const countInput: React.CSSProperties = {
  font: "inherit",
  fontSize: "12.5px",
  width: "74px",
  flex: "0 0 auto",
  background: "var(--ink)",
  color: "inherit",
  border: "1px solid var(--line-strong)",
  borderRadius: "8px",
  padding: "5px 8px",
};
const crewRow = (on: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "9px 11px",
  borderRadius: "10px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line)"}`,
  background: on ? "rgba(31,111,156,.10)" : "var(--ink)",
  cursor: "pointer",
  minWidth: 0,
});
