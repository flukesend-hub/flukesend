/*
  The full walkthrough. Six real screenshots carry the page: the QR card, the
  guest sign-up form, the send page, the delivery email, the gallery, and the
  review ask. Every screen is the actual product with a real operator's
  branding, captured from the same code paths guests and operators use, so the
  page is proof, not promises. Copy stays short; the screens do the talking.
*/
import Link from "next/link";

export const metadata = {
  title: "How Flukesend works - the full walkthrough",
  description:
    "From the QR scan on deck to the review on Google, every screen of a Flukesend delivery, shown for real.",
};

const CALL_URL = "https://calendly.com/flukesend/30min";

export default function HowItWorksPage() {
  return (
    <main>
      {/* Hero: set the frame, then get out of the way */}
      <section style={{ maxWidth: "820px", margin: "0 auto", padding: "52px 24px 8px", textAlign: "center" }}>
        <div style={eyebrow}>The full walkthrough</div>
        <h1 style={hero}>From the boat to the review</h1>
        <p style={{ ...lede, margin: "18px auto 0" }}>
          You take the photos. Flukesend handles everything after: the guest
          list, the delivery, the gallery, and the review ask. Every screen
          below is the real product, not a mockup.
        </p>
      </section>

      {/* Step 1: the QR card and the guest's phone, side by side */}
      <Step
        n="1"
        title="Guests scan aboard"
        body="Print your sign-up QR once and post it on deck. Guests scan it on their own phones, pick their trip time, and type their own email. No clipboards, no wet handwriting, no missed guests."
      >
        <div style={pairRow}>
          <figure style={figWide}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/walkthrough/qr-card.png" alt="The guest sign-up QR card in Flukesend settings" style={shotCard} loading="lazy" />
            <figcaption style={caption}>Your QR card, in Settings. Save it to your phone or print it.</figcaption>
          </figure>
          <figure style={figPhone}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/walkthrough/qr-form.png" alt="The sign-up form a guest sees after scanning, in the operator's branding" style={shotPhone} loading="lazy" />
            <figcaption style={caption}>What guests see when they scan. Your brand, three fields, done.</figcaption>
          </figure>
        </div>
      </Step>

      {/* Step 2: the send page, the operator's whole evening in one screen */}
      <Step
        n="2"
        title="Send from home"
        body="Back on land, pick the trip and the sign-ups load themselves. Drop the edited photos in, add any emails collected on paper, and press send. That is the whole job."
      >
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/walkthrough/send-page.png" alt="The Flukesend send page with photos, species, and the guest list loaded from QR sign-ups" style={shotCard} loading="lazy" />
          <figcaption style={caption}>
            The send page: trip details, the photo set, and the guest list already waiting.
          </figcaption>
        </figure>
      </Step>

      {/* Step 3: what lands in the guest's pocket */}
      <Step
        n="3"
        title="Photos land in their pocket"
        body="Each guest gets a branded email with a private link to their gallery. One tap saves every shot to their camera roll. It looks like you the whole way, because it is your brand on every screen."
      >
        <div style={pairRow}>
          <figure style={figWide}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/walkthrough/delivery-email.png" alt="The branded delivery email with a View your photos button" style={shotCard} loading="lazy" />
            <figcaption style={caption}>The delivery email, in the operator&apos;s colors with the trip details.</figcaption>
          </figure>
          <figure style={figPhone}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/walkthrough/gallery.jpg" alt="A branded guest gallery of orca photos with download buttons" style={shotPhone} loading="lazy" />
            <figcaption style={caption}>The gallery on the guest&apos;s phone. Real photos from a real trip.</figcaption>
          </figure>
        </div>
      </Step>

      {/* Step 4: the payoff */}
      <Step
        n="4"
        title="The review ask arrives at the perfect moment"
        body="The instant a guest downloads their photos, they get a warm thank you with one tap buttons to your review pages. They are holding the best photo of their whale when the ask lands. That is why it works."
      >
        <figure style={{ margin: "0 auto", maxWidth: "620px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marketing/walkthrough/review-email.png" alt="The review ask email with a Leave us a Google Review button" style={shotCard} loading="lazy" />
          <figcaption style={caption}>
            Sent automatically on download. Every guest is asked, every ask is tracked.
          </figcaption>
        </figure>
      </Step>

      {/* Close the loop and go */}
      <section style={{ maxWidth: "820px", margin: "0 auto", padding: "18px 24px 64px", textAlign: "center" }}>
        <h2 style={h2}>That is the whole flow</h2>
        <p style={{ color: "#5f6b68", fontSize: "16px", margin: "0 auto 22px", maxWidth: "46ch" }}>
          Scan, send, deliver, ask. Set up your branding once and every trip
          after that builds your reputation on its own.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" style={primaryBtn}>
            Start free
          </Link>
          <a href={CALL_URL} target="_blank" rel="noreferrer" style={secondaryBtn}>
            Book a call
          </a>
        </div>
        <p style={{ fontSize: "13px", color: "#8a938f", margin: "14px 0 0" }}>
          Your first 3 transfers or 30 guest emails are free. No card required.
        </p>
      </section>
    </main>
  );
}

// One numbered step: header block centered, then the screenshot(s) below.
function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section style={stepWrap}>
      <div style={{ maxWidth: "640px", margin: "0 auto 26px", textAlign: "center" }}>
        <div style={stepNum}>{n}</div>
        <h2 style={{ ...h2, margin: "14px 0 10px" }}>{title}</h2>
        <p style={{ fontSize: "15.5px", lineHeight: 1.65, color: "#3a4744", margin: 0 }}>{body}</p>
      </div>
      {children}
    </section>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#1c5578",
  fontWeight: 600,
};
const hero: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(32px, 5vw, 50px)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  margin: "14px 0 0",
  color: "#10221f",
};
const lede: React.CSSProperties = {
  fontSize: "17px",
  lineHeight: 1.6,
  color: "#3a4744",
  maxWidth: "54ch",
};
const h2: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(24px, 3.5vw, 32px)",
  letterSpacing: "-0.01em",
  color: "#10221f",
  margin: 0,
};
const stepWrap: React.CSSProperties = {
  maxWidth: "1080px",
  margin: "0 auto",
  padding: "44px 24px 10px",
};
const stepNum: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "#0c1a21",
  color: "#1f6f9c",
  display: "inline-grid",
  placeItems: "center",
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "16px",
};
// Two shots side by side; wraps to a column on phones.
const pairRow: React.CSSProperties = {
  display: "flex",
  gap: "26px",
  alignItems: "flex-start",
  justifyContent: "center",
  flexWrap: "wrap",
};
const figWide: React.CSSProperties = { flex: "1 1 420px", minWidth: 0, maxWidth: "640px", margin: 0 };
const figPhone: React.CSSProperties = { flex: "0 1 320px", margin: 0 };
// Desktop screens and emails sit in a soft card; phone screens get the
// tighter rounding of the homepage phone mock.
const shotCard: React.CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block",
  borderRadius: "16px",
  border: "1px solid #ece7dd",
  boxShadow: "0 14px 36px rgba(16,34,31,.10)",
};
const shotPhone: React.CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block",
  borderRadius: "26px",
  border: "1px solid #e3ddd0",
  boxShadow: "0 18px 44px rgba(16,34,31,.12)",
};
const caption: React.CSSProperties = {
  fontSize: "12.5px",
  color: "#8a938f",
  textAlign: "center",
  marginTop: "10px",
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
