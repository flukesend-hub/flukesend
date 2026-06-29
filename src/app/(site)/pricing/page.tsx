/*
  Public pricing page. Free trial, then per operator pricing by number of boats.
  Display only: billing and trial enforcement are a separate build.
*/
import Link from "next/link";
import { Faq, type QA } from "@/app/_ui/faq";

export const metadata = { title: "Pricing - Flukesend" };

type Tier = {
  name: string;
  price: string;
  unit: string;
  blurb: string;
  features: string[];
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Single boat",
    price: "$150",
    unit: "per operator / month",
    blurb: "One boat, the full review engine.",
    features: [
      "1 boat",
      "Branded photo galleries",
      "Automatic review asks",
      "Unlimited sends",
      "Crew and boat roster",
      "Export your guest emails",
    ],
  },
  {
    name: "Two boats",
    price: "$250",
    unit: "per operator / month",
    blurb: "Run a second boat without a second account.",
    popular: true,
    features: [
      "Up to 2 boats",
      "Everything in Single boat",
      "Per boat selection on every send",
    ],
  },
  {
    name: "Fleet",
    price: "$300",
    unit: "per operator / month",
    blurb: "Unlimited boats for a busy operation.",
    features: [
      "Unlimited boats",
      "Everything in Two boats",
      "Priority support",
    ],
  },
];

const FAQ: QA[] = [
  {
    q: "Is there a free trial?",
    a: "Yes. Your first 3 transfers or 30 guest emails are free, whichever comes first. No card required to start.",
  },
  {
    q: "What counts as a transfer?",
    a: "One send to a trip's guests, however many photos or people are on it. A family of five booked under one name is one transfer.",
  },
  {
    q: "Do my guests need an account?",
    a: "No. Each guest opens a private link, views their gallery, and downloads. No login, no app to install.",
  },
  {
    q: "Who owns the guest emails?",
    a: "You do. Every email is yours to keep and export at any time. You are the sender of record; Flukesend is the processor.",
  },
  {
    q: "When does the review email go out?",
    a: "Automatically, a few hours after a guest downloads their photos. The download is the trigger, so the ask always lands warm.",
  },
  {
    q: "Can I use my own branding?",
    a: "Yes. Your logo, brand color, and message flow into every gallery and every email your guests receive.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "56px 24px 20px", textAlign: "center" }}>
        <h1 style={hero}>Simple pricing, per operator</h1>
        <p style={lede}>
          Start free, then pick the plan that fits your fleet. Every plan
          includes the full review engine.
        </p>
        <div style={trial}>
          Free trial: your first <strong>3 transfers or 30 guest emails</strong>,
          on us. No card required.
        </div>
      </section>

      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 40px" }}>
        <div style={grid}>
          {TIERS.map((t) => (
            <div key={t.name} style={{ ...tierCard, ...(t.popular ? popularCard : {}) }}>
              {t.popular ? <div style={popularTag}>Most popular</div> : null}
              <div style={{ padding: "26px 24px" }}>
                <h3 style={tierName}>{t.name}</h3>
                <p style={tierBlurb}>{t.blurb}</p>
                <div style={priceRow}>
                  <span style={price}>{t.price}</span>
                </div>
                <div style={unit}>{t.unit}</div>
                <Link href="/login" style={t.popular ? tierCtaPrimary : tierCta}>
                  Start free
                </Link>
                <ul style={featureList}>
                  {t.features.map((f) => (
                    <li key={f} style={featureItem}>
                      <span style={tick}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: "780px", margin: "0 auto", padding: "30px 24px 70px" }}>
        <h2 style={{ ...hero, fontSize: "30px", textAlign: "center", marginBottom: "26px" }}>
          Questions and answers
        </h2>
        <Faq items={FAQ} />
      </section>
    </main>
  );
}

const hero: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "clamp(30px, 5vw, 46px)",
  letterSpacing: "-0.02em",
  color: "#10221f",
  margin: 0,
};
const lede: React.CSSProperties = {
  fontSize: "16.5px",
  lineHeight: 1.6,
  color: "#3a4744",
  maxWidth: "52ch",
  margin: "16px auto 0",
};
const trial: React.CSSProperties = {
  display: "inline-block",
  marginTop: "22px",
  background: "#fbf3e0",
  border: "1px solid #ecdcb4",
  borderRadius: "999px",
  padding: "10px 18px",
  fontSize: "14px",
  color: "#7a5a17",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
  alignItems: "start",
};
const tierCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece7dd",
  borderRadius: "18px",
  overflow: "hidden",
};
const popularCard: React.CSSProperties = { border: "2px solid #0c1a21" };
const popularTag: React.CSSProperties = {
  background: "#0c1a21",
  color: "#e7b14c",
  textAlign: "center",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  padding: "7px",
};
const tierName: React.CSSProperties = { margin: 0, fontSize: "19px", fontWeight: 700, color: "#10221f" };
const tierBlurb: React.CSSProperties = { margin: "6px 0 16px", fontSize: "14px", color: "#5f6b68", minHeight: "40px" };
const priceRow: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: "6px" };
const price: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "38px",
  color: "#10221f",
};
const unit: React.CSSProperties = { fontSize: "13px", color: "#8a938f", margin: "2px 0 18px" };
const tierCta: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  fontSize: "14.5px",
  fontWeight: 600,
  color: "#10221f",
  background: "transparent",
  border: "1px solid #cfcabd",
  padding: "11px",
  borderRadius: "11px",
};
const tierCtaPrimary: React.CSSProperties = {
  ...tierCta,
  color: "#fff",
  background: "#0c1a21",
  border: "1px solid #0c1a21",
};
const featureList: React.CSSProperties = { listStyle: "none", margin: "20px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "10px" };
const featureItem: React.CSSProperties = { display: "flex", gap: "9px", fontSize: "14px", color: "#3a4744" };
const tick: React.CSSProperties = { color: "#2f8f63", fontWeight: 700, flex: "0 0 auto" };
