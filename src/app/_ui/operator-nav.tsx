"use client";

/*
  Persistent operator nav, WeTransfer style: two rounded pill cards floating on
  the deep water background. Left card is the brand plus the main nav, right
  card is the account. Active link comes from the current path. Shown on the
  signed in operator screens (dashboard, send, settings, a delivery).
*/
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/auth/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", match: (p: string) => p === "/dashboard" || p.startsWith("/deliveries") },
  { href: "/send", label: "New send", match: (p: string) => p.startsWith("/send") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function OperatorNav({ email, plan }: { email: string; plan: string }) {
  const pathname = usePathname();

  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={pill}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "9px", paddingRight: "4px" }}>
            <span style={dot} />
            <span className="fl-display" style={{ fontSize: "16px" }}>
              Flukesend
            </span>
          </span>
          <span style={divider} />
          <nav style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link key={l.href} href={l.href} style={navLink(active)}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={pill}>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{email}</span>
            <span style={{ fontSize: "11px", color: "var(--muted-2)", textTransform: "capitalize" }}>
              {plan} plan
            </span>
          </span>
          <span style={avatar} />
          <span style={divider} />
          <form action={signout}>
            <button type="submit" style={signoutBtn} title="Sign out">
              Sign out
            </button>
          </form>
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
const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "var(--line-strong)",
};
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
const avatar: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "linear-gradient(135deg,var(--signal),#d98a3c)",
  flex: "0 0 auto",
};
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
