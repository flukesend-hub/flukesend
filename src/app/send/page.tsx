/*
  New send screen, dark workspace with the persistent nav. Passes the operator's
  brand color (drives the upload animation and the dropzone tint) and default
  message to the form.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getTrialUsage, TRIAL_TRANSFERS, TRIAL_EMAILS } from "@/lib/trial";
import { SendForm } from "./send-form";

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
    .select("default_message, brand_color, plan")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  const { data: boats } = await supabase
    .from("boats")
    .select("id, name")
    .eq("operator_id", membership.operator_id)
    .order("sort_order", { ascending: true });

  const { data: crew } = await supabase
    .from("crew_members")
    .select("id, name")
    .eq("operator_id", membership.operator_id)
    .order("sort_order", { ascending: true });

  const usage = await getTrialUsage(supabase, membership.operator_id);

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
              border: "1px solid rgba(231,177,76,.45)",
              background: "rgba(231,177,76,.14)",
              fontSize: "13px",
              color: "#7a5a17",
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

        <SendForm
          defaultMessage={branding?.default_message ?? ""}
          brandColor={branding?.brand_color ?? "#0b5563"}
          boats={(boats ?? []).map((b) => b.name)}
          crew={(crew ?? []).map((c) => c.name)}
        />
      </main>
    </>
  );
}
