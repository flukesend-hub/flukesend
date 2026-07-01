"use client";

/*
  Plan picker, dark workspace. Monthly / yearly toggle, three tier cards. A
  subscribe button starts Stripe Checkout; an active operator gets a Manage
  billing button to the Stripe portal. Current plan is marked.
*/
import { useState } from "react";
import { PLANS } from "@/lib/plans";
import { createCheckoutSession, createPortalSession } from "./actions";

type Tier = "single" | "two" | "fleet";

// Names and the emails-per-month line come from the plan catalog; prices stay
// here alongside the checkout call. Boats are unlimited on every plan now.
function emailsLine(key: Tier): string {
  const per = PLANS[key].emailsPerMonth;
  return per === null ? "Unlimited emails / month" : `${per} emails / month`;
}

const TIERS: {
  key: Tier;
  name: string;
  boats: string;
  monthly: number;
  yearlyMonthly: number;
  yearlyTotal: number;
  popular?: boolean;
}[] = [
  { key: "single", name: PLANS.single.displayName, boats: emailsLine("single"), monthly: 150, yearlyMonthly: 125, yearlyTotal: 1500 },
  { key: "two", name: PLANS.two.displayName, boats: emailsLine("two"), monthly: 250, yearlyMonthly: 208, yearlyTotal: 2500, popular: true },
  { key: "fleet", name: PLANS.fleet.displayName, boats: emailsLine("fleet"), monthly: 300, yearlyMonthly: 250, yearlyTotal: 3000 },
];

export function BillingClient({
  status,
  tier,
  cycle,
}: {
  status: "trial" | "active" | "canceled";
  tier: Tier | null;
  cycle: "monthly" | "yearly" | null;
}) {
  const [yearly, setYearly] = useState(cycle === "yearly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = status === "active";

  async function subscribe(t: Tier) {
    setBusy(t);
    setError(null);
    const res = await createCheckoutSession(t, yearly ? "yearly" : "monthly");
    if ("error" in res) {
      setError(res.error);
      setBusy(null);
      return;
    }
    window.location.href = res.url;
  }

  async function manage() {
    setBusy("manage");
    setError(null);
    const res = await createPortalSession();
    if ("error" in res) {
      setError(res.error);
      setBusy(null);
      return;
    }
    window.location.href = res.url;
  }

  return (
    <div style={{ marginTop: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={toggleWrap}>
          <button onClick={() => setYearly(false)} style={seg(!yearly)}>
            Monthly
          </button>
          <button onClick={() => setYearly(true)} style={seg(yearly)}>
            Yearly
          </button>
        </div>
        <span style={saveTag}>2 months free</span>
        {active ? (
          <button onClick={manage} disabled={busy === "manage"} className="fl-btn-ghost" style={{ marginLeft: "auto" }}>
            {busy === "manage" ? "Opening..." : "Manage billing"}
          </button>
        ) : null}
      </div>

      <div style={grid}>
        {TIERS.map((t) => {
          const isCurrent = active && tier === t.key && (cycle === "yearly") === yearly;
          return (
            <div key={t.key} style={{ ...card, ...(t.popular ? popular : {}) }}>
              {t.popular ? <div style={popTag}>Most popular</div> : null}
              <div style={{ padding: "22px" }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>{t.name}</h3>
                <div style={{ fontSize: "13px", color: "var(--muted-2)", margin: "3px 0 14px" }}>{t.boats}</div>
                <div className="fl-display" style={{ fontSize: "32px" }}>
                  ${yearly ? t.yearlyMonthly : t.monthly}
                  <span style={{ fontSize: "13px", color: "var(--muted)", fontFamily: "inherit", fontWeight: 400 }}> /mo</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted-2)", margin: "2px 0 16px", minHeight: "30px" }}>
                  {yearly ? `billed $${t.yearlyTotal.toLocaleString()} a year` : "billed monthly"}
                </div>
                {isCurrent ? (
                  <div style={currentBtn}>Current plan</div>
                ) : (
                  <button onClick={() => subscribe(t.key)} disabled={busy === t.key} className="fl-btn" style={{ width: "100%" }}>
                    {busy === t.key ? "Starting..." : active ? "Switch to this" : "Subscribe"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p style={{ color: "var(--bad)", fontSize: "13px", marginTop: "14px" }}>{error}</p> : null}
    </div>
  );
}

const toggleWrap: React.CSSProperties = {
  display: "inline-flex",
  background: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "999px",
  padding: "4px",
};
function seg(active: boolean): React.CSSProperties {
  return {
    font: "inherit",
    fontSize: "13.5px",
    fontWeight: 600,
    border: 0,
    borderRadius: "999px",
    padding: "7px 16px",
    cursor: "pointer",
    color: active ? "var(--signal-ink)" : "var(--muted)",
    background: active ? "var(--signal)" : "transparent",
  };
}
const saveTag: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--signal)",
  border: "1px solid var(--signal)",
  borderRadius: "999px",
  padding: "4px 10px",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
  alignItems: "start",
};
const card: React.CSSProperties = {
  background: "linear-gradient(180deg,var(--panel),var(--panel) 60%,var(--ink-2))",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  overflow: "hidden",
};
const popular: React.CSSProperties = { border: "2px solid var(--signal)" };
const popTag: React.CSSProperties = {
  background: "var(--signal)",
  color: "var(--signal-ink)",
  textAlign: "center",
  fontSize: "12px",
  fontWeight: 600,
  padding: "6px",
};
const currentBtn: React.CSSProperties = {
  textAlign: "center",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--muted)",
  border: "1px solid var(--line-strong)",
  borderRadius: "11px",
  padding: "12px",
};
