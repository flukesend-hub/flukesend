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
  const [{ data: branding }, { data: reviewRows }, { data: op }, { data: me }] =
    await Promise.all([
      supabase
        .from("branding")
        .select(
          "logo_url, brand_color, accent_color, header_text_color, font_key, text_tone, copy_overrides, default_message, retention_days, species_options, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
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
    ]);

  const myTipSet = Boolean(isTipProvider(me?.tip_provider as string) && me?.tip_handle);
  const tips = {
    enabled: Boolean(op?.tips_enabled),
    showReview: Boolean(op?.tips_show_review),
    myTip: myTipSet
      ? {
          firstName:
            ((me?.display_name as string | null) ?? "").trim().split(/\s+/)[0] || "your photographer",
          verb: tipProviderVerb(me?.tip_provider as TipProvider),
        }
      : null,
  };

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <h1 className="fl-h1">Branding</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: "0 0 20px" }}>
          Your look and your words, everywhere a guest sees you. Everything here
          has a good default, so change only what you want.
        </p>
        <BrandingWorkbench
          operatorName={operatorName ?? "Operator"}
          reviewLinks={(reviewRows ?? []).map((l) => ({ label: l.label as string }))}
          tips={tips}
          initial={{
            logoUrl: (branding?.logo_url as string | null) ?? null,
            brandColor: (branding?.brand_color as string | null) ?? "#0b5563",
            accentColor: (branding?.accent_color as string | null) ?? null,
            headerTextColor: (branding?.header_text_color as string | null) ?? null,
            fontKey: (branding?.font_key as string | null) ?? null,
            textTone: (branding?.text_tone as string | null) ?? null,
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
    </>
  );
}
