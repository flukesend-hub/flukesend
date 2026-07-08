"use client";

/*
  The Social surface. Pick a trip day, then pick which of that day's trips to
  include (default all). Two modes share that day and trip picker:

  - Story: choose one hero photo of the day and post a branded 1080x1920 card.
    One trip selected shows that trip's time on the card; several shows the date.
  - Post: choose several of the day's photos and post them as a regular
    Instagram carousel. Since Instagram cannot be filled from the web, Post saves
    the full resolution photos (the phone share sheet offers Save to Photos, or a
    download on desktop) and then opens Instagram, where the operator makes the
    carousel from their camera roll.

  On a touch device the primary action is the native share sheet; desktop gets a
  download.
*/
import { useEffect, useMemo, useState } from "react";
import { getDay, getPostUrls, type DayTrip } from "./actions";

export type StoryDay = {
  date: string; // YYYY-MM-DD (UTC)
  label: string;
  trips: number;
  photos: number;
  species: string[];
};

const MAX_POST = 10; // Instagram carousel limit.

export function StoryBuilder({ days }: { days: StoryDay[] }) {
  const [mode, setMode] = useState<"story" | "post">("story");
  const [day, setDay] = useState<StoryDay | null>(null);
  const [trips, setTrips] = useState<DayTrip[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [heroId, setHeroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Post mode state.
  const [postSel, setPostSel] = useState<Set<string>>(new Set());
  const [savingPost, setSavingPost] = useState(false);
  const [postSaved, setPostSaved] = useState(false);
  const [postNote, setPostNote] = useState<string | null>(null);

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

  function resetPost() {
    setPostSel(new Set());
    setPostSaved(false);
    setPostNote(null);
  }

  async function pickDay(d: StoryDay) {
    setDay(d);
    setTrips([]);
    setSelected(new Set());
    setHeroId(null);
    setNote(null);
    resetPost();
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
    // Drop any picked-to-post photos that are no longer in an included trip.
    setPostSel((prev) => {
      const keep = new Set([...prev].filter((pid) => stillPhotos.some((p) => p.id === pid)));
      return keep;
    });
    setPostSaved(false);
    setRendering(true);
  }

  function chooseHero(id: string) {
    if (id === heroId) return;
    setHeroId(id);
    setRendering(true);
  }

  function togglePost(id: string) {
    setPostSaved(false);
    setPostSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPostNote(null);
      } else if (next.size >= MAX_POST) {
        setPostNote(`Instagram allows up to ${MAX_POST} photos in one post.`);
        return prev;
      } else {
        next.add(id);
        setPostNote(null);
      }
      return next;
    });
  }

  const postPhotos = useMemo(
    () => selectedPhotos.filter((p) => postSel.has(p.id)),
    [selectedPhotos, postSel],
  );

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

  async function savePost() {
    const ids = postPhotos.map((p) => p.id);
    if (!ids.length) return;
    setSavingPost(true);
    setPostNote(null);
    try {
      const urls = await getPostUrls(ids);
      const files: File[] = [];
      for (const u of urls) {
        const res = await fetch(u.url);
        if (!res.ok) continue;
        const blob = await res.blob();
        files.push(new File([blob], u.filename, { type: blob.type || "image/jpeg" }));
      }
      if (!files.length) throw new Error("no files");

      if (canShare && typeof navigator.canShare === "function" && navigator.canShare({ files })) {
        await navigator.share({ files });
      } else {
        for (const f of files) {
          const url = URL.createObjectURL(f);
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      }
      setPostSaved(true);
      setPostNote(
        canShare
          ? `Saved ${files.length} photo${files.length === 1 ? "" : "s"}. Now open Instagram, tap the plus, and pick them from your camera roll.`
          : `Downloaded ${files.length} photo${files.length === 1 ? "" : "s"}. Now open Instagram and drag them into a new post.`,
      );
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setPostNote("Could not save the photos here. Try another browser, or download them from the send.");
      }
    } finally {
      setSavingPost(false);
    }
  }

  function openInstagram() {
    window.open("https://www.instagram.com/", "_blank", "noopener");
  }

  return (
    <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 22px 90px" }}>
      <div className="fl-eyebrow">Social</div>
      <h1 className="fl-h1" style={{ fontSize: "30px" }}>Social</h1>
      <p style={{ color: "var(--muted)", fontSize: "14.5px", margin: "6px 0 0", maxWidth: "60ch" }}>
        Pick a day, then post a branded story of your sightings or a set of the day's best shots.
      </p>

      {days.length === 0 ? (
        <div className="fl-card" style={{ marginTop: "22px", color: "var(--muted)", fontSize: "14px" }}>
          No trips with photos in the last 30 days yet. Create a send, then come back to build a post.
        </div>
      ) : (
        <>
          {/* Story / Post mode toggle */}
          <div style={{ display: "inline-flex", gap: "4px", marginTop: "20px", padding: "4px", background: "#eef1f0", borderRadius: "12px" }}>
            {(["story", "post"] as const).map((m) => {
              const on = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    font: "inherit",
                    cursor: "pointer",
                    border: 0,
                    borderRadius: "9px",
                    padding: "8px 20px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: on ? "var(--signal-ink)" : "var(--muted)",
                    background: on ? "var(--signal)" : "transparent",
                  }}
                >
                  {m === "story" ? "Story" : "Post"}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "7px" }}>
            {mode === "story"
              ? "Story: one branded photo-of-the-day card, sized for Instagram Stories."
              : "Post: pick several of the day's shots for a regular Instagram carousel."}
          </div>

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
                    {mode === "story"
                      ? "All trips makes a day recap. Pick one to feature just that trip, with its time."
                      : "Choose which trips' photos to pick from."}
                  </div>
                </div>
              ) : null}

              {mode === "story" ? (
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
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginTop: "26px", alignItems: "flex-start" }}>
                  {/* Multi-select photo picker */}
                  <div style={{ flex: "1 1 380px", minWidth: "300px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>
                      Pick photos to post{postSel.size ? ` (${postSel.size} selected)` : ""}
                    </div>
                    {loading ? (
                      <div style={{ color: "var(--muted)", fontSize: "14px" }}>Loading photos...</div>
                    ) : selectedPhotos.length === 0 ? (
                      <div style={{ color: "var(--muted)", fontSize: "14px" }}>No photos in the selected trips.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px" }}>
                        {selectedPhotos.map((p) => {
                          const on = postSel.has(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePost(p.id)}
                              style={{
                                position: "relative",
                                padding: 0,
                                border: on ? "3px solid var(--signal)" : "1px solid var(--line)",
                                borderRadius: "10px",
                                overflow: "hidden",
                                cursor: "pointer",
                                aspectRatio: "1 / 1",
                                background: "#e7e2d8",
                              }}
                              aria-label={on ? "Remove from post" : "Add to post"}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.92 }} />
                              <span
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "999px",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: on ? "var(--signal-ink)" : "transparent",
                                  background: on ? "var(--signal)" : "rgba(255,255,255,.65)",
                                  border: on ? "0" : "1px solid rgba(0,0,0,.15)",
                                }}
                              >
                                {on ? "✓" : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected preview + save/open Instagram */}
                  <div style={{ flex: "0 0 auto", width: "300px", maxWidth: "100%" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>
                      Your post{postPhotos.length ? ` (${postPhotos.length})` : ""}
                    </div>
                    <div style={{ width: "270px", maxWidth: "100%", borderRadius: "14px", overflow: "hidden", border: "1px solid var(--line)", background: "#f2efe9", padding: "10px" }}>
                      {postPhotos.length === 0 ? (
                        <div style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", fontSize: "12.5px", color: "#6b7a7d", textAlign: "center", padding: "0 18px" }}>
                          Tap photos on the left to add them to your post.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                          {postPhotos.map((p) => (
                            <div key={p.id} style={{ aspectRatio: "1 / 1", borderRadius: "8px", overflow: "hidden", background: "#e7e2d8" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ width: "270px", maxWidth: "100%", marginTop: "14px" }}>
                      <button
                        type="button"
                        onClick={savePost}
                        disabled={savingPost || postPhotos.length === 0}
                        className="fl-btn"
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "center",
                          padding: "13px",
                          cursor: postPhotos.length === 0 ? "not-allowed" : "pointer",
                          border: 0,
                          font: "inherit",
                          opacity: savingPost || postPhotos.length === 0 ? 0.55 : 1,
                        }}
                      >
                        {savingPost ? "Preparing..." : canShare ? "Save photos for Instagram" : "Download photos for Instagram"}
                      </button>
                      {postSaved ? (
                        <button
                          type="button"
                          onClick={openInstagram}
                          style={{ display: "block", width: "100%", textAlign: "center", marginTop: "8px", padding: "12px", cursor: "pointer", font: "inherit", fontSize: "14px", fontWeight: 600, color: "var(--signal-ink)", background: "#fff", border: "1.5px solid var(--signal)", borderRadius: "10px" }}
                        >
                          Open Instagram
                        </button>
                      ) : null}
                      {postNote ? (
                        <p style={{ fontSize: "12.5px", color: postSaved ? "var(--muted)" : "#a04435", margin: "10px 0 0", textAlign: "center", lineHeight: 1.5 }}>{postNote}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
