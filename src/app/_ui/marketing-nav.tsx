/*
  Public marketing nav, light theme. Used by the marketing route group only.
*/
import Link from "next/link";

export function MarketingNav() {
  return (
    <header style={wrap}>
      <Link href="/" style={brand}>
        <span style={dot} />
        Flukesend
      </Link>
      <nav style={links}>
        <Link href="/pricing" style={link}>
          Pricing
        </Link>
        <Link href="/operators" style={link}>
          Operators
        </Link>
        <Link href="/login" style={link}>
          Log in
        </Link>
        <Link href="/login" style={cta}>
          Get started
        </Link>
      </nav>
    </header>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  maxWidth: "1080px",
  margin: "0 auto",
  padding: "20px 24px",
};
const brand: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "9px",
  fontFamily: "var(--font-fraunces), serif",
  fontWeight: 600,
  fontSize: "19px",
  color: "#10221f",
};
const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "#e7b14c",
  boxShadow: "0 0 10px rgba(231,177,76,.6)",
};
const links: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const link: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "#3a4744",
  padding: "8px 12px",
  borderRadius: "9px",
};
const cta: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  padding: "9px 16px",
  borderRadius: "999px",
};
