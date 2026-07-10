/*
  Branding tab actions: the shared brand look (logo, colors, font pack), the
  per surface copy overrides, and the test send. Any member can edit branding
  (it is not owner gated; only tips policy, billing, and deletion are). Writes
  go through the RLS client, which already allows members to update their
  operator's branding row. The logo upload uses the shared trusted helper.

  Copy saves validate hard: only approved tokens, within each field's length
  limit. A value equal to the default (or blank) removes the override so the
  row stays clean and future default improvements reach everyone who never
  customized.
*/
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOperatorLogo } from "@/lib/logo-upload";
import { sendEmail } from "@/lib/email";
import { resolveFromAddress } from "@/lib/sender-domain";
import { buildDeliveryEmail } from "@/lib/delivery-email";
import { buildReviewEmail } from "@/lib/review-email";
import { isFontKey, isTextTone } from "@/lib/brand-fonts";
import {
  DELIVERY_COPY,
  REVIEW_COPY,
  GALLERY_COPY,
  findUnknownTokens,
  type CopyField,
  type CopyOverrides,
} from "@/lib/brand-copy";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

export type BrandingState =
  | { error?: string; ok?: string }
  | undefined;

const HEX = /^#[0-9a-fA-F]{6}$/;

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
  return {
    supabase,
    operatorId: membership.operator_id as string,
    userEmail: user.email ?? null,
  };
}

function revalidateBranding() {
  revalidatePath("/branding");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/send");
}

// ---- Brand look: logo, colors, font pack ----

export async function saveBrandLook(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  const { supabase, operatorId } = await resolveOperator();

  const brandColor = (String(formData.get("brand_color") ?? "").trim() || "#0b5563").toLowerCase();
  if (!HEX.test(brandColor)) {
    return { error: "Pick a valid brand color." };
  }
  // Blank means "match the brand color" and stores null.
  const accentRaw = String(formData.get("accent_color") ?? "").trim().toLowerCase();
  if (accentRaw && !HEX.test(accentRaw)) {
    return { error: "Pick a valid accent color." };
  }
  const headerTextRaw = String(formData.get("header_text_color") ?? "").trim().toLowerCase();
  if (headerTextRaw && !HEX.test(headerTextRaw)) {
    return { error: "Pick a valid header text color." };
  }
  const fontRaw = String(formData.get("font_key") ?? "").trim();
  if (fontRaw && !isFontKey(fontRaw)) {
    return { error: "Pick a font from the pack." };
  }
  const toneRaw = String(formData.get("text_tone") ?? "").trim();
  if (toneRaw && !isTextTone(toneRaw)) {
    return { error: "Pick a text darkness." };
  }

  const upload = await uploadOperatorLogo(operatorId, formData.get("logo"));
  if (!upload.ok) {
    return { error: upload.error };
  }

  const update: Record<string, unknown> = {
    brand_color: brandColor,
    // An accent equal to the brand color is the same as "match", store null.
    accent_color: accentRaw && accentRaw !== brandColor ? accentRaw : null,
    header_text_color: headerTextRaw && headerTextRaw !== "#ffffff" ? headerTextRaw : null,
    font_key: fontRaw && fontRaw !== "classic" ? fontRaw : null,
    text_tone: toneRaw && toneRaw !== "standard" ? toneRaw : null,
  };
  if (upload.logoUrl) {
    update.logo_url = upload.logoUrl;
  }

  const { error } = await supabase
    .from("branding")
    .update(update)
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your brand look. Try again." };
  }

  revalidateBranding();
  return { ok: "Brand look saved." };
}

// ---- Copy overrides ----

// Validate one field's posted value. Returns the cleaned value, null when the
// override should be removed (blank or same as default), or an error string.
function cleanCopyValue(
  field: CopyField,
  raw: string,
): { value: string | null } | { error: string } {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value || value === field.default) {
    return { value: null };
  }
  if (value.length > field.limit) {
    return { error: `${field.label} is over the ${field.limit} character limit.` };
  }
  const unknown = findUnknownTokens(value);
  if (unknown.length) {
    return {
      error: `${field.label}: ${unknown.join(", ")} is not a token we know. You can use {operator_name}, {first_name}, {species}, {date}, {photographer_name}, or {crew}.`,
    };
  }
  return { value };
}

