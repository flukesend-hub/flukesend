/*
  Guest gallery lookup. Guests are not signed in, so RLS would hide everything;
  the gallery is reached purely by the recipient's unguessable token and read
  server side with the service role. This helper resolves a token to its
  recipient, delivery, operator, and branding in one place, reused by the
  gallery page and the download and open route handlers.
*/
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type GalleryData = {
  recipient: { id: string; email: string; name: string | null; token: string };
  delivery: {
    id: string;
    operator_id: string;
    trip_datetime: string | null;
    whale_count: number | null;
    species: string[];
    captain_name: string | null;
    crew_names: string[];
    custom_message: string | null;
    expires_at: string;
  };
  operator: { id: string; name: string };
  branding: {
    logo_url: string | null;
    brand_color: string;
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
      "id, operator_id, trip_datetime, whale_count, species, captain_name, crew_names, custom_message, expires_at",
    )
    .eq("id", recipient.delivery_id)
    .maybeSingle();
  if (!delivery) {
    return null;
  }

  const { data: operator } = await admin
    .from("operators")
    .select("id, name")
    .eq("id", delivery.operator_id)
    .maybeSingle();

  const { data: branding } = await admin
    .from("branding")
    .select("logo_url, brand_color, default_message")
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
    operator: operator ?? { id: delivery.operator_id, name: "Operator" },
    branding: branding ?? null,
  };
}

export function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now();
}
