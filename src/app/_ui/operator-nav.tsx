"use client";

/*
  Persistent operator nav. Desktop: Flukesend wordmark far left, nav and account
  far right. Mobile (<=640px): two compact rows. Sticky to the top. "Transfers"
  is not a page; it opens the Transfers drawer over whatever page you are on.
  Layout lives in globals.css (.fl-nav-*).
*/
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/auth/actions";
import { TransfersDrawer } from "./transfers-drawer";

export function OperatorNav({ operatorName }: { operatorName: string }) {
  const pathname = usePathname();
  const [transfersOpen, setTransfersOpen] = useState(false);

  return (
    <>
      <div className="fl-nav-wrap">
        <div className="fl-nav-inner">
          <div className="fl-nav-pill fl-nav-brand">
            <span style={dot} />
            <span className="fl-display" style={{ fontSize: "16px" }}>
              Flukesend
            </span>
          </div>

          <nav className="fl-nav-pill fl-nav-links">
            <Link href="/send" style={navLink(pathname.startsWith("/send"))}>
              New send
            </Link>
            <button
              type="button"
              onClick={() => setTransfersOpen(true)}
              style={{ ...navLink(transfersOpen), border: 0, cursor: "pointer", font: "inherit" }}
            >
              Transfers
            </button>
            <Link href="/settings" style={navLink(pathname.startsWith("/settings"))}>
              Settings
            </Link>
          </nav>

          <div className="fl-nav-pill fl-nav-account">
            <span style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap" }}>
              {operatorName}
            </span>
            <span style={divider} />
            <form action={signout}>
              <button type="submit" style={signoutBtn} title="Sign out">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <TransfersDrawer open={transfersOpen} onClose={() => setTransfersOpen(false)} />
    </>
  );
}

const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "var(--signal)",
  boxShadow: "0 0 10px var(--signal)",
  flex: "0 0 auto",
};
const divider: React.CSSProperties = { width: 1, height: 20, background: "var(--line-strong)", flex: "0 0 auto" };
function navLink(active: boolean): React.CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: active ? 600 : 500,
    color: active ? "var(--signal-ink)" : "var(--muted)",
    background: active ? "var(--signal)" : "transparent",
    padding: "7px 12px",
    borderRadius: "9px",
    whiteSpace: "nowrap",
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
  whiteSpace: "nowrap",
};
