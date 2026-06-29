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

  // Recent sends, with a guest count per delivery via the embedded count.
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, created_at, trip_datetime, whale_count, recipients(count)")
    .eq("operator_id", membership.operator_id)
    .order("created_at", { ascending: false })
    .limit(10);

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

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1.25rem",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recent sends</h2>
          <Link href="/send" style={styles.newSend}>
            New send
          </Link>
        </div>

        {deliveries?.length ? (
          <ul style={styles.list}>
            {deliveries.map((d) => {
              const guests =
                (d.recipients as unknown as { count: number }[] | null)?.[0]
                  ?.count ?? 0;
              const when = d.trip_datetime ?? d.created_at;
              return (
                <li key={d.id}>
                  <Link href={`/deliveries/${d.id}`} style={styles.deliveryRow}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      {new Date(when).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                      {d.whale_count != null ? `${d.whale_count} whales` : "trip"}
                      {" · "}
                      {guests} guest{guests === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            No sends yet. Create your first one.
          </p>
        )}
      </section>
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

const styles: Record<string, React.CSSProperties> = {
  newSend: {
    padding: "0.5rem 0.9rem",
    borderRadius: "0.5rem",
    background: "#0b5563",
    color: "white",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  deliveryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    padding: "0.6rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    background: "white",
    textDecoration: "none",
    color: "#0f172a",
  },
};
