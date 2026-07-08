"use client";

/*
  The Story Builder surface. Pick a trip day, then choose which of that day's
  trips to include (default all), pick the hero photo of the day from the
  included trips, watch the branded card preview update, and share or download
  it. One trip selected shows that trip's time on the card; several shows just
  the date. On a touch device the primary action is the native share sheet
  (Instagram, Messages, etc.); desktop gets a download.
*/
import { useEffect, useMemo, useState } from "react";
import { getDay, type DayTrip } from "./actions";

export type StoryDay = {
  date: string; // YYYY-MM-DD (UTC)
  label: string;
  trips: number;
  photos: number;
  species: string[];
};

export function StoryBuilder({ days }: { days: StoryDay[] }) {
  const [day, setDay] = useState<StoryDay | null>(null);
  const [trips, setTrips] = useState<DayTrip[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [heroId, setHeroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Only offer native share on a touch-first device that can share files.
  useEffect(() => {
    try {
      const touchFirst = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
      const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
      setCanShare(touchFirst && typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShare(false);
    }
  }, []);

  const selectedPhotos = useMemo(
    () => trips.filter((t) => selected.has(t.id)).flatMap((t) => t.photos),
    [trips, selected],
  );

  async function pickDay(d: StoryDay) {
    setDay(d);
    setTrips([]);
    setSelected(new Set());
    setHeroId(null);
    setNote(null);
    setLoading(true);
    try {
      const t = await getDay(d.date);
      setTrips(t);
      setSelected(new Set(t.map((x) => x.id)));
      const firstPhoto = t.flatMap((x) => x.photos)[0];
      if (firstPhoto) {
        setHeroId(firstPhoto.id);
        setRendering(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleTrip(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size === 1) return; // always keep at least one trip
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
    const stillPhotos = trips.filter((t) => next.has(t.id)).flatMap((t) => t.photos);
    if (!stillPhotos.some((p) => p.id === heroId)) {
      setHeroId(stillPhotos[0]?.id ?? null);
    }
    setRendering(true);
  }

  function chooseHero(id: string) {
    if (id === heroId) return;
    setHeroId(id);
    setRendering(true);
  }

  const cardSrc = day && heroId ? `/story/card?d=${day.date}&t=${[...selected].join(",")}&hero=${heroId}` : null;

  async function share() {
    if (!cardSrc) return;
    setSharing(true);
    setNote(null);
    try {
      const res = await fetch(cardSrc);
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], "flukesend-story.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
        throw new Error("cannot share");
      }
      await navigator.share({ files: [file] });
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setNote("Could not open sharing here. Use download instead.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 22px 90px" }}>
      <div className="fl-eyebrow">Story Builder</div>
      <h1 className="fl-h1" style={{ fontSize: "30px" }}>Story Builder</h1>
      <p style={{ color: "var(--muted)", fontSize: "14.5px", margin: "6px 0 0", maxWidth: "60ch" }}>
        Pick a day, choose the photo of the day, and post a branded story of your sightings.
      </p>

      {days.length === 0 ? (
        <div className="fl-card" style={{ marginTop: "22px", color: "var(--muted)", fontSize: "14px" }}>
          No trips with photos in the last 30 days yet. Create a send, then come back to build a story.
        </div>
      ) : (
        <>
          {/* Day picker */}
          <div style={{ margin: "22px 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>Pick a day</div>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px" }}>
            {days.map((d) => {
              const active = day?.date === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => pickDay(d)}
                  style={{
                    flex: "0 0 auto",
                    textAlign: "left",
                    minWidth: "170px",
                    cursor: "pointer",
                    border: active ? "2px solid var(--signal)" : "1px solid var(--line)",
                    background: active ? "#eef5fb" : "#fff",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#1c2b2e" }}>{d.label}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                    {d.trips} trip{d.trips === 1 ? "" : "s"} · {d.photos} photo{d.photos === 1 ? "" : "s"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                    {d.species.length ? d.species.join(", ") : "No species tagged"}
                  </div>
                </button>
              );
            })}
          </div>

          {day ? (
            <>
              {/* Trip toggles, only when the day had more than one trip. */}
              {trips.length > 1 ? (
                <div style={{ marginTop: "22px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "8px" }}>
                    Trips to include
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {trips.map((t) => {
                      const on = selected.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTrip(t.id)}
                          style={{
                            font: "inherit",
                            cursor: "pointer",
                            borderRadius: "999px",
                            padding: "8px 14px",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#1c2b2e",
                            border: on ? "2px solid var(--signal)" : "1px solid var(--line)",
                            background: on ? "#eef5fb" : "#fff",
                          }}
                        >
                          {on ? "✓ " : ""}
                          {t.timeLabel}
                          {t.photos.length ? "" : " · no photos"}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "7px" }}>
                    All trips makes a day recap. Pick one to feature just that trip, with its time.
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginTop: "26px", alignItems: "flex-start" }}>
                {/* Photo picker */}
                <div style={{ flex: "1 1 380px", minWidth: "300px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>
                    Pick the photo of the day
                  </div>
                  {loading ? (
                    <div style={{ color: "var(--muted)", fontSize: "14px" }}>Loading photos...</div>
                  ) : selectedPhotos.length === 0 ? (
                    <div style={{ color: "var(--muted)", fontSize: "14px" }}>No photos in the selected trips.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px" }}>
                      {selectedPhotos.map((p) => {
                        const active = p.id === heroId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => chooseHero(p.id)}
                            style={{
                              padding: 0,
                              border: active ? "3px solid var(--signal)" : "1px solid var(--line)",
                              borderRadius: "10px",
                              overflow: "hidden",
                              cursor: "pointer",
                              aspectRatio: "1 / 1",
                              background: "#e7e2d8",
                            }}
                            aria-label={active ? "Selected hero photo" : "Use this photo"}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live preview + share/download */}
                <div style={{ flex: "0 0 auto", width: "300px", maxWidth: "100%" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>Preview</div>
                  <div style={{ position: "relative", width: "270px", maxWidth: "100%", aspectRatio: "1080 / 1920", borderRadius: "14px", overflow: "hidden", border: "1px solid var(--line)", background: "#f2efe9" }}>
                    {cardSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={cardSrc}
                        src={cardSrc}
                        alt="Story preview"
                        onLoad={() => setRendering(false)}
                        onError={() => setRendering(false)}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", opacity: rendering ? 0.35 : 1, transition: "opacity .15s" }}
                      />
                    ) : null}
                    {rendering ? (
                      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "12.5px", fontWeight: 600, color: "#6b7a7d" }}>
                        Rendering...
                      </div>
                    ) : null}
                  </div>

                  {cardSrc ? (
                    <div style={{ width: "270px", maxWidth: "100%", marginTop: "14px" }}>
                      {canShare ? (
                        <>
                          <button
                            type="button"
                            onClick={share}
                            disabled={sharing}
                            className="fl-btn"
                            style={{ display: "block", width: "100%", textAlign: "center", padding: "13px", cursor: "pointer", border: 0, font: "inherit", opacity: sharing ? 0.75 : 1 }}
                          >
                            {sharing ? "Preparing..." : "Share"}
                          </button>
                          <a href={cardSrc} download="flukesend-story.png" style={{ display: "block", textAlign: "center", marginTop: "8px", fontSize: "12.5px", color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
                            or download
                          </a>
                        </>
                      ) : (
                        <a href={cardSrc} download="flukesend-story.png" className="fl-btn" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "13px" }}>
                          Download story
                        </a>
                      )}
                      {note ? <p style={{ fontSize: "12.5px", color: "#a04435", margin: "8px 0 0", textAlign: "center" }}>{note}</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
