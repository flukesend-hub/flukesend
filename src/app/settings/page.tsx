/*
  Operator settings. Edit branding and manage review links. Reached from the
  dashboard. Reads go through the RLS client, so an operator only ever sees
  their own branding and links.
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
    <main
      style={{
        minHeight: "100dvh",
        padding: "2rem",
        maxWidth: "40rem",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard" style={{ color: "#0b5563", fontSize: "0.85rem" }}>
          Back to dashboard
        </Link>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.4rem" }}>
          {operator?.name ?? "Operator"} settings
        </h1>
      </header>

      <Section title="Branding">
        <BrandingForm
          logoUrl={branding?.logo_url ?? null}
          brandColor={branding?.brand_color ?? "#0b5563"}
          defaultMessage={branding?.default_message ?? ""}
          retentionDays={branding?.retention_days ?? 5}
        />
      </Section>

      <Section title="Review links">
        <ReviewLinks links={links ?? []} />
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: "1.5rem",
        padding: "1.25rem",
        borderRadius: "0.75rem",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>{title}</h2>
      {children}
    </section>
  );
}
