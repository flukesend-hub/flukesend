/*
  Analytics presentation. The current month funnel shows for everyone, drawn as
  shrinking bars so the drop off between stages is visible at a glance. Recent
  sends, trend, breakdowns, and CSV export are full plan only; basic plans see
  an upgrade card in their place. No client state here, so this renders on the
  server.
*/
import type { Analytics, DeliveryRow, Funnel, GroupRow, TrendPoint } from "@/lib/analytics";

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function AnalyticsView({
  data,
  recentSends,
  isFull,
  planName,
}: {
  data: Analytics;
  recentSends: DeliveryRow[];
  isFull: boolean;
  planName: string;
}) {
  return (
    <div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "22px" }}>
      <FunnelBars month={data.month} />

      {isFull ? (
        <>
          <RecentSends rows={recentSends} />
          <Trend trend={data.trend} months={data.windowMonths} />
          <Breakdown title="By boat" rows={data.byBoat} last={data.windowMonths} />
          <Breakdown
            title="By photographer"
            rows={data.byPhotographer}
            last={data.windowMonths}
            empty="No sends with a photographer credited in this window yet. Tag a photographer under Crew mentions on a send."
          />
          <div>
            <a href="/api/export/analytics" className="fl-btn" style={{ textDecoration: "none" }}>
              Export CSV
            </a>
            <span style={{ marginLeft: "12px", fontSize: "12.5px", color: "var(--muted-2)" }}>
              Every send with its guests, opens, downloads, and review asks.
            </span>
          </div>
        </>
      ) : (
        <div className="fl-card" style={{ borderColor: "rgba(63,122,77,.45)", background: "rgba(63,122,77,.10)" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600 }}>
            See trends and breakdowns
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.5 }}>
            Your {planName} plan shows this month&apos;s totals. Upgrade to Offshore
            for month by month trends, per boat and per photographer breakdowns,
            and CSV export.
          </p>
          <a href="/billing" className="fl-btn" style={{ textDecoration: "none" }}>
            See plans
          </a>
        </div>
      )}
    </div>
  );
}

// The month at a glance: two small side stats, then the guest funnel drawn as
// shrinking bars. Each stage shows its count and its share of the stage above,
// so the leak between any two steps reads without any mental math.
function FunnelBars({ month }: { month: Funnel }) {
  const stages = [
    { label: "Guests reached", short: "reached", value: month.reached },
    { label: "Opened the gallery", short: "opened", value: month.opened },
    { label: "Downloaded photos", short: "downloaded", value: month.downloaded },
    { label: "Review asks sent", short: "asks", value: month.reviewAsks },
    { label: "Clicked a review link", short: "clicks", value: month.reviewClicks },
  ];
  const max = Math.max(1, month.reached);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", maxWidth: "420px" }}>
        {[
          { label: "Sends", value: month.sends },
          { label: "Captured by QR", value: month.captured },
        ].map((t) => (
          <div key={t.label} className="fl-card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "5px" }}>{t.label}</div>
            <div className="fl-display" style={{ fontSize: "26px", lineHeight: 1 }}>{t.value}</div>
          </div>
        ))}
      </div>
      <div className="fl-card">
        <h3 style={sectionH}>From reached to reviewed</h3>
        <p className="fl-hint" style={{ margin: "0 0 16px" }}>
          Every guest this month, step by step. Where a bar shrinks is where
          guests drop out.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {stages.map((s, i) => {
            const prev = i > 0 ? stages[i - 1] : null;
            const width = Math.max(month.reached ? 2 : 0, (s.value / max) * 100);
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "150px", fontSize: "12.5px", color: "var(--muted)", flex: "0 0 auto" }}>
                  {s.label}
                </div>
                <div style={{ flex: 1, height: "28px", background: "var(--ink)", borderRadius: "7px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${width}%`,
                      height: "100%",
                      background: "var(--signal)",
                      opacity: 1 - i * 0.13,
                      borderRadius: "7px",
                    }}
                  />
                </div>
                <div style={{ width: "128px", flex: "0 0 auto", textAlign: "right" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>{s.value}</span>
                  {prev ? (
                    <span style={{ fontSize: "11.5px", color: "var(--muted-2)", marginLeft: "6px" }}>
                      {pct(s.value, prev.value)}% of {prev.short}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// One row per send, newest first: the "which trip's gallery flopped" view.
function RecentSends({ rows }: { rows: DeliveryRow[] }) {
  return (
    <div className="fl-card">
      <h3 style={sectionH}>Recent sends</h3>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        The last {rows.length ? rows.length : "few"} sends, one row per trip.
        The full history is in the CSV export.
      </p>
      {rows.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={th}>Date</th>
                <th style={th}>Boat</th>
                <th style={thNum}>Guests</th>
                <th style={thNum}>Opened</th>
                <th style={thNum}>Downloaded</th>
                <th style={thNum}>Download rate</th>
                <th style={thNum}>Review clicks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.date}:${r.boat}:${i}`} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={td}>{r.date}</td>
                  <td style={td}>{r.boat}</td>
                  <td style={tdNum}>{r.guests}</td>
                  <td style={tdNum}>{r.opened}</td>
                  <td style={tdNum}>{r.downloaded}</td>
                  <td style={tdNum}>{pct(r.downloaded, r.guests)}%</td>
                  <td style={tdNum}>{r.reviewClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: 0 }}>No sends yet.</p>
      )}
    </div>
  );
}

function Trend({ trend, months }: { trend: TrendPoint[]; months: number }) {
  const max = Math.max(1, ...trend.map((p) => p.reached));
  return (
    <div className="fl-card">
      <h3 style={sectionH}>Trend</h3>
      <p className="fl-hint" style={{ margin: "0 0 16px" }}>
        Guests reached and photos downloaded, last {months} months.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {trend.map((p) => (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "68px", fontSize: "12px", color: "var(--muted)", flex: "0 0 auto" }}>{p.label}</div>
            <div style={{ flex: 1, position: "relative", height: "22px", background: "var(--ink)", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${(p.reached / max) * 100}%`, background: "var(--panel-2)", borderRadius: "6px" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(p.downloaded / max) * 100}%`, background: "var(--signal)", borderRadius: "6px" }} />
            </div>
            <div style={{ width: "112px", fontSize: "12px", color: "var(--muted-2)", flex: "0 0 auto", textAlign: "right" }}>
              {p.reached} reached, {p.downloaded} dl
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  last,
  empty = "No sends in this window yet.",
}: {
  title: string;
  rows: GroupRow[];
  last: number;
  empty?: string;
}) {
  return (
    <div className="fl-card">
      <h3 style={sectionH}>{title}</h3>
      <p className="fl-hint" style={{ margin: "0 0 14px" }}>
        Last {last} months.
      </p>
      {rows.length ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={thNum}>Sends</th>
              <th style={thNum}>Reached</th>
              <th style={thNum}>Downloaded</th>
              <th style={thNum}>Download rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={td}>{r.name}</td>
                <td style={tdNum}>{r.sends}</td>
                <td style={tdNum}>{r.reached}</td>
                <td style={tdNum}>{r.downloaded}</td>
                <td style={tdNum}>{pct(r.downloaded, r.reached)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="fl-hint" style={{ margin: 0 }}>{empty}</p>
      )}
    </div>
  );
}

const sectionH: React.CSSProperties = { margin: "0 0 2px", fontSize: "15px", fontWeight: 600 };
const th: React.CSSProperties = { padding: "6px 8px 8px 0", fontWeight: 500 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "8px 8px 8px 0", color: "var(--text)" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", color: "var(--text-2)" };
