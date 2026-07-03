/*
  Public operators showcase. The mock is meant to look like the real product,
  so each card pulls the operator's live branding straight from their settings:
  their name, brand color (the panel behind the logo, exactly the color that
  fills their real gallery header), logo, and website. The only curated copy is
  the one line tagline and a real guest review excerpt.

  Adding a future operator: drop their id and a tagline into SHOWCASE, gather a
  five star guest review to quote, and the branding renders itself. Read
  through the service role admin client (server only) because this public page
  has no operator session; only public fields (name, brand color, public logo
  url, website) are exposed.
*/
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Operators - Flukesend" };
// Re-read branding at most hourly so a logo or color change shows up without
// a redeploy, while keeping this off the database on every visit.
export const revalidate = 3600;

type Showcase = {
  operatorId: string;
  place: string;
  line: string;
  // A real guest's Google review excerpt. Guests raving about the photos is
  // the strongest proof this page can carry; keep excerpts faithful.
  quote: string;
};

const SHOWCASE: Showcase[] = [
  {
    operatorId: "0d2fb4e9-32e9-45e7-97e9-dba4f4ef90b9",
    place: "Moss Landing, CA",
    line: "Premium 6 passenger vessel out of Moss Landing, CA.",
    quote:
      "They included a photo package of everything we saw, which was such an unexpected and thoughtful bonus... having professional photos to look back on makes it even better.",
  },
  {
    operatorId: "dbb9e0a2-594c-483b-b8f4-f84952f87581",
    place: "Monterey, CA",
    line: "Year-round whale watching out of Monterey's Old Fisherman's Wharf.",
    quote:
      "A professional photographer was on board taking photos of the whales and shared them with everyone on board for free!",
  },
];

type Card = Showcase & {
  name: string;
  brandColor: string;
  logo: string;
  site: string | null;
};

async function loadCards(): Promise<Card[]> {
  const admin = createAdminClient();
  const ids = SHOWCASE.map((s) => s.operatorId);
  const [{ data: ops }, { data: brands }] = await Promise.all([
    admin.from("operators").select("id, name").in("id", ids),
    admin.from("branding").select("operator_id, brand_color, logo_url, website_url").in("operator_id", ids),
  ]);
  const opById = new Map((ops ?? []).map((o) => [o.id as string, o]));
  const brandById = new Map((brands ?? []).map((b) => [b.operator_id as string, b]));

  return SHOWCASE.map((s) => {
    const op = opById.get(s.operatorId);
    const b = brandById.get(s.operatorId);
    return {
      ...s,
      name: (op?.name as string) ?? "",
      brandColor: (b?.brand_color as string) ?? "#0c1a21",
      logo: (b?.logo_url as string) ?? "",
      site: (b?.website_url as string) ?? null,
    };
  }).filter((c) => c.name && c.logo);
}

export default async function OperatorsPage() {
  const cards = await loadCards();

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
          {cards.map((op) => (
            <div key={op.operatorId} style={card}>
              {/* The operator's real brand color, the same fill as their live
                  gallery header, with their real logo on it. */}
              <div style={{ ...logoPanel, background: op.brandColor }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={op.logo} alt={`${op.name} logo`} style={logoImg} />
              </div>
              <div style={{ padding: "20px 22px 24px", textAlign: "center" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#10221f" }}>{op.name}</h3>
                <div style={{ fontSize: "13px", color: "#8a938f", margin: "3px 0 10px" }}>{op.place}</div>
                <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6, color: "#5f6b68" }}>{op.line}</p>
                {op.site ? (
                  <a href={op.site} target="_blank" rel="noopener noreferrer" style={siteLink}>
                    {op.site.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                ) : null}
                <figure style={quoteBox}>
                  <div style={stars} aria-label="5 star review">
                    {"★★★★★"}
                  </div>
                  <blockquote style={quoteText}>&ldquo;{op.quote}&rdquo;</blockquote>
                  <figcaption style={quoteWho}>Guest review on Google</figcaption>
                </figure>
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
const logoPanel: React.CSSProperties = {
  height: "132px",
  display: "grid",
  placeItems: "center",
  padding: "22px",
};
const logoImg: React.CSSProperties = {
  maxHeight: "72px",
  maxWidth: "84%",
  objectFit: "contain",
};
const siteLink: React.CSSProperties = {
  display: "inline-block",
  marginTop: "12px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#1c5578",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
const quoteBox: React.CSSProperties = {
  margin: "18px 0 0",
  padding: "14px 16px",
  borderRadius: "12px",
  background: "#faf8f4",
  border: "1px solid #ece7dd",
  textAlign: "left",
};
const stars: React.CSSProperties = {
  color: "#d7a831",
  fontSize: "13px",
  letterSpacing: "2px",
  marginBottom: "6px",
};
const quoteText: React.CSSProperties = {
  margin: 0,
  fontSize: "13.5px",
  lineHeight: 1.6,
  color: "#3a4744",
  fontStyle: "italic",
};
const quoteWho: React.CSSProperties = {
  marginTop: "8px",
  fontSize: "12px",
  color: "#8a938f",
};
const primaryBtn: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  padding: "13px 24px",
  borderRadius: "999px",
};
