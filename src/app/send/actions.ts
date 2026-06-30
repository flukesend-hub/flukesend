/*
  The send flow: turning an operator's trip into a delivery with photos and
  recipient rows. Photos do not pass through the server (Vercel caps request
  bodies, and photo sets are large), so the browser uploads them straight to
  Storage using short lived signed upload URLs that signUploads mints. Then
  createSend records the delivery, the photo rows, and one recipient row per
  guest email, each with its own gallery token.

  The recipient rows are the whole point of the product: five pasted emails
  become five rows, five tokens, five review asks later, not one.
*/
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, operatorFromAddress } from "@/lib/email";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { getTrialUsage, TRIAL_TRANSFERS, TRIAL_EMAILS } from "@/lib/trial";

const PHOTO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const MAX_PHOTOS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  return { supabase, userId: user.id, operatorId: membership.operator_id as string };
}

function safeName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "photo";
}

export type SignedUpload = {
  path: string;
  token: string;
  filename: string;
  size: number;
};

export type SignResult =
  | { error: string }
  | { uploads: SignedUpload[] };

// Mint one signed upload URL per file, all under this operator's namespace and
// a fresh per-send folder. The browser uploads to these directly.
export async function signUploads(
  files: { name: string; size: number; type: string }[],
): Promise<SignResult> {
  const { operatorId } = await resolveOperator();

  if (!files.length) {
    return { error: "Add at least one photo." };
  }
  if (files.length > MAX_PHOTOS) {
    return { error: `Too many photos. The limit is ${MAX_PHOTOS} per send.` };
  }
  for (const f of files) {
    if (!PHOTO_TYPES.includes(f.type)) {
      return { error: `"${f.name}" is not a supported image type.` };
    }
    if (f.size > MAX_PHOTO_BYTES) {
      return { error: `"${f.name}" is over the 50 MB limit.` };
    }
  }

  const admin = createAdminClient();
  const sendId = crypto.randomUUID();
  const uploads: SignedUpload[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const path = `${operatorId}/${sendId}/${i}-${safeName(f.name)}`;
    const { data, error } = await admin.storage
      .from("photos")
      .createSignedUploadUrl(path);
    if (error || !data) {
      return { error: "Could not start the photo upload. Try again." };
    }
    uploads.push({ path: data.path, token: data.token, filename: f.name, size: f.size });
  }

  return { uploads };
}

export type CreateSendInput = {
  tripDatetime: string | null;
  whaleCount: number | null;
  species: string[];
  captainName: string | null;
  crewNames: string[];
  boatName: string | null;
  customMessage: string | null;
  photos: { storageKey: string; filename: string; size: number }[];
  emails: string[];
};

export type CreateSendResult =
  | { error: string; upgrade?: boolean }
  | { ok: true; deliveryId: string; recipientCount: number; emailed: number };

