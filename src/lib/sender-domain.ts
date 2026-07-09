/*
  White label sending domains, part of the single plan. An operator verifies
  their own domain with Resend by adding DNS records, and from then on their
  delivery and review emails send from photos@theirdomain.com instead of the
  shared slug@flukesend.com. Their brand in the inbox, their domain's
  reputation.

  Resend's DNS records live on a return-path subdomain (send.theirdomain.com)
  plus a DKIM selector record, so nothing about the operator's existing email
  (their own SPF or MX on the root) is touched. Safe to tell operators that.

  All writes go through the Resend API with our key, service role in the
  database. Setup is concierge only, through the admin support page.
*/
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { operatorFromAddress } from "@/lib/email";

// The local part guests see. Fixed in v1: photos@theirdomain.com.
export const FROM_LOCAL = "photos";

export type DnsRecord = {
  type: string;
  name: string;
  value: string;
  status: string;
};

export type SenderDomain = {
  domain: string;
  status: string;
  records: DnsRecord[];
};

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  records?: { record: string; type: string; name: string; value: string; status?: string }[];
};

const API = "https://api.resend.com";

function key(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

function mapRecords(d: ResendDomain): DnsRecord[] {
  return (d.records ?? []).map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    status: r.status ?? "not_started",
  }));
}

// Hostname only, no scheme, no path, at least one dot, no spaces.
export function normalizeDomain(raw: string): string | null {
  const v = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(v)) {
    return null;
  }
  return v;
}

export async function createSenderDomain(
  operatorId: string,
  domainRaw: string,
): Promise<{ ok: true } | { error: string }> {
  const apiKey = key();
  if (!apiKey) return { error: "Email service is not configured yet." };
  const domain = normalizeDomain(domainRaw);
  if (!domain) return { error: "Enter a domain like yourtours.com." };

  const res = await fetch(`${API}/domains`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    console.error(`sender domain create failed for ${operatorId} (${domain}): ${res.status} ${text}`);
    return {
      error:
        res.status === 403 || text.includes("already")
          ? "That domain is already registered. Remove it first or contact support."
          : "Could not start domain setup. Try again.",
    };
  }
  const created = (await res.json()) as ResendDomain;

  const admin = createAdminClient();
  const { error } = await admin.from("sender_domains").upsert(
    {
      operator_id: operatorId,
      domain,
      resend_domain_id: created.id,
      status: created.status ?? "pending",
      records: mapRecords(created),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "operator_id" },
  );
  if (error) {
    console.error(`sender domain save failed for ${operatorId}: ${error.message}`);
    return { error: "Could not save the domain. Try again." };
  }
  return { ok: true };
}

// Ask Resend to (re)verify, then refresh our copy of status and records.
export async function checkSenderDomain(
  operatorId: string,
): Promise<{ ok: true; status: string } | { error: string }> {
  const apiKey = key();
  if (!apiKey) return { error: "Email service is not configured yet." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("sender_domains")
    .select("resend_domain_id")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (!row) return { error: "No domain set up yet." };

  // Read the domain's settled status first. Do NOT trigger a re-verify and then
  // read immediately: Resend flips an already-verified domain back to "pending"
  // while it re-checks the DNS, so a read right after the POST catches that
  // transient state and the panel never shows verified even once the domain is
  // done. So we GET the current status, and only nudge a re-verify (fire and
  // forget, for next time) when the domain is not verified yet.
  const res = await fetch(`${API}/domains/${row.resend_domain_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return { error: "Could not check the domain. Try again." };
  }
  const d = (await res.json()) as ResendDomain;
  const status = d.status ?? "pending";
  if (status !== "verified") {
    // Not verified yet: nudge Resend to re-check so the next look reflects any
    // DNS that has since propagated. Idempotent, and we do not wait on it.
    await fetch(`${API}/domains/${row.resend_domain_id}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => {});
  }
  const { error } = await admin
    .from("sender_domains")
    .update({
      status,
      records: mapRecords(d),
      updated_at: new Date().toISOString(),
    })
    .eq("operator_id", operatorId);
  if (error) {
    console.error(`sender domain refresh failed for ${operatorId}: ${error.message}`);
  }
  return { ok: true, status };
}

export async function removeSenderDomain(
  operatorId: string,
): Promise<{ ok: true } | { error: string }> {
  const apiKey = key();
  if (!apiKey) return { error: "Email service is not configured yet." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("sender_domains")
    .select("resend_domain_id")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (!row) return { ok: true };

  const res = await fetch(`${API}/domains/${row.resend_domain_id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok && res.status !== 404) {
    return { error: "Could not remove the domain. Try again." };
  }
  await admin.from("sender_domains").delete().eq("operator_id", operatorId);
  return { ok: true };
}

export async function getSenderDomain(operatorId: string): Promise<SenderDomain | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sender_domains")
    .select("domain, status, records, from_local")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (!data) return null;
  return {
    domain: data.domain as string,
    status: data.status as string,
    records: (data.records as DnsRecord[]) ?? [],
  };
}

// The From header for an operator's guest email. Verified white label domain
// wins; everything else falls back to the shared flukesend.com sender. One
// small indexed read per send path call.
export async function resolveFromAddress(
  operatorId: string,
  operatorName: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sender_domains")
    .select("domain, status, from_local")
    .eq("operator_id", operatorId)
    .eq("status", "verified")
    .maybeSingle();
  if (data?.domain) {
    const display = (operatorName || "Your crew").replace(/["\\\r\n]/g, " ").trim();
    return `"${display}" <${(data.from_local as string) || FROM_LOCAL}@${data.domain}>`;
  }
  return operatorFromAddress(operatorName);
}
