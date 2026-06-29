/*
  Protected operator home. The proxy already bounces signed out visitors, but we
  re-check the user here because auth checks belong close to the data, not only
  in the proxy. We then look up which operator this user belongs to. RLS limits
  every read to the user's own operator.

  A signed in user with no operator yet has not finished setup, so we send them
  to the onboarding screen. Once they have one, this shows the operator and its
  branding. The send flow gets added here next.
*/
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, role, operators(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }

  // operator_members.operator_id is a to-one FK, so Supabase returns a single
  // operators object at runtime. Without generated types the inferred type is an
  // array, so cast through unknown.
  const operator = membership.operators as unknown as { name: string } | null;

  const { data: branding } = await supabase
    .from("branding")
    .select("logo_url, brand_color, default_message, retention_days, plan")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "2rem",
        maxWidth: "42rem",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Flukesend</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            href="/settings"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "0.5rem",
              border: "1px solid #cbd5e1",
              background: "white",
              color: "#0f172a",
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            Settings
          </Link>
          <form action={signout}>
            <button
              type="submit"
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                background: "white",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <p style={{ color: "#64748b" }}>
        Signed in as <strong>{user.email}</strong>
      </p>

      <section
        style={{
          marginTop: "1rem",
          padding: "1.25rem",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={`${operator?.name ?? "Operator"} logo`}
              style={{ height: "40px", width: "auto" }}
            />
          ) : null}
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
            {operator?.name ?? "Your operator"}
          </h2>
        </div>

        {branding ? (
          <dl style={{ display: "grid", gap: "0.6rem", margin: 0 }}>
            <Row label="Brand color">
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "0.25rem",
                    background: branding.brand_color,
                    border: "1px solid #cbd5e1",
                  }}
                />
                {branding.brand_color}
              </span>
            </Row>
            <Row label="Retention">{branding.retention_days} days</Row>
            <Row label="Plan">{branding.plan}</Row>
            <Row label="Default message">
              {branding.default_message ? (
                branding.default_message
              ) : (
                <em style={{ color: "#94a3b8" }}>none set</em>
              )}
            </Row>
          </dl>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>
            Branding not set yet.
          </p>
        )}
      </section>

      <p style={{ marginTop: "1.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
        The send flow (trip details, photos, guest emails) is the next step.
      </p>
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "8rem 1fr", gap: "0.5rem" }}>
      <dt style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "0.9rem" }}>{children}</dd>
    </div>
  );
}
