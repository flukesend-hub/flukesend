/*
  Support view of one operator: edit their branding on their behalf. Admin only,
  reads and writes with the service role.
*/
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSenderDomain } from "@/lib/sender-domain";
import { BrandingEditor } from "./branding-editor";
import { SenderDomainPanel } from "./sender-domain-panel";

export default async function AdminOperatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: operator } = await admin
    .from("operators")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!operator) notFound();

  const [{ data: b }, senderDomain] = await Promise.all([
    admin
      .from("branding")
      .select(
        "logo_url, brand_color, default_message, retention_days, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
      )
      .eq("operator_id", id)
      .maybeSingle(),
    getSenderDomain(id),
  ]);

  return (
    <main style={{ padding: "28px", maxWidth: "820px", margin: "0 auto" }}>
      <a href="/admin" className="fl-link">&larr; Back to admin</a>
      <h1 className="fl-h1" style={{ marginTop: "8px" }}>{operator.name}</h1>
      <p className="fl-muted" style={{ fontSize: "14px", margin: "0 0 20px" }}>
        Support: edit this operator&apos;s branding.
      </p>
      <BrandingEditor
        operatorId={operator.id}
        operatorName={operator.name}
        logoUrl={b?.logo_url ?? null}
        brandColor={b?.brand_color ?? "#0b5563"}
        defaultMessage={b?.default_message ?? ""}
        retentionDays={b?.retention_days ?? 3}
        social={{
          website_url: b?.website_url ?? null,
          facebook_url: b?.facebook_url ?? null,
          instagram_url: b?.instagram_url ?? null,
          tiktok_url: b?.tiktok_url ?? null,
          youtube_url: b?.youtube_url ?? null,
          x_url: b?.x_url ?? null,
        }}
      />
      <SenderDomainPanel
        operatorId={operator.id}
        operatorName={operator.name}
        senderDomain={senderDomain}
      />
    </main>
  );
}
