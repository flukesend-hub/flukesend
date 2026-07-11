"use client";

/*
  Admin support console. Three layers, top to bottom:

  1. A fleet KPI strip: this month's totals across every operator, so the
     admin's own scoreboard is the first thing on the page.
  2. A "Needs attention" triage section that only renders when an operator has
     a red flag (review engine off while sending, or bounced emails). Each card
     says what is wrong and what to do in plain words.
  3. One card per operator, accented with their brand color: health stats,
     plan control, and the support links.

  Plan changes keep the same setPlan wiring as before; paid (Stripe) operators
  show a read only label so their subscription is never touched here.
*/
import { useState, useTransition } from "react";
import { setPlan, type AdminState } from "./actions";
import type { OperatorHealth } from "@/lib/admin-health";

export type OperatorRow = {
  operatorId: string;
  name: string;
  email: string;
  paid: boolean;
  tier: string | null;
  value: string;
  health: OperatorHealth;
};

const OPTIONS = [
  { value: "trial", label: "Free trial" },
  { value: "canceled", label: "No plan (must buy)" },
  { value: "fleet", label: "Comp: full plan" },
];

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// A red flag puts the operator in the triage section; quiet gaps just show as
// chips on their card. "Review engine off" only fires when they are actually
// sending: photos going out with no review link means no ask can ever fire.
// An operator with no sign-in owner is a demo tenant (it powers the public
// sample gallery, deliberately wearing a real crew's branding). Demos never
// enter triage: their review engine being off is intentional, not a problem.
function isDemo(r: OperatorRow): boolean {
  return !r.email;
}

type Triage = { title: string; fix: string; action: string; anchor: string };

function triageFor(r: OperatorRow): Triage[] {
  if (isDemo(r)) return [];
  const h = r.health;
  const out: Triage[] = [];
  if (h.totalSends > 0 && !h.hasReviewLinks) {
    out.push({
      title: `${r.name} · Review engine off`,
      fix: "Sending photos but no review links are set, so no review ask can ever fire. Add their Google review link.",
      action: "Add review links",
      anchor: "review-links",
    });
  }
  if (h.bounced > 0) {
    out.push({
      title: `${r.name} · ${h.bounced} ${h.bounced === 1 ? "email" : "emails"} bounced`,
      fix: `Never delivered: ${h.bouncedEmails.join(", ")}. Correct and resend in one step.`,
      action: "Fix and resend",
      anchor: "bounced",
    });
  }
  return out;
}

