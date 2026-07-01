/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getOperatorCaptureToken } from "@/lib/capture";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { BrandingForm } from "./branding-form";
import { ReviewLinks } from "./review-links";
import { SocialLinksForm } from "./social-links-form";
import { SpeciesPicker } from "./species-picker";
import { SettingsSection } from "./settings-section";
import { RosterList } from "./roster-list";
import { CrewRoster } from "./crew-roster";
import { CaptureQr } from "./qr-cards";
import { addBoat, deleteBoat, addCrew, deleteCrew, setCrewRoles } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, operators(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  const operatorId = membership.operator_id as string;
  const operator = membership.operators as unknown as { name: string } | null;

  const { data: branding } = await supabase
    .from("branding")
    .select(
      "logo_url, brand_color, default_message, retention_days, plan, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url, species_options",
    )
    .eq("operator_id", operatorId)
    .maybeSingle();

  const { data: links } = await supabase
    .from("review_destinations")
    .select("id, label, url, sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: true });

  const { data: boats } = await supabase
    .from("boats")
    .select("id, name")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: true });

  const { data: crew } = await supabase
    .from("crew_members")
    .select("id, name, roles")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: true });

  // One standing, operator wide capture link, rendered as a single QR. Generated
  // on the server so the client just renders the SVG string.
  const captureToken = await getOperatorCaptureToken(operatorId);
  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const captureUrl = captureToken && baseUrl ? `${baseUrl}/j/${captureToken}` : null;
  const captureSvg = captureUrl
    ? await QRCode.toString(captureUrl, { type: "svg", margin: 1, width: 240 })
    : null;

  // One line summaries so each collapsed section says what is set without
  // opening it. Most of this is set once; species is the part that changes.
  const social = {
    website_url: branding?.website_url ?? null,
    facebook_url: branding?.facebook_url ?? null,
    instagram_url: branding?.instagram_url ?? null,
    tiktok_url: branding?.tiktok_url ?? null,
    youtube_url: branding?.youtube_url ?? null,
    x_url: branding?.x_url ?? null,
  };
  const socialCount = Object.values(social).filter(Boolean).length;
  const speciesList = (branding?.species_options ?? []) as string[];
  const reviewCount = links?.length ?? 0;
  const boatCount = boats?.length ?? 0;
  const crewCount = crew?.length ?? 0;
  const retentionDays = branding?.retention_days ?? 5;
  const hasLogo = Boolean(branding?.logo_url);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const doneChip = { label: "Done", tone: "good" as const };

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h1 className="fl-h1">Settings</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
              Your brand, links, and roster. Set this up once.
            </p>
          </div>
          <a href="/billing" className="fl-btn-ghost" style={{ flex: "0 0 auto", marginTop: "8px" }}>
            Billing
          </a>
        </div>

        <div style={{ maxWidth: "880px", marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              background: "rgba(34,160,90,.10)",
              border: "1px solid rgba(34,160,90,.28)",
              borderRadius: "12px",
              padding: "12px 14px",
              marginBottom: "18px",
            }}
          >
            <span aria-hidden="true" style={{ color: "#1f8a55", fontSize: "14px", lineHeight: 1.5 }}>
              {"✓"}
            </span>
            <div style={{ fontSize: "13px", color: "#2a5b43", lineHeight: 1.5 }}>
              You are all set. Flukesend already sends fine with sensible defaults,
              so everything here is optional polish you do once.
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "var(--muted)", margin: "0 2px 8px" }}>
            Set once
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <SettingsSection
              title="Brand and email look"
              summary={`${hasLogo ? "Logo set" : "No logo yet"}, photos kept ${retentionDays} ${plural(retentionDays, "day", "days")}`}
              chip={doneChip}
            >
              <BrandingForm
                operatorName={operator?.name ?? "Operator"}
                logoUrl={branding?.logo_url ?? null}
                brandColor={branding?.brand_color ?? "#0b5563"}
                defaultMessage={branding?.default_message ?? ""}
                retentionDays={branding?.retention_days ?? 5}
              />
            </SettingsSection>

            <SettingsSection
              title="Website and social links"
              summary={socialCount ? `${socialCount} ${plural(socialCount, "link", "links")} shown as email footer icons` : "None yet"}
              chip={socialCount ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <SocialLinksForm links={social} />
            </SettingsSection>

            <SettingsSection
              title="Review links"
              summary={reviewCount ? `${reviewCount} ${plural(reviewCount, "link", "links")}` : "None yet, add your Google or Tripadvisor link"}
              chip={reviewCount ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <ReviewLinks links={links ?? []} />
            </SettingsSection>

            <SettingsSection
              title="Boats and employees"
              summary={boatCount || crewCount ? `${boatCount} ${plural(boatCount, "boat", "boats")}, ${crewCount} ${plural(crewCount, "employee", "employees")}` : "None yet"}
              chip={boatCount || crewCount ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <p className="fl-hint" style={{ margin: "0 0 16px" }}>
                Pre-add your boats and team once. On a send you just pick the
                boat and check who was aboard.
              </p>
              <div className="fl-cols">
                <RosterList
                  title="Boats"
                  hint="The vessels you run trips on."
                  placeholder="Boat name"
                  addLabel="Add boat"
                  emptyLabel="No boats yet."
                  items={boats ?? []}
                  addAction={addBoat}
                  deleteAction={deleteBoat}
                />
                <CrewRoster
                  items={(crew ?? []) as { id: string; name: string; roles: string[] }[]}
                  addAction={addCrew}
                  deleteAction={deleteCrew}
                  setRolesAction={setCrewRoles}
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Guest sign-up QR"
              summary="One code guests scan aboard to get their photos"
              chip={{ label: "Optional", tone: "muted" }}
            >
              <CaptureQr operatorName={operator?.name ?? "Operator"} url={captureUrl} svg={captureSvg} />
            </SettingsSection>
          </div>

          <div style={{ fontSize: "12px", color: "var(--muted)", margin: "20px 2px 8px" }}>
            Changes by season
          </div>
          <SettingsSection
            title="Species"
            summary={speciesList.length ? `${speciesList.length} selected, shown as pills on a send` : "Using the default list"}
            chip={speciesList.length ? doneChip : { label: "Default", tone: "muted" }}
          >
            <SpeciesPicker selected={speciesList} />
          </SettingsSection>
        </div>
      </main>
    </>
  );
}
