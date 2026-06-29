/*
  Public marketing footer, light theme.
*/
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer style={wrap}>
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "40px 24px", display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "9px", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: "17px", color: "#10221f" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e7b14c" }} />
          Flukesend
        </div>
        <nav style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "13.5px", color: "#5f6b68" }}>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Log in</Link>
        </nav>
        <div style={{ fontSize: "13px", color: "#8a938f", width: "100%", textAlign: "center", paddingTop: "8px" }}>
          Branded photo delivery and review engine for whale watch operators.
        </div>
      </div>
    </footer>
  );
}

const wrap: React.CSSProperties = {
  borderTop: "1px solid #e7e2d8",
  background: "#f1efe8",
};
