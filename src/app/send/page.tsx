/*
  New send screen, dark workspace with the persistent nav. Passes the operator's
  brand color (drives the upload animation and the dropzone tint) and default
  message to the form.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getTrialUsage, getPlan, TRIAL_TRANSFERS, TRIAL_EMAILS } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { getRecipientsUsed, monthlyQuota } from "@/lib/usage";
import { speciesForSend } from "@/lib/species";
import { SendForm } from "./send-form";

// Covers createSend when the email batch falls back to one guest at a time:
// spaced sends for a big guest list need more than the default action window.
export const maxDuration = 60;

export default async function SendPage() {
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
  const operator = membership.operators as unknown as { name: string } | null;

  const { data: branding } = await supabase
    .from("branding")
    .select("default_message, brand_color, plan, species_options")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  const { data: boats } = await supabase
    .from("boats")
    .select("id, name")
    .eq("operator_id", membership.operator_id)
    .order("sort_order", { ascending: true });

  const { data: crew } = await supabase
    .from("crew_members")
    .select("id, name, roles")
    .eq("operator_id", membership.operator_id)
    .order("sort_order", { ascending: true });

  // Guests captured per boat and not yet pulled into a send. The member RLS
  // policy scopes this to the operator, so a simple tally is safe.
  const { data: captured } = await supabase
    .from("captured_guests")
    .select("boat_id")
    .is("consumed_at", null);
  const capturedByBoat: Record<string, number> = {};
  for (const row of captured ?? []) {
    if (row.boat_id) capturedByBoat[row.boat_id] = (capturedByBoat[row.boat_id] ?? 0) + 1;
  }

  const usage = await getTrialUsage(supabase, membership.operator_id);

  // Active operators see how many emails they have left this month, drawn from
  // their plan's monthly cap. Fleet is unlimited, so nothing to count.
  let quota: { plan: string; used: number; limit: number | null; remaining: number | null } | null =
    null;
  if (usage.status === "active") {
    const plan = PLANS[(await getPlan(supabase, membership.operator_id)).tier];
    const used = await getRecipientsUsed(supabase, membership.operator_id);
    const q = monthlyQuota(used, plan.emailsPerMonth);
    quota = { plan: plan.displayName, used: q.used, limit: q.limit, remaining: q.remaining };
  }

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ padding: "16px 28px 80px" }}>
        <div className="fl-eyebrow">New send</div>
        <h1 className="fl-h1" style={{ fontSize: "32px" }}>
          Today&apos;s send
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
          Fill the trip, drop the photos, paste the guest emails. Each guest gets
          their own gallery link and their own review ask later this evening.
        </p>

        {usage.status === "trial" ? (
          <div
            style={{
              marginTop: "16px",
              padding: "11px 16px",
              borderRadius: "11px",
              border: "1px solid rgba(63,122,77,.45)",
              background: "rgba(63,122,77,.14)",
              fontSize: "13px",
              color: "#33502a",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>
              Free trial: <strong>{usage.transfers}</strong> of {TRIAL_TRANSFERS}{" "}
              transfers and <strong>{usage.emails}</strong> of {TRIAL_EMAILS}{" "}
              guest emails used.
            </span>
            <a href="/billing" style={{ color: "var(--signal-2)", fontWeight: 600, marginLeft: "auto" }}>
              See plans
            </a>
          </div>
        ) : null}

        {usage.status === "canceled" ? (
          <div
            style={{
              marginTop: "16px",
              padding: "11px 16px",
              borderRadius: "11px",
              border: "1px solid rgba(194,83,63,.45)",
              background: "rgba(194,83,63,.12)",
              fontSize: "13px",
              color: "#8a2f22",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>No active plan. Choose a plan to start sending.</span>
            <a href="/billing" style={{ color: "#8a2f22", fontWeight: 600, marginLeft: "auto" }}>
              See plans
            </a>
          </div>
        ) : null}

        {quota ? (
          <div
            style={{
              marginTop: "16px",
              padding: "11px 16px",
              borderRadius: "11px",
              border: "1px solid rgba(63,122,77,.45)",
              background: "rgba(63,122,77,.14)",
              fontSize: "13px",
              color: "#33502a",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>
              {quota.remaining === null ? (
                <>
                  <strong>Unlimited</strong> emails this month on your {quota.plan} plan.
                </>
              ) : (
                <>
                  <strong>{quota.remaining}</strong> of {quota.limit} emails remaining this
                  month ({quota.used} used).
                </>
              )}
            </span>
            <a href="/billing" style={{ color: "var(--signal-2)", fontWeight: 600, marginLeft: "auto" }}>
              Billing
            </a>
          </div>
        ) : null}

        <SendForm
          defaultMessage={branding?.default_message ?? ""}
          brandColor={branding?.brand_color ?? "#0b5563"}
          speciesOptions={speciesForSend(branding?.species_options as string[] | null)}
          boats={(boats ?? []).map((b) => ({ id: b.id as string, name: b.name as string }))}
          capturedByBoat={capturedByBoat}
          crew={(crew ?? []).map((c) => ({
            name: c.name,
            roles: (c.roles ?? []) as string[],
          }))}
        />
      </main>
    </>
  );
}
