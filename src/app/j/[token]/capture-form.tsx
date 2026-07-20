"use client";

/*
  The guest self capture form. Operator branded (the brand color drives the
  button and accents, never the Flukesend green). The guest picks which boat and
  which trip time they were on; the date is set to today automatically since they
  are filling this in aboard. Only trips that have already departed are listed
  (a trip appears the moment its time hits), so a guest cannot pick a later trip
  that has not gone out; a quiet link reveals the full list for odd cases. A
  hidden honeypot field catches bots. On success it swaps to a short thank you.
*/
import { useEffect, useState } from "react";
import { formatTripTime, departedTripTimes } from "@/lib/trip-times";
import { SOCIAL_PLATFORMS, type SocialLinks } from "@/lib/social";
import { captureGuest } from "./actions";

export function CaptureForm({
  token,
  brand,
  operatorName,
  boats,
  tripTimes,
  social,
  defaultBoatId,
  lockedBoatName,
}: {
  token: string;
  brand: string;
  operatorName: string;
  boats: { id: string; name: string }[];
  tripTimes: string[];
  social: SocialLinks;
  defaultBoatId: string;
  // When the scanned code is a specific boat's, the boat is fixed and the guest
  // never picks: we show the name and hide the picker. Null for the operator
  // wide code, where the guest still chooses their boat.
  lockedBoatName: string | null;
}) {
  const [boatId, setBoatId] = useState(defaultBoatId || (boats.length === 1 ? boats[0].id : ""));
  const [tripTime, setTripTime] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [dateLabel, setDateLabel] = useState("today");
  const [now, setNow] = useState<Date | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stamp today from the guest's own device, since they are aboard right now.
  // Set after mount so the server render and client agree. The clock ticks so
  // a page left open still shows the right trips when the next one departs.
  useEffect(() => {
    const stamp = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTripDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setDateLabel(d.toLocaleDateString("en-US", { dateStyle: "long" }));
      setNow(d);
    };
    stamp();
    const timer = setInterval(stamp, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Only trips that have already left the dock, by the guest's own clock. The
  // list is empty for one frame before mount (and matches the server render),
  // then fills in. "Show all" is the escape hatch for odd cases: a delayed
  // boat, a charter, or signing up from a photo of the QR later on.
  const visibleTimes =
    showAll ? tripTimes : now ? departedTripTimes(tripTimes, now) : [];

  // One departed trip means it is theirs; select it so the common case
  // (scanning mid-trip) is zero taps.
  useEffect(() => {
    if (!showAll && visibleTimes.length === 1 && !tripTime) {
      setTripTime(visibleTimes[0]);
    }
  }, [showAll, visibleTimes, tripTime]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!boatId) {
      setError("Pick which boat you were on.");
      return;
    }
    if (!tripTime) {
      setError("Pick your trip time.");
      return;
    }
    setBusy(true);
    const res = await captureGuest({ token, boatId, tripDate, tripTime, email, name, company });
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    const socialLinks = SOCIAL_PLATFORMS.map((p) => ({ p, url: social[p.column] }))
      .filter((x): x is { p: (typeof SOCIAL_PLATFORMS)[number]; url: string } => Boolean(x.url));
    return (
      <div style={{ background: "#fff", border: "1px solid #e7e0d4", borderRadius: "14px", padding: "26px 22px", textAlign: "center" }}>
        <div style={{ fontSize: "34px", lineHeight: 1 }} aria-hidden="true">
          {"✓"}
        </div>
        <p style={{ margin: "12px 0 4px", fontWeight: 600, fontSize: "16px" }}>You are on the list.</p>
        <p style={{ margin: 0, color: "#6b7a7d", fontSize: "13.5px", lineHeight: 1.55 }}>
          {operatorName} will email your photos after the trip. If you do not
          see them, check your spam or junk folder. You can close this page.
        </p>
        {socialLinks.length ? (
          <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid #eee5d8" }}>
            <div style={{ fontSize: "12.5px", color: "#8a938f", marginBottom: "12px" }}>
              Follow {operatorName}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
              {socialLinks.map(({ p, url }) => (
                <a key={p.key} href={url} target="_blank" rel="noopener noreferrer" aria-label={p.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/email/social/${p.key}.png`} alt={p.label} width={26} height={26} style={{ display: "block", opacity: 0.8 }} />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e7e0d4", borderRadius: "14px", padding: "22px" }}>
      {lockedBoatName ? (
        <div style={label}>
          <span style={labelText}>Your boat</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              border: "1px solid #d7cfbf",
              borderRadius: "10px",
              padding: "12px 13px",
              background: "#fdfcf9",
              fontSize: "16px",
              fontWeight: 600,
              color: "#10221f",
            }}
          >
            <span aria-hidden="true" style={{ color: brand }}>
              {"✓"}
            </span>
            {lockedBoatName}
          </div>
        </div>
      ) : boats.length > 1 ? (
        <label style={label}>
          <span style={labelText}>Which boat were you on?</span>
          <select value={boatId} onChange={(e) => setBoatId(e.target.value)} style={input}>
            <option value="">Choose your boat</option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label style={label}>
        <span style={labelText}>Which trip? (today, {dateLabel})</span>
        <select value={tripTime} onChange={(e) => setTripTime(e.target.value)} style={input}>
          <option value="">Choose your trip time</option>
          {visibleTimes.map((slot) => (
            <option key={slot} value={slot}>
              {formatTripTime(slot)}
            </option>
          ))}
        </select>
        {!showAll ? (
          <span style={{ display: "block", fontSize: "12px", color: "#8a938f", marginTop: "6px" }}>
            {visibleTimes.length === 0 && now
              ? "Trips show up here once they have left the dock. "
              : null}
            {"Don't see your trip? "}
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{ font: "inherit", fontWeight: 600, color: "#33464a", background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              Show all times
            </button>
          </span>
        ) : null}
      </label>

      <label style={label}>
        <span style={labelText}>Your email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={input}
        />
      </label>
      <label style={{ ...label, marginBottom: "18px" }}>
        <span style={labelText}>Your first name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name"
          autoComplete="name"
          style={input}
        />
      </label>

      {/* Honeypot: visually hidden, off screen, not tabbable. Humans never fill it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label>
          Company
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p style={{ color: "#b23c2b", fontSize: "13px", margin: "0 0 12px" }}>{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        style={{
          width: "100%",
          border: 0,
          borderRadius: "11px",
          padding: "13px",
          fontSize: "15px",
          fontWeight: 600,
          color: "#fff",
          background: brand,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Saving..." : "Send me my photos"}
      </button>
      <p style={{ margin: "14px 0 0", color: "#33464a", fontSize: "13px", fontWeight: 700, lineHeight: 1.5, textAlign: "center" }}>
        Make sure to check your spam folder.
      </p>
    </form>
  );
}

const label: React.CSSProperties = { display: "block", marginBottom: "14px" };
const labelText: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 600, color: "#33464a", marginBottom: "6px" };
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d7cfbf",
  borderRadius: "10px",
  padding: "12px 13px",
  fontSize: "16px",
  font: "inherit",
  color: "#10221f",
  background: "#fdfcf9",
  outline: "none",
};
