"use client";

/*
  The send form, dark workspace styling from the design handoff. Trip details
  with species pills, a photo dropzone with thumbnails uploading straight to
  storage, and the live email chip box. While a send runs, a circular water fill
  animates in the operator's brand color. On success it goes to the confirmation
  page. The upload and createSend logic is unchanged from before.
*/
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { CREW_ROLES, topRole } from "@/lib/roles";
import { TRIP_TIME_SLOTS, formatTripTime } from "@/lib/trip-times";
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

type Status = "idle" | "uploading" | "saving";

export function SendForm({
  defaultMessage,
  brandColor,
  speciesOptions,
  boats,
  capturedByBoat,
  crew,
}: {
  defaultMessage: string;
  brandColor: string;
  speciesOptions: string[];
  boats: Boat[];
  capturedByBoat: Record<string, number>;
  crew: { name: string; roles: string[] }[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [species, setSpecies] = useState<string[]>([]);
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
  const [crewOpen, setCrewOpen] = useState(false);
  // Index of the file row being dragged, for reordering. Null when not dragging.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
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

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setFiles((prev) => {
      const key = (f: File) => `${f.name}:${f.size}`;
      const have = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !have.has(key(f)))];
    });
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUpgrade(false);

    const fd = new FormData(e.currentTarget);
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
    const boatName = boats.find((b) => b.id === boat)?.name ?? null;
    const customMessage = String(fd.get("custom_message") ?? "").trim() || null;

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
        captainName,
        naturalistName,
        photographerName,
        crewNames,
        boatName,
        customMessage,
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
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: `${progress}%`,
              background: `linear-gradient(180deg,${brandColor},var(--ink))`,
              transition: "height .12s linear",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-12px",
                left: 0,
                width: "200%",
                height: "18px",
                animation: "fl-wave 2.4s linear infinite",
                background: `radial-gradient(circle at 12.5% 0,transparent 11px,${brandColor} 12px) repeat-x`,
                backgroundSize: "50px 18px",
              }}
            />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span className="fl-display" style={{ fontSize: "40px", color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,.4)" }}>
              {progress}%
            </span>
          </div>
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

  return (
    <form onSubmit={handleSubmit} className="fl-side" style={{ gridTemplateColumns: "360px minmax(0, 480px)", marginTop: "22px" }}>
      {/* Trip details */}
      <div className="fl-card">
        <h3 style={h3}>Trip details</h3>
        <p className="fl-hint" style={{ margin: "0 0 16px" }}>
          These show up on the gallery and warm up the review email.
        </p>
        <label style={field}>
          <span className="fl-label-text">Trip date</span>
          <input
            type="date"
            className="fl-input"
            style={{ minWidth: 0, maxWidth: "100%" }}
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
          />
        </label>
        {boats.length > 1 ? (
          <label style={field}>
            <span className="fl-label-text">Boat</span>
            <select className="fl-input" value={boat} onChange={(e) => setBoat(e.target.value)}>
              <option value="">No boat</option>
              {boats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label style={field}>
          <span className="fl-label-text">Trip time</span>
          <select className="fl-input" value={tripTime} onChange={(e) => setTripTime(e.target.value)}>
            <option value="">No time set</option>
            {TRIP_TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {formatTripTime(slot)}
              </option>
            ))}
          </select>
          {boats.length ? (
            <span className="fl-hint" style={{ display: "block", marginTop: "6px" }}>
              {boats.length > 1
                ? "Pick the boat and trip time to load guests who signed up by QR."
                : "Pick the trip time to load guests who signed up by QR."}
            </span>
          ) : null}
        </label>

        <div style={{ marginBottom: "16px" }}>
          <button type="button" onClick={() => setCrewOpen((o) => !o)} aria-expanded={crewOpen} style={crewToggle}>
            <span className="fl-label-text" style={{ margin: 0 }}>Crew mentions (optional)</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              aria-hidden="true"
              style={{ transform: crewOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {crewOpen ? (
            crew.length ? (
              <div style={{ marginTop: "10px" }}>
                <p className="fl-hint" style={{ margin: "0 0 8px" }}>
                  Check who was aboard. Each person is credited once, by their main role.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                        <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{c.name}</span>
                        <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)" }}>
                          {creditedLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="fl-hint" style={{ margin: "10px 0 0" }}>
                Add your team in{" "}
                <a href="/settings" style={{ color: "var(--signal-2)", fontWeight: 600 }}>Settings</a>{" "}
                and tag each person&apos;s role to credit them here.
              </p>
            )
          ) : null}
        </div>
        <span className="fl-label-text">Species seen</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          {speciesOptions.map((name) => {
            const on = species.includes(name);
            return (
              <button key={name} type="button" onClick={() => toggleSpecies(name)} style={speciesPill(on)}>
                {name}
              </button>
            );
          })}
        </div>
        <p className="fl-hint" style={{ margin: "0 0 16px" }}>
          Edit this list in <a href="/settings" style={{ color: "var(--signal-2)", fontWeight: 600 }}>Settings</a>.
        </p>
        <label style={{ display: "block", margin: 0 }}>
          <span className="fl-label-text">Custom message (optional)</span>
          <textarea name="custom_message" className="fl-textarea" style={{ minHeight: "60px" }} placeholder={defaultMessage || "Overrides your default message for this send."} />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Photos */}
        <div className="fl-card">
          <h3 style={h3}>Photos</h3>
          <p className="fl-hint" style={{ margin: "0 0 14px" }}>
            Drop the edited set in. They upload straight to storage.
          </p>
          <label style={{ display: "block" }}>
            <div style={{ ...dropzone, background: `${brandColor}16` }}>Drop photos here, or browse</div>
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
            <p className="fl-hint" style={{ margin: "12px 0 0" }}>
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
        </div>

        {/* Guest emails */}
        <div className="fl-card">
          <h3 style={h3}>Guest emails</h3>
          <p className="fl-hint" style={{ margin: "0 0 14px" }}>
            {capturedGuests.length
              ? "QR sign-ups for this trip loaded below. Add more emails in the box, any format."
              : "Paste straight from the naturalist's notes. Line breaks, spaces, semicolons, it all works. No commas needed."}
          </p>

          {boat && !tripTime && (capturedByBoat[boat] ?? 0) > 0 ? (
            <div style={captureBox}>
              <span style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.45 }}>
                <b>{capturedByBoat[boat]}</b>{" "}
                {capturedByBoat[boat] === 1 ? "guest has" : "guests have"} signed up by QR for{" "}
                {boats.find((b) => b.id === boat)?.name ?? "this boat"}. Pick the trip time above to load them.
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
              style={{ width: "100%", border: 0, background: "transparent", color: "var(--text)", font: "inherit", fontSize: "14px", minHeight: "46px", padding: "4px", outline: "none", resize: "vertical" }}
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

          {error ? (
            <p style={{ color: "var(--bad)", fontSize: "13px", margin: "12px 0 0" }}>
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

          <div style={{ marginTop: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" disabled={!allValid.length || !files.length} className="fl-btn" style={{ padding: "11px 18px", fontSize: "14px" }}>
              Send to {allValid.length} {allValid.length === 1 ? "guest" : "guests"}
            </button>
            <span style={{ fontSize: "12px", color: "var(--muted-2)" }}>
              review asks go out as guests download
            </span>
          </div>
        </div>
      </div>
    </form>
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

const h3: React.CSSProperties = { margin: "0 0 2px", fontSize: "15px", fontWeight: 600 };
const field: React.CSSProperties = { display: "block", marginBottom: "14px" };
const captureBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(63,122,77,.45)",
  background: "rgba(63,122,77,.12)",
  marginBottom: "12px",
};
const dropzone: React.CSSProperties = {
  border: "1.5px dashed var(--line-strong)",
  borderRadius: "13px",
  padding: "18px",
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
const crewToggle: React.CSSProperties = {
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
const crewRow = (on: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "9px 11px",
  borderRadius: "10px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line)"}`,
  background: on ? "rgba(63,122,77,.10)" : "var(--ink)",
  cursor: "pointer",
});
// Species pills are small: the list can be long.
const speciesPill = (on: boolean): React.CSSProperties => ({
  font: "inherit",
  fontSize: "11.5px",
  border: `1px solid ${on ? "var(--signal)" : "var(--line-strong)"}`,
  background: on ? "var(--signal)" : "var(--ink)",
  color: on ? "var(--signal-ink)" : "var(--muted)",
  borderRadius: "999px",
  padding: "4px 9px",
  cursor: "pointer",
  fontWeight: on ? 600 : 400,
});
const waterRing: React.CSSProperties = {
  position: "relative",
  width: "188px",
  height: "188px",
  margin: "0 auto",
  borderRadius: "50%",
  overflow: "hidden",
  border: "1px solid var(--line-strong)",
  background: "var(--ink)",
  boxShadow: "inset 0 0 30px rgba(0,0,0,.4)",
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
  background: "rgba(63,122,77,.14)",
  border: "1px solid rgba(63,122,77,.45)",
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
