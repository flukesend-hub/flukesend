/*
  Public operators showcase: the real crews running Flukesend, with their real
  logos (snapshotted into public/operators so this page never depends on live
  branding files). Linked from the nav and footer and sent in outreach emails,
  so keep it honest: no fictional operators, no invented numbers.
*/
import Link from "next/link";

export const metadata = { title: "Operators - Flukesend" };

type Op = {
  name: string;
  place: string;
  line: string;
  color: string;
  logo: string;
  site: string;
};

const OPERATORS: Op[] = [
  {
    name: "Enocean Tours",
    place: "Moss Landing, CA",
    line: "Premium 6 passenger vessel out of Moss Landing, CA.",
    color: "#0c1a21",
    logo: "/operators/enocean-tours.jpg",
    site: "https://www.enoceantours.com/",
  },
  {
    name: "Princess Whale Watching",
    place: "Monterey, CA",
    line: "Year-round whale watching out of Monterey's Old Fisherman's Wharf.",
    color: "#2c2f6d",
    logo: "/operators/princess-whale-watching.png",
    site: "https://montereywhalewatching.com/",
  },
];

export default function OperatorsPage() {
  return (
    <main>
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "56px 24px 20px", textAlign: "center" }}>
        <h1 style={hero}>Operators who Flukesend</h1>
        <p style={lede}>
          These operators deliver their guests&apos; photos and grow their
          reviews with Flukesend, every trip.
        </p>
      </section>

      <section style={{ maxWidth: "760px", margin: "0 auto", padding: "20px 24px 30px" }}>
        <div style={grid}>
          {OPERATORS.map((op) => (
            <div key={op.name} style={card}>
              <div style={{ ...band, background: op.color }} />
              <div style={logoBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={op.logo} alt={`${op.name} logo`} style={logoImg} />
              </div>
              <div style={{ padding: "0 22px 24px", textAlign: "center" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#10221f" }}>{op.name}</h3>
                <div style={{ fontSize: "13px", color: "#8a938f", margin: "3px 0 10px" }}>{op.place}</div>
                <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6, color: "#5f6b68" }}>{op.line}</p>
                <a href={op.site} target="_blank" rel="noopener noreferrer" style={siteLink}>
                  {op.site.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "30px 24px 70px", textAlign: "center" }}>
        <h2 style={{ ...hero, fontSize: "30px", marginBottom: "10px" }}>Put your operation here</h2>
        <p style={{ color: "#5f6b68", fontSize: "16px", margin: "0 auto 22px", maxWidth: "42ch" }}>
          Start free and ship your first branded gallery this week.
        </p>
        <Link href="/login" style={primaryBtn}>
          Get started
        </Link>
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
  maxWidth: "54ch",
  margin: "16px auto 0",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ece7dd",
  borderRadius: "16px",
  overflow: "hidden",
};
const band: React.CSSProperties = { height: "8px" };
const logoBox: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: "20px 22px 12px",
};
const logoImg: React.CSSProperties = {
  height: "84px",
  maxWidth: "100%",
  objectFit: "contain",
};
const siteLink: React.CSSProperties = {
  display: "inline-block",
  marginTop: "12px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#35662f",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
const primaryBtn: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  padding: "13px 24px",
  borderRadius: "999px",
};
