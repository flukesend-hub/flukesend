/*
  The guest sighting card render, one per gallery. Public, reached by the
  recipient token exactly like the gallery page: guests are not signed in, so
  the lookup runs with the service role, scoped to the token. The actual
  resolve and paint live in lib/guest-card-render, shared with the zip route
  so the bundled PNG and this preview are always the same card. A 404 (no
  gallery, expired, or no usable photo) is the signal for the gallery to
  quietly hide the share card, so a thin trip never shows something broken.
*/
import { getGalleryByToken, isExpired } from "@/lib/gallery";
import { renderGuestCard } from "@/lib/guest-card-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await getGalleryByToken(token);
  if (!data || isExpired(data.delivery.expires_at)) {
    return new Response("Not found", { status: 404 });
  }
  const card = await renderGuestCard(data);
  if (!card) {
    return new Response("No card", { status: 404 });
  }
  return card;
}
