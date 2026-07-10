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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendEmailBatch, type BatchEmail } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { brandLookFromRow } from "@/lib/brand-copy";
import { getTrialUsage, getPlan, TRIAL_TRANSFERS } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getRecipientsUsed, incrementRecipientsUsed } from "@/lib/usage";
import { deliveryExpiresAt } from "@/lib/retention";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

const PHOTO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_PHOTO_BYTES = 100 * 1024 * 1024;
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

  // Gate storage the same way the send itself is gated. Without this, a
  // canceled or exhausted account could mint signed URLs in a loop and park
  // unlimited bytes in the bucket without ever creating a send. The orphan
  // cleanup would eventually sweep them, but there is no reason to hold the
  // door open. createSend re-checks the same limits with exact counts.
  const usage = await getTrialUsage(await createClient(), operatorId);
  if (usage.status === "canceled") {
    return { error: "This account has no active plan. Choose a plan to keep sending." };
  }
  if (usage.status !== "active" && usage.transfers >= TRIAL_TRANSFERS) {
    return { error: "Your free trial is used up. Upgrade to keep sending." };
  }

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
      return { error: `"${f.name}" is over the 100 MB limit.` };
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

export type CapturedGuest = { id: string; email: string; name: string | null };

// The guests captured for one trip (boat, day, and time slot) that have not
// been pulled into a send yet. Read only: nothing is consumed here, so the
// operator can change their boat or time selection freely. Admin client, but
// strictly scoped by this operator's id, so a crafted boat id from another
// tenant matches nothing. Consuming happens in createSend once the send lands.
export async function getCapturedForTrip(
  boatId: string,
  tripDate: string,
  tripTime: string,
): Promise<CapturedGuest[]> {
  const { operatorId } = await resolveOperator();
  if (!boatId || !tripDate || !tripTime) return [];

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("captured_guests")
    .select("id, email, name")
    .eq("operator_id", operatorId)
    .eq("boat_id", boatId)
    .eq("trip_date", tripDate)
    .eq("trip_time", tripTime)
    .is("consumed_at", null);

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    name: (r.name as string | null) ?? null,
  }));
}

export type CreateSendInput = {
  tripDatetime: string | null;
  species: string[];
  // Optional head count per species, e.g. { "Humpback whale": 3 }. Only species
  // the operator gave a positive number for appear here; the rest just show the
  // name. Keyed by the same names as species.
  speciesCounts?: Record<string, number>;
  captainName: string | null;
  naturalistName: string | null;
  photographerName: string | null;
  crewNames: string[];
  boatName: string | null;
  customMessage: string | null;
  photos: { storageKey: string; filename: string; size: number }[];
  emails: string[];
  // Captured-guest rows that were auto-loaded for this trip. Consumed once the
  // send is saved so they never load again.
  capturedIds?: string[];
};

