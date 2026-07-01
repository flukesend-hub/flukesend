/*
  Public landing page. What Flukesend is: branded photo delivery for whale watch
  operators with an automatic review engine baked in, and QR self capture so the
  guest emails collect themselves on deck. The QR shown in the capture section
  is real and points at the site, so a curious visitor can scan it.
*/
import Link from "next/link";
import QRCode from "qrcode";

export const metadata = {
  title: "Flukesend - branded photo galleries that turn into reviews",
};

export default async function LandingPage() {
  const demoQr = await QRCode.toDataURL("https://www.flukesend.com", {
    margin: 1,
    width: 480,
    color: { dark: "#10221f", light: "#faf8f4" },
  });
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
          download. Even the guest emails collect themselves, scanned in by QR
          on deck.
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
        <h2 style={{ ...h2, marginBottom: "8px" }}>More than delivery</h2>
        <p style={{ textAlign: "center", color: "#5f6b68", fontSize: "15.5px", margin: "0 auto 26px", maxWidth: "52ch" }}>
          The photos make the trip better. The trip makes the reviews. The
          list brings everyone back next season.
        </p>
        <div style={grid3}>
          <Feature
            title="Part of the trip you sell"
            body="Guests go home with professional shots of their own whale, waiting in their inbox that evening. The trip does not end at the dock, and a better ending is a better memory."
          />
          <Feature
            title="Branded, not a file dump"
            body="Every guest opens a gallery in your colors and your logo, with the trip written as warm copy. It looks like your operation, not a generic link."
          />
          <Feature
            title="The download is the trigger"
            body="The evening after a guest saves their photos, they get a warm, branded ask to leave a review. Automatically. No Gmail scripts, no spreadsheets."
          />
          <Feature
            title="Built for sharing"
            body="A gallery link is easy to text to the whole family. Friends who were not aboard see your brand wrapped around photos worth booking a trip for."
          />
          <Feature
            title="Repeat customers, built in"
            body="Every send grows a clean list of past guests, yours to keep and export. Next season's announcement reaches everyone who sailed with you this year."
          />
          <Feature
            title="Proof it is working"
            body="Analytics show the whole funnel for every send: guests reached, galleries opened, photos saved, review links clicked. By boat and by photographer."
          />
        </div>
      </section>

      {/* QR capture */}
      <section style={{ background: "#fff", borderTop: "1px solid #ece7dd", borderBottom: "1px solid #ece7dd" }}>
        <div style={qrSection}>
          <div style={{ flex: "1 1 380px" }}>
            <div style={eyebrow}>On the boat</div>
            <h2 style={{ ...h2, textAlign: "left", margin: "12px 0 14px" }}>
              Guest emails collect themselves
            </h2>
            <p style={{ fontSize: "15.5px", lineHeight: 1.65, color: "#3a4744", margin: 0 }}>
              The hard part of photo delivery was never the photos. It was
              collecting emails legibly on a moving boat. Print your Flukesend
              QR code once and post it aboard: guests scan it, type their own
              email, and pick their trip time. By the time you sit down to
              send, the guest list is already loaded.
            </p>
            <ul style={qrList}>
              <li style={qrItem}>One code for your whole operation. Print it and forget it.</li>
              <li style={qrItem}>Sign-ups tie to the boat and trip time, so the right guests load into the right send.</li>
              <li style={qrItem}>No typos, no deciphering wet handwriting, no missed guests.</li>
            </ul>
          </div>
          <div style={{ flex: "0 1 260px", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demoQr} alt="Flukesend guest sign-up QR code" style={qrImg} />
            <div style={{ fontSize: "12.5px", color: "#8a938f", marginTop: "10px" }}>
              Go ahead, scan it.
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "54px 24px" }}>
          <h2 style={h2}>How it works</h2>
          <div style={grid3}>
            <Step n="1" title="Guests scan aboard" body="Your printed QR collects each guest's email on deck, tied to the boat and the trip time." />
            <Step n="2" title="Send from home" body="Pick the trip, drop the edited photos in, and the QR sign-ups load themselves. Ship it." />
            <Step n="3" title="Photos land in Photos" body="Guests open their branded gallery and save every shot straight to their camera roll in one tap." />
            <Step n="4" title="Reviews roll in" body="The review ask goes out that evening, branded as you, one tap from Google." />
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
  color: "#35662f",
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
  color: "#3f7a4d",
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
const qrSection: React.CSSProperties = {
  maxWidth: "1080px",
  margin: "0 auto",
  padding: "54px 24px",
  display: "flex",
  gap: "44px",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "center",
};
const qrList: React.CSSProperties = {
  margin: "18px 0 0",
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};
const qrItem: React.CSSProperties = {
  fontSize: "14.5px",
  lineHeight: 1.55,
  color: "#3a4744",
  paddingLeft: "24px",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233f7a4d' stroke-width='3'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "0 4px",
};
const qrImg: React.CSSProperties = {
  width: "100%",
  maxWidth: "240px",
  borderRadius: "18px",
  border: "1px solid #ece7dd",
  boxShadow: "0 10px 30px rgba(16,34,31,.08)",
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
