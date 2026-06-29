"use client";

/*
  Pricing cards with a monthly / yearly toggle. Yearly is two months free (pay
  for ten), shown as the monthly equivalent with the annual total. Display only;
  no checkout is wired yet.
*/
import { useState } from "react";
import Link from "next/link";

type Tier = {
  name: string;
  monthly: number;
  annualMonthly: number;
  annualTotal: number;
  blurb: string;
  features: string[];
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Single boat",
    monthly: 150,
    annualMonthly: 125,
    annualTotal: 1500,
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
    monthly: 250,
    annualMonthly: 208,
    annualTotal: 2500,
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
    monthly: 300,
    annualMonthly: 250,
    annualTotal: 3000,
    blurb: "Unlimited boats for a busy operation.",
    features: ["Unlimited boats", "Everything in Two boats", "Priority support"],
  },
];

export function PricingTable() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", margin: "26px 0 0" }}>
        <div style={toggleWrap}>
          <button onClick={() => setYearly(false)} style={seg(!yearly)}>
            Monthly
          </button>
          <button onClick={() => setYearly(true)} style={seg(yearly)}>
            Yearly
          </button>
        </div>
        <span style={saveTag}>2 months free</span>
      </div>

      <div style={grid}>
        {TIERS.map((t) => (
          <div key={t.name} style={{ ...tierCard, ...(t.popular ? popularCard : {}) }}>
            {t.popular ? <div style={popularTag}>Most popular</div> : null}
            <div style={{ padding: "26px 24px" }}>
              <h3 style={tierName}>{t.name}</h3>
              <p style={tierBlurb}>{t.blurb}</p>
              <div style={priceRow}>
                <span style={price}>${yearly ? t.annualMonthly : t.monthly}</span>
                <span style={{ fontSize: "14px", color: "#8a938f" }}>/mo</span>
              </div>
              <div style={unit}>
                {yearly
                  ? `per operator, billed annually ($${t.annualTotal.toLocaleString()}/yr)`
                  : "per operator / month"}
              </div>
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
    </>
  );
}

const toggleWrap: React.CSSProperties = {
  display: "inline-flex",
  background: "#ece8df",
  borderRadius: "999px",
  padding: "4px",
};
function seg(active: boolean): React.CSSProperties {
  return {
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    border: 0,
    borderRadius: "999px",
    padding: "8px 18px",
    cursor: "pointer",
    color: active ? "#fff" : "#5f6b68",
    background: active ? "#0c1a21" : "transparent",
  };
}
const saveTag: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#7a5a17",
  background: "#fbf3e0",
  border: "1px solid #ecdcb4",
  borderRadius: "999px",
  padding: "5px 11px",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
  alignItems: "start",
  marginTop: "28px",
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
const priceRow: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: "4px" };
const price: React.CSSProperties = {
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "38px",
  color: "#10221f",
};
const unit: React.CSSProperties = { fontSize: "13px", color: "#8a938f", margin: "2px 0 18px", minHeight: "32px" };
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
