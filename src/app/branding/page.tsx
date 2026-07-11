/*
  The Branding tab: one place for the look and voice of every guest facing
  surface. Brand identity (logo, colors, font pack) on top, then a sub tab per
  surface with its editable copy on the left and a live preview on the right,
  rendered by the exact same builder the real sends use. Reads go through the
  RLS client. Any member can edit branding; it is not owner gated.
*/
import { requireOperator } from "@/lib/operator-session";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { BrandingWorkbench } from "./workbench";
import { type CopyOverrides } from "@/lib/brand-copy";
import { isTipProvider, tipProviderVerb, type TipProvider } from "@/lib/tips";

export default async function BrandingPage() {
  const { supabase, userId, operatorId, operatorName } = await requireOperator();

  // Branding row, the operator's review links, the tips switches, and the
  // signed-in member's own tip link, all through RLS, all in one wave. The
  // last three exist so the gallery preview mirrors the real post-save slot:
  // tip when tips are on and this member has a link, review buttons
  // otherwise, thanks line when neither.
  const [{ data: branding }, { data: reviewRows }, { data: op }, { data: me }, { data: crewRows }] =
    await Promise.all([
      supabase
        .from("branding")
        .select(
          "logo_url, brand_color, accent_color, header_text_color, font_key, text_tone, logo_align, guest_locale, copy_overrides, review_show_crew, default_message, retention_days, species_options, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
        )
        .eq("operator_id", operatorId)
        .maybeSingle(),
      supabase
        .from("review_destinations")
        .select("label, sort_order")
        .eq("operator_id", operatorId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("operators")
        .select("tips_enabled, tips_show_review")
        .eq("id", operatorId)
        .maybeSingle(),
      supabase
        .from("operator_members")
        .select("display_name, tip_provider, tip_handle")
        .eq("operator_id", operatorId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("crew_members")
        .select("name, photo_url, show_to_guests, sort_order")
        .eq("operator_id", operatorId)
        .order("sort_order", { ascending: true }),
    ]);

  // The real roster for the review-email preview, with each person's shown
  // flag, so the preview shows exactly who guests will see and can explain who
  // is being left out (hidden, or has no photo yet).
  // Full roster (rosters are small): the workbench filters to the shown ones
  // for the preview and lists the hidden ones in the caption. Capping happens
  // after filtering so shown people are never dropped by hidden ones ahead.
  const crew = (crewRows ?? []).map((c) => ({
    firstName: (c.name as string).trim().split(/\s+/)[0],
    photoUrl: (c.photo_url as string | null) ?? null,
    show: c.show_to_guests !== false,
  }));

  const myTipSet = Boolean(isTipProvider(me?.tip_provider as string) && me?.tip_handle);
  // The signed-in member's own face for the tip bubble preview: match their tip
  // display name to their roster entry, the same way the real gallery shows the
  // credited photographer's photo. Falls back to initials when unmatched.
  const myName = ((me?.display_name as string | null) ?? "").trim();
  const myPhotoUrl = myName
    ? ((crewRows ?? []).find(
        (c) => (c.name as string).trim().toLowerCase() === myName.toLowerCase(),
      )?.photo_url as string | null) ?? null
    : null;
  const tips = {
    enabled: Boolean(op?.tips_enabled),
    showReview: Boolean(op?.tips_show_review),
    myTip: myTipSet
      ? {
          firstName: myName.split(/\s+/)[0] || "your photographer",
          verb: tipProviderVerb(me?.tip_provider as TipProvider),
          photoUrl: myPhotoUrl,
        }
      : null,
  };

  return (
    <div className="fl-brandpage">
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <main className="fl-brandmain">
        <h1 className="fl-h1">Branding</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: "0 0 14px" }}>
          Your look and your words, everywhere a guest sees you. Everything here
          has a good default, so change only what you want.
        </p>
        <BrandingWorkbench
          operatorName={operatorName ?? "Operator"}
          reviewLinks={(reviewRows ?? []).map((l) => ({ label: l.label as string }))}
          tips={tips}
          crew={crew}
          reviewShowCrew={Boolean(branding?.review_show_crew)}
          initial={{
            logoUrl: (branding?.logo_url as string | null) ?? null,
            brandColor: (branding?.brand_color as string | null) ?? "#0b5563",
            accentColor: (branding?.accent_color as string | null) ?? null,
            headerTextColor: (branding?.header_text_color as string | null) ?? null,
            fontKey: (branding?.font_key as string | null) ?? null,
            textTone: (branding?.text_tone as string | null) ?? null,
            logoAlign: (branding?.logo_align as string | null) ?? null,
            guestLocale: (branding?.guest_locale as string | null) ?? null,
            copyOverrides: ((branding?.copy_overrides ?? {}) as CopyOverrides),
            defaultMessage: (branding?.default_message as string | null) ?? "",
            retentionDays: (branding?.retention_days as number | null) ?? 7,
            sampleSpecies: ((branding?.species_options ?? []) as string[]).slice(0, 2),
            social: {
              website_url: (branding?.website_url as string | null) ?? null,
              facebook_url: (branding?.facebook_url as string | null) ?? null,
              instagram_url: (branding?.instagram_url as string | null) ?? null,
              tiktok_url: (branding?.tiktok_url as string | null) ?? null,
              youtube_url: (branding?.youtube_url as string | null) ?? null,
              x_url: (branding?.x_url as string | null) ?? null,
            },
          }}
        />
      </main>
    </div>
  );
}
