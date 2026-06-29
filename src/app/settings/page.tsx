/*
  Operator settings, dark workspace. Edit branding and manage review links.
  Reads go through the RLS client, so an operator only sees their own data.
*/
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("logo_url, brand_color, default_message, retention_days")
    .eq("operator_id", operatorId)
    .maybeSingle();

  const { data: links } = await supabase
    .from("review_destinations")
    .select("id, label, url, sort_order")
    .eq("operator_id", operatorId)
    .order("sort_order", { ascending: true });

  return (
    <main style={{ maxWidth: "880px", margin: "0 auto", padding: "34px 22px 80px" }}>
      <Link href="/dashboard" className="fl-link">
        {"‹"} Back to dashboard
      </Link>
      <h1 className="fl-h1" style={{ marginTop: "10px" }}>
        Settings
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
        Edit your branding and manage the review links that become buttons in the
        review email.
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
  );
}
