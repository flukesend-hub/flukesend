"use client";

/*
  Persistent operator nav. Flukesend wordmark pinned far left; everything else
  pinned far right: a nav pill (New send / Transfers / Settings) and an account
  pill (Sign out, then the company name). Active link comes from the path.
*/
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/auth/actions";

const LINKS = [
  { href: "/send", label: "New send", match: (p: string) => p.startsWith("/send") },
  { href: "/dashboard", label: "Transfers", match: (p: string) => p === "/dashboard" || p.startsWith("/deliveries") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function OperatorNav({ operatorName }: { operatorName: string }) {
  const pathname = usePathname();

  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={pill}>
          <span style={dot} />
          <span className="fl-display" style={{ fontSize: "16px" }}>
            Flukesend
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <nav style={{ ...pill, gap: "3px" }}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} style={navLink(l.match(pathname))}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div style={pill}>
            <form action={signout}>
              <button type="submit" style={signoutBtn} title="Sign out">
                Sign out
              </button>
            </form>
            <span style={divider} />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{operatorName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "var(--ink)",
  padding: "14px 22px",
};
const inner: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};
const pill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  padding: "9px 14px",
};
const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "var(--signal)",
  boxShadow: "0 0 10px var(--signal)",
};
const divider: React.CSSProperties = { width: 1, height: 20, background: "var(--line-strong)" };
function navLink(active: boolean): React.CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: active ? 600 : 500,
    color: active ? "var(--signal-ink)" : "var(--muted)",
    background: active ? "var(--signal)" : "transparent",
    padding: "7px 12px",
    borderRadius: "9px",
  };
}
const signoutBtn: React.CSSProperties = {
  font: "inherit",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--muted)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  padding: "2px 4px",
};
