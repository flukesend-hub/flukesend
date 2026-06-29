/*
  The guest gallery. Public, reached only by the recipient token. Branded with
  the operator's color, logo, and message, with the trip details written as warm
  copy. Photos live in a private bucket, so they are shown through short lived
  signed URLs generated here on the server. Each photo downloads through our own
  route so the click can write the download event that triggers the review ask.
*/
import { notFound } from "next/navigation";
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackOpen } from "./track-open";

function tripLine(d: GalleryDelivery) {
  const parts: string[] = [];
  if (d.trip_datetime) {
    parts.push(
      new Date(d.trip_datetime).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    );
  }
  if (d.captain_name) {
    parts.push(`with Captain ${d.captain_name}`);
  }
  const wildlife: string[] = [];
  if (d.whale_count != null) {
    wildlife.push(`${d.whale_count} whale${d.whale_count === 1 ? "" : "s"}`);
  }
  if (d.species?.length) {
    wildlife.push(d.species.join(", "));
  }
  let line = parts.join(" ");
  if (wildlife.length) {
    line += (line ? ". " : "") + wildlife.join(", ");
  }
  return line;
}

type GalleryDelivery = {
  trip_datetime: string | null;
  whale_count: number | null;
  species: string[];
  captain_name: string | null;
};

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
        .createSignedUrls(
          rows.map((r) => r.storage_key),
          3600,
        );
      photos = rows.map((r, i) => ({
        id: r.id,
        name: r.filename ?? "photo",
        url: signed?.[i]?.signedUrl ?? "",
      }));
    }
  }

  const line = tripLine(delivery);

  return (
    <main style={{ minHeight: "100dvh", background: "#faf8f4", color: "#1c2b2e" }}>
      <TrackOpen token={token} />

      <header style={{ background: brand, color: "white", padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: "60rem", margin: "0 auto" }}>
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={`${operator.name} logo`}
              style={{ height: "48px", width: "auto", marginBottom: "1rem" }}
            />
          ) : (
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
              {operator.name}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Your photos are ready</h1>
          {line ? (
            <p style={{ margin: "0.5rem 0 0", opacity: 0.92, fontSize: "1rem" }}>
              {line}
            </p>
          ) : null}
        </div>
      </header>

      <div style={{ maxWidth: "60rem", margin: "0 auto", padding: "1.5rem" }}>
        {message ? (
          <p style={{ fontSize: "1.05rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            {message}
          </p>
        ) : null}

        {expired ? (
          <div
            style={{
              padding: "2rem",
              borderRadius: "0.75rem",
              background: "white",
              border: "1px solid #e7e2d8",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>This gallery has expired.</p>
            <p style={{ margin: "0.5rem 0 0", color: "#5f7882", fontSize: "0.9rem" }}>
              Reach out to {operator.name} if you still need your photos.
            </p>
          </div>
        ) : photos.length ? (
          <div style={styles.grid}>
            {photos.map((p) => (
              <figure key={p.id} style={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} style={styles.thumb} />
                <figcaption style={styles.caption}>
                  <a
                    href={`/g/${token}/download?p=${p.id}`}
                    style={{ ...styles.download, background: brand }}
                  >
                    Download
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p style={{ color: "#5f7882" }}>No photos in this gallery yet.</p>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "1rem",
  },
  card: {
    margin: 0,
    background: "white",
    borderRadius: "0.75rem",
    overflow: "hidden",
    border: "1px solid #e7e2d8",
  },
  thumb: {
    width: "100%",
    height: "200px",
    objectFit: "cover",
    display: "block",
    background: "#eee",
  },
  caption: { padding: "0.6rem", display: "flex", justifyContent: "flex-end" },
  download: {
    color: "white",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "0.85rem",
    padding: "0.4rem 0.8rem",
    borderRadius: "0.4rem",
  },
};
