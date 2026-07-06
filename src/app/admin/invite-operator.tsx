"use client";

/*
  Operators onboard themselves: create an account, set up branding, start
  sending. So the admin's "add operator" is an invite, not a form: one tap
  copies the signup link to paste into a text or email to the captain.
*/
import { useEffect, useState } from "react";

const SIGNUP_URL = "https://www.flukesend.com/login";

export function InviteOperator() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SIGNUP_URL);
      setCopied(true);
    } catch {
      // Clipboard blocked (rare); fall back to a prompt the user can copy from.
      window.prompt("Copy the signup link:", SIGNUP_URL);
    }
  }

  return (
    <button type="button" onClick={copy} style={btn} title="Copy the signup link to send to a new operator">
      {copied ? "Link copied" : "Invite operator"}
    </button>
  );
}

const btn: React.CSSProperties = {
  font: "inherit",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#fff",
  background: "#0c1a21",
  border: 0,
  borderRadius: "999px",
  padding: "8px 16px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
