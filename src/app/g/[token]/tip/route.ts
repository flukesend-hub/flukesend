/*
  Tip button click tracking. The gallery's tip button points here rather than
  straight at Venmo/Cash App/PayPal, so a tap writes a 'tip_clicked' event and
  then redirects on to the photographer's own payment link. The link is resolved
  server side from the send's creator, gated by the same two flags as the button
  (operator tips on, photographer link set), so this can never be an open
  redirect: with tips off or no link, it just 404s. We only see the tap, never
  the amount. Public, keyed by the recipient token, served with the service role
  since guests have no session.
*/
import { getGalleryByToken, resolveGalleryTip } from "@/lib/gallery";
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

  const tip = await resolveGalleryTip(data);
  if (!tip) {
    return new Response("Not found", { status: 404 });
  }

  // Preview mode (the operator checking their own send) never records events.
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (!preview) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "tip_clicked" });
    if (error) {
      console.error(`tip click event insert failed for recipient ${data.recipient.id}: ${error.message}`);
    }
  }

  return Response.redirect(tip.url, 302);
}
