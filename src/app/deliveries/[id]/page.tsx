/*
  Delivery confirmation and detail. Shown right after a send is created, and
  reachable later from the dashboard. RLS scopes every read to the operator, so
  a delivery that is not theirs simply is not found.

  Each recipient has its own gallery token. The tokened guest gallery and the
  review email are Session 2, so for now we show the future gallery path so the
  operator can see that every guest is a separate row with a separate link.
*/
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fmtDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function DeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailed?: string }>;
}) {
  const { id } = await params;
  const { emailed } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: delivery } = await supabase
    .from("deliveries")
    .select(
      "id, created_at, trip_datetime, whale_count, species, captain_name, crew_names, custom_message, expires_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!delivery) {
    notFound();
  }

  const { data: photos } = await supabase
    .from("photos")
    .select("filename, size")
    .eq("delivery_id", id)
    .order("sort_order", { ascending: true });

  const { data: recipients } = await supabase
    .from("recipients")
    .select("email, token, review_email_status")
    .eq("delivery_id", id);

  const species = (delivery.species ?? []) as string[];
  const crew = (delivery.crew_names ?? []) as string[];

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "2rem",
        maxWidth: "42rem",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard" style={{ color: "#0b5563", fontSize: "0.85rem" }}>
          Back to dashboard
        </Link>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.4rem" }}>Send created</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
          {recipients?.length ?? 0} guest
          {(recipients?.length ?? 0) === 1 ? "" : "s"} and {photos?.length ?? 0}{" "}
          photo{(photos?.length ?? 0) === 1 ? "" : "s"}.
        </p>
      </header>

      {emailed !== undefined ? (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid",
            borderColor: Number(emailed) > 0 ? "#bbf7d0" : "#fde68a",
            background: Number(emailed) > 0 ? "#f0fdf4" : "#fffbeb",
            fontSize: "0.9rem",
          }}
        >
          {Number(emailed) > 0
            ? `Emailed the gallery link to ${emailed} of ${
                recipients?.length ?? 0
              } guest${(recipients?.length ?? 0) === 1 ? "" : "s"}.`
            : "Guests were not emailed. Check that the email service is configured."}
        </div>
      ) : null}

      <Section title="Trip">
        <dl style={{ display: "grid", gap: "0.6rem", margin: 0 }}>
          <Row label="Date">{fmtDateTime(delivery.trip_datetime)}</Row>
          <Row label="Whales seen">{delivery.whale_count ?? "Not set"}</Row>
          <Row label="Species">{species.length ? species.join(", ") : "Not set"}</Row>
          <Row label="Captain">{delivery.captain_name ?? "Not set"}</Row>
          <Row label="Crew">{crew.length ? crew.join(", ") : "Not set"}</Row>
          <Row label="Expires">{fmtDateTime(delivery.expires_at)}</Row>
        </dl>
      </Section>

      <Section title={`Photos (${photos?.length ?? 0})`}>
        {photos?.length ? (
          <ul style={styles.plainList}>
            {photos.map((p, i) => (
              <li key={i} style={styles.fileRow}>
                <span style={styles.fileName}>{p.filename ?? "photo"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={styles.muted}>No photos.</p>
        )}
      </Section>

      <Section title={`Guests (${recipients?.length ?? 0})`}>
        {recipients?.length ? (
          <ul style={styles.plainList}>
            {recipients.map((r, i) => (
              <li key={i} style={styles.recipientRow}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.email}</span>
                <code style={styles.token}>/g/{r.token}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p style={styles.muted}>No recipients.</p>
        )}
        <p style={{ ...styles.muted, marginTop: "0.75rem" }}>
          The tokened gallery and the review email land in Session 2. Each link
          above is one guest&apos;s personal gallery.
        </p>
      </Section>

      <Link href="/send" style={styles.primaryLink}>
        Create another send
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "9rem 1fr", gap: "0.5rem" }}>
      <dt style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "0.9rem" }}>{children}</dd>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  plainList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  fileRow: { fontSize: "0.85rem" },
  fileName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  recipientRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    padding: "0.5rem 0.7rem",
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    background: "white",
  },
  token: { fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis" },
  muted: { color: "#64748b", fontSize: "0.85rem", margin: 0 },
  primaryLink: {
    display: "inline-block",
    padding: "0.7rem 1rem",
    borderRadius: "0.5rem",
    background: "#0b5563",
    color: "white",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "0.95rem",
  },
};