export async function createSend(
  input: CreateSendInput,
): Promise<CreateSendResult> {
  const { supabase, userId, operatorId } = await resolveOperator();

  // Photos must already be uploaded, and each storage key must live in this
  // operator's namespace. This stops a crafted request from attaching another
  // operator's files.
  if (!input.photos.length) {
    return { error: "Add at least one photo." };
  }
  for (const p of input.photos) {
    if (!p.storageKey.startsWith(`${operatorId}/`)) {
      return { error: "A photo could not be verified. Try the upload again." };
    }
  }

  // Recipients: validate and dedupe one more time on the server, since the
  // client list cannot be trusted.
  const emails = Array.from(
    new Set(
      input.emails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)),
    ),
  );
  if (!emails.length) {
    return { error: "Add at least one valid guest email." };
  }

  // Free trial gate. Operators on the trial can send up to TRIAL_TRANSFERS
  // transfers or TRIAL_EMAILS guest emails, whichever comes first. Active
  // (paid) operators are unlimited.
  const usage = await getTrialUsage(supabase, operatorId);
  if (usage.status !== "active") {
    if (usage.transfers >= TRIAL_TRANSFERS) {
      return {
        error: `Your free trial covers ${TRIAL_TRANSFERS} transfers, and you have used them. Upgrade to keep sending.`,
        upgrade: true,
      };
    }
    if (usage.emails + emails.length > TRIAL_EMAILS) {
      return {
        error: `This send would pass your ${TRIAL_EMAILS} free trial guest emails (${usage.emails} used so far). Upgrade to keep sending.`,
        upgrade: true,
      };
    }
  }

  // Retention is set per operator and stamped onto each delivery, so the
  // cleanup job can expire this send on its own schedule.
  const { data: branding } = await supabase
    .from("branding")
    .select("retention_days, brand_color, logo_url, default_message, reply_to_email")
    .eq("operator_id", operatorId)
    .maybeSingle();
  const retentionDays = branding?.retention_days ?? 5;
  const expiresAt = new Date(
    Date.now() + retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const tripDatetime = input.tripDatetime
    ? new Date(input.tripDatetime).toISOString()
    : null;
  const whaleCount =
    input.whaleCount != null && Number.isFinite(input.whaleCount)
      ? Math.trunc(input.whaleCount)
      : null;

  const { data: delivery, error: dErr } = await supabase
    .from("deliveries")
    .insert({
      operator_id: operatorId,
      created_by: userId,
      trip_datetime: tripDatetime,
      whale_count: whaleCount,
      species: input.species,
      captain_name: input.captainName,
      crew_names: input.crewNames,
      boat_name: input.boatName,
      custom_message: input.customMessage,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (dErr || !delivery) {
    return { error: "Could not create the send. Try again." };
  }

  const photoRows = input.photos.map((p, i) => ({
    delivery_id: delivery.id,
    storage_key: p.storageKey,
    filename: p.filename,
    size: p.size,
    sort_order: i,
  }));
  const { error: pErr } = await supabase.from("photos").insert(photoRows);
  if (pErr) {
    await cleanupFailedSend(delivery.id, input.photos.map((p) => p.storageKey));
    return { error: "Could not save the photos. Try again." };
  }

  // Tokens are generated by the recipients table default, so we only supply the
  // email here. Each row is its own guest with its own gallery link. We select
  // the tokens back so we can email each guest their personal gallery.
  const recipientRows = emails.map((email) => ({
    delivery_id: delivery.id,
    email,
  }));
  const { data: recipients, error: rErr } = await supabase
    .from("recipients")
    .insert(recipientRows)
    .select("email, token");
  if (rErr || !recipients) {
    await cleanupFailedSend(delivery.id, input.photos.map((p) => p.storageKey));
    return { error: "Could not save the recipients. Try again." };
  }

  // Ship it: email each guest their gallery link. Best effort, run in parallel,
  // and never fail the send over it. The delivery exists either way, and the
  // operator can resend from the confirmation page if needed.
  const { data: operator } = await supabase
    .from("operators")
    .select("name")
    .eq("id", operatorId)
    .maybeSingle();

  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const message = input.customMessage || branding?.default_message || "";

  let emailed = 0;
  if (baseUrl) {
    const deliveryFrom = operatorFromAddress(operator?.name ?? "your crew");
    const deliveryReplyTo = branding?.reply_to_email ?? null;
    const sends = await Promise.allSettled(
      recipients.map((r) => {
        const { subject, html } = buildDeliveryEmail({
          operatorName: operator?.name ?? "your crew",
          brandColor: branding?.brand_color ?? "#0b5563",
          logoUrl: branding?.logo_url ?? null,
          recipientName: null,
          tripLine: deliveryTripLine(input),
          message,
          galleryUrl: `${baseUrl}/g/${r.token}`,
        });
        return sendEmail(r.email, subject, html, deliveryFrom, deliveryReplyTo);
      }),
    );
    emailed = sends.filter(
      (s) => s.status === "fulfilled" && s.value.status === "sent",
    ).length;
  }

  return {
    ok: true,
    deliveryId: delivery.id,
    recipientCount: emails.length,
    emailed,
  };
}

function deliveryTripLine(input: CreateSendInput) {
  const parts: string[] = [];
  if (input.tripDatetime) {
    parts.push(
      new Date(input.tripDatetime).toLocaleDateString("en-US", {
        dateStyle: "long",
      }),
    );
  }
  if (input.captainName) parts.push(`with Captain ${input.captainName}`);
  const wildlife: string[] = [];
  if (input.whaleCount != null) {
    wildlife.push(`${input.whaleCount} whale${input.whaleCount === 1 ? "" : "s"}`);
  }
  if (input.species.length) wildlife.push(input.species.join(", "));
  let line = parts.join(" ");
  if (wildlife.length) line += (line ? ". " : "") + wildlife.join(", ");
  return line;
}

// Best effort rollback. Deleting the delivery cascades the photo and recipient
// rows; we also drop the uploaded files so a failed send leaves nothing behind.
async function cleanupFailedSend(deliveryId: string, storageKeys: string[]) {
  const admin = createAdminClient();
  await admin.from("deliveries").delete().eq("id", deliveryId);
  if (storageKeys.length) {
    await admin.storage.from("photos").remove(storageKeys);
  }
}
