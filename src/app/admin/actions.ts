/*
  Admin actions. Set any operator's plan from the admin table, and edit an
  operator's branding for support. Everything is gated by requireAdmin and runs
  with the service role, since it writes other operators' rows across RLS.

  Plans: "trial" removes the subscription row (they fall back to the free trial
  and can subscribe in app); "fleet" comps them on the paid plan with no Stripe
  ids. Changing the plan is refused when a real Stripe customer exists, so a
  paying subscription is never orphaned.
*/
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { sendEmail } from "@/lib/email";
import { uploadOperatorLogo } from "@/lib/logo-upload";
import { SOCIAL_PLATFORMS, normalizeSocialUrl } from "@/lib/social";
import {
  createSenderDomain,
  checkSenderDomain,
  removeSenderDomain,
  resolveFromAddress,
} from "@/lib/sender-domain";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

export type AdminState = { error?: string; ok?: string } | undefined;

const PLANS = ["trial", "canceled", "fleet"] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function setPlan(operatorId: string, plan: string): Promise<AdminState> {
  await requireAdmin();
  if (!operatorId) return { error: "Missing operator." };
  if (!(PLANS as readonly string[]).includes(plan)) return { error: "Pick a valid plan." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("operator_id", operatorId)
    .maybeSingle();
  if (sub?.stripe_customer_id) {
    return { error: "This operator pays through Stripe. Manage their plan in Stripe." };
  }

  if (plan === "trial") {
    // Back to the free trial (with its free allowance).
    await admin.from("subscriptions").delete().eq("operator_id", operatorId);
  } else if (plan === "canceled") {
    // No plan: no free allowance, they must buy before sending.
    const { error } = await admin
      .from("subscriptions")
      .upsert({ operator_id: operatorId, status: "canceled", tier: null }, { onConflict: "operator_id" });
    if (error) return { error: "Could not update the plan. Try again." };
  } else {
    const { error } = await admin
      .from("subscriptions")
      .upsert({ operator_id: operatorId, status: "active", tier: plan }, { onConflict: "operator_id" });
    if (error) return { error: "Could not update the plan. Try again." };
  }

  revalidatePath("/admin");
  return { ok: "Plan updated." };
}

// Edit an operator's branding for support. Same fields the operator can edit
// themselves (logo, color, default message, retention, website and socials),
// but scoped to any operator by id and written with the service role.
export async function adminUpdateBranding(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const operatorId = String(formData.get("operator_id") ?? "");
  if (!operatorId) return { error: "Missing operator." };

  const brandColor = (String(formData.get("brand_color") ?? "").trim() || "#0b5563").toLowerCase();
  const defaultMessage = String(formData.get("default_message") ?? "").trim();
  const retentionRaw = Number(formData.get("retention_days"));
  if (!HEX.test(brandColor)) return { error: "Pick a valid brand color." };
  const retentionDays = Number.isFinite(retentionRaw) ? Math.trunc(retentionRaw) : NaN;
  if (![3, 5, 7].includes(retentionDays)) return { error: "Pick 3, 5, or 7 days of retention." };

  const upload = await uploadOperatorLogo(operatorId, formData.get("logo"));
  if (!upload.ok) return { error: upload.error };

  const update: Record<string, unknown> = {
    brand_color: brandColor,
    default_message: defaultMessage,
    retention_days: retentionDays,
  };
  if (upload.logoUrl) update.logo_url = upload.logoUrl;
  for (const p of SOCIAL_PLATFORMS) {
    const r = normalizeSocialUrl(String(formData.get(p.key) ?? ""));
    if ("error" in r) return { error: `${p.label}: ${r.error}` };
    update[p.column] = r.url;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("branding").update(update).eq("operator_id", operatorId);
  if (error) return { error: "Could not save branding. Try again." };

  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin");
  return { ok: "Branding saved." };
}

// ---- White label sender domain, concierge mode ----
// Admin sets up any operator's domain regardless of tier: comping is a
// support decision, same as setPlan. The operator-facing self serve flow is
// deliberately not exposed; the first Fleet customers get walked through it.

export async function adminCreateSenderDomain(
  operatorId: string,
  domain: string,
): Promise<AdminState> {
  await requireAdmin();
  const res = await createSenderDomain(operatorId, domain);
  if ("error" in res) {
    return { error: res.error };
  }
  revalidatePath(`/admin/operators/${operatorId}`);
  return { ok: "Domain created. Send the directions, then check verification." };
}

export async function adminCheckSenderDomain(operatorId: string): Promise<AdminState> {
  await requireAdmin();
  const res = await checkSenderDomain(operatorId);
  if ("error" in res) {
    return { error: res.error };
  }
  revalidatePath(`/admin/operators/${operatorId}`);
  return res.status === "verified"
    ? { ok: "Verified. Their guest email now sends from their domain." }
    : { ok: "Not verified yet. DNS can take a while to spread." };
}

export async function adminRemoveSenderDomain(operatorId: string): Promise<AdminState> {
  await requireAdmin();
  const res = await removeSenderDomain(operatorId);
  if ("error" in res) {
    return { error: res.error };
  }
  revalidatePath(`/admin/operators/${operatorId}`);
  return { ok: "Domain removed. Their email sends from flukesend.com again." };
}

// ---- Review links, support mode ----
// Same validation as the operator's own settings, but scoped to any operator
// and written with the service role. This is how the admin turns the review
// engine on for an operator who never set their links up.

export async function adminAddReviewLink(
  operatorId: string,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  if (!operatorId) return { error: "Missing operator." };

  const label = String(formData.get("label") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (!label) return { error: "Enter a label for the link." };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return { error: "Enter a valid URL." };
  }

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("review_destinations")
    .select("sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin.from("review_destinations").insert({
    operator_id: operatorId,
    label,
    url,
    sort_order: ((last?.sort_order as number | null) ?? -1) + 1,
  });
  if (error) return { error: "Could not add the link. Try again." };

  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin");
  return { ok: "Link added. Their review engine is on." };
}

export async function adminDeleteReviewLink(
  operatorId: string,
  id: string,
): Promise<AdminState> {
  await requireAdmin();
  if (!operatorId || !id) return { error: "Missing link." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("review_destinations")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId);
  if (error) return { error: "Could not remove the link. Try again." };
  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin");
  return { ok: "Link removed." };
}

// ---- Bounced guests, support mode ----
// Correct a bounced address on the operator's behalf and resend their gallery
// email in one move. Resend only happens while the gallery is still live; on
// an expired send the corrected address is saved for the export list but no
// dead link goes out.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function adminFixBouncedEmail(
  recipientId: string,
  emailRaw: string,
): Promise<AdminState> {
  await requireAdmin();
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };

  const admin = createAdminClient();
  const { data: r } = await admin
    .from("recipients")
    .select("id, name, token, delivery_id")
    .eq("id", recipientId)
    .maybeSingle();
  if (!r) return { error: "Guest not found." };

  const { data: d } = await admin
    .from("deliveries")
    .select(
      "operator_id, trip_datetime, species, captain_name, naturalist_name, photographer_name, custom_message, expires_at",
    )
    .eq("id", r.delivery_id)
    .maybeSingle();
  if (!d) return { error: "Send not found." };

  // Save the corrected address first; even if the resend fails the export
  // list is fixed. The bounce mark stays until a send actually succeeds.
  const { error: upErr } = await admin
    .from("recipients")
    .update({ email })
    .eq("id", recipientId);
  if (upErr) return { error: "Could not update the email. Try again." };

  const operatorId = d.operator_id as string;
  const expired = !!d.expires_at && new Date(d.expires_at as string) < new Date();
  if (expired) {
    revalidatePath(`/admin/operators/${operatorId}`);
    revalidatePath("/admin");
    return { ok: "Address saved. The gallery has expired, so no email was sent." };
  }

  const [{ data: operator }, { data: branding }] = await Promise.all([
    admin.from("operators").select("name").eq("id", operatorId).maybeSingle(),
    admin
      .from("branding")
      .select(
        "retention_days, brand_color, logo_url, default_message, reply_to_email, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", operatorId)
      .maybeSingle(),
  ]);

  // Canonical domain, never the admin's browsing host. See base-url.ts.
  const baseUrl = CANONICAL_ORIGIN;

  const { subject, html } = buildDeliveryEmail({
    operatorName: operator?.name ?? "your crew",
    brandColor: branding?.brand_color ?? "#0b5563",
    logoUrl: branding?.logo_url ?? null,
    retentionDays: (branding?.retention_days as number | null) ?? 7,
    recipientName: (r.name as string | null) ?? null,
    tripDate: d.trip_datetime
      ? new Date(d.trip_datetime as string).toLocaleDateString("en-US", { dateStyle: "long" })
      : null,
    captainName: d.captain_name,
    naturalistName: d.naturalist_name,
    photographerName: d.photographer_name,
    species: (d.species ?? []) as string[],
    message: (d.custom_message as string | null) || branding?.default_message || "",
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
    email,
    subject,
    html,
    await resolveFromAddress(operatorId, operator?.name ?? "your crew"),
    branding?.reply_to_email ?? null,
  );
  if (result.status === "sent") {
    // Fresh attempt: new email id, bounce cleared so the guest row starts over.
    const { error: idErr } = await admin
      .from("recipients")
      .update({
        resend_email_id: result.ids[0] ?? null,
        email_status: null,
        email_status_at: null,
      })
      .eq("id", recipientId);
    if (idErr) {
      console.error(
        `adminFixBouncedEmail: storing resend id for ${recipientId} failed: ${idErr.message}`,
      );
    }
    revalidatePath(`/admin/operators/${operatorId}`);
    revalidatePath("/admin");
    return { ok: `Saved and resent to ${email}.` };
  }
  if (result.status === "skipped") {
    return { error: "Address saved, but the email service is not configured." };
  }
  return { error: "Address saved, but the resend failed. Try again." };
}

// Remove a dead address entirely: the guest row and its events go (cascade),
// so the bounce stops counting against the operator's numbers and the address
// never lands in their export. For typos prefer the fix-and-resend path; this
// is for addresses that cannot be salvaged. Usage is not refunded, matching
// the operator's own delete semantics.
export async function adminDeleteRecipient(recipientId: string): Promise<AdminState> {
  await requireAdmin();
  if (!recipientId) return { error: "Missing guest." };

  const admin = createAdminClient();
  // Resolve the operator first so the right pages revalidate after the delete.
  const { data: r } = await admin
    .from("recipients")
    .select("id, deliveries!inner(operator_id)")
    .eq("id", recipientId)
    .maybeSingle();
  if (!r) return { error: "Guest not found." };
  const operatorId = (r as unknown as { deliveries: { operator_id: string } }).deliveries
    .operator_id;

  const { error } = await admin.from("recipients").delete().eq("id", recipientId);
  if (error) return { error: "Could not delete the guest. Try again." };

  revalidatePath(`/admin/operators/${operatorId}`);
  revalidatePath("/admin");
  return { ok: "Guest removed. The bounce no longer counts against their numbers." };
}
