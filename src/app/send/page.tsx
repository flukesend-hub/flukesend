/*
  New send screen, dark workspace with the persistent nav. Passes the operator's
  brand color (drives the upload animation and the dropzone tint) and default
  message to the form.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
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
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("default_message, brand_color, plan")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  return (
    <>
      <OperatorNav email={user.email ?? ""} plan={branding?.plan ?? "base"} />
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 22px 80px" }}>
        <div className="fl-eyebrow">New send</div>
        <h1 className="fl-h1" style={{ fontSize: "32px" }}>
          Tonight&apos;s trip
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
          Fill the trip, drop the photos, paste the guest emails. Each guest gets
          their own gallery link and their own review ask later this evening.
        </p>

        <SendForm
          defaultMessage={branding?.default_message ?? ""}
          brandColor={branding?.brand_color ?? "#0b5563"}
        />
      </main>
    </>
  );
}
