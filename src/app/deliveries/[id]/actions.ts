/*
  Per guest actions on the Send created page: fix a guest's email, and resend
  the gallery delivery email to a guest. Both go through the RLS client, so an
  operator can only touch recipients on their own deliveries.
*/
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, operatorFromAddress } from "@/lib/email";
import { buildDeliveryEmail } from "@/lib/delivery-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RowResult = { ok: true; email?: string } | { error: string };

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

export async function resendDelivery(recipientId: string): Promise<RowResult> {
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("recipients")
    .select("email, token, delivery_id")
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
    .select("brand_color, logo_url, default_message, reply_to_email")
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
    recipientName: null,
    tripDate: formatTripDate(d.trip_datetime),
    captainName: d.captain_name,
    naturalistName: d.naturalist_name,
    photographerName: d.photographer_name,
    species: (d.species ?? []) as string[],
    message: d.custom_message || branding?.default_message || "",
    galleryUrl: `${baseUrl}/g/${r.token}`,
  });

  const result = await sendEmail(
    r.email,
    subject,
    html,
    operatorFromAddress(operator?.name ?? "your crew"),
    branding?.reply_to_email ?? null,
  );
  if (result.status === "sent") {
    return { ok: true };
  }
  if (result.status === "skipped") {
    return { error: "Email service is not configured yet." };
  }
  return { error: "Could not resend. Try again." };
}
