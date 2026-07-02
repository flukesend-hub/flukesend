/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireOperator } from "@/lib/operator-session";
import { getOperatorCaptureToken } from "@/lib/capture";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { BrandingForm } from "./branding-form";
import { ReviewLinks } from "./review-links";
import { SocialLinksForm } from "./social-links-form";
import { SpeciesPicker } from "./species-picker";
import { TripTimesPicker } from "./trip-times-picker";
import { SettingsSection } from "./settings-section";
import { RosterList } from "./roster-list";
import { CrewRoster } from "./crew-roster";
import { CaptureQr } from "./qr-cards";
import { addBoat, deleteBoat, addCrew, deleteCrew, setCrewRoles } from "./actions";

export default async function SettingsPage() {
  const { supabase, operatorId, operatorName } = await requireOperator();

  // Independent reads all fire at once; the page waits for the slowest one,
  // not the sum. The capture link is the one lazy-creating call and is safe
  // to run alongside the reads.
  const [{ data: branding }, { data: links }, { data: boats }, { data: crew }, captureToken, hdrs] =
    await Promise.all([
      supabase
        .from("branding")
        .select(
          "logo_url, brand_color, default_message, retention_days, plan, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url, species_options, trip_times",
        )
        .eq("operator_id", operatorId)
        .maybeSingle(),
      supabase
        .from("review_destinations")
        .select("id, label, url, sort_order")
        .eq("operator_id", operatorId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("boats")
        .select("id, name")
        .eq("operator_id", operatorId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("crew_members")
        .select("id, name, roles")
        .eq("operator_id", operatorId)
        .order("sort_order", { ascending: true }),
      // One standing, operator wide capture link, rendered as a single QR.
      getOperatorCaptureToken(operatorId),
      headers(),
    ]);
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const captureUrl = captureToken && baseUrl ? `${baseUrl}/j/${captureToken}` : null;
  // A PNG data URL (not SVG) so it renders as a real image the operator can save
  // to their phone's photos, and downloads as a .png. 512px stays crisp when
  // shown small on screen or printed larger.
  const captureDataUrl = captureUrl
    ? await QRCode.toDataURL(captureUrl, { margin: 1, width: 512 })
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
  const tripTimes = (branding?.trip_times ?? []) as string[];
  const reviewCount = links?.length ?? 0;
  const boatCount = boats?.length ?? 0;
  const crewCount = crew?.length ?? 0;
  const retentionDays = branding?.retention_days ?? 5;
  const hasLogo = Boolean(branding?.logo_url);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const doneChip = { label: "Done", tone: "good" as const };

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
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
                operatorName={operatorName ?? "Operator"}
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
              <CaptureQr operatorName={operatorName ?? "Operator"} dataUrl={captureDataUrl} />
            </SettingsSection>
          </div>

          <div style={{ fontSize: "12px", color: "var(--muted)", margin: "20px 2px 8px" }}>
            Changes by season
          </div>
          <SettingsSection
            title="Trip times"
            summary={tripTimes.length ? `${tripTimes.length} departure ${tripTimes.length === 1 ? "time" : "times"}, shown on a send and your QR` : "Showing every slot, pick yours to narrow it"}
            chip={tripTimes.length ? doneChip : { label: "Default", tone: "muted" }}
          >
            <TripTimesPicker selected={tripTimes} />
          </SettingsSection>
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
