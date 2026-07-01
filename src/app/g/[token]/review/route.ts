/*
  Review link click tracking. The review email's buttons point here rather than
  straight at Google or Tripadvisor, so a tap writes a 'review_clicked' event and
  then redirects on to the real destination. The destination is resolved server
  side from its id, scoped to the recipient's operator, so this can never be used
  as an open redirect: an unknown or cross operator id just 404s. Public, keyed
  by the recipient token, served with the service role since guests have no
  session. Gallery expiry does not gate this; the review link stays good after
  the photos are gone.
*/
import { getGalleryByToken } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const destId = new URL(request.url).searchParams.get("d");
  if (!destId) {
    return new Response("Missing destination", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: dest } = await admin
    .from("review_destinations")
    .select("url")
    .eq("id", destId)
    .eq("operator_id", data.delivery.operator_id)
    .maybeSingle();
  if (!dest) {
    return new Response("Not found", { status: 404 });
  }

  // Log the click, then redirect. Recorded on every tap; analytics counts
  // distinct recipients, so repeats do not inflate the number.
  await admin
    .from("events")
    .insert({ recipient_id: data.recipient.id, type: "review_clicked" });

  return Response.redirect(dest.url, 302);
}
