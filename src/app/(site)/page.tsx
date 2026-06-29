/*
  Public landing page. What Flukesend is: branded photo delivery for whale watch
  operators with an automatic review engine baked in.
*/
import Link from "next/link";

export const metadata = {
  title: "Flukesend - branded photo galleries that turn into reviews",
};

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "60px 24px 40px", textAlign: "center" }}>
        <div style={eyebrow}>For whale watch operators</div>
        <h1 style={hero}>
          Branded photo galleries
          <br />
          that turn into reviews
        </h1>
        <p style={lede}>
          Flukesend delivers your guests their whale watch photos in a gallery
          that looks like you, then quietly asks for a review the moment they
          download. WeTransfer, built for the water.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "26px" }}>
          <Link href="/login" style={primaryBtn}>
            Start free
          </Link>
          <Link href="/pricing" style={secondaryBtn}>
            See pricing
          </Link>
        </div>
        <p style={{ fontSize: "13px", color: "#8a938f", marginTop: "14px" }}>
          Your first 3 transfers or 30 guest emails are free. No card required.
        </p>
      </section>

      {/* Value props */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "30px 24px 50px" }}>
        <div style={grid3}>
          <Feature
            title="Branded, not a file dump"
            body="Every guest opens a gallery in your colors and your logo, with the trip written as warm copy. It looks like your operation, not a generic link."
          />
          <Feature
            title="The download is the trigger"
            body="A few hours after a guest saves their photos, they get a warm, branded ask to leave a review. Automatically. No Gmail scripts, no spreadsheets."
          />
          <Feature
            title="The email list is yours"
            body="Every guest email is yours to keep and export. You are the sender of record, we are just the engine. Clean on CAN-SPAM, by design."
          />
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "#fff", borderTop: "1px solid #ece7dd", borderBottom: "1px solid #ece7dd" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "54px 24px" }}>
          <h2 style={h2}>How it works</h2>
          <div style={grid3}>
            <Step n="1" title="Get home and edit" body="Off the boat, photos edited. Nothing happens on the water." />
            <Step n="2" title="Create a send" body="Trip details, drop the photos, paste the guest emails. Each guest becomes their own gallery." />
            <Step n="3" title="Reviews roll in" body="Guests download their photos, and the review asks go out on their own that evening." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <h2 style={{ ...h2, marginBottom: "10px" }}>Turn this season&apos;s trips into reviews</h2>
        <p style={{ color: "#5f6b68", fontSize: "16px", margin: "0 auto 22px", maxWidth: "44ch" }}>
          Set up your branding once. Every send after that looks like you and
          builds your reputation.
        </p>
        <Link href="/login" style={primaryBtn}>
          Start free
        </Link>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div style={card}>
      <h3 style={cardTitle}>{title}</h3>
      <p style={cardBody}>{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={card}>
      <div style={stepNum}>{n}</div>
      <h3 style={{ ...cardTitle, marginTop: "12px" }}>{title}</h3>
      <p style={cardBody}>{body}</p>
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#9a7b2e",
  fontWeight: 600,
};
const hero: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(34px, 6vw, 60px)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  margin: "14px 0 0",
  color: "#10221f",
};
const lede: React.CSSProperties = {
  fontSize: "17px",
  lineHeight: 1.6,
  color: "#3a4744",
  maxWidth: "56ch",
  margin: "18px auto 0",
};
const h2: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(26px, 4vw, 36px)",
  letterSpacing: "-0.01em",
  color: "#10221f",
  margin: "0 0 26px",
  textAlign: "center",
};
const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "18px",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece7dd",
  borderRadius: "16px",
  padding: "24px",
};
const cardTitle: React.CSSProperties = { margin: 0, fontSize: "17px", fontWeight: 600, color: "#10221f" };
const cardBody: React.CSSProperties = { margin: "8px 0 0", fontSize: "14.5px", lineHeight: 1.6, color: "#5f6b68" };
const stepNum: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "#0c1a21",
  color: "#e7b14c",
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "16px",
};
const primaryBtn: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  padding: "13px 24px",
  borderRadius: "999px",
};
const secondaryBtn: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#10221f",
  background: "transparent",
  border: "1px solid #cfcabd",
  padding: "12px 23px",
  borderRadius: "999px",
};
