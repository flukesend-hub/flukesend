"use client";

/*
  White label sending domain setup (Fleet). Three states: no domain yet (one
  input), records pending (DNS table with copy buttons and a check button),
  and verified (green confirmation). The DNS records live on a send subdomain
  plus a DKIM selector, so the operator's existing email setup is untouched;
  the copy says so because that is every operator's first worry.
*/
import { useState, useTransition } from "react";
import type { SenderDomain } from "@/lib/sender-domain";
import {
  setupSenderDomain,
  refreshSenderDomain,
  removeSenderDomainAction,
  type SettingsState,
} from "./actions";

export function SenderDomainForm({
  senderDomain,
  allowed,
}: {
  senderDomain: SenderDomain | null;
  allowed: boolean;
}) {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<SettingsState>(undefined);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  function run(action: () => Promise<SettingsState>) {
    setState(undefined);
    startTransition(async () => {
      setState(await action());
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked; the value is selectable either way.
    }
  }

  if (!allowed) {
    return (
      <p className="fl-hint" style={{ margin: 0 }}>
        On the Fleet plan, your delivery and review emails send from your own
        domain (photos@yourtours.com) instead of flukesend.com. Your brand in
        the inbox, your domain&apos;s reputation.{" "}
        <a href="/billing" style={{ color: "var(--signal-2)", fontWeight: 600 }}>
          See plans
        </a>
      </p>
    );
  }

  if (!senderDomain) {
    return (
      <div>
        <p className="fl-hint" style={{ margin: "0 0 14px" }}>
          Guest email currently sends from flukesend.com. Add your domain and
          your delivery and review emails will send from photos@yourdomain
          instead. You will add three DNS records; nothing about your existing
          email changes.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            className="fl-input"
            style={{ flex: "1 1 220px", fontSize: "13.5px" }}
            placeholder="yourtours.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <button
            type="button"
            className="fl-btn"
            disabled={pending || !domain.trim()}
            onClick={() => run(() => setupSenderDomain(domain))}
          >
            {pending ? "Setting up..." : "Start setup"}
          </button>
        </div>
        <Feedback state={state} />
      </div>
    );
  }

  const verified = senderDomain.status === "verified";
  return (
    <div>
      {verified ? (
        <div style={banner}>
          Verified. Guest email now sends from{" "}
          <b>photos@{senderDomain.domain}</b>.
        </div>
      ) : (
        <p className="fl-hint" style={{ margin: "0 0 14px" }}>
          Add these records at your DNS host for <b>{senderDomain.domain}</b>,
          then check verification. They live on a send subdomain plus a DKIM
          key, so your existing email keeps working exactly as it does now.
          DNS changes can take up to a day to spread, usually minutes.
        </p>
      )}

      {!verified && senderDomain.records.length ? (
        <div style={{ overflowX: "auto", marginBottom: "14px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={th}>Type</th>
                <th style={th}>Name</th>
                <th style={th}>Value</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {senderDomain.records.map((r) => (
                <tr key={`${r.type}:${r.name}`} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.type}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.name}</td>
                  <td style={{ ...td, fontFamily: "monospace", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.value}
                  </td>
                  <td style={td}>
                    <span style={r.status === "verified" ? chipGood : chipMuted}>
                      {r.status === "verified" ? "OK" : "Waiting"}
                    </span>
                  </td>
                  <td style={td}>
                    <button type="button" className="fl-btn-ghost" style={copyBtn} onClick={() => copy(r.value)}>
                      {copied === r.value ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {!verified ? (
          <button
            type="button"
            className="fl-btn"
            disabled={pending}
            onClick={() => run(refreshSenderDomain)}
          >
            {pending ? "Checking..." : "Check verification"}
          </button>
        ) : null}
        <button
          type="button"
          className="fl-btn-ghost"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Remove ${senderDomain.domain}? Guest email goes back to sending from flukesend.com.`)) {
              run(removeSenderDomainAction);
            }
          }}
        >
          Remove domain
        </button>
      </div>
      <Feedback state={state} />
    </div>
  );
}

function Feedback({ state }: { state: SettingsState }) {
  if (!state) return null;
  return (
    <p
      style={{
        fontSize: "13px",
        margin: "12px 0 0",
        color: "error" in state && state.error ? "var(--bad)" : "var(--good)",
      }}
    >
      {"error" in state && state.error ? state.error : "ok" in state ? state.ok : null}
    </p>
  );
}

const banner: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: "11px",
  border: "1px solid rgba(34,160,90,.35)",
  background: "rgba(34,160,90,.12)",
  color: "var(--good)",
  fontSize: "13.5px",
  marginBottom: "14px",
};
const th: React.CSSProperties = { padding: "4px 10px 6px 0", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: ".06em" };
const td: React.CSSProperties = { padding: "7px 10px 7px 0", color: "var(--text-2)", verticalAlign: "middle" };
const chipGood: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "var(--good)", background: "rgba(34,160,90,.14)", borderRadius: "999px", padding: "2px 8px" };
const chipMuted: React.CSSProperties = { fontSize: "11px", fontWeight: 600, color: "var(--muted)", background: "var(--line)", borderRadius: "999px", padding: "2px 8px" };
const copyBtn: React.CSSProperties = { fontSize: "11.5px", padding: "4px 10px" };
