/*
  The guest gallery. Public, reached only by the recipient token. A light,
  warm surface colored by the operator's own brand color, with the trip written
  as copy in the hero. Photos live in a private bucket, shown through short
  lived signed URLs. The interactive grid and downloads are in GalleryPhotos.
*/
import { notFound } from "next/navigation";
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackOpen } from "./track-open";
import { GalleryPhotos } from "./gallery-photos";

function retentionDaysLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    notFound();
  }
  const { delivery, operator, branding } = data;
  const brand = branding?.brand_color ?? "#0b5563";
  const message = delivery.custom_message || branding?.default_message || "";
  const expired = isExpired(delivery.expires_at);

  let photos: { id: string; name: string; url: string }[] = [];
  if (!expired) {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("photos")
      .select("id, storage_key, filename, sort_order")
      .eq("delivery_id", delivery.id)
      .order("sort_order", { ascending: true });
    if (rows?.length) {
      const { data: signed } = await admin.storage
        .from("photos")
        .createSignedUrls(rows.map((r) => r.storage_key), 3600);
      photos = rows.map((r, i) => ({
        id: r.id,
        name: r.filename ?? "photo",
        url: signed?.[i]?.signedUrl ?? "",
      }));
    }
  }

  // Hero copy from the trip.
  const time = delivery.trip_datetime
    ? new Date(delivery.trip_datetime).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const title =
    delivery.captain_name && time
      ? `Your ${time} trip with Captain ${delivery.captain_name}`
      : delivery.captain_name
        ? `Your trip with Captain ${delivery.captain_name}`
        : "Your photos are ready";
  const facts: string[] = [];
  if (delivery.whale_count != null) {
    facts.push(`${delivery.whale_count} whale${delivery.whale_count === 1 ? "" : "s"} sighted`);
  }
  if (delivery.species?.length) facts.push(delivery.species.join(" and "));
  if (delivery.boat_name) facts.push(`aboard ${delivery.boat_name}`);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--paper-ink)", padding: "0 0 60px" }}>
      <TrackOpen token={token} />
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <div style={{ background: brand, color: "#fff", padding: "32px 26px 28px" }}>
          <div className="fl-display" style={{ fontSize: "20px", letterSpacing: ".02em", opacity: 0.96 }}>
            {operator.name}
          </div>
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt={operator.name} style={{ height: "40px", marginTop: "10px" }} />
          ) : null}
          <div className="fl-display" style={{ fontWeight: 500, fontSize: "26px", lineHeight: 1.2, margin: "16px 0 8px", maxWidth: "18ch" }}>
            {title}
          </div>
          {facts.length ? (
            <div style={{ fontSize: "13px", opacity: 0.85 }}>{facts.join(" · ")}</div>
          ) : null}
        </div>

        <div style={{ padding: "24px 22px" }}>
          {message ? (
            <p style={{ fontSize: "14.5px", lineHeight: 1.6, margin: "0 0 18px", color: "#33464a" }}>
              {message}
            </p>
          ) : null}

          {expired ? (
            <div style={{ padding: "24px", borderRadius: "14px", background: "#fff", border: "1px solid #e7e0d4", textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>This gallery has expired.</p>
              <p style={{ margin: "6px 0 0", color: "#6b7a7d", fontSize: "13px" }}>
                Reach out to {operator.name} if you still need your photos.
              </p>
            </div>
          ) : photos.length ? (
            <GalleryPhotos
              token={token}
              brand={brand}
              retentionDays={retentionDaysLeft(delivery.expires_at)}
              photos={photos}
            />
          ) : (
            <p style={{ color: "#6b7a7d" }}>No photos in this gallery yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
