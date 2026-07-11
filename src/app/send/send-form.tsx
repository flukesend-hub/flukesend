"use client";

/*
  The send form as a four step cascade (design handoff "Send Page v2"): Trip
  details, Photos, Guests, then a read only Review before the send goes out.
  All four steps are stacked cards; one is expanded at a time, the others
  collapse to a header row with a live summary. Each step gates the next, so
  the operator does one thing at a time and nothing ships half filled.

  Only the presentation changed. The upload path (signed URLs straight to
  storage), createSend, the QR captured guest loading, email parsing and
  dedupe, crew crediting, and the circular water fill progress are all the
  same logic as before.
*/
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { CREW_ROLES, topRole } from "@/lib/roles";
import { formatTripTime } from "@/lib/trip-times";
import { signUploads, createSend, getCapturedForTrip, type CapturedGuest } from "./actions";

type Boat = { id: string; name: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const tokenRaw of raw.split(/[\s,;]+/)) {
    const token = tokenRaw.trim().toLowerCase();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    if (EMAIL_RE.test(token)) valid.push(token);
    else invalid.push(token);
  }
  return { valid, invalid };
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "2026-07-09" as "Jul 9" for the collapsed card summary and the review row.
function fmtDay(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Status = "idle" | "uploading" | "saving";

const EASE = "cubic-bezier(.32,.72,0,1)";
const STEP_TITLES = ["Trip details", "Photos", "Guests", "Review & send"];

export function SendForm({
  defaultMessage,
  brandColor,
  speciesOptions,
  tripTimes,
  boats,
  capturedByBoat,
  crew,
}: {
  defaultMessage: string;
  brandColor: string;
  speciesOptions: string[];
  tripTimes: string[];
  boats: Boat[];
  capturedByBoat: Record<string, number>;
  crew: { name: string; roles: string[] }[];
}) {
  const router = useRouter();
  // Which card is expanded (0 to 3). Everything else about the send lives in
  // the same state the previous single screen form managed.
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [species, setSpecies] = useState<string[]>([]);
  // Optional head count per selected species, kept as raw input strings (blank
  // is fine). Turned into a name to number map at submit time.
  const [speciesCounts, setSpeciesCounts] = useState<Record<string, string>>({});
  // Trip date and time are split so the time lines up with the 30 minute slots a
  // guest picks when self capturing. Together they become the delivery datetime.
  const [tripDate, setTripDate] = useState("");
  const [tripTime, setTripTime] = useState("");
  // Boat holds the selected boat id (empty means no boat). With a single boat
  // there is nothing to choose, so it is preselected and captured guests load
  // as soon as a trip time is picked. The name is denormalized at submit time.
  const [boat, setBoat] = useState(boats.length === 1 ? boats[0].id : "");
  // Guests self captured for the selected boat and trip, auto loaded and shown
  // as chips. They ride along as recipients and are consumed when the send goes.
  const [capturedGuests, setCapturedGuests] = useState<CapturedGuest[]>([]);
  const [loadingCaptured, setLoadingCaptured] = useState(false);
  // Who was aboard, by name. Each person's roles (set in Settings) decide how
  // they get credited on the delivery, so the send just asks who came along.
  const [aboard, setAboard] = useState<string[]>([]);
  // Personal note for this send (overrides the default message). Controlled
  // state now, since the field lives on step 3 and submit happens on step 4.
  const [customMessage, setCustomMessage] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  // Index of the file row being dragged, for reordering. Null when not dragging.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // True while a file is being dragged over the dropzone from the desktop, for
  // the highlight. Separate from dragIdx, which is the internal reorder drag.
  const [dropActive, setDropActive] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [uploaded, setUploaded] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  const parsed = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);
  const busy = status !== "idle";

  // The full recipient list: captured guests first, then any pasted emails, one
  // per address after dedupe. This is what the send actually goes to.
  const allValid = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of [...capturedGuests.map((g) => g.email), ...parsed.valid]) {
      const k = e.trim().toLowerCase();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    return out;
  }, [capturedGuests, parsed.valid]);

  // Object URL thumbnails for the first four files, revoked when files change.
  // The review step reuses the same strip.
  const thumbUrls = useMemo(
    () => files.slice(0, 4).map((f) => URL.createObjectURL(f)),
    [files],
  );
  useEffect(() => () => thumbUrls.forEach((u) => URL.revokeObjectURL(u)), [thumbUrls]);

  // Default the trip date to the operator's local "today". Set after mount so
  // the server render (which has no local clock) and the client agree.
  useEffect(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setTripDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }, []);

  // A photo dropped anywhere outside the dropzone would otherwise make the
  // browser navigate to that file and wipe the in-progress send. Swallow those
  // stray file drops at the window; the dropzone's own handlers still run and
  // add the photos. Internal row reorder drags carry no files, so they pass
  // through untouched.
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  // Auto load the guests captured for the chosen boat, day, and trip time. Runs
  // whenever the selection changes. Read only, so switching trips never strands
  // anyone; the rows are consumed only when the send lands.
  useEffect(() => {
    if (!boat || !tripDate || !tripTime) {
      setCapturedGuests([]);
      return;
    }
    let cancelled = false;
    setLoadingCaptured(true);
    getCapturedForTrip(boat, tripDate, tripTime)
      .then((guests) => {
        if (!cancelled) setCapturedGuests(guests);
      })
      .catch(() => {
        if (!cancelled) setCapturedGuests([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCaptured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boat, tripDate, tripTime]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setFiles((prev) => {
      const key = (f: File) => `${f.name}:${f.size}`;
      const have = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !have.has(key(f)))];
    });
  }

  // Photos dropped onto the dropzone. Filter to images (a desktop drop skips
  // the file input's accept list); an empty type is kept, since HEIC from an
  // iPhone often reports none. The server validates the rest.
  function dropFiles(dt: DataTransfer) {
    const imgs = Array.from(dt.files).filter(
      (f) => f.type === "" || f.type.startsWith("image/"),
    );
    if (imgs.length) addFiles(imgs);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // Reorder by dragging rows. Order is what the guest sees: the photos land in
  // this order and the top one is the cover on the gallery and confirmation.
  function moveFile(from: number, to: number) {
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function toggleSpecies(name: string) {
    setSpecies((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
    // Drop a species' count when it is unselected, so a hidden number never
    // rides along on a later reselect.
    setSpeciesCounts((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function toggleAboard(name: string) {
    setAboard((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  }

  // Drop a captured guest from this send. It stays un-consumed, so it will load
  // again next time the operator picks this trip.
  function removeCaptured(id: string) {
    setCapturedGuests((prev) => prev.filter((g) => g.id !== id));
  }

  // Step completeness. Step 1 needs the trip pinned down (a boat too, when the
  // operator has boats to choose from); 2 needs photos; 3 needs a guest.
  function stepDone(i: number): boolean {
    if (i === 0) return Boolean(tripDate && tripTime && (boats.length === 0 || boat));
    if (i === 1) return files.length > 0;
    if (i === 2) return allValid.length > 0;
    return false;
  }
  // A step is unlocked when everything before it is done.
  function unlocked(i: number): boolean {
    for (let j = 0; j < i; j++) if (!stepDone(j)) return false;
    return true;
  }
  function goTo(i: number) {
    if (stepDone(i) || unlocked(i)) setStep(i);
  }

  const boatName = boats.find((b) => b.id === boat)?.name ?? null;
  const speciesSummary = species
    .map((n) => (speciesCounts[n] && parseInt(speciesCounts[n], 10) > 0 ? `${parseInt(speciesCounts[n], 10)} ${n}` : n))
    .join(", ");
  const tripSummary = [
    tripDate ? fmtDay(tripDate) : null,
    tripTime ? formatTripTime(tripTime) : null,
    boatName,
  ]
    .filter(Boolean)
    .join(" · ");
  const ready = files.length > 0 && allValid.length > 0;
  const sums = [
    tripSummary || "Date, boat, time",
    files.length ? `${files.length} ${files.length === 1 ? "photo" : "photos"}` : "Nothing added yet",
    allValid.length ? `${allValid.length} ${allValid.length === 1 ? "guest" : "guests"} ready` : "No guests yet",
    ready ? "Ready to go" : "Waiting on the steps above",
  ];
  const sumSet = [Boolean(tripSummary), files.length > 0, allValid.length > 0, ready];
  const completed = [0, 1, 2].filter((i) => stepDone(i)).length;

  const missing: string[] = [];
  if (boats.length > 0 && !boat) missing.push("pick a boat");
  if (!tripTime) missing.push("pick a departure");
  if (!files.length) missing.push("add photos");
  if (!allValid.length) missing.push("add at least one guest");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUpgrade(false);

    // Combine the split date and time into the delivery datetime. Time alone is
    // never sent without a date; a date without a time defaults to midnight.
    const tripDatetime = tripDate
      ? tripTime
        ? `${tripDate}T${tripTime}`
        : `${tripDate}T00:00`
      : null;
    // Credit each aboard person exactly once, by their highest ranked role
    // (captain > naturalist > photographer > crew), so nobody is named twice.
    const credited = crew
      .filter((c) => aboard.includes(c.name))
      .map((c) => ({ name: c.name, role: topRole(c.roles) }));
    const nameForRole = (role: string) =>
      credited.find((c) => c.role === role)?.name ?? null;
    const captainName = nameForRole("captain");
    const naturalistName = nameForRole("naturalist");
    const photographerName = nameForRole("photographer");
    const crewNames = credited.filter((c) => c.role === "crew").map((c) => c.name);

    if (!files.length) {
      setError("Add at least one photo.");
      return;
    }
    if (!allValid.length) {
      setError("Add at least one valid guest email.");
      return;
    }

    try {
      setStatus("uploading");
      setUploaded(0);
      setProgress(0);

      const signRes = await signUploads(
        files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      );
      if ("error" in signRes) {
        setError(signRes.error);
        setStatus("idle");
        return;
      }

      const supabase = createClient();
      const photos: { storageKey: string; filename: string; size: number }[] = [];
      for (let i = 0; i < signRes.uploads.length; i++) {
        const u = signRes.uploads[i];
        const file = files[i];
        const { error: upErr } = await supabase.storage
          .from("photos")
          .uploadToSignedUrl(u.path, u.token, file, { contentType: file.type });
        if (upErr) {
          setError(`Upload failed for "${file.name}". Try again.`);
          setStatus("idle");
          return;
        }
        photos.push({ storageKey: u.path, filename: file.name, size: file.size });
        setUploaded(i + 1);
        setProgress(Math.round(((i + 1) / signRes.uploads.length) * 100));
      }

      setStatus("saving");
      setProgress(100);
      const res = await createSend({
        tripDatetime,
        species,
        speciesCounts: Object.fromEntries(
          species
            .map((name) => [name, parseInt(speciesCounts[name] ?? "", 10)] as const)
            .filter(([, n]) => Number.isFinite(n) && n > 0),
        ),
        captainName,
        naturalistName,
        photographerName,
        crewNames,
        boatName,
        customMessage: customMessage.trim() || null,
        photos,
        emails: allValid,
        capturedIds: capturedGuests.map((g) => g.id),
      });
      if ("error" in res) {
        setError(res.error);
        setUpgrade(res.upgrade ?? false);
        setStatus("idle");
        return;
      }

      const failedQ = res.failed.length
        ? `&failed=${encodeURIComponent(res.failed.join(","))}`
        : "";
      router.push(`/deliveries/${res.deliveryId}?emailed=${res.emailed}${failedQ}`);
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("idle");
    }
  }

  if (busy) {
    return (
      <div style={{ maxWidth: "520px", margin: "34px auto 0", textAlign: "center" }}>
        <div style={waterRing}>
          {/* Two rotating rounded squares. Their top edge is the waterline;
              the rounded corners sweeping past it make the rolling wave. They
              rise as progress climbs, and their corners round to a flat 50%
              circle (calming the water) the instant we hit 100% / saving. */}
          <div
            className="fl-water-back"
            style={{
              position: "absolute",
              left: "50%",
              top: `calc(${100 - progress}% - 14px)`,
              width: "440px",
              height: "440px",
              marginLeft: "-220px",
              borderRadius: progress >= 100 ? "50%" : "38%",
              background: "#5aa7cf",
              transition: "border-radius 1.2s ease, top .25s linear",
            }}
          />
          <div
            className="fl-water-front"
            style={{
              position: "absolute",
              left: "50%",
              top: `calc(${100 - progress}% - 8px)`,
              width: "440px",
              height: "440px",
              marginLeft: "-220px",
              borderRadius: progress >= 100 ? "50%" : "41%",
              background: "#1e6f9c",
              transition: "border-radius 1.2s ease, top .25s linear",
            }}
          />
          {progress >= 100 ? (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="fl-fluke" src="/brand/fluke-white.png" alt="" width={96} style={{ height: "auto", display: "block" }} />
            </div>
          ) : (
            <>
              {/* The number twice: navy above the waterline, white below it via
                  a clip that tracks the fill, so it stays legible at any level. */}
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <span className="fl-display" style={{ fontSize: "40px", color: "var(--text)" }}>
                  {progress}%
                </span>
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  clipPath: `inset(calc(${100 - progress}% - 4px) 0 0 0)`,
                  transition: "clip-path .25s linear",
                }}
              >
                <span className="fl-display" style={{ fontSize: "40px", color: "#fff" }}>
                  {progress}%
                </span>
              </div>
            </>
          )}
        </div>
        <div className="fl-display" style={{ fontSize: "20px", margin: "20px 0 4px" }}>
          {status === "saving" ? "Creating the send" : "Uploading photos"}
        </div>
        <p style={{ color: "var(--muted)", fontSize: "13.5px", margin: 0 }}>
          {status === "saving"
            ? "Writing a gallery and token for every guest"
            : `Uploading ${uploaded} of ${files.length} straight to storage`}
        </p>
      </div>
    );
  }

  // Props for a card at position i, handed to the top level StepCard. Defining
  // these as data (not components created inside the render) keeps the card
  // subtree stable across renders, so typing never loses focus.
  const cardProps = (i: number) => ({
    index: i,
    active: step === i,
    done: stepDone(i),
    open: unlocked(i),
    summary: sums[i],
    summarySet: sumSet[i],
    onOpen: () => goTo(i),
  });
  const continueBtn = (i: number, label = "Continue") => {
    const ok = stepDone(i);
    return (
      <button
        type="button"
        disabled={!ok}
        onClick={() => {
          if (stepDone(i)) setStep(i + 1);
        }}
        style={{ ...primaryBtn, opacity: ok ? 1 : 0.4, marginLeft: "auto" }}
      >
        {label}
      </button>
    );
  };
  const backBtn = (to: number) => (
    <button type="button" onClick={() => setStep(to)} style={ghostBtn}>
      Back
    </button>
  );

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "640px", marginTop: "22px" }}>
      {/* Progress: only the three input steps count; Review is the destination. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)" }}>
          Step {step + 1} of 4
        </span>
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)" }}>
          {completed} of 3 steps complete
        </span>
      </div>
      <div style={{ height: "4px", background: "var(--panel-2)", borderRadius: "999px", margin: "8px 0 12px" }}>
        <div
          style={{
            height: "100%",
            borderRadius: "999px",
            background: "var(--signal)",
            width: `${Math.max(6, Math.round((completed / 3) * 100))}%`,
            transition: `width .5s ${EASE}`,
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Step 1: Trip details */}
        <StepCard {...cardProps(0)}>
          <div style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "block" }}>
              <span className="fl-label-text">Trip date</span>
              <input
                type="date"
                className="fl-input"
                style={{ maxWidth: "220px" }}
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
              />
            </label>

            {boats.length > 1 ? (
              <div>
                <span className="fl-label-text">Boat · required</span>
                <div style={{ display: "inline-flex", border: "1px solid var(--line-strong)", borderRadius: "12px", overflow: "hidden" }}>
                  {boats.map((b) => {
                    const on = boat === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBoat(b.id)}
                        style={{
                          font: "inherit",
                          fontSize: "13.5px",
                          padding: "10px 18px",
                          border: 0,
                          cursor: "pointer",
                          background: on ? "var(--signal)" : "#fff",
                          color: on ? "#fff" : "var(--muted)",
                          fontWeight: on ? 600 : 500,
                        }}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <span className="fl-label-text">Departure</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {tripTimes.map((slot) => {
                  const on = tripTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTripTime(on ? "" : slot)}
                      style={{
                        font: "inherit",
                        fontSize: "13px",
                        padding: "9px 15px",
                        borderRadius: "999px",
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
                        background: on ? "var(--signal)" : "#fff",
                        color: on ? "#fff" : "var(--muted)",
                        fontWeight: on ? 600 : 500,
                      }}
                    >
                      {formatTripTime(slot)}
                    </button>
                  );
                })}
              </div>
              <span style={{ display: "block", marginTop: "8px", fontSize: "12.5px", color: "var(--muted)" }}>
                {boat && tripTime && capturedGuests.length
                  ? `${capturedGuests.length} QR ${capturedGuests.length === 1 ? "sign-up" : "sign-ups"} found for this trip. ${capturedGuests.length === 1 ? "They will" : "They'll"} be waiting on the Guests step.`
                  : boats.length > 1
                    ? "Pick the boat and departure to load guests who signed up by QR."
                    : "Pick the departure to load guests who signed up by QR."}
              </span>
            </div>

            <div>
              <span className="fl-label-text">Species seen</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {speciesOptions.map((name) => {
                  const on = species.includes(name);
                  return (
                    <button key={name} type="button" onClick={() => toggleSpecies(name)} style={speciesPill(on)}>
                      {name}
                    </button>
                  );
                })}
              </div>
              {/* How many, per selected species. Optional: leave blank when you
                  did not count. The number input sits snug beside the name. */}
              {species.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                  {species.map((name) => (
                    <span
                      key={name}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px solid var(--line)",
                        background: "var(--ink-2)",
                        borderRadius: "10px",
                        padding: "5px 6px 5px 11px",
                      }}
                    >
                      <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{name}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="how many"
                        value={speciesCounts[name] ?? ""}
                        onChange={(e) => setSpeciesCounts((prev) => ({ ...prev, [name]: e.target.value }))}
                        style={countInput}
                      />
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="fl-hint" style={{ margin: "8px 0 0" }}>
                Edit this list in <a href="/settings" style={{ color: "var(--signal-2)", fontWeight: 600 }}>Settings</a>.
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <span className="fl-label-text">Crew mentions (recommended)</span>
              {crew.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {crew.map((c) => {
                    const on = aboard.includes(c.name);
                    const credited = topRole(c.roles);
                    const creditedLabel =
                      CREW_ROLES.find((r) => r.key === credited)?.label ?? "No role set";
                    return (
                      <label key={c.name} style={crewRow(on)}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleAboard(c.name)}
                          style={{ width: "16px", height: "16px", accentColor: "var(--signal)", flex: "0 0 auto" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--muted)", flex: "0 0 auto" }}>
                          {creditedLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="fl-hint" style={{ margin: "4px 0 0" }}>
                  Add your team in{" "}
                  <a href="/settings" style={{ color: "var(--signal-2)", fontWeight: 600 }}>Settings</a>{" "}
                  and tag each person&apos;s role to credit them here.
                </p>
              )}
            </div>

            <div style={{ display: "flex" }}>
              {continueBtn(0)}
            </div>
          </div>
        </StepCard>

        {/* Step 2: Photos */}
        <StepCard {...cardProps(1)}>
          <label
            style={{ display: "block" }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              // Ignore leaving into a child element; only clear when the
              // pointer actually exits the dropzone.
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setDropActive(false);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setDropActive(false);
              dropFiles(e.dataTransfer);
            }}
          >
            <div
              style={{
                ...dropzone,
                background: dropActive ? `${brandColor}2b` : `${brandColor}16`,
                borderColor: dropActive ? "var(--signal)" : "var(--line-strong)",
                color: dropActive ? "var(--signal-2)" : "var(--muted)",
              }}
            >
              {dropActive ? "Drop to add these photos" : "Drop photos here, or browse"}
            </div>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          {files.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginTop: "14px" }}>
              {thumbUrls.map((url, i) => (
                <div key={i} style={{ ...thumb, backgroundImage: `url(${url})` }}>
                  {i === 0 ? <div style={thumbCover}>Cover</div> : null}
                  {i === 3 && files.length > 4 ? (
                    <div style={thumbMore}>+{files.length - 4}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {files.length > 1 ? (
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: "var(--muted-2)" }}>
              Drag to reorder. The top photo is the cover guests see first.
            </p>
          ) : null}
          {files.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
              {files.map((f, i) => (
                <div
                  key={`${f.name}:${f.size}`}
                  style={{ ...fileRow, opacity: dragIdx === i ? 0.45 : 1, cursor: "grab" }}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(i);
                    e.dataTransfer.effectAllowed = "move";
                    // Firefox will not start a drag without data attached.
                    e.dataTransfer.setData("text/plain", "");
                  }}
                  onDragEnter={() => {
                    if (dragIdx !== null && dragIdx !== i) {
                      moveFile(dragIdx, i);
                      setDragIdx(i);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <Grip />
                  <span style={fileName}>{f.name}</span>
                  {i === 0 ? <span style={coverChip}>Cover</span> : null}
                  <span style={{ color: "var(--muted-2)" }}>{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(i)} style={fileRemove} aria-label="Remove">
                    {"×"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: "18px" }}>
            {backBtn(0)}
            {continueBtn(1)}
          </div>
        </StepCard>

        {/* Step 3: Guests */}
        <StepCard {...cardProps(2)}>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted)" }}>
            {capturedGuests.length
              ? "QR sign-ups for this trip loaded below. Add more emails in the box, any format."
              : "Paste straight from the naturalist's notes. Line breaks, spaces, semicolons, it all works."}
          </p>

          {boat && !tripTime && (capturedByBoat[boat] ?? 0) > 0 ? (
            <div style={captureBox}>
              <span style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.45 }}>
                <b>{capturedByBoat[boat]}</b>{" "}
                {capturedByBoat[boat] === 1 ? "guest has" : "guests have"} signed up by QR for{" "}
                {boatName ?? "this boat"}.{" "}
                <button type="button" onClick={() => setStep(0)} style={inlineLink}>
                  Pick the departure
                </button>{" "}
                to load them.
              </span>
            </div>
          ) : null}

          {loadingCaptured ? (
            <p style={{ color: "var(--muted)", fontSize: "12.5px", margin: "0 0 12px" }}>
              Loading captured guests...
            </p>
          ) : capturedGuests.length ? (
            <div style={{ marginBottom: "12px" }}>
              <div className="fl-label-text" style={{ marginBottom: "6px" }}>
                Loaded from QR sign-ups ({capturedGuests.length})
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {capturedGuests.map((g) => (
                  <span key={g.id} style={chipCaptured}>
                    {g.email}
                    <button
                      type="button"
                      onClick={() => removeCaptured(g.id)}
                      aria-label={`Remove ${g.email}`}
                      style={chipRemove}
                    >
                      {"×"}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--line-strong)", borderRadius: "12px", background: "var(--ink)", padding: "10px" }}>
            {parsed.valid.length || parsed.invalid.length ? (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                {parsed.valid.map((e) => (
                  <span key={e} style={chipOk}>
                    {e}
                  </span>
                ))}
                {parsed.invalid.map((e) => (
                  <span key={e} style={chipBad}>
                    ⚠ {e}
                  </span>
                ))}
              </div>
            ) : null}
            <textarea
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              placeholder="paste emails here, any format"
              style={{ width: "100%", border: 0, background: "transparent", color: "var(--text)", font: "inherit", fontSize: "14px", minHeight: "56px", padding: "4px", outline: "none", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", marginTop: "11px", fontSize: "12.5px", color: "var(--muted)", flexWrap: "wrap" }}>
            <span>
              <b style={{ color: "var(--text)" }}>{allValid.length}</b> guests ready
            </span>
            {parsed.invalid.length ? (
              <span style={{ color: "var(--bad)" }}>
                <b>{parsed.invalid.length}</b> need a look
              </span>
            ) : null}
            <span style={{ marginLeft: "auto", color: "var(--muted-2)" }}>
              duplicates dropped automatically
            </span>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "12px" }}>
            <button type="button" onClick={() => setNoteOpen((o) => !o)} aria-expanded={noteOpen} style={noteToggle}>
              <span className="fl-label-text" style={{ margin: 0 }}>Personal note · optional</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="2"
                aria-hidden="true"
                style={{ transform: noteOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {noteOpen ? (
              <textarea
                className="fl-textarea"
                style={{ minHeight: "60px", marginTop: "10px" }}
                placeholder={defaultMessage || "Overrides your default message for this send."}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
            ) : null}
          </div>

          <div style={{ display: "flex", marginTop: "18px" }}>
            {backBtn(1)}
            {continueBtn(2, "Review send")}
          </div>
        </StepCard>

        {/* Step 4: Review & send */}
        <StepCard {...cardProps(3)}>
          <div>
            {[
              { label: "Trip", value: tripSummary || "Not set", color: tripSummary ? "var(--text)" : "var(--bad)", edit: 0 },
              { label: "Sightings", value: speciesSummary || "None recorded", color: speciesSummary ? "var(--text)" : "var(--muted)", edit: 0 },
              { label: "Crew", value: aboard.length ? aboard.join(", ") : "No crew credited", color: aboard.length ? "var(--text)" : "var(--muted)", edit: 0 },
              { label: "Photos", value: files.length ? `${files.length} ${files.length === 1 ? "photo" : "photos"} · "${files[0].name}" is the cover` : "No photos yet", color: files.length ? "var(--text)" : "var(--bad)", edit: 1 },
              { label: "Guests", value: allValid.length ? `${allValid.length} ready${capturedGuests.length ? ` · ${capturedGuests.length} from QR sign-ups` : ""}` : "No guests yet", color: allValid.length ? "var(--text)" : "var(--bad)", edit: 2 },
              { label: "Note", value: customMessage.trim() ? `"${customMessage.trim()}"` : "Your default message", color: customMessage.trim() ? "var(--text)" : "var(--muted)", edit: 2 },
            ].map((row) => (
              <div
                key={row.label}
                style={{ display: "flex", alignItems: "baseline", gap: "14px", padding: "12px 0", borderBottom: "1px solid var(--line)" }}
              >
                <span style={{ flex: "0 0 88px", fontSize: "12.5px", fontWeight: 600, color: "var(--muted)" }}>
                  {row.label}
                </span>
                <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: "13.5px", color: row.color, overflowWrap: "anywhere" }}>
                  {row.value}
                </span>
                <button type="button" onClick={() => setStep(row.edit)} style={editLink}>
                  Edit
                </button>
              </div>
            ))}
          </div>

          {thumbUrls.length ? (
            <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
              {thumbUrls.map((url, i) => (
                <div
                  key={i}
                  style={{
                    width: "69px",
                    height: "52px",
                    borderRadius: "6px",
                    backgroundColor: "var(--ink-2)",
                    backgroundImage: `url(${url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ))}
            </div>
          ) : null}

          {!ready ? (
            <p style={{ color: "var(--bad)", fontSize: "12.5px", margin: "14px 0 0" }}>
              Before this can go out: {missing.join(", ")}.
            </p>
          ) : null}

          {error ? (
            <p style={{ color: "var(--bad)", fontSize: "13px", margin: "14px 0 0" }}>
              {error}
              {upgrade ? (
                <>
                  {" "}
                  <a href="/billing" style={{ color: "var(--signal)", fontWeight: 600 }}>
                    See plans
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", marginTop: "18px" }}>
            {backBtn(2)}
            <button
              type="submit"
              disabled={!ready}
              className="fl-btn"
              style={{ marginLeft: "auto", padding: "13px 26px", fontSize: "14.5px", fontWeight: 600, opacity: ready ? 1 : 0.4 }}
            >
              Send to {allValid.length} {allValid.length === 1 ? "guest" : "guests"}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--muted-2)", textAlign: "right" }}>
            review asks go out as guests download
          </p>
        </StepCard>
      </div>
    </form>
  );
}

/*
  One cascade card: the always visible header row (status circle, title, live
  summary, action word) and the animated body. The grid-rows trick animates
  height without measuring: 1fr when open, 0fr when closed. Top level so the
  subtree identity is stable across the parent's renders.
*/
function StepCard({
  index,
  active,
  done,
  open,
  summary,
  summarySet,
  onOpen,
  children,
}: {
  index: number;
  active: boolean;
  done: boolean;
  open: boolean;
  summary: string;
  summarySet: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const action = active ? "" : done ? "Edit" : open ? "Open" : "Locked";
  const clickable = done || open;
  return (
    <section
      style={{
        background: "var(--panel)",
        borderRadius: "16px",
        border: `1px solid ${active ? "#1f6f9c55" : "var(--line)"}`,
        boxShadow: active
          ? "0 1px 2px rgba(14,26,24,.04), 0 12px 32px rgba(14,26,24,.07)"
          : "none",
        transition: "border-color .3s ease, box-shadow .3s ease",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={active}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          background: "transparent",
          border: 0,
          font: "inherit",
          textAlign: "left",
          cursor: clickable ? "pointer" : "default",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "26px",
            height: "26px",
            flex: "0 0 auto",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: "12.5px",
            fontWeight: 700,
            background: done ? "var(--signal)" : "#fff",
            border: `1.5px solid ${done || active ? "var(--signal)" : "var(--line-strong)"}`,
            color: active ? "var(--signal)" : "var(--muted-2)",
            transition: "all .3s ease",
          }}
        >
          {done ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          ) : (
            index + 1
          )}
        </span>
        <span style={{ fontSize: "14.5px", fontWeight: 600, flex: "0 0 auto" }}>
          {STEP_TITLES[index]}
        </span>
        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            textAlign: "right",
            fontSize: "12.5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: summarySet ? "var(--text-2)" : "#a1a8a3",
          }}
        >
          {active ? "" : summary}
        </span>
        <span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: 600, color: "var(--signal-2)" }}>
          {action}
        </span>
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: active ? "1fr" : "0fr",
          transition: `grid-template-rows .45s ${EASE}`,
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "2px 20px 22px 58px" }}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function Grip() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="var(--muted-2)" aria-hidden="true" style={{ flex: "0 0 auto" }}>
      <circle cx="4" cy="3" r="1.3" />
      <circle cx="8" cy="3" r="1.3" />
      <circle cx="4" cy="7" r="1.3" />
      <circle cx="8" cy="7" r="1.3" />
      <circle cx="4" cy="11" r="1.3" />
      <circle cx="8" cy="11" r="1.3" />
    </svg>
  );
}

const captureBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(31,111,156,.45)",
  background: "rgba(31,111,156,.12)",
  marginBottom: "12px",
};
const dropzone: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "14px",
  padding: "30px 18px",
  textAlign: "center",
  color: "var(--muted)",
  fontSize: "13.5px",
  cursor: "pointer",
};
const thumb: React.CSSProperties = {
  position: "relative",
  aspectRatio: "4/3",
  borderRadius: "9px",
  // backgroundColor (not the `background` shorthand) so it does not reset
  // backgroundSize/Position and leave the full-res photo zoomed to its corner.
  backgroundColor: "var(--ink-2)",
  backgroundSize: "cover",
  backgroundPosition: "center",
};
const thumbCover: React.CSSProperties = {
  position: "absolute",
  top: "5px",
  left: "5px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "#fff",
  background: "rgba(8,18,23,.66)",
  borderRadius: "6px",
  padding: "2px 6px",
};
const coverChip: React.CSSProperties = {
  flex: "0 0 auto",
  fontSize: "10.5px",
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--signal-2)",
  border: "1px solid var(--signal)",
  borderRadius: "999px",
  padding: "1px 7px",
};
const thumbMore: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  fontSize: "18px",
  background: "rgba(8,18,23,.58)",
  borderRadius: "9px",
  color: "#fff",
};
const fileRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "12.5px",
  padding: "6px 2px",
  borderBottom: "1px solid var(--line)",
};
const fileName: React.CSSProperties = {
  flex: 1,
  color: "var(--text-2)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const fileRemove: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--muted)",
  borderRadius: "7px",
  cursor: "pointer",
  width: "26px",
  height: "24px",
  fontSize: "13px",
  lineHeight: 1,
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
// Species pills are small: the list can be long.
const speciesPill = (on: boolean): React.CSSProperties => ({
  font: "inherit",
  fontSize: "12px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
  background: on ? "var(--signal)" : "#fff",
  color: on ? "var(--signal-ink)" : "var(--muted)",
  borderRadius: "999px",
  padding: "4px 10px",
  cursor: "pointer",
  fontWeight: on ? 600 : 400,
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
const primaryBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "#fff",
  background: "var(--signal)",
  border: 0,
  borderRadius: "11px",
  padding: "11px 22px",
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--muted)",
  background: "transparent",
  border: "1px solid var(--line-strong)",
  borderRadius: "10px",
  padding: "10px 16px",
  cursor: "pointer",
};
const noteToggle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
};
const inlineLink: React.CSSProperties = {
  font: "inherit",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--signal-2)",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};
const editLink: React.CSSProperties = {
  flex: "0 0 auto",
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "var(--signal-2)",
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
};
const waterRing: React.CSSProperties = {
  position: "relative",
  width: "188px",
  height: "188px",
  margin: "0 auto",
  borderRadius: "50%",
  overflow: "hidden",
  border: "1px solid var(--line)",
  background: "#f7f9f9",
};
const chipOk: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "12.5px",
  background: "var(--panel-2)",
  border: "1px solid var(--line)",
  borderRadius: "999px",
  padding: "4px 11px",
  color: "var(--text)",
};
const chipBad: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "12.5px",
  background: "transparent",
  border: "1px solid var(--bad)",
  borderRadius: "999px",
  padding: "4px 11px",
  color: "var(--bad)",
};
const chipCaptured: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12.5px",
  background: "rgba(31,111,156,.14)",
  border: "1px solid rgba(31,111,156,.45)",
  borderRadius: "999px",
  padding: "4px 6px 4px 11px",
  color: "var(--text)",
};
const chipRemove: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: "15px",
  lineHeight: 1,
  padding: "0 2px",
};
