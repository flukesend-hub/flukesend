"use client";

/*
  The Story Builder surface. Pick a trip day, pick the hero photo of the day from
  every shot across that day's trips, watch the branded card preview update, and
  download it. The day list and the aggregated sightings come from the server;
  the day's photos are fetched on demand (signed thumbnails) when a day is picked.
  The preview and the download both point at /story/card, which renders the real
  1080x1920 image.
*/
import { useState } from "react";
import { getDayPhotos, type DayPhoto } from "./actions";

export type StoryDay = {
  date: string; // YYYY-MM-DD (UTC)
  label: string;
  trips: number;
  photos: number;
  species: string[];
};

export function StoryBuilder({ days }: { days: StoryDay[] }) {
  const [day, setDay] = useState<StoryDay | null>(null);
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickDay(d: StoryDay) {
    setDay(d);
    setPhotos([]);
    setHeroId(null);
    setLoading(true);
    try {
      const p = await getDayPhotos(d.date);
      setPhotos(p);
      setHeroId(p[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  const cardSrc = day ? `/story/card?d=${day.date}${heroId ? `&hero=${heroId}` : ""}` : null;

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
                    background: active ? "var(--signal-wash, #eef6fb)" : "#fff",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink, #1c2b2e)" }}>{d.label}</div>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginTop: "26px", alignItems: "flex-start" }}>
              {/* Photo picker */}
              <div style={{ flex: "1 1 380px", minWidth: "300px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>
                  Pick the photo of the day
                </div>
                {loading ? (
                  <div style={{ color: "var(--muted)", fontSize: "14px" }}>Loading photos...</div>
                ) : photos.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: "14px" }}>No photos found for this day.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px" }}>
                    {photos.map((p) => {
                      const active = p.id === heroId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setHeroId(p.id)}
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

              {/* Live preview + download */}
              <div style={{ flex: "0 0 auto", width: "300px", maxWidth: "100%" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginBottom: "10px" }}>Preview</div>
                <div style={{ width: "270px", maxWidth: "100%", aspectRatio: "1080 / 1920", borderRadius: "14px", overflow: "hidden", border: "1px solid var(--line)", background: "#f2efe9" }}>
                  {cardSrc && heroId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cardSrc} alt="Story preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  ) : null}
                </div>
                {cardSrc && heroId ? (
                  <a
                    href={cardSrc}
                    download="flukesend-story.png"
                    className="fl-btn"
                    style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "13px", marginTop: "14px", width: "270px", maxWidth: "100%" }}
                  >
                    Download story
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
