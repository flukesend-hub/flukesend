/*
  Guest gallery lookup. Guests are not signed in, so RLS would hide everything;
  the gallery is reached purely by the recipient's unguessable token and read
  server side with the service role. This helper resolves a token to its
  recipient, delivery, operator, and branding in one place, reused by the
  gallery page and the download and open route handlers.
*/
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTipUrl,
  isTipProvider,
  normalizeTipHandle,
  tipFirstName,
  tipProviderVerb,
  type TipProvider,
} from "@/lib/tips";

export type GalleryData = {
  recipient: { id: string; email: string; name: string | null; token: string };
  delivery: {
    id: string;
    operator_id: string;
    created_by: string | null;
    trip_datetime: string | null;
    species: string[];
    captain_name: string | null;
    naturalist_name: string | null;
    photographer_name: string | null;
    crew_names: string[];
    boat_name: string | null;
    custom_message: string | null;
    expires_at: string;
  };
  operator: { id: string; name: string; tips_enabled: boolean; tips_show_review: boolean };
  branding: {
    logo_url: string | null;
    brand_color: string;
    accent_color: string | null;
    font_key: string | null;
    copy_overrides: Record<string, string> | null;
    default_message: string;
  } | null;
};

export async function getGalleryByToken(
  token: string,
): Promise<GalleryData | null> {
  const admin = createAdminClient();

  const { data: recipient } = await admin
    .from("recipients")
    .select("id, email, name, token, delivery_id")
    .eq("token", token)
    .maybeSingle();
  if (!recipient) {
    return null;
  }

  const { data: delivery } = await admin
    .from("deliveries")
    .select(
      "id, operator_id, created_by, trip_datetime, species, captain_name, naturalist_name, photographer_name, crew_names, boat_name, custom_message, expires_at",
    )
    .eq("id", recipient.delivery_id)
    .maybeSingle();
  if (!delivery) {
    return null;
  }

  const { data: operator } = await admin
    .from("operators")
    .select("id, name, tips_enabled, tips_show_review")
    .eq("id", delivery.operator_id)
    .maybeSingle();

  const { data: branding } = await admin
    .from("branding")
    .select("logo_url, brand_color, accent_color, font_key, copy_overrides, default_message")
    .eq("operator_id", delivery.operator_id)
    .maybeSingle();

  return {
    recipient: {
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      token: recipient.token,
    },
    delivery,
    operator: operator
      ? {
          id: operator.id,
          name: operator.name,
          tips_enabled: Boolean(operator.tips_enabled),
          tips_show_review: Boolean(operator.tips_show_review),
        }
      : { id: delivery.operator_id, name: "Operator", tips_enabled: false, tips_show_review: false },
    branding: branding ?? null,
  };
}

export function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now();
}

export type GalleryTip = {
  provider: TipProvider;
  firstName: string;
  // "opens Venmo", for the small grey cue on the gallery.
  verb: string;
  // The built payment URL. Kept server side (the gallery links through the
  // tracked /tip route); the tip route uses it for the redirect.
  url: string;
};

/*
  Resolve the tip for a gallery, or null when there is nothing to show. The gate
  is the two flag model: the operator must have tipping on, and the send's
  creator (the photographer who made it) must have a provider and handle set.
  Either missing, no tip. Shared by the gallery page and the /tip route so both
  gate the exact same way.
*/
export async function resolveGalleryTip(data: GalleryData): Promise<GalleryTip | null> {
  if (!data.operator.tips_enabled) return null;
  const uid = data.delivery.created_by;
  if (!uid) return null;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("operator_members")
    .select("display_name, tip_provider, tip_handle")
    .eq("operator_id", data.delivery.operator_id)
    .eq("user_id", uid)
    .maybeSingle();
  if (!member) return null;

  const provider = member.tip_provider as string | null;
  if (!isTipProvider(provider) || !member.tip_handle) return null;
  const handle = normalizeTipHandle(member.tip_handle as string);
  if (!handle) return null;

  // Only pay for the auth lookup when we have no better name to show.
  let email: string | null = null;
  if (!member.display_name && !data.delivery.photographer_name) {
    const { data: u } = await admin.auth.admin.getUserById(uid);
    email = u?.user?.email ?? null;
  }
  const firstName = tipFirstName(
    (member.display_name as string | null) ?? null,
    data.delivery.photographer_name,
    email,
  );

  return { provider, firstName, verb: tipProviderVerb(provider), url: buildTipUrl(provider, handle) };
}
