/*
  Photo download. This is the moment the whole product hangs on: the click both
  streams the file to the guest and writes a downloaded event. That event is the
  trigger the nightly job reads to send the review ask, which is what deletes
  the old Gmail script workaround. Public, keyed by the recipient token, served
  with the service role since guests have no session.
*/
import { after } from "next/server";
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewAskAfterDownload } from "@/lib/review-ask";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }
  if (isExpired(data.delivery.expires_at)) {
    return new Response("This gallery has expired.", { status: 410 });
  }

  const search = new URL(request.url).searchParams;
  const photoId = search.get("p");
  // Preview downloads come from the operator checking their own send and must
  // not write the downloaded event that triggers the guest's review ask.
  const preview = search.get("preview") === "1";
  if (!photoId) {
    return new Response("Missing photo", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("photos")
    .select("storage_key, filename")
    .eq("id", photoId)
    .eq("delivery_id", data.delivery.id)
    .maybeSingle();
  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  const { data: blob, error } = await admin.storage
    .from("photos")
    .download(photo.storage_key);
  if (error || !blob) {
    return new Response("Download failed", { status: 500 });
  }

  // The trigger. Recorded after the file is in hand so we only log real
  // downloads. The nightly job keys off review_email_status, so logging on
  // every photo download is fine and never double sends.
  if (!preview) {
    const { error: evErr } = await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "downloaded" });
    if (evErr) {
      console.error(
        `download event insert failed for recipient ${data.recipient.id}: ${evErr.message}`,
      );
    }
    // The instant review ask, after the file is served so the download is
    // never slowed. Idempotent inside, so ten photo taps send one email.
    const origin = new URL(request.url).origin;
    after(() => sendReviewAskAfterDownload(data.recipient.id, origin));
  }

  const filename = (photo.filename ?? "photo").replace(/["\r\n]/g, "");
  return new Response(blob, {
    headers: {
      "content-type": blob.type || "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

// Event-only variant for the Save to Photos flow: the client fetches the
// photos straight from their signed storage URLs (no server hop for the
// bytes), then posts here once after a successful share so the downloaded
// event still fires exactly like any other download.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    return new Response(null, { status: 404 });
  }
  if (isExpired(data.delivery.expires_at)) {
    return new Response(null, { status: 410 });
  }
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (!preview) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "downloaded" });
    if (error) {
      console.error(
        `share download event insert failed for recipient ${data.recipient.id}: ${error.message}`,
      );
    }
    const origin = new URL(request.url).origin;
    after(() => sendReviewAskAfterDownload(data.recipient.id, origin));
  }
  return new Response(null, { status: 204 });
}
