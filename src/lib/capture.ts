/*
  QR self capture helpers. Guests are not signed in, so the public /j/[token]
  page and its submit run server side with the service role, exactly like the
  guest gallery. This module resolves a capture token to its operator, branding,
  and boat, ensures every boat has a standing link, and hashes submitter IPs for
  rate limiting. Nothing here ever returns another operator's data: every lookup
  is scoped by the token's own operator_id.
*/
import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type CaptureContext = {
  link: { id: string; operator_id: string; boat_id: string | null };
  operator: { id: string; name: string };
  branding: { logo_url: string | null; brand_color: string; default_message: string } | null;
  boatName: string | null;
  // The operator's boats, so the guest can pick which one they were on. The
  // scanned link's boat, if any, is the default.
  boats: { id: string; name: string }[];
};

// Resolve a public capture token to everything the /j page needs to render an
// operator branded form. Returns null for an unknown or retired link.
export async function getCaptureByToken(token: string): Promise<CaptureContext | null> {
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("capture_links")
    .select("id, operator_id, boat_id, active")
    .eq("token", token)
    .maybeSingle();
  if (!link || !link.active) {
    return null;
  }

  const { data: operator } = await admin
    .from("operators")
    .select("id, name")
    .eq("id", link.operator_id)
    .maybeSingle();

  const { data: branding } = await admin
    .from("branding")
    .select("logo_url, brand_color, default_message")
    .eq("operator_id", link.operator_id)
    .maybeSingle();

  const { data: boats } = await admin
    .from("boats")
    .select("id, name")
    .eq("operator_id", link.operator_id)
    .order("sort_order", { ascending: true });
  const boatList = (boats ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const boatName = link.boat_id
    ? boatList.find((b) => b.id === link.boat_id)?.name ?? null
    : null;

  return {
    link: { id: link.id, operator_id: link.operator_id, boat_id: link.boat_id },
    operator: operator ?? { id: link.operator_id, name: "Operator" },
    branding: branding ?? null,
    boatName,
    boats: boatList,
  };
}

// The operator's single standing capture token, created on first read. One link
// per operator (boat_id left null); the unique index on operator_id keeps it to
// one even under a race. Admin client, since Settings needs it to render the QR.
export async function getOperatorCaptureToken(operatorId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("capture_links")
    .select("token")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const { data: created } = await admin
    .from("capture_links")
    .insert({ operator_id: operatorId })
    .select("token")
    .maybeSingle();
  if (created?.token) return created.token as string;

  // Lost a race to a concurrent insert; the winner's row is there now.
  const { data: again } = await admin
    .from("capture_links")
    .select("token")
    .eq("operator_id", operatorId)
    .maybeSingle();
  return (again?.token as string) ?? null;
}

// Salted hash of a submitter IP. Stored only to rate limit, never the raw IP.
// The salt is a static server side constant; this is bucketing, not a secret.
const IP_SALT = "flukesend-capture-v1";
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_SALT}:${ip}`).digest("hex");
}
