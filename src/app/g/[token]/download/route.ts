/*
  Photo download. This is the moment the whole product hangs on: the click both
  writes a downloaded event and hands the guest their file. That event is the
  trigger the review ask reads. Public, keyed by the recipient token, served
  with the service role since guests have no session.

  The bytes do not pass through this function: we write the event, then 302 to
  a short lived signed storage URL so the photo streams straight from Supabase
  to the guest. That keeps download bandwidth off the serverless function
  entirely (no double egress, no function time), which is what keeps the cost
  flat as operator count grows.
*/
import { after } from "next/server";
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewAskAfterDownload } from "@/lib/review-ask";
import { CANONICAL_ORIGIN } from "@/lib/base-url";

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

  // Signed URL that makes the browser save the file under its real name. Short
  // lived: the guest is redirected to it immediately.
  const filename = (photo.filename ?? "photo").replace(/["\r\n\\]/g, "");
  const { data: signed, error } = await admin.storage
    .from("photos")
    .createSignedUrl(photo.storage_key, 120, { download: filename });
  if (error || !signed?.signedUrl) {
    return new Response("Download failed", { status: 500 });
  }

  // The trigger, written on the click. The review ask keys off
  // review_email_status, so logging every photo download is fine and never
  // double sends.
  if (!preview) {
    const { error: evErr } = await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "downloaded" });
    if (evErr) {
      console.error(
        `download event insert failed for recipient ${data.recipient.id}: ${evErr.message}`,
      );
    }
    // The instant review ask, after the response so the redirect is never
    // slowed. Idempotent inside, so ten photo taps send one email. Its links
    // live on the canonical domain (see base-url.ts).
    after(() => sendReviewAskAfterDownload(data.recipient.id, CANONICAL_ORIGIN));
  }

  // Straight to Supabase for the bytes. no-store so the redirect itself is
  // never cached (the signed URL expires).
  return new Response(null, {
    status: 302,
    headers: { location: signed.signedUrl, "cache-control": "private, no-store" },
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
    after(() => sendReviewAskAfterDownload(data.recipient.id, CANONICAL_ORIGIN));
  }
  return new Response(null, { status: 204 });
}
