/*
  The guest gallery. Public, reached only by the recipient token. A light,
  warm surface colored by the operator's own brand color, with the trip written
  as copy in the hero. Photos live in a private bucket, shown through short
  lived signed URLs. The interactive grid and downloads are in GalleryPhotos.
*/
import { notFound } from "next/navigation";
import { getGalleryByToken, isExpired, resolveGalleryTip } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { fontPack, googleFontsHref } from "@/lib/brand-fonts";
import { GALLERY_COPY, GALLERY_THANKS_DEFAULT, copyValue, renderTokens } from "@/lib/brand-copy";
import { TrackOpen } from "./track-open";
import { GalleryPhotos } from "./gallery-photos";

function retentionDaysLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  // Preview mode is for the operator checking their own send. No opened or
  // downloaded events are written, so previewing never triggers a review ask.
  const preview = (await searchParams).preview === "1";
  const data = await getGalleryByToken(token);
  if (!data) {
    notFound();
  }
  const { delivery, operator, branding } = data;
  const brand = branding?.brand_color ?? "#0b5563";
  // The Branding tab look: accent paints the buttons (falls back to brand),
  // the font pack sets the display type, and the post-save copy comes from
  // copy_overrides with fill-ins rendered here (React escapes on output).
  const accent = branding?.accent_color ?? brand;
  const pack = fontPack(branding?.font_key);
  const fontsHref = googleFontsHref(pack);
  const tokenCtx = {
    operatorName: operator.name,
    firstName: data.recipient.name?.trim().split(/\s+/)[0] ?? null,
    species: delivery.species?.length ? delivery.species.join(" and ") : null,
    date: delivery.trip_datetime
      ? new Date(delivery.trip_datetime).toLocaleDateString("en-US", { dateStyle: "long" })
      : null,
    photographerName: delivery.photographer_name,
    crew: delivery.captain_name ? `Captain ${delivery.captain_name}` : null,
  };
  const galleryCopy = Object.fromEntries(
    GALLERY_COPY.map((f) => [f.key, renderTokens(copyValue(branding?.copy_overrides, f), tokenCtx)]),
  );
  const message = delivery.custom_message || branding?.default_message || "";
  const expired = isExpired(delivery.expires_at);

  const admin = createAdminClient();

  // The operator's review links, as tracked hrefs through /review so a tap
  // from the gallery logs a review_clicked event just like the email buttons.
  // Rendered in the save confirmation, so guests can review at the peak moment
  // right after they save their photos.
  const { data: reviewRows } = await admin
    .from("review_destinations")
    .select("id, label, sort_order")
    .eq("operator_id", delivery.operator_id)
    .order("sort_order", { ascending: true });
  const reviewLinks = (reviewRows ?? []).map((l) => ({
    label: l.label as string,
    href: `/g/${token}/review?d=${l.id}`,
  }));

  // The tip, when both flags line up (operator tips on, this send's
  // photographer has a link). When present it becomes the primary ask in the
  // post-save slot, in place of the review links; never both at once. The
  // button links through the tracked /tip route, so the payment URL stays server
  // side and a tap is counted.
  const tipInfo = await resolveGalleryTip(data);
  const tip = tipInfo
    ? {
        firstName: tipInfo.firstName,
        verb: tipInfo.verb,
        href: `/g/${token}/tip${preview ? "?preview=1" : ""}`,
      }
    : null;

  let photos: { id: string; name: string; url: string; thumbUrl: string; size: number }[] = [];
  if (!expired) {
    const { data: rows } = await admin
      .from("photos")
      .select("id, storage_key, filename, size, sort_order")
      .eq("delivery_id", delivery.id)
      .order("sort_order", { ascending: true });
    if (rows?.length) {
      const keys = rows.map((r) => r.storage_key);
      // Full res signed URLs power the actual save and download (guests keep
      // the originals). The grid renders resized thumbnails instead, so a ten
      // photo gallery loads a few hundred KB rather than tens of MB. The
      // transform is a Supabase Pro feature; if it ever fails the grid falls
      // back to the full image so nothing breaks.
      const [{ data: full }, thumbs] = await Promise.all([
        admin.storage.from("photos").createSignedUrls(keys, 3600),
        Promise.all(
          keys.map((k) =>
            admin.storage
              .from("photos")
              // contain with both dimensions scales proportionally to fit an
              // 800 box. Width only leaves the height at the original and
              // squishes the image, so both are required.
              .createSignedUrl(k, 3600, {
                transform: { width: 800, height: 800, resize: "contain", quality: 70 },
              }),
          ),
        ),
      ]);
      photos = rows.map((r, i) => {
        const fullUrl = full?.[i]?.signedUrl ?? "";
        return {
          id: r.id,
          name: r.filename ?? "photo",
          url: fullUrl,
          thumbUrl: thumbs[i]?.data?.signedUrl ?? fullUrl,
          size: Number(r.size) || 0,
        };
      });
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
  if (delivery.species?.length) facts.push(delivery.species.join(" and "));
  if (delivery.boat_name) facts.push(`aboard ${delivery.boat_name}`);
  if (delivery.naturalist_name) facts.push(`naturalist ${delivery.naturalist_name}`);
  if (delivery.photographer_name) facts.push(`photos by ${delivery.photographer_name}`);

  return (
    <main style={{ minHeight: "100dvh", background: "var(--paper)", color: "var(--paper-ink)", padding: "0 0 60px" }}>
      {fontsHref && pack.key !== "classic" ? (
        // The operator picked a non default font pack; load it for the hero
        // and headings. Classic already loads through the app layout.
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontsHref} />
      ) : null}
      {preview ? null : <TrackOpen token={token} />}
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        {preview ? (
          <div style={{ background: "#33464a", color: "#fff", fontSize: "12.5px", textAlign: "center", padding: "8px 12px" }}>
            Preview mode: opens and downloads here are not counted and will not
            trigger the review note.
          </div>
        ) : null}
        <div style={{ background: brand, color: "#fff", padding: "32px 26px 28px" }}>
          {/* The logo already carries the operator name, so show one or the
              other: the logo when set, the name in type as the fallback. */}
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt={operator.name} style={{ height: "40px" }} />
          ) : (
            <div className="fl-display" style={{ fontFamily: pack.displayStack, fontSize: "20px", letterSpacing: ".02em", opacity: 0.96 }}>
              {operator.name}
            </div>
          )}
          <div className="fl-display" style={{ fontFamily: pack.displayStack, fontWeight: 500, fontSize: "26px", lineHeight: 1.2, margin: "16px 0 8px", maxWidth: "18ch" }}>
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
              accent={accent}
              retentionDays={retentionDaysLeft(delivery.expires_at)}
              photos={photos}
              reviewLinks={reviewLinks}
              reviewAskText={galleryCopy["gallery.review_ask"]}
              thanksText={GALLERY_THANKS_DEFAULT}
              tip={tip}
              reviewUnderTip={Boolean(tip && data.operator.tips_show_review)}
              preview={preview}
            />
          ) : (
            <p style={{ color: "#6b7a7d" }}>No photos in this gallery yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
