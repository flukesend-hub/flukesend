"use client";

/*
  The guest self capture form. Operator branded (the brand color drives the
  button and accents, never the Flukesend green). The guest picks which boat and
  which trip time they were on; the date is set to today automatically since they
  are filling this in aboard. A hidden honeypot field catches bots. On success it
  swaps to a short thank you.
*/
import { useEffect, useState } from "react";
import { TRIP_TIME_SLOTS, formatTripTime } from "@/lib/trip-times";
import { captureGuest } from "./actions";

export function CaptureForm({
  token,
  brand,
  operatorName,
  boats,
  defaultBoatId,
}: {
  token: string;
  brand: string;
  operatorName: string;
  boats: { id: string; name: string }[];
  defaultBoatId: string;
}) {
  const [boatId, setBoatId] = useState(defaultBoatId || (boats.length === 1 ? boats[0].id : ""));
  const [tripTime, setTripTime] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [dateLabel, setDateLabel] = useState("today");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stamp today from the guest's own device, since they are aboard right now.
  // Set after mount so the server render and client agree.
  useEffect(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setTripDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setDateLabel(d.toLocaleDateString("en-US", { dateStyle: "long" }));
  }, []);

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
    return (
      <div style={{ background: "#fff", border: "1px solid #e7e0d4", borderRadius: "14px", padding: "26px 22px", textAlign: "center" }}>
        <div style={{ fontSize: "34px", lineHeight: 1 }} aria-hidden="true">
          {"✓"}
        </div>
        <p style={{ margin: "12px 0 4px", fontWeight: 600, fontSize: "16px" }}>You are on the list.</p>
        <p style={{ margin: 0, color: "#6b7a7d", fontSize: "13.5px", lineHeight: 1.55 }}>
          {operatorName} will email your photos after the trip. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e7e0d4", borderRadius: "14px", padding: "22px" }}>
      {boats.length > 1 ? (
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
          {TRIP_TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {formatTripTime(slot)}
            </option>
          ))}
        </select>
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
        <span style={labelText}>Your name (optional)</span>
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
      <p style={{ margin: "12px 0 0", color: "#8a938f", fontSize: "12px", lineHeight: 1.5, textAlign: "center" }}>
        We use this only to send your trip photos and a review ask. Nothing else.
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