// Shared save for one surface's fields: validate each, then read-modify-write
// copy_overrides so the other surfaces' overrides survive. extra lets the
// delivery save also carry the intro (default_message, its own column).
async function saveCopyFields(
  fields: CopyField[],
  formData: FormData,
  extra?: Record<string, unknown>,
): Promise<BrandingState> {
  const { supabase, operatorId } = await resolveOperator();

  const patch: Record<string, string | null> = {};
  for (const field of fields) {
    const cleaned = cleanCopyValue(field, String(formData.get(field.key) ?? ""));
    if ("error" in cleaned) {
      return { error: cleaned.error };
    }
    patch[field.key] = cleaned.value;
  }

  const { data: row } = await supabase
    .from("branding")
    .select("copy_overrides")
    .eq("operator_id", operatorId)
    .maybeSingle();
  const overrides: CopyOverrides = { ...((row?.copy_overrides ?? {}) as CopyOverrides) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete overrides[key];
    else overrides[key] = value;
  }

  const { error } = await supabase
    .from("branding")
    .update({ copy_overrides: overrides, ...(extra ?? {}) })
    .eq("operator_id", operatorId);
  if (error) {
    return { error: "Could not save your wording. Try again." };
  }

  revalidateBranding();
  return { ok: "Wording saved." };
}

export async function saveDeliveryCopy(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  // The intro is the existing default guest message, same column as always,
  // so the send page prefill and the gallery keep reading it unchanged.
  const intro = String(formData.get("default_message") ?? "").trim();
  return saveCopyFields(DELIVERY_COPY, formData, { default_message: intro });
}

export async function saveReviewCopy(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  return saveCopyFields(REVIEW_COPY, formData);
}

export async function saveGalleryCopy(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  // The gallery's intro is the same default_message shown atop the delivery
  // email; editable from either surface, saved to the one column.
  const intro = String(formData.get("default_message") ?? "").trim();
  return saveCopyFields(GALLERY_COPY, formData, { default_message: intro });
}

// ---- Test send ----

// The draft the workbench is showing right now, so the test matches the
// preview exactly, saved or not. The unsaved logo file is the one exception:
// it only exists in the browser, so the test uses the saved logo.
export type DeliveryTestDraft = {
  brandColor: string;
  accentColor: string | null;
  headerTextColor: string | null;
  fontKey: string | null;
  textTone: string | null;
  copy: Record<string, string>;
  message: string;
};

export async function sendTestDelivery(draft: DeliveryTestDraft): Promise<BrandingState> {
  const { supabase, operatorId, userEmail } = await resolveOperator();
  if (!userEmail) {
    return { error: "Could not find your login email." };
  }

  if (!HEX.test(draft.brandColor)) return { error: "Pick a valid brand color." };
  if (draft.accentColor && !HEX.test(draft.accentColor)) return { error: "Pick a valid accent color." };
  if (draft.headerTextColor && !HEX.test(draft.headerTextColor)) return { error: "Pick a valid header text color." };
  if (draft.fontKey && !isFontKey(draft.fontKey)) return { error: "Pick a font from the pack." };
  if (draft.textTone && !isTextTone(draft.textTone)) return { error: "Pick a text darkness." };

  const overrides: CopyOverrides = {};
  for (const field of DELIVERY_COPY) {
    const cleaned = cleanCopyValue(field, draft.copy[field.key] ?? "");
    if ("error" in cleaned) return { error: cleaned.error };
    if (cleaned.value) overrides[field.key] = cleaned.value;
  }

  const [{ data: operator }, { data: branding }] = await Promise.all([
    supabase.from("operators").select("name").eq("id", operatorId).maybeSingle(),
    supabase
      .from("branding")
      .select(
        "logo_url, retention_days, reply_to_email, species_options, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", operatorId)
      .maybeSingle(),
  ]);
  const operatorName = (operator?.name as string) ?? "Your crew";
  const species = ((branding?.species_options ?? []) as string[]).slice(0, 2);

  const { subject, html } = buildDeliveryEmail({
    operatorName,
    brandColor: draft.brandColor,
    accentColor: draft.accentColor,
    headerTextColor: draft.headerTextColor,
    fontKey: draft.fontKey,
    textTone: draft.textTone,
    copyOverrides: overrides,
    logoUrl: (branding?.logo_url as string | null) ?? null,
    recipientName: "Alex Rivera",
    tripDate: new Date().toLocaleDateString("en-US", { dateStyle: "long" }),
    captainName: "Ray",
    naturalistName: "Maya",
    photographerName: "Jordan",
    species: species.length ? species : ["Humpback whales"],
    message: draft.message.trim(),
    galleryUrl: `${CANONICAL_ORIGIN}/`,
    retentionDays: (branding?.retention_days as number | null) ?? 7,
    social: {
      website_url: (branding?.website_url as string | null) ?? null,
      facebook_url: (branding?.facebook_url as string | null) ?? null,
      instagram_url: (branding?.instagram_url as string | null) ?? null,
      tiktok_url: (branding?.tiktok_url as string | null) ?? null,
      youtube_url: (branding?.youtube_url as string | null) ?? null,
      x_url: (branding?.x_url as string | null) ?? null,
    },
  });

  const result = await sendEmail(
    userEmail,
    `[Test] ${subject}`,
    html,
    await resolveFromAddress(operatorId, operatorName),
    (branding?.reply_to_email as string | null) ?? null,
  );
  if (result.status === "sent") {
    return { ok: `Test sent to ${userEmail}.` };
  }
  if (result.status === "skipped") {
    return { error: "Email service is not configured." };
  }
  return { error: "The test send failed. Try again." };
}

