/*
  Per guest actions on the Send created page: fix a guest's email, and resend
  the gallery delivery email to a guest. Both go through the RLS client, so an
  operator can only touch recipients on their own deliveries.
*/
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { getTrialUsage, getPlan } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getRecipientsUsed, incrementRecipientsUsed } from "@/lib/usage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RowResult = { ok: true; email?: string } | { error: string };

export type AddGuestResult =
  | { ok: true; email: string; emailed: boolean }
  | { error: string; upgrade?: boolean };

// Add a forgotten guest to a send that already went out. They get their own
// recipient row, their own gallery token, and their own review ask later, the
// same as everyone who was on the original send. Gated by the same plan rules
// as a new send, for one more guest, and metered the same way.
export async function addRecipient(
  deliveryId: string,
  emailRaw: string,
): Promise<AddGuestResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email." };
  }
  const supabase = await createClient();

  // RLS scopes this read to the operator's own sends.
  const { data: d } = await supabase
    .from("deliveries")
    .select("id, operator_id, expires_at")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) {
    return { error: "Send not found." };
  }
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) {
    return { error: "This send has expired. Create a new send instead." };
  }

  const { data: existing } = await supabase
    .from("recipients")
    .select("id")
    .eq("delivery_id", deliveryId)
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return { error: "That guest is already on this send." };
  }

  const operatorId = d.operator_id as string;
  const usage = await getTrialUsage(supabase, operatorId);
  if (usage.status === "canceled") {
    return {
      error: "This account has no active plan. Choose a plan to add guests.",
      upgrade: true,
    };
  }
  // Trial has no per guest limit, only a transfer count, and adding a guest to
  // an existing send is not a new transfer. So only active operators, held to
  // their plan's caps, are checked here.
  if (usage.status === "active") {
    const plan = PLANS[(await getPlan(supabase, operatorId)).tier];
    const { count: onSend } = await supabase
      .from("recipients")
      .select("*", { count: "exact", head: true })
      .eq("delivery_id", deliveryId);
    if ((onSend ?? 0) + 1 > plan.emailsPerSend) {
      return {
        error: `This send is at your ${plan.displayName} plan limit of ${plan.emailsPerSend} guests per send.`,
        upgrade: true,
      };
    }
    if (plan.emailsPerMonth !== null) {
      const used = await getRecipientsUsed(supabase, operatorId);
      if (used + 1 > plan.emailsPerMonth) {
        return {
          error: `You are at your ${plan.displayName} plan limit of ${plan.emailsPerMonth} emails this month.`,
          upgrade: true,
        };
      }
    }
  }

  const { data: inserted, error: iErr } = await supabase
    .from("recipients")
    .insert({ delivery_id: deliveryId, email })
    .select("id")
    .single();
  if (iErr || !inserted) {
    return { error: "Could not add the guest. Try again." };
  }

  await incrementRecipientsUsed(operatorId, 1);

  // Email them their gallery link through the same path as the Resend button.
  // If it fails they are still on the send, with Resend right there.
  const sent = await resendDelivery(inserted.id as string);
  return { ok: true, email, emailed: !("error" in sent) };
}

export async function updateRecipientEmail(
  recipientId: string,
  emailRaw: string,
): Promise<RowResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Enter a valid email." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipients")
    .update({ email })
    .eq("id", recipientId);
  if (error) {
    return { error: "Could not update the email. Try again." };
  }
  return { ok: true, email };
}

function formatTripDate(tripDatetime: string | null): string | null {
  if (!tripDatetime) return null;
  return new Date(tripDatetime).toLocaleDateString("en-US", { dateStyle: "long" });
}

// Permanently delete a send. Rows go first through the RLS client (so an
// operator can only ever delete their own, and gallery links plus analytics
// update the moment it lands), then the storage objects via the admin client,
// since the private bucket has no member policies and cascade cannot reach it.
// Usage metering is deliberately not refunded: the emails went out.
export async function deleteDelivery(
  deliveryId: string,
): Promise<{ error: string }> {
  const supabase = await createClient();

  const { data: photos, error: pErr } = await supabase
    .from("photos")
    .select("storage_key")
    .eq("delivery_id", deliveryId);
  if (pErr) {
    return { error: "Could not load the send. Try again." };
  }
  const keys = (photos ?? []).map((p) => p.storage_key as string);

  const { error: dErr, count } = await supabase
    .from("deliveries")
    .delete({ count: "exact" })
    .eq("id", deliveryId);
  if (dErr || !count) {
    return { error: "Could not delete the send. Try again." };
  }

  if (keys.length) {
    const admin = createAdminClient();
    const { error: rmErr } = await admin.storage.from("photos").remove(keys);
    if (rmErr) {
      console.error(
        `delete send ${deliveryId}: removing ${keys.length} photos from storage failed: ${rmErr.message}`,
      );
    }
  }

  redirect("/send");
}

export async function resendDelivery(recipientId: string): Promise<RowResult> {
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("recipients")
    .select("email, name, token, delivery_id")
    .eq("id", recipientId)
    .maybeSingle();
  if (!r) {
    return { error: "Guest not found." };
  }

  const { data: d } = await supabase
    .from("deliveries")
    .select("operator_id, trip_datetime, species, captain_name, naturalist_name, photographer_name, custom_message")
    .eq("id", r.delivery_id)
    .maybeSingle();
  if (!d) {
    return { error: "Send not found." };
  }

  const { data: operator } = await supabase
    .from("operators")
    .select("name")
    .eq("id", d.operator_id)
    .maybeSingle();
  const { data: branding } = await supabase
    .from("branding")
    .select(
      "retention_days, brand_color, logo_url, default_message, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
    )
    .eq("operator_id", d.operator_id)
    .maybeSingle();

  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";

  const { subject, html } = buildDeliveryEmail({
    operatorName: operator?.name ?? "your crew",
    brandColor: branding?.brand_color ?? "#0b5563",
    logoUrl: branding?.logo_url ?? null,
    retentionDays: (branding?.retention_days as number | null) ?? 7,
    recipientName: (r.name as string | null) ?? null,
    tripDate: formatTripDate(d.trip_datetime),
    captainName: d.captain_name,
    naturalistName: d.naturalist_name,
    photographerName: d.photographer_name,
    species: (d.species ?? []) as string[],
    message: d.custom_message || branding?.default_message || "",
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

  const result = await sendEmail(
    r.email,
    subject,
    html,
    await resolveFromAddress(d.operator_id as string, operator?.name ?? "your crew"),
    branding?.reply_to_email ?? null,
  );
  if (result.status === "sent") {
    // Fresh attempt: track the new email id and clear any old bounce so a
    // corrected address gets a clean slate on the guest row.
    const { error: idErr } = await supabase
      .from("recipients")
      .update({
        resend_email_id: result.ids[0] ?? null,
        email_status: null,
        email_status_at: null,
      })
      .eq("id", recipientId);
    if (idErr) {
      console.error(
        `resendDelivery: storing resend id for ${recipientId} failed: ${idErr.message}`,
      );
    }
    return { ok: true };
  }
  if (result.status === "skipped") {
    return { error: "Email service is not configured yet." };
  }
  return { error: "Could not resend. Try again." };
}
