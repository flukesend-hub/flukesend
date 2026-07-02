"use client";

/*
  Concierge white label setup on the admin operator page. Create the domain,
  open the directions (a ready to forward, record by record message built from
  the operator's actual records, unique DKIM key included), copy it, check
  verification, remove. Written to double as a phone script: each record is
  numbered with explicit field names.
*/
import { useState, useTransition } from "react";
import type { SenderDomain } from "@/lib/sender-domain";
import {
  adminCreateSenderDomain,
  adminCheckSenderDomain,
  adminRemoveSenderDomain,
  type AdminState,
} from "../../actions";

export function SenderDomainPanel({
  operatorId,
  operatorName,
  senderDomain,
}: {
  operatorId: string;
  operatorName: string;
  senderDomain: SenderDomain | null;
}) {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<AdminState>(undefined);
  const [pending, startTransition] = useTransition();
  const [showDirections, setShowDirections] = useState(false);
  const [copied, setCopied] = useState(false);

  function run(action: () => Promise<AdminState>) {
    setState(undefined);
    startTransition(async () => {
      setState(await action());
    });
  }

  const directions = senderDomain ? buildDirections(operatorName, senderDomain) : "";

  async function copyDirections() {
    try {
      await navigator.clipboard.writeText(directions);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Selectable text below either way.
    }
  }

  return (
    <section style={{ marginTop: "28px" }}>
      <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 4px" }}>
        White label email
      </h2>
      <p className="fl-muted" style={{ fontSize: "13px", margin: "0 0 14px" }}>
        {senderDomain
          ? senderDomain.status === "verified"
            ? `Guest email sends from photos@${senderDomain.domain}.`
            : `${senderDomain.domain} is waiting on DNS records.`
          : "Guest email sends from flukesend.com. Set up their domain here and send them the directions."}
      </p>

      {!senderDomain ? (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            className="fl-input"
            style={{ flex: "1 1 220px", fontSize: "13.5px" }}
            placeholder="theirtours.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <button
            type="button"
            className="fl-btn"
            disabled={pending || !domain.trim()}
            onClick={() => run(() => adminCreateSenderDomain(operatorId, domain))}
          >
            {pending ? "Creating..." : "Create domain"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <span style={senderDomain.status === "verified" ? chipGood : chipWait}>
              {senderDomain.status === "verified" ? "Verified" : senderDomain.status}
            </span>
            <button type="button" className="fl-btn" onClick={() => setShowDirections((s) => !s)}>
              {showDirections ? "Hide directions" : "Open directions"}
            </button>
            {senderDomain.status !== "verified" ? (
              <button
                type="button"
                className="fl-btn-ghost"
                disabled={pending}
                onClick={() => run(() => adminCheckSenderDomain(operatorId))}
              >
                {pending ? "Checking..." : "Check verification"}
              </button>
            ) : null}
            <button
              type="button"
              className="fl-btn-ghost"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Remove ${senderDomain.domain}? Their email goes back to flukesend.com.`)) {
                  run(() => adminRemoveSenderDomain(operatorId));
                }
              }}
            >
              Remove
            </button>
          </div>

          {showDirections ? (
            <div>
              <button type="button" className="fl-btn" style={{ marginBottom: "8px" }} onClick={copyDirections}>
                {copied ? "Copied" : "Copy directions"}
              </button>
              <pre style={directionsBox}>{directions}</pre>
            </div>
          ) : null}
        </div>
      )}

      {state?.error ? (
        <p style={{ color: "var(--bad)", fontSize: "13px", margin: "10px 0 0" }}>{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p style={{ color: "var(--good)", fontSize: "13px", margin: "10px 0 0" }}>{state.ok}</p>
      ) : null}
    </section>
  );
}

// The forwardable message. Written to be read over the phone too: numbered
// records, explicit field names, host quirks at the end.
function buildDirections(operatorName: string, sd: SenderDomain): string {
  const lines: string[] = [
    `DNS records for ${sd.domain} (branded email setup)`,
    ``,
    `Hi! We are setting up branded photo delivery email for ${operatorName}.`,
    `Please add the ${sd.records.length} DNS records below to ${sd.domain}.`,
    `They all live on subdomains, so nothing about the existing website or`,
    `email changes.`,
    ``,
  ];
  sd.records.forEach((r, i) => {
    lines.push(`Record ${i + 1} of ${sd.records.length}`);
    lines.push(`  Type: ${r.type}`);
    lines.push(`  Host / Name: ${r.name}`);
    if (r.type === "MX") {
      lines.push(`  Priority: 10`);
    }
    lines.push(`  Value: ${r.value}`);
    lines.push(``);
  });
  lines.push(
    `Notes:`,
    `- Enter the Host exactly as shown. Most DNS hosts (Squarespace, GoDaddy)`,
    `  add the domain part automatically.`,
    `- Squarespace: Settings, then Domains, then ${sd.domain}, then DNS, and`,
    `  add each one under Custom Records.`,
    `- Cloudflare: set each record to DNS only (the gray cloud).`,
    ``,
    `Once they are saved, reply here and we will verify. It usually takes`,
    `just a few minutes.`,
  );
  return lines.join("\n");
}

const chipGood: React.CSSProperties = {
  alignSelf: "center",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--good)",
  background: "rgba(34,160,90,.14)",
  borderRadius: "999px",
  padding: "4px 12px",
};
const chipWait: React.CSSProperties = {
  alignSelf: "center",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--muted)",
  background: "var(--line)",
  borderRadius: "999px",
  padding: "4px 12px",
};
const directionsBox: React.CSSProperties = {
  margin: 0,
  padding: "14px 16px",
  borderRadius: "11px",
  border: "1px solid var(--line-strong)",
  background: "var(--ink)",
  color: "var(--text-2)",
  fontSize: "12px",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: "420px",
  overflowY: "auto",
};
