/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import QRCode from "qrcode";
import { requireOperator } from "@/lib/operator-session";
import { CANONICAL_ORIGIN } from "@/lib/base-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorCaptureToken, getBoatCaptureLinks } from "@/lib/capture";
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
import { CaptureQrs } from "./qr-cards";
import { addBoat, deleteBoat, addCrew, deleteCrew, setCrewRoles, setCrewPhoto, removeCrewPhoto, setCrewShowToGuests } from "./actions";

// Sub-block styling inside a combined section: a hairline divider and a small
// heading, so several related editors read as one calm card.
const subDivider = { borderTop: "1px solid var(--line)", margin: "20px 0 16px" };
const subHead = { margin: "0 0 10px", fontSize: "14px", fontWeight: 600 };

// One dark, high-contrast color per boat, assigned in boat order. Dark keeps
// every QR scannable; the color is just so the crew can tell the codes apart.
const BOAT_QR_COLORS = ["#1f3a8a", "#0f5a4e", "#8a2b3a", "#5b3a8a", "#7a4a12", "#245a3a"];

export default async function SettingsPage() {
  const { supabase, userId, operatorId, operatorName } = await requireOperator();

  // Independent reads all fire at once; the page waits for the slowest one,
  // not the sum. The capture link is the one lazy-creating call and is safe
  // to run alongside the reads.
  const [{ data: branding }, { data: links }, { data: boats }, { data: crew }, captureToken] =
    await Promise.all([
      supabase
        .from("branding")
        .select("retention_days, species_options, trip_times")
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
        .select("id, name, roles, photo_url, show_to_guests")
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

  // With more than one boat, each boat gets its own colored code so the crew
  // can tell them apart and a scan locks the guest to that boat. Colors stay
  // dark for high contrast, so every code still scans reliably. Single-boat
  // operators keep just the one operator wide code, no per-boat clutter.
  const boatLinks =
    (boats?.length ?? 0) >= 2 ? await getBoatCaptureLinks(operatorId) : [];
  const boatQrs = await Promise.all(
    boatLinks.map(async (b, i) => {
      const color = BOAT_QR_COLORS[i % BOAT_QR_COLORS.length];
      const url = `${CANONICAL_ORIGIN}/j/${b.token}`;
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 512,
        color: { dark: color, light: "#ffffff" },
      });
      return { boatName: b.boatName, dataUrl, color };
    }),
  );

  // One line summaries so each collapsed section says what is set without
  // opening it. Most of this is set once; species is the part that changes.
  const speciesList = (branding?.species_options ?? []) as string[];
  const tripTimes = (branding?.trip_times ?? []) as string[];
  const reviewCount = links?.length ?? 0;
  const boatCount = boats?.length ?? 0;
  const crewCount = crew?.length ?? 0;
  const retentionDays = branding?.retention_days ?? 7;
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
            <p style={{ color: "var(--muted)", fontSize: "14.5px", lineHeight: 1.55, margin: "4px 0 0", maxWidth: "60ch" }}>
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>
                Your brand, links, and roster.
              </strong>{" "}
              Set it up once. Everything here is optional polish, Flukesend
              already sends fine with sensible defaults.
            </p>
          </div>
          <a href="/billing" className="fl-btn-ghost" style={{ flex: "0 0 auto", marginTop: "8px" }}>
            Billing
          </a>
        </div>

        <div style={{ maxWidth: "880px", marginTop: "20px" }}>
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
                  Branding
                </span>
                <span style={{ display: "block", fontSize: "12.5px", color: "var(--muted)", marginTop: "3px" }}>
                  Logo, colors, fonts, email wording, website, social links
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
              title="Boats, crew, and trips"
              summary={`${boatCount} ${plural(boatCount, "boat", "boats")}, ${crewCount} ${plural(crewCount, "employee", "employees")}, ${tripTimes.length || "all"} ${plural(tripTimes.length, "departure", "departures")}, ${speciesList.length || "all"} species`}
              chip={boatCount || crewCount || tripTimes.length || speciesList.length ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <p className="fl-hint" style={{ margin: "0 0 16px" }}>
                Everything a send is built from. Set these once, then on a send
                you just pick the boat, departure, species, and who was aboard.
                Departures and species change with the season.
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
                  items={(crew ?? []).map((c) => ({
                    id: c.id as string,
                    name: c.name as string,
                    roles: (c.roles ?? []) as string[],
                    photoUrl: (c.photo_url as string | null) ?? null,
                    showToGuests: c.show_to_guests !== false,
                  }))}
                  addAction={addCrew}
                  deleteAction={deleteCrew}
                  setRolesAction={setCrewRoles}
                  setPhotoAction={setCrewPhoto}
                  removePhotoAction={removeCrewPhoto}
                  setShowAction={setCrewShowToGuests}
                />
              </div>

              <div style={subDivider} />
              <h4 style={subHead}>Departures</h4>
              <TripTimesPicker selected={tripTimes} />

              <div style={subDivider} />
              <h4 style={subHead}>Species</h4>
              <SpeciesPicker selected={speciesList} />
            </SettingsSection>

            <SettingsSection
              title="Review links"
              summary={reviewCount ? `${reviewCount} ${plural(reviewCount, "link", "links")}` : "None yet, add your Google or Tripadvisor link"}
              chip={reviewCount ? doneChip : { label: "Optional", tone: "muted" }}
            >
              <ReviewLinks links={links ?? []} />
            </SettingsSection>

            <SettingsSection
              title="Tips"
              summary={
                tipsEnabled
                  ? tipsShowReview
                    ? "On, with a review shown under the tip"
                    : "On, guests can tip their photographer"
                  : myTipSet
                    ? "Off, your personal link is ready for when it turns on"
                    : "Off"
              }
              chip={tipsEnabled ? doneChip : { label: "Off", tone: "muted" }}
            >
              <TipsToggle enabled={tipsEnabled} showReview={tipsShowReview} isOwner={isOwner} />
              <div style={subDivider} />
              <h4 style={subHead}>Your personal tip link</h4>
              <p className="fl-hint" style={{ margin: "0 0 12px" }}>
                Each team member sets their own. Tips on a send go to whoever
                created it, so this one is yours.
              </p>
              <TipLinkForm displayName={myTip.displayName} provider={myTip.provider} handle={myTip.handle} />
            </SettingsSection>

            <SettingsSection
              title="Guest sign-up QR"
              summary={
                boatQrs.length
                  ? "A code per boat, plus one for the whole operation"
                  : "One code guests scan aboard to get their photos"
              }
              chip={{ label: "Recommended", tone: "good" }}
            >
              <CaptureQrs
                operatorName={operatorName ?? "Operator"}
                operatorDataUrl={captureDataUrl}
                boats={boatQrs}
              />
            </SettingsSection>

            <SettingsSection
              title="Team"
              summary={`${members.length} ${plural(members.length, "person", "people")}${invites.length ? `, ${invites.length} invited` : ""}`}
              chip={members.length > 1 ? doneChip : { label: "Just you", tone: "muted" }}
            >
              <TeamManager members={members} invites={invites} isOwner={isOwner} />
            </SettingsSection>
          </div>
        </div>
      </main>
    </>
  );
}
