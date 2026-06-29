/*
  Operator settings, dark workspace with the persistent nav. Edit branding and
  manage review links. Reads go through the RLS client.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { BrandingForm } from "./branding-form";
import { ReviewLinks } from "./review-links";

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

  return (
    <>
      <OperatorNav email={user.email ?? ""} plan={branding?.plan ?? "base"} />
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 22px 80px" }}>
        <h1 className="fl-h1">Settings</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
          Edit your branding and manage the review links that become buttons in
          the review email.
        </p>

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
      </main>
    </>
  );
}
