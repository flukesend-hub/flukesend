/*
  Send created / delivery detail, WeTransfer finished-send style. A photo preview
  with an Open, a short summary, and Send another / Open buttons, with the trip
  details and guest list tucked behind "See what's inside". RLS scopes reads to
  the operator; the first photo is signed with the service role for the preview.
  No em dashes anywhere.
*/
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { GuestRow } from "./guest-row";
import { AddGuest } from "./add-guest";
import { DeleteSend } from "./delete-send";
import { Reveal } from "./reveal";
import { recipientStatus } from "@/lib/recipient-status";

function fmtDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailed?: string; failed?: string }>;
}) {
  const { id } = await params;
  const { emailed, failed } = await searchParams;
  const { supabase, operatorName } = await requireOperator();

  // Wave one: everything keyed by the route id fires together. RLS scopes the
  // delivery to this operator, so a foreign id just comes back empty.
  const [{ data: delivery }, { count: photoCount }, { data: firstPhoto }, { data: recipients }] =
    await Promise.all([
      supabase
        .from("deliveries")
        .select(
          "id, operator_id, trip_datetime, species, captain_name, naturalist_name, photographer_name, crew_names, boat_name, expires_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("photos").select("*", { count: "exact", head: true }).eq("delivery_id", id),
      supabase
        .from("photos")
        .select("storage_key")
        .eq("delivery_id", id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("recipients").select("id, email, token, review_email_status").eq("delivery_id", id),
    ]);
  if (!delivery) {
    notFound();
  }

  // Wave two: the reads that needed wave one's results, again together.
  const recipientIds = (recipients ?? []).map((r) => r.id);
  const [{ data: events }, previewUrl, hdrs] = await Promise.all([
    recipientIds.length
      ? supabase.from("events").select("recipient_id, type").in("recipient_id", recipientIds)
      : Promise.resolve({ data: [] as { recipient_id: string; type: string }[] }),
    // Sign the first photo (private bucket) for the preview thumbnail.
    firstPhoto?.storage_key
      ? createAdminClient()
          .storage.from("photos")
          .createSignedUrl(firstPhoto.storage_key, 60 * 60)
          .then(({ data: signed }) => signed?.signedUrl ?? null)
      : Promise.resolve(null),
    headers(),
  ]);

  // Fold each guest's events into download/open flags for the status chip.
  const eventsByRecipient = new Map<string, { download: boolean; open: boolean }>();
  for (const e of events ?? []) {
    const cur = eventsByRecipient.get(e.recipient_id) ?? { download: false, open: false };
    if (e.type === "downloaded") cur.download = true;
    if (e.type === "opened") cur.open = true;
    eventsByRecipient.set(e.recipient_id, cur);
  }
  const baseUrl = `${hdrs.get("x-forwarded-proto") ?? "https"}://${hdrs.get("host") ?? ""}`;
  // Preview mode: the crew checking their own send must not write opened or
  // downloaded events, or guest number one gets a review ask for a gallery
  // they never saw.
  const openUrl = recipients?.[0]
    ? `${baseUrl}/g/${recipients[0].token}?preview=1`
    : null;

  const species = (delivery.species ?? []) as string[];
  const crew = (delivery.crew_names ?? []) as string[];
  const guests = recipients?.length ?? 0;
  const photos = photoCount ?? 0;
  const emailedN = emailed !== undefined ? Number(emailed) : null;
  const failedEmails = failed ? failed.split(",").filter(Boolean) : [];
  const expires = fmtDate(delivery.expires_at);

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "28px 22px 80px" }}>
        <div style={{ maxWidth: "460px", margin: "0 auto", textAlign: "center" }}>
          {previewUrl ? (
            <div style={previewWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Send preview" style={previewImg} />
            </div>
          ) : (
            <div style={{ ...previewWrap, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "14px" }}>
              {photos} photo{photos === 1 ? "" : "s"}
            </div>
          )}

          <h1 className="fl-h1" style={{ fontSize: "30px", marginTop: "22px" }}>
            {emailedN === 0
              ? "Send created"
              : failedEmails.length
                ? "Sent, with problems"
                : "Email sent!"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14.5px", margin: "6px 0 0" }}>
            {guests} guest{guests === 1 ? "" : "s"} and {photos} photo{photos === 1 ? "" : "s"}
            {expires ? ` · available until ${expires}` : ""}.
          </p>

          {emailedN === 0 && !failedEmails.length ? (
            <p style={{ color: "var(--bad)", fontSize: "13px", margin: "10px 0 0" }}>
              Guests were not emailed. Check that the email service is configured.
            </p>
          ) : null}

          {failedEmails.length ? (
            <div
              style={{
                textAlign: "left",
                border: "1px solid var(--bad)",
                borderRadius: "12px",
                padding: "12px 14px",
                margin: "14px 0 0",
                fontSize: "13px",
              }}
            >
              <p style={{ color: "var(--bad)", fontWeight: 600, margin: 0 }}>
                {failedEmails.length} of {guests} guest email
                {failedEmails.length === 1 ? "" : "s"} did not send:
              </p>
              <p style={{ margin: "6px 0 0", wordBreak: "break-word" }}>
                {failedEmails.join(", ")}
              </p>
              <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>
                Use the Resend button next to each guest under Transfer details
                below.
              </p>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
            <Link href="/send" className="fl-btn" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "14px" }}>
              Send another
            </Link>
            {openUrl ? (
              <a href={openUrl} target="_blank" rel="noreferrer" className="fl-btn-ghost" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "13px", fontSize: "14px" }}>
                Open
              </a>
            ) : null}
          </div>
        </div>

        <Reveal label="Transfer details">
          <div className="fl-card">
            <h3 style={h3}>Trip</h3>
            {/* Only the fields that were actually filled in. An untagged
                naturalist or empty crew list is not worth a "Not set" row. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {delivery.trip_datetime ? (
                <Row label="Date">{fmtDateTime(delivery.trip_datetime)}</Row>
              ) : null}
              {species.length ? <Row label="Species">{species.join(", ")}</Row> : null}
              {delivery.boat_name ? <Row label="Boat">{delivery.boat_name}</Row> : null}
              {delivery.captain_name ? <Row label="Captain">{delivery.captain_name}</Row> : null}
              {delivery.naturalist_name ? (
                <Row label="Naturalist">{delivery.naturalist_name}</Row>
              ) : null}
              {delivery.photographer_name ? (
                <Row label="Photographer">{delivery.photographer_name}</Row>
              ) : null}
              {crew.length ? <Row label="Crew">{crew.join(", ")}</Row> : null}
              <Row label="Expires">{fmtDateTime(delivery.expires_at)}</Row>
            </div>
          </div>

          <div className="fl-card" style={{ marginTop: "16px" }}>
            <h3 style={h3}>Guests ({guests})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recipients?.map((r) => {
                const ev = eventsByRecipient.get(r.id);
                return (
                  <GuestRow
                    key={r.id}
                    id={r.id}
                    email={r.email}
                    galleryUrl={`${baseUrl}/g/${r.token}`}
                    status={recipientStatus(r.review_email_status, ev?.download ?? false, ev?.open ?? false)}
                  />
                );
              })}
            </div>
            <p style={{ color: "var(--muted-2)", fontSize: "12.5px", margin: "14px 0 0" }}>
              Each link above is one guest&apos;s personal gallery. The download
              from any of them is the single event that triggers that guest&apos;s
              review ask.
            </p>

            <AddGuest deliveryId={delivery.id} />
          </div>

          <DeleteSend deliveryId={delivery.id} />
        </Reveal>
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
const previewWrap: React.CSSProperties = {
  position: "relative",
  display: "block",
  width: "100%",
  aspectRatio: "16 / 10",
  borderRadius: "16px",
  overflow: "hidden",
  background: "var(--ink-2)",
  border: "1px solid var(--line)",
};
const previewImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};
