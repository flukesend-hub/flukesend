/*
  Delivery confirmation and detail, dark workspace. Shown right after a send is
  created, and reachable later from the dashboard. RLS scopes every read to the
  operator. Each recipient has its own gallery token; the tokened gallery and
  the emails are the guest surfaces.
*/
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { GuestRow } from "./guest-row";

function fmtDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
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
      "id, operator_id, trip_datetime, whale_count, species, captain_name, crew_names, boat_name, expires_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!delivery) {
    notFound();
  }

  const { data: operator } = await supabase
    .from("operators")
    .select("name")
    .eq("id", delivery.operator_id)
    .maybeSingle();

  const { count: photoCount } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })
    .eq("delivery_id", id);

  const { data: recipients } = await supabase
    .from("recipients")
    .select("id, email, token")
    .eq("delivery_id", id);

  const hdrs = await headers();
  const baseUrl = `${hdrs.get("x-forwarded-proto") ?? "https"}://${hdrs.get("host") ?? ""}`;

  const species = (delivery.species ?? []) as string[];
  const crew = (delivery.crew_names ?? []) as string[];
  const guests = recipients?.length ?? 0;
  const emailedN = emailed !== undefined ? Number(emailed) : null;

  return (
    <>
      <OperatorNav operatorName={operator?.name ?? "Operator"} />
      <main style={{ maxWidth: "820px", margin: "0 auto", padding: "16px 22px 80px" }}>
        <h1 className="fl-h1">Send created</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", margin: "4px 0 0" }}>
          {guests} guest{guests === 1 ? "" : "s"} and {photoCount ?? 0} photo
          {(photoCount ?? 0) === 1 ? "" : "s"}.
        </p>

      {emailedN !== null ? (
        <div style={emailedN > 0 ? bannerOk : bannerWarn}>
          <span style={emailedN > 0 ? check : checkWarn}>{emailedN > 0 ? "✓" : "!"}</span>
          <span style={{ fontSize: "13.5px", color: emailedN > 0 ? "#0f6e56" : "#7a5a17" }}>
            {emailedN > 0
              ? `Emailed the gallery link to ${emailedN} of ${guests} guests. Review asks are scheduled for this evening.`
              : "Guests were not emailed. Check that the email service is configured."}
          </span>
        </div>
      ) : null}

      <div className="fl-card" style={{ marginTop: "18px" }}>
        <h3 style={h3}>Trip</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Row label="Date">{fmtDateTime(delivery.trip_datetime)}</Row>
          <Row label="Whales seen">{delivery.whale_count ?? "Not set"}</Row>
          <Row label="Species">{species.length ? species.join(", ") : "Not set"}</Row>
          <Row label="Boat">{delivery.boat_name ?? "Not set"}</Row>
          <Row label="Captain">{delivery.captain_name ?? "Not set"}</Row>
          <Row label="Crew">{crew.length ? crew.join(", ") : "Not set"}</Row>
          <Row label="Expires">{fmtDateTime(delivery.expires_at)}</Row>
        </div>
      </div>

      <div className="fl-card" style={{ marginTop: "16px" }}>
        <h3 style={h3}>Guests ({guests})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {recipients?.map((r) => (
            <GuestRow key={r.id} id={r.id} email={r.email} galleryUrl={`${baseUrl}/g/${r.token}`} />
          ))}
        </div>
        <p style={{ color: "var(--muted-2)", fontSize: "12.5px", margin: "14px 0 0" }}>
          Each link above is one guest&apos;s personal gallery. The download from
          any of them is the single event that triggers that guest&apos;s review
          ask.
        </p>
      </div>

      <div style={{ marginTop: "18px" }}>
        <Link href="/send" className="fl-btn">
          Create another send
        </Link>
      </div>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "10px", fontSize: "13.5px" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

const h3: React.CSSProperties = { margin: "0 0 14px", fontSize: "15px", fontWeight: 600 };
const bannerOk: React.CSSProperties = {
  marginTop: "18px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "13px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(47,143,99,.4)",
  background: "rgba(47,143,99,.12)",
};
const bannerWarn: React.CSSProperties = {
  ...bannerOk,
  border: "1px solid rgba(231,177,76,.45)",
  background: "rgba(231,177,76,.14)",
};
const check: React.CSSProperties = {
  width: "26px",
  height: "26px",
  borderRadius: "50%",
  background: "var(--good)",
  display: "grid",
  placeItems: "center",
  color: "#06231a",
  fontSize: "15px",
  fontWeight: 700,
  flex: "0 0 auto",
};
const checkWarn: React.CSSProperties = { ...check, background: "var(--signal)", color: "var(--signal-ink)" };