export function AdminOperators({ rows }: { rows: OperatorRow[] }) {
  const [state, setState] = useState<AdminState>(undefined);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, start] = useTransition();

  function change(operatorId: string, plan: string) {
    setState(undefined);
    setSavingId(operatorId);
    start(async () => {
      const r = await setPlan(operatorId, plan);
      setState(r);
      setSavingId(null);
    });
  }

  // Demo tenants are not customers: they stay out of the count, the KPI math,
  // and the cards, reachable only through the quiet footnote below.
  const real = rows.filter((r) => !isDemo(r));
  const demos = rows.filter(isDemo);

  // Fleet totals for the KPI strip, this month, real operators only.
  const fleet = real.reduce(
    (t, r) => {
      t.sends += r.health.sendsThisMonth;
      t.sendsPrev += r.health.sendsLastMonth;
      t.reached += r.health.reached;
      t.downloaded += r.health.downloaded;
      t.clicks += r.health.reviewClicks;
      t.bounced += r.health.bounced;
      return t;
    },
    { sends: 0, sendsPrev: 0, reached: 0, downloaded: 0, clicks: 0, bounced: 0 },
  );
  const triage = real.flatMap((r) => triageFor(r).map((t) => ({ ...t, row: r })));
  const delta = fleet.sends - fleet.sendsPrev;
  const prevMonth = new Date(Date.now() - 31 * 24 * 3600 * 1000).toLocaleDateString("en-US", {
    month: "short",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: 0 }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: 0 }}>{state.ok}</p>
      ) : null}

      {/* This month across the fleet. Zeros render muted: a healthy nothing
          should not compete with real numbers for attention. */}
      <div>
        <h3 style={sectionH}>This month</h3>
        <div style={kpiGrid}>
          <Kpi
            n={String(fleet.sends)}
            label="Sends"
            sub={delta === 0 ? `same as ${prevMonth}` : `${delta > 0 ? "+" : ""}${delta} vs ${prevMonth}`}
          />
          <Kpi n={String(fleet.reached)} label="Reached" />
          <Kpi n={`${pct(fleet.downloaded, fleet.reached)}%`} label="Downloaded" />
          <Kpi n={String(fleet.clicks)} label="Review clicks" />
          <Kpi n={String(fleet.bounced)} label="Bounced" alert={fleet.bounced > 0} />
        </div>
      </div>

      {/* Triage when something is wrong; a quiet all-clear when nothing is. */}
      {triage.length ? (
        <div>
          <h3 style={sectionH}>
            Needs attention
            <span style={countBadge}>{triage.length}</span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {triage.map((t) => (
              <div key={t.title} style={triageCard}>
                <Avatar name={t.row.name} color={t.row.health.brandColor} />
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "13.5px" }}>{t.title}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px", lineHeight: 1.5, overflowWrap: "anywhere" }}>
                    {t.fix}
                  </div>
                </div>
                <a href={`/admin/operators/${t.row.operatorId}#${t.anchor}`} style={triageBtn}>
                  {t.action}
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={allClear}>
          <span style={{ color: "var(--good)", fontWeight: 700 }}>{"✓"}</span> All clear.
          Nothing needs you.
        </p>
      )}

      {/* Operator cards, real customers only */}
      <div>
        <h3 style={sectionH}>
          Operators
          <span style={{ color: "var(--muted-2)", fontWeight: 600 }}>{real.length}</span>
        </h3>
        <div style={cardGrid}>
          {real.map((r) => (
            <OperatorCard
              key={r.operatorId}
              row={r}
              saving={savingId === r.operatorId}
              onPlan={(plan) => change(r.operatorId, plan)}
            />
          ))}
        </div>
        {/* Demo tenants stay reachable through one quiet link; the full
            do-not-delete story lives on their own support page. */}
        {demos.length ? (
          <p style={{ fontSize: "12px", color: "var(--muted-2)", margin: "12px 0 0" }}>
            {demos.map((d, i) => (
              <span key={d.operatorId}>
                {i > 0 ? " · " : ""}
                <a href={`/admin/operators/${d.operatorId}`} className="fl-link">
                  {demos.length === 1 ? "1 demo tenant hidden" : d.name}
                </a>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OperatorCard({
  row: r,
  saving,
  onPlan,
}: {
  row: OperatorRow;
  saving: boolean;
  onPlan: (plan: string) => void;
}) {
  const h = r.health;
  const demo = isDemo(r);
  const band = h.brandColor ?? "var(--line-strong)";
  // Demos skip the gap chips: their missing pieces are by design.
  const quietGaps: string[] = [];
  if (!demo) {
    if (h.totalSends === 0) quietGaps.push("No sends yet");
    if (h.totalSends === 0 && !h.hasReviewLinks) quietGaps.push("No review links");
    if (!h.hasLogo) quietGaps.push("No logo");
  }

  return (
    <div className="fl-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* The header band is the operator's real brand: their color, their
          logo, same as their gallery and emails. Logos are made for this
          band (many are white), which is why they cannot sit on the card. */}
      {h.logoUrl ? (
        <div style={{ background: band, padding: "12px 17px", display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.logoUrl}
            alt=""
            style={{ height: "22px", width: "auto", maxWidth: "70%", objectFit: "contain", display: "block" }}
          />
        </div>
      ) : (
        <div style={{ height: "5px", background: band }} />
      )}
      <div style={{ padding: "14px 17px", flex: 1 }}>
        <div style={{ display: "flex", gap: "11px", alignItems: "center" }}>
          {h.logoUrl ? null : <Avatar name={r.name} color={h.brandColor} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "14.5px", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
              {r.name}
              {demo ? <span style={chipMuted}>Demo tenant</span> : null}
              {/* Today's QR sign-ups, hidden entirely until there is at least
                  one, so it reads as a live pulse and never as an empty zero. */}
              {h.qrToday > 0 ? (
                <span style={chipGood}>
                  {h.qrToday} QR sign-up{h.qrToday === 1 ? "" : "s"} today
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--muted-2)", overflowWrap: "anywhere" }}>
              {demo
                ? "Powers the homepage sample gallery. No login. Not a customer."
                : r.email}
            </div>
          </div>
        </div>

        <div style={statGrid}>
          <Stat n={String(h.sendsThisMonth)} label={h.sendsThisMonth === 1 ? "Send" : "Sends"} />
          <Stat n={String(h.reached)} label="Reached" />
          <Stat
            n={`${pct(h.downloaded, h.reached)}%`}
            label="Downloaded"
            // Amber only when guests were reached and few are downloading;
            // a normal rate stays plain, nothing is green for existing.
            warn={h.reached > 0 && pct(h.downloaded, h.reached) < 30}
          />
          <Stat n={String(h.reviewClicks)} label="Review clicks" />
        </div>

        {!demo && (h.bounced > 0 || (h.totalSends > 0 && !h.hasReviewLinks) || quietGaps.length) ? (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px" }}>
            {h.totalSends > 0 && !h.hasReviewLinks ? <span style={chipBad}>Review engine off</span> : null}
            {h.bounced > 0 ? <span style={chipBad}>{h.bounced} bounced</span> : null}
            {quietGaps.map((g) => (
              <span key={g} style={chipMuted}>
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer reads left to right as fact, rare control, frequent action:
          last send, then the quiet plan select, then Settings. */}
      <div style={cardFoot}>
        <span style={{ fontSize: "11.5px", color: "var(--muted-2)", flex: "1 1 auto" }}>
          {h.lastSendAt ? `Last send ${fmtDay(h.lastSendAt)}` : "Never sent"}
        </span>
        {r.paid ? (
          <span style={{ color: "var(--muted)", fontSize: "12px", flex: "0 0 auto" }}>Paid ({r.tier})</span>
        ) : (
          <select
            aria-label="Plan"
            value={r.value}
            disabled={saving}
            onChange={(e) => onPlan(e.target.value)}
            style={planSelect}
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <a href={`/admin/operators/${r.operatorId}`} style={settingsLink}>
          Settings
        </a>
      </div>
    </div>
  );
}

// Color is for exceptions only: alerts go red, healthy zeros recede to gray,
// everything else stays plain ink.
function Kpi({ n, label, sub, alert }: { n: string; label: string; sub?: string; alert?: boolean }) {
  const zero = n === "0" || n === "0%";
  return (
    <div className="fl-card" style={{ padding: "11px 14px" }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: "20px",
          lineHeight: 1.15,
          fontVariantNumeric: "tabular-nums",
          color: alert ? "var(--bad)" : zero ? "var(--muted-2)" : "var(--text)",
        }}
      >
        {n}
      </div>
      <div style={kpiLabel}>{label}</div>
      {sub ? (
        <div style={{ fontSize: "11px", color: "var(--muted-2)", marginTop: "2px" }}>{sub}</div>
      ) : null}
    </div>
  );
}

function Stat({ n, label, warn }: { n: string; label: string; warn?: boolean }) {
  const zero = n === "0" || n === "0%";
  return (
    <div>
      <div
        style={{
          fontWeight: 700,
          fontSize: "15.5px",
          fontVariantNumeric: "tabular-nums",
          color: warn ? "#8a6d1f" : zero ? "var(--muted-2)" : "var(--text)",
        }}
      >
        {n}
      </div>
      <div style={kpiLabel}>{label}</div>
    </div>
  );
}

// Brand colored square with the operator's initial. Falls back to a neutral
// tone when no brand color is set (a quiet onboarding nudge in itself).
function Avatar({ name, color }: { name: string; color: string | null }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "38px",
        height: "38px",
        borderRadius: "11px",
        background: color ?? "#8a938f",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: "15px",
        flex: "0 0 auto",
      }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

const kpiGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: "10px",
};
const kpiLabel: React.CSSProperties = {
  fontSize: "10.5px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted-2)",
  fontWeight: 600,
  marginTop: "3px",
};
const sectionH: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: "13px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--muted)",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};
const countBadge: React.CSSProperties = {
  background: "var(--bad)",
  color: "#fff",
  fontSize: "11px",
  borderRadius: "999px",
  padding: "1px 8px",
};
const triageCard: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid rgba(194,83,63,.26)",
  borderLeft: "4px solid var(--bad)",
  borderRadius: "14px",
  padding: "13px 16px",
  display: "flex",
  gap: "13px",
  alignItems: "center",
  flexWrap: "wrap",
};
const triageBtn: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  padding: "8px 14px",
  borderRadius: "9px",
  flex: "0 0 auto",
};
const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
  gap: "13px",
};
const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px 14px",
  marginTop: "13px",
};
const cardFoot: React.CSSProperties = {
  borderTop: "1px solid var(--line)",
  padding: "10px 17px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};
// The plan changes maybe once per operator ever, so the control whispers: a
// borderless select that reads as text until you need it.
const planSelect: React.CSSProperties = {
  font: "inherit",
  fontSize: "12px",
  color: "var(--muted)",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: "7px",
  padding: "4px 2px",
  cursor: "pointer",
  maxWidth: "140px",
  flex: "0 0 auto",
};
const settingsLink: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "var(--signal-2)",
  border: "1px solid var(--line-strong)",
  borderRadius: "8px",
  padding: "5px 12px",
  flex: "0 0 auto",
};
const allClear: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  color: "var(--muted)",
  display: "flex",
  alignItems: "center",
  gap: "7px",
};
const chipBad: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--bad)",
  background: "rgba(194,83,63,.10)",
  border: "1px solid rgba(194,83,63,.28)",
  borderRadius: "999px",
  padding: "2px 9px",
};
const chipGood: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--good)",
  background: "rgba(47,143,99,.10)",
  border: "1px solid rgba(47,143,99,.28)",
  borderRadius: "999px",
  padding: "2px 9px",
};
const chipMuted: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 600,
  color: "var(--muted)",
  background: "var(--ink)",
  border: "1px solid var(--line-strong)",
  borderRadius: "999px",
  padding: "2px 9px",
};
