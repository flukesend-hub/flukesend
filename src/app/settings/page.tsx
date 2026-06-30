/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { BrandingForm } from "./branding-form";
import { ReviewLinks } from "./review-links";
import { RosterList } from "./roster-list";
import { CrewRoster } from "./crew-roster";
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
    .select("logo_url, brand_color, default_message, retention_days, plan")
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

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h1 className="fl-h1">Settings</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
              Edit your branding and manage the review links that become buttons
              in the review email.
            </p>
          </div>
          <a href="/billing" className="fl-btn-ghost" style={{ flex: "0 0 auto", marginTop: "8px" }}>
            Billing
          </a>
        </div>

        <div className="fl-cols" style={{ marginTop: "22px" }}>
          <BrandingForm
            operatorName={operator?.name ?? "Operator"}
            logoUrl={branding?.logo_url ?? null}
            brandColor={branding?.brand_color ?? "#0b5563"}
            defaultMessage={branding?.default_message ?? ""}
            retentionDays={branding?.retention_days ?? 5}
          />
          <ReviewLinks links={links ?? []} />
        </div>

        <div className="fl-card" style={{ marginTop: "16px" }}>
          <h3 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600 }}>
            Boats and crew
          </h3>
          <p className="fl-hint" style={{ margin: "0 0 16px" }}>
            Pre-add your boats and people once. On a send you just pick the boat,
            the captain, and check who is aboard.
          </p>
          <div className="fl-cols">
            <RosterList
              title="Boats"
              hint="The vessels you run trips on."
              placeholder="Sea Otter II"
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
        </div>
      </main>
    </>
  );
}
