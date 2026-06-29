/*
  Records that a guest opened their gallery, once per recipient. Public, keyed
  by the recipient token. Writes server side with the service role since guests
  have no session.
*/
import { getGalleryByToken } from "@/lib/gallery";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data) {
    return new Response(null, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("events")
    .select("id")
    .eq("recipient_id", data.recipient.id)
    .eq("type", "opened")
    .limit(1)
    .maybeSingle();
  if (!existing) {
    await admin
      .from("events")
      .insert({ recipient_id: data.recipient.id, type: "opened" });
  }

  return new Response(null, { status: 204 });
}
