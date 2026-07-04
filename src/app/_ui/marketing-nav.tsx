/*
  Public marketing nav, light theme. Used by the marketing route group only.
*/
import Link from "next/link";

export function MarketingNav() {
  return (
    <header style={wrap}>
      <Link href="/" style={brand} aria-label="Flukesend home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/flukesend-wordmark-black.png"
          alt="Flukesend"
          style={{ height: "30px", width: "auto", display: "block" }}
        />
      </Link>
      <nav style={links}>
        {/* Ordered by the buyer's journey: learn the product, see the crews
            already on it, then check the price. */}
        <Link href="/how-it-works" style={link}>
          How it works
        </Link>
        <Link href="/operators" style={link}>
          Operators
        </Link>
        <Link href="/pricing" style={link}>
          Pricing
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
