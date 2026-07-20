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
import { tripTimesFor } from "@/lib/trip-times";
import { type SocialLinks } from "@/lib/social";

export type CaptureContext = {
  link: { id: string; operator_id: string; boat_id: string | null };
  operator: { id: string; name: string };
  branding: { logo_url: string | null; brand_color: string; default_message: string } | null;
  // The operator's chosen departure times, so the guest only sees trips that
  // really sail. Empty means show every slot (not yet configured).
  tripTimes: string[];
  // The operator's website and social links, shown after the guest signs up so
  // the QR scan becomes a follow.
  social: SocialLinks;
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
    .select(
      "logo_url, brand_color, default_message, trip_times, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
    )
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
    tripTimes: tripTimesFor((branding?.trip_times as string[] | null) ?? null),
    social: {
      website_url: branding?.website_url ?? null,
      facebook_url: branding?.facebook_url ?? null,
      instagram_url: branding?.instagram_url ?? null,
      tiktok_url: branding?.tiktok_url ?? null,
      youtube_url: branding?.youtube_url ?? null,
      x_url: branding?.x_url ?? null,
    },
    boatName,
    boats: boatList,
  };
}

// The operator's standing operator-wide capture token, created on first read.
// The operator-wide link is the one with boat_id null; the partial unique index
// on operator_id where boat_id is null keeps it to one even under a race, while
// still leaving room for a link per boat. Admin client, since Settings needs it
// to render the QR.
export async function getOperatorCaptureToken(operatorId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("capture_links")
    .select("token")
    .eq("operator_id", operatorId)
    .is("boat_id", null)
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
    .is("boat_id", null)
    .maybeSingle();
  return (again?.token as string) ?? null;
}

export type BoatCaptureLink = { boatId: string; boatName: string; token: string };

// One standing capture link per boat, created on first read. Each boat's link
// carries its boat_id, so a guest who scans it is locked to that boat and never
// picks the wrong one. Mirrors getOperatorCaptureToken but keyed by boat; the
// partial unique on boat_id keeps each boat to a single link even under a race.
// Returned in the operator's boat order, so the settings cards line up with the
// boat roster. Admin client, since Settings needs it to render the QR codes.
export async function getBoatCaptureLinks(operatorId: string): Promise<BoatCaptureLink[]> {
  const admin = createAdminClient();

  const { data: boats } = await admin
    .from("boats")
    .select("id, name")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: true });
  const boatList = (boats ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  if (boatList.length === 0) return [];

  // One read for every existing per-boat link, then only the missing boats get
  // an insert, so a fully provisioned operator makes no writes.
  const { data: existing } = await admin
    .from("capture_links")
    .select("token, boat_id")
    .eq("operator_id", operatorId)
    .not("boat_id", "is", null);
  const byBoat = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.boat_id) byBoat.set(row.boat_id as string, row.token as string);
  }

  const links: BoatCaptureLink[] = [];
  for (const boat of boatList) {
    let token = byBoat.get(boat.id) ?? null;
    if (!token) {
      const { data: created } = await admin
        .from("capture_links")
        .insert({ operator_id: operatorId, boat_id: boat.id })
        .select("token")
        .maybeSingle();
      token = (created?.token as string) ?? null;
      if (!token) {
        // Lost a race to a concurrent insert; the winner's row is there now.
        const { data: again } = await admin
          .from("capture_links")
          .select("token")
          .eq("operator_id", operatorId)
          .eq("boat_id", boat.id)
          .maybeSingle();
        token = (again?.token as string) ?? null;
      }
    }
    if (token) links.push({ boatId: boat.id, boatName: boat.name, token });
  }
  return links;
}

// Salted hash of a submitter IP. Stored only to rate limit, never the raw IP.
// The salt is a static server side constant; this is bucketing, not a secret.
const IP_SALT = "flukesend-capture-v1";
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_SALT}:${ip}`).digest("hex");
}
