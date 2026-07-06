/*
  Support view of one operator: edit their branding, review links, sender
  domain, and fix bounced guest emails on their behalf. Admin only, reads and
  writes with the service role. The admin triage cards deep link to the
  #review-links and #bounced sections here.
*/
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSenderDomain } from "@/lib/sender-domain";
import { BrandingEditor } from "./branding-editor";
import { SenderDomainPanel } from "./sender-domain-panel";
import { ReviewLinksPanel, type ReviewLink } from "./review-links-panel";
import { BouncedGuests, type BouncedGuest } from "./bounced-guests";

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

  // A memberless operator is a demo tenant; its page carries the warning so
  // the operators list does not have to.
  const { count: memberCount } = await admin
    .from("operator_members")
    .select("user_id", { count: "exact", head: true })
    .eq("operator_id", id);
  const isDemo = (memberCount ?? 0) === 0;

  const [{ data: b }, senderDomain, { data: linkRows }, { data: bouncedRows }] =
    await Promise.all([
      admin
        .from("branding")
        .select(
          "logo_url, brand_color, default_message, retention_days, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, x_url",
        )
        .eq("operator_id", id)
        .maybeSingle(),
      getSenderDomain(id),
      admin
        .from("review_destinations")
        .select("id, label, url")
        .eq("operator_id", id)
        .order("sort_order", { ascending: true }),
      // Bounced guests across this operator's sends, newest first. Bounces are
      // rare per operator, so no paging needed here.
      admin
        .from("recipients")
        .select("id, email, deliveries!inner(operator_id, trip_datetime, created_at, expires_at)")
        .eq("deliveries.operator_id", id)
        .eq("email_status", "bounced")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const links = (linkRows ?? []) as unknown as ReviewLink[];
  const now = Date.now();
  const bounced: BouncedGuest[] = (
    (bouncedRows ?? []) as unknown as {
      id: string;
      email: string;
      deliveries: { trip_datetime: string | null; created_at: string; expires_at: string | null };
    }[]
  ).map((r) => {
    const d = r.deliveries;
    const tripTs = d.trip_datetime ?? d.created_at;
    return {
      recipientId: r.id,
      email: r.email,
      tripLabel: `Trip ${new Date(tripTs).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })}`,
      expired: !!d.expires_at && new Date(d.expires_at).getTime() < now,
    };
  });

  return (
    <main style={{ padding: "28px", maxWidth: "820px", margin: "0 auto" }}>
      <a href="/admin" className="fl-link">&larr; Back to admin</a>
      <h1 className="fl-h1" style={{ marginTop: "8px" }}>{operator.name}</h1>
      <p className="fl-muted" style={{ fontSize: "14px", margin: "0 0 20px" }}>
        Support: branding, review links, bounced guests, sender domain.
      </p>
      {isDemo ? (
        <div
          style={{
            border: "1px solid rgba(215,168,49,.4)",
            background: "rgba(215,168,49,.1)",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          <b>Demo tenant.</b> This operator powers the homepage sample gallery.
          It has no login and is not a customer. Do not delete it, and keep its
          review links empty so the demo never emails anyone.
        </div>
      ) : null}
      <BouncedGuests guests={bounced} />
      <ReviewLinksPanel operatorId={operator.id} links={links} />
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
