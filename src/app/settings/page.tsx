/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import QRCode from "qrcode";
import { requireOperator } from "@/lib/operator-session";
import { CANONICAL_ORIGIN } from "@/lib/base-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorCaptureToken } from "@/lib/capture";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { TeamManager } from "./team";
import { TipsToggle } from "./tips-toggle";
import { TipLinkForm } from "./tip-link-form";
import { isTipProvider, type TipProvider } from "@/lib/tips";
import { RetentionForm } from "./retention-form";
import { ReviewLinks } from "./review-links";
import { SpeciesPicker } from "./species-picker";
import { TripTimesPicker } from "./trip-times-picker";
import { SettingsSection } from "./settings-section";
import { RosterList } from "./roster-list";
import { CrewRoster } from "./crew-roster";
import { CaptureQr } from "./qr-cards";
import { addBoat, deleteBoat, addCrew, deleteCrew, setCrewRoles } from "./actions";

export default async function SettingsPage() {
  const { supabase, userId, operatorId, operatorName } = await requireOperator();

  // Independent reads all fire at once; the page waits for the slowest one,
  // not the sum. The capture link is the one lazy-creating call and is safe
  // to run alongside the reads.
  const [{ data: branding }, { data: links }, { data: boats }, { data: crew }, captureToken] =
    await Promise.all([
      supabase
        .from("branding")
        .select("logo_url, retention_days, species_options, trip_times")
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
    ]);
  // The QR gets printed and lives on the boat for years: it must carry the
  // canonical domain, never the host the operator happened to browse on.
  const captureUrl = captureToken ? `${CANONICAL_ORIGIN}/j/${captureToken}` : null;
  // A PNG data URL (not SVG) so it renders as a real image the operator can save
  // to their phone's photos, and downloads as a .png. 512px stays crisp when
  // shown small on screen or printed larger.
  const captureDataUrl = captureUrl
    ? await QRCode.toDataURL(captureUrl, { margin: 1, width: 512 })
    : null;

  // One line summaries so each collapsed section says what is set without
  // opening it. Most of this is set once; species is the part that changes.
  const speciesList = (branding?.species_options ?? []) as string[];
  const tripTimes = (branding?.trip_times ?? []) as string[];
  const reviewCount = links?.length ?? 0;
  const boatCount = boats?.length ?? 0;
  const crewCount = crew?.length ?? 0;
  const retentionDays = branding?.retention_days ?? 5;
  const hasLogo = Boolean(branding?.logo_url);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const doneChip = { label: "Done", tone: "good" as const };

  // Team: members with their emails (emails live in auth, so the service role
  // reads them; the roster is small) and any pending invites.
  const admin = createAdminClient();
  const [{ data: memberRows }, { data: op }] = await Promise.all([
    admin
      .from("operator_members")
      .select("user_id, role, display_name, tip_provider, tip_handle")
      .eq("operator_id", operatorId),
    admin.from("operators").select("tips_enabled, tips_show_review").eq("id", operatorId).maybeSingle(),
  ]);
  const members = await Promise.all(
    (memberRows ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      return { email: data?.user?.email ?? "unknown", role: (m.role as string) ?? "member" };
    }),
  );
  const isOwner = (memberRows ?? []).some((m) => m.user_id === userId && (m.role as string) === "owner");

  // Tips: the operator switch and this member's own link, for the two sections.
  const tipsEnabled = Boolean(op?.tips_enabled);
  const tipsShowReview = Boolean(op?.tips_show_review);
  const myMember = (memberRows ?? []).find((m) => m.user_id === userId);
  const myTip = {
    displayName: (myMember?.display_name as string | null) ?? null,
    provider: (isTipProvider(myMember?.tip_provider as string) ? (myMember?.tip_provider as TipProvider) : null),
    handle: (myMember?.tip_handle as string | null) ?? null,
  };
  const myTipSet = Boolean(myTip.provider && myTip.handle);
  const { data: inviteRows } = await supabase
    .from("operator_invites")
    .select("id, email")
    .is("accepted_at", null)
    .eq("operator_id", operatorId)
    .order("created_at", { ascending: false });
  const invites = (inviteRows ?? []).map((i) => ({ id: i.id as string, email: i.email as string }));

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
            <a
              href="/branding"
              className="fl-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 18px",
                textDecoration: "none",
                color: "var(--text)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "15px", fontWeight: 600 }}>
                  Brand look and messaging
                </span>
                <span style={{ display: "block", fontSize: "12.5px", color: "var(--muted)", marginTop: "3px" }}>
                  {hasLogo ? "Logo set" : "No logo yet"}. Logo, colors, fonts,
                  email wording, and your website and social links now live in
                  the Branding tab.
                </span>
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--signal-ink)", background: "var(--signal)", padding: "7px 12px", borderRadius: "9px", flex: "0 0 auto" }}>
                Open Branding
              </span>
            </a>

            <SettingsSection
              title="Photo retention"
              summary={`Photos kept ${retentionDays} ${plural(retentionDays, "day", "days")}`}
              chip={doneChip}
            >
              <RetentionForm retentionDays={retentionDays} />
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

            <SettingsSection
              title="Team"
              summary={`${members.length} ${plural(members.length, "person", "people")}${invites.length ? `, ${invites.length} invited` : ""}`}
              chip={members.length > 1 ? doneChip : { label: "Just you", tone: "muted" }}
            >
              <TeamManager members={members} invites={invites} isOwner={isOwner} />
            </SettingsSection>

            <SettingsSection
              title="Tips"
              summary={
                tipsEnabled
                  ? tipsShowReview
                    ? "On, with a review shown under the tip"
                    : "On, guests can tip their photographer"
                  : "Off"
              }
              chip={tipsEnabled ? doneChip : { label: "Off", tone: "muted" }}
            >
              <TipsToggle enabled={tipsEnabled} showReview={tipsShowReview} isOwner={isOwner} />
            </SettingsSection>

            <SettingsSection
              title="Your tip link"
              summary={myTipSet ? "Set, tips go straight to you" : "Not set"}
              chip={myTipSet ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <TipLinkForm displayName={myTip.displayName} provider={myTip.provider} handle={myTip.handle} />
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