export type CreateSendResult =
  | { error: string; upgrade?: boolean }
  | {
      ok: true;
      deliveryId: string;
      recipientCount: number;
      emailed: number;
      failed: string[];
    };

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

  // Plan gate. Canceled means no plan: they must buy before sending, with no
  // free allowance. Trial (or no row) gets TRIAL_TRANSFERS free transfers,
  // however many guests each reaches. Active operators are held to their plan's
  // per send and monthly recipient caps.
  const usage = await getTrialUsage(supabase, operatorId);
  if (usage.status === "canceled") {
    return {
      error: "This account has no active plan. Choose a plan to start sending.",
      upgrade: true,
    };
  }
  if (usage.status !== "active") {
    if (usage.transfers >= TRIAL_TRANSFERS) {
      return {
        error: `Your free trial covers ${TRIAL_TRANSFERS} transfers, and you have used them. Upgrade to keep sending.`,
        upgrade: true,
      };
    }
  } else {
    const plan = PLANS[(await getPlan(supabase, operatorId)).tier];
    if (emails.length > plan.emailsPerSend) {
      return {
        error: `This send has ${emails.length} guests, over your ${plan.displayName} plan limit of ${plan.emailsPerSend} emails per send. Upgrade to send to more at once.`,
        upgrade: true,
      };
    }
    if (plan.emailsPerMonth !== null) {
      const used = await getRecipientsUsed(supabase, operatorId);
      if (used + emails.length > plan.emailsPerMonth) {
        return {
          error: `This send would pass your ${plan.displayName} plan limit of ${plan.emailsPerMonth} emails this month (${used} used so far). Upgrade to keep sending.`,
          upgrade: true,
        };
      }
    }
  }

  // Retention is set per operator and stamped onto each delivery, so the
  // cleanup job can expire this send on its own schedule. Retention counts in
  // whole local days: a send stays live through the full day retention_days
  // later, then expires at local midnight, so every send on a day dies together.
  const { data: branding } = await supabase
    .from("branding")
    .select(
      "retention_days, brand_color, accent_color, header_text_color, font_key, text_tone, copy_overrides, logo_url, default_message, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
    )
    .eq("operator_id", operatorId)
    .maybeSingle();
  const retentionDays = branding?.retention_days ?? 5;
  const expiresAt = deliveryExpiresAt(new Date(), retentionDays);

  const tripDatetime = input.tripDatetime
    ? new Date(input.tripDatetime).toISOString()
    : null;

  // Keep only positive whole counts for species actually on this send, so a
  // stray or negative client value never lands in the row. Null when empty.
  const speciesCounts: Record<string, number> = {};
  for (const name of input.species) {
    const n = Math.floor(Number(input.speciesCounts?.[name]));
    if (Number.isFinite(n) && n > 0) speciesCounts[name] = n;
  }
  const speciesCountsValue = Object.keys(speciesCounts).length ? speciesCounts : null;

  const { data: delivery, error: dErr } = await supabase
    .from("deliveries")
    .insert({
      operator_id: operatorId,
      created_by: userId,
      trip_datetime: tripDatetime,
      species: input.species,
      species_counts: speciesCountsValue,
      captain_name: input.captainName,
      naturalist_name: input.naturalistName,
      photographer_name: input.photographerName,
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

  // Carry each guest's first name from their QR sign-up onto the recipient
  // row, matched by email (newest sign-up wins), so the delivery and review
  // emails can greet them by name. Best effort: no match just means no name.
  const { data: capNames } = await supabase
    .from("captured_guests")
    .select("email, name")
    .eq("operator_id", operatorId)
    .in("email", emails)
    .not("name", "is", null)
    .order("captured_at", { ascending: true });
  const nameByEmail = new Map<string, string>();
  for (const c of capNames ?? []) {
    const n = (c.name as string | null)?.trim();
    if (n) nameByEmail.set((c.email as string).toLowerCase(), n);
  }

  // Tokens are generated by the recipients table default, so we only supply the
  // email here. Each row is its own guest with its own gallery link. We select
  // the tokens back so we can email each guest their personal gallery.
  const recipientRows = emails.map((email) => ({
    delivery_id: delivery.id,
    email,
    name: nameByEmail.get(email) ?? null,
  }));
  const { data: recipients, error: rErr } = await supabase
    .from("recipients")
    .insert(recipientRows)
    .select("id, email, name, token");
  if (rErr || !recipients) {
    await cleanupFailedSend(delivery.id, input.photos.map((p) => p.storageKey));
    return { error: "Could not save the recipients. Try again." };
  }

  // Meter the send: bump this operator's monthly recipient counter by the
  // number of guests. This is the only place usage is incremented. The review
  // ask that fires later is downstream and is never metered.
  await incrementRecipientsUsed(operatorId, emails.length);

  // Consume the QR sign-ups this send served. Keyed on the recipient EMAILS,
  // not just the chips that were auto loaded, so a guest is marked used no
  // matter how their email got onto the send (auto loaded, pasted by hand, or
  // a send under a slightly different trip time than they signed up for).
  // Otherwise a delivered guest keeps reappearing in the QR slot. Both sides
  // store email lowercased, so the match is exact. Scoped to this operator.
  // Best effort: the send already exists, so a failure just means they might
  // reappear until the next send or a manual cleanup.
  {
    const admin = createAdminClient();
    const { error: cgErr } = await admin
      .from("captured_guests")
      .update({ consumed_at: new Date().toISOString() })
      .eq("operator_id", operatorId)
      .is("consumed_at", null)
      .in("email", emails);
    if (cgErr) {
      console.error(
        `captured guest consume failed for delivery ${delivery.id}: ${cgErr.message}`,
      );
    }
  }

  // Ship it: email each guest their gallery link. Best effort, run in parallel,
  // and never fail the send over it. The delivery exists either way, and the
  // operator can resend from the confirmation page if needed.
  const { data: operator } = await supabase
    .from("operators")
    .select("name")
    .eq("id", operatorId)
    .maybeSingle();

  // Guest links always live on the canonical domain, never the host the
  // operator happens to be browsing (a preview URL would email dead links).
  const baseUrl = CANONICAL_ORIGIN;
  const message = input.customMessage || branding?.default_message || "";

  let emailed = 0;
  const failed: string[] = [];
  // Scope block: everything below builds and sends the guest emails.
  {
    const deliveryFrom = await resolveFromAddress(operatorId, operator?.name ?? "your crew");
    const deliveryReplyTo = branding?.reply_to_email ?? null;
    const messages: BatchEmail[] = recipients.map((r) => {
      const { subject, html } = buildDeliveryEmail({
        operatorName: operator?.name ?? "your crew",
        brandColor: branding?.brand_color ?? "#0b5563",
        ...brandLookFromRow(branding),
        logoUrl: branding?.logo_url ?? null,
        retentionDays,
        recipientName: (r.name as string | null) ?? null,
        tripDate: formatTripDate(input.tripDatetime),
        captainName: input.captainName,
        naturalistName: input.naturalistName,
        photographerName: input.photographerName,
        species: input.species,
        message,
        galleryUrl: `${baseUrl}/g/${r.token}`,
        social: {
          website_url: branding?.website_url ?? null,
          facebook_url: branding?.facebook_url ?? null,
          instagram_url: branding?.instagram_url ?? null,
          tiktok_url: branding?.tiktok_url ?? null,
          youtube_url: branding?.youtube_url ?? null,
          x_url: branding?.x_url ?? null,
        },
      });
      return { to: r.email, subject, html };
    });

    // One batch call per 100 guests keeps the whole send inside Resend's
    // rate limit. If a batch is rejected, fall back to one guest at a time,
    // spaced under the 2 per second cap, so one bad response cannot silently
    // drop a whole boat. Every failure is collected and reported by address.
    // Remember each guest's Resend email id so the webhook can report what
    // happened (delivered, bounced) back onto their row. Best effort.
    const rememberId = async (recipientId: string, resendId: string | null) => {
      if (!resendId) return;
      const { error: idErr } = await supabase
        .from("recipients")
        .update({ resend_email_id: resendId })
        .eq("id", recipientId);
      if (idErr) {
        console.error(`createSend: storing resend id for ${recipientId} failed: ${idErr.message}`);
      }
    };
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const batch = await sendEmailBatch(chunk, deliveryFrom, deliveryReplyTo);
      if (batch.status === "sent") {
        emailed += chunk.length;
        await Promise.all(chunk.map((_, j) => rememberId(recipients[i + j].id, batch.ids[j] ?? null)));
        continue;
      }
      if (batch.status === "skipped") {
        continue;
      }
      for (let j = 0; j < chunk.length; j++) {
        const m = chunk[j];
        const single = await sendEmail(m.to, m.subject, m.html, deliveryFrom, deliveryReplyTo);
        if (single.status === "sent") {
          emailed += 1;
          await rememberId(recipients[i + j].id, single.ids[0] ?? null);
        } else if (single.status === "error") {
          failed.push(m.to);
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (failed.length) {
      console.error(
        `createSend ${delivery.id}: ${failed.length} of ${recipients.length} delivery emails failed: ${failed.join(", ")}`,
      );
    }
  }

  return {
    ok: true,
    deliveryId: delivery.id,
    recipientCount: emails.length,
    emailed,
    failed,
  };
}

function formatTripDate(tripDatetime: string | null): string | null {
  if (!tripDatetime) return null;
  return new Date(tripDatetime).toLocaleDateString("en-US", { dateStyle: "long" });
}

// Best effort rollback. Deleting the delivery cascades the photo and recipient
// rows; we also drop the uploaded files so a failed send leaves nothing behind.
async function cleanupFailedSend(deliveryId: string, storageKeys: string[]) {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("deliveries")
    .delete()
    .eq("id", deliveryId);
  if (delErr) {
    console.error(`cleanup: delivery ${deliveryId} delete failed: ${delErr.message}`);
  }
  if (storageKeys.length) {
    const { error: rmErr } = await admin.storage.from("photos").remove(storageKeys);
    if (rmErr) {
      console.error(
        `cleanup: removing ${storageKeys.length} photos for delivery ${deliveryId} failed: ${rmErr.message}`,
      );
    }
  }
}