// Same idea for the review ask. The buttons are the operator's real review
// links (pointing straight at the destinations; no tracking on a test), so
// with no links there is nothing honest to send and we say so.
export type ReviewTestDraft = Omit<DeliveryTestDraft, "message">;

export async function sendTestReview(draft: ReviewTestDraft): Promise<BrandingState> {
  const { supabase, operatorId, userEmail } = await resolveOperator();
  if (!userEmail) {
    return { error: "Could not find your login email." };
  }

  if (!HEX.test(draft.brandColor)) return { error: "Pick a valid brand color." };
  if (draft.accentColor && !HEX.test(draft.accentColor)) return { error: "Pick a valid accent color." };
  if (draft.headerTextColor && !HEX.test(draft.headerTextColor)) return { error: "Pick a valid header text color." };
  if (draft.fontKey && !isFontKey(draft.fontKey)) return { error: "Pick a font from the pack." };
  if (draft.textTone && !isTextTone(draft.textTone)) return { error: "Pick a text darkness." };

  const overrides: CopyOverrides = {};
  for (const field of REVIEW_COPY) {
    const cleaned = cleanCopyValue(field, draft.copy[field.key] ?? "");
    if ("error" in cleaned) return { error: cleaned.error };
    if (cleaned.value) overrides[field.key] = cleaned.value;
  }

  const [{ data: operator }, { data: branding }, { data: links }] = await Promise.all([
    supabase.from("operators").select("name").eq("id", operatorId).maybeSingle(),
    supabase
      .from("branding")
      .select(
        "logo_url, reply_to_email, species_options, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", operatorId)
      .maybeSingle(),
    supabase
      .from("review_destinations")
      .select("label, url, sort_order")
      .eq("operator_id", operatorId)
      .order("sort_order", { ascending: true }),
  ]);
  if (!links?.length) {
    return { error: "Add a review link first (Settings, Review links), then the test has real buttons to show." };
  }
  const operatorName = (operator?.name as string) ?? "Your crew";
  const species = ((branding?.species_options ?? []) as string[]).slice(0, 2);
  const today = new Date().toLocaleDateString("en-US", { dateStyle: "long" });

  const { subject, html } = buildReviewEmail({
    operatorName,
    brandColor: draft.brandColor,
    accentColor: draft.accentColor,
    headerTextColor: draft.headerTextColor,
    fontKey: draft.fontKey,
    textTone: draft.textTone,
    copyOverrides: overrides,
    logoUrl: (branding?.logo_url as string | null) ?? null,
    recipientName: "Alex",
    tripLine: `${today} with Captain Ray`,
    tripDate: today,
    captainName: "Ray",
    species: species.length ? species : ["Humpback whales"],
    reviewLinks: (links ?? []).map((l) => ({ label: l.label as string, href: l.url as string })),
    social: {
      website_url: (branding?.website_url as string | null) ?? null,
      facebook_url: (branding?.facebook_url as string | null) ?? null,
      instagram_url: (branding?.instagram_url as string | null) ?? null,
      tiktok_url: (branding?.tiktok_url as string | null) ?? null,
      youtube_url: (branding?.youtube_url as string | null) ?? null,
      x_url: (branding?.x_url as string | null) ?? null,
    },
  });

  const result = await sendEmail(
    userEmail,
    `[Test] ${subject}`,
    html,
    await resolveFromAddress(operatorId, operatorName),
    (branding?.reply_to_email as string | null) ?? null,
  );
  if (result.status === "sent") {
    return { ok: `Test sent to ${userEmail}.` };
  }
  if (result.status === "skipped") {
    return { error: "Email service is not configured." };
  }
  return { error: "The test send failed. Try again." };
}
