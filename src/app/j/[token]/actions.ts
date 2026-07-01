/*
  The public self capture submit. A guest aboard is not signed in, so this runs
  with the admin client, but strictly scoped to the operator that owns the
  scanned token: operator_id is read from the link, and a chosen boat must belong
  to that same operator. A capture is tied to a trip (boat, day, and 30 minute
  slot) so the operator can load exactly that departure's guests later. Three
  guards keep it clean: a honeypot field catches naive bots, a per IP rate limit
  caps bursts, and a dedupe window stops the same guest stacking rows for the
  same trip before the operator imports.
*/
"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCaptureByToken, hashIp } from "@/lib/capture";
import { isTripTime } from "@/lib/trip-times";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8; // captures per IP per minute
const MAX_NAME = 80;

export type CaptureResult = { ok: true } | { error: string };

// Trip date must land within a day of the server's date, so a guest cannot
// stamp an arbitrary day, but a near midnight local/UTC skew still passes.
function validTripDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const picked = new Date(`${value}T12:00:00Z`).getTime();
  if (Number.isNaN(picked)) return false;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return Math.abs(picked - now) <= 1.5 * day;
}

export async function captureGuest(input: {
  token: string;
  boatId: string;
  tripDate: string;
  tripTime: string;
  email: string;
  name: string;
  // Honeypot: a field hidden from humans. If it is filled, it is a bot.
  company: string;
}): Promise<CaptureResult> {
  // Bot guard. Pretend success so a bot learns nothing, but write nothing.
  if (input.company.trim()) {
    return { ok: true };
  }

  const ctx = await getCaptureByToken(input.token);
  if (!ctx) {
    return { error: "This link is no longer active. Ask the crew for a fresh one." };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "That email does not look right. Give it another try." };
  }
  const name = input.name.trim().slice(0, MAX_NAME) || null;

  // Resolve the boat. Fall back to the link's own boat, or the operator's only
  // boat when there is exactly one, so a single boat operator never asks the
  // guest to choose. Whatever we land on must belong to this operator. An
  // operator with no boats at all captures with no boat.
  const boatId =
    input.boatId ||
    ctx.link.boat_id ||
    (ctx.boats.length === 1 ? ctx.boats[0].id : "");
  if (boatId) {
    if (!ctx.boats.some((b) => b.id === boatId)) {
      return { error: "Pick which boat you were on." };
    }
  } else if (ctx.boats.length > 0) {
    return { error: "Pick which boat you were on." };
  }

  if (!isTripTime(input.tripTime)) {
    return { error: "Pick your trip time." };
  }
  const tripDate = validTripDate(input.tripDate)
    ? input.tripDate
    : new Date().toISOString().slice(0, 10);

  const admin = createAdminClient();

  // Rate limit by IP, best effort. The first forwarded address is the client.
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recent } = await admin
    .from("captured_guests")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("captured_at", since);
  if ((recent ?? 0) >= RATE_MAX) {
    return { error: "Too many sign ups from here just now. Wait a minute and retry." };
  }

  // Dedupe: if this guest already sits un-consumed for this exact trip, treat
  // the resubmit as success rather than stacking another row.
  const { data: existing } = await admin
    .from("captured_guests")
    .select("id")
    .eq("operator_id", ctx.operator.id)
    .eq("boat_id", boatId)
    .eq("email", email)
    .eq("trip_date", tripDate)
    .eq("trip_time", input.tripTime)
    .is("consumed_at", null)
    .maybeSingle();
  if (existing) {
    return { ok: true };
  }

  const { error } = await admin.from("captured_guests").insert({
    operator_id: ctx.operator.id,
    boat_id: boatId || null,
    email,
    name,
    trip_date: tripDate,
    trip_time: input.tripTime,
    ip_hash: ipHash,
  });
  if (error) {
    return { error: "Could not save that just now. Please try again." };
  }

  return { ok: true };
}
