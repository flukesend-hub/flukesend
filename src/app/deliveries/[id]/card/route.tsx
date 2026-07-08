/*
  Operator "story card": a 1080x1920 Instagram-story image the operator posts
  after a trip. Follows the Flukesend Story design (logo banner, hero photo of
  the day, then date, trip time, species sighted, and website), but rendered in
  the operator's OWN brand color throughout, with their logo on the brand band
  where their logo is built to sit. Server rendered with next/og.

  Operator only: the delivery read is scoped to the signed in operator by RLS,
  and the private hero photo is signed with the service role just for the render.
*/
import { ImageResponse } from "next/og";
import { requireOperator } from "@/lib/operator-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_W = 1080;
const CARD_H = 1920;
// trip_datetime is stored as the naive local departure clock time tagged +00
// (a 9am trip is 09:00:00+00), and the rest of the app renders it in the
// server's UTC zone. Format in UTC to match, so a 9am trip reads "9:00 AM"
// rather than being shifted by a timezone conversion.
const TZ = "UTC";

const INK = "#f7f6f3";
const SOFT = "rgba(247,246,243,0.72)";
const LINE = "rgba(247,246,243,0.45)";

// Match the design: split, trim, and pluralize each species.
function pluralize(list: string[]): string[] {
  return list
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/s$/i.test(s) ? s : `${s}s`));
}

// Best effort Archivo so the card matches the design; falls back to the built in
// font when the fetch fails, so the card always renders.
type LoadedFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };
async function loadFonts(): Promise<LoadedFont[] | undefined> {
  try {
    const weights: (500 | 600 | 700)[] = [500, 600, 700];
    const out: LoadedFont[] = [];
    for (const weight of weights) {
      const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wght@${weight}`, {
        // An older UA string makes Google serve a ttf, which Satori can read
        // (it does not read woff2).
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1)" },
      });
      const css = await cssRes.text();
      const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
      if (!url) return undefined;
      const data = await (await fetch(url)).arrayBuffer();
      out.push({ name: "Archivo", data, weight, style: "normal" });
    }
    return out;
  } catch {
    return undefined;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, operatorId } = await requireOperator();

  // RLS scopes this to the operator's own sends; a foreign id comes back empty.
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, operator_id, species, trip_datetime")
    .eq("id", id)
    .maybeSingle();
  if (!delivery) {
    return new Response("Not found", { status: 404 });
  }

  const [{ data: branding }, { data: operator }, { data: firstPhoto }] = await Promise.all([
    supabase.from("branding").select("brand_color, logo_url, website_url").eq("operator_id", operatorId).maybeSingle(),
    supabase.from("operators").select("name").eq("id", operatorId).maybeSingle(),
    supabase.from("photos").select("storage_key").eq("delivery_id", id).order("sort_order", { ascending: true }).limit(1).maybeSingle(),
  ]);

  let heroUrl: string | null = null;
  if (firstPhoto?.storage_key) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("photos")
      .createSignedUrl(firstPhoto.storage_key as string, 600);
    heroUrl = signed?.signedUrl ?? null;
  }

  const brand = (branding?.brand_color as string) || "#0b5563";
  const logo = (branding?.logo_url as string | null) ?? null;
  const website = ((branding?.website_url as string | null) ?? "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/.*$/, "");
  const name = (operator?.name as string) || "";
  const species = pluralize((delivery.species ?? []) as string[]);
  const trip = delivery.trip_datetime ? new Date(delivery.trip_datetime as string) : null;
  const dateText = trip
    ? trip.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ })
    : "";
  const timeText = trip
    ? trip.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })
    : "";

  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: "flex",
          flexDirection: "column",
          background: brand,
          color: INK,
          fontFamily: fonts ? "Archivo" : "sans-serif",
        }}
      >
        {/* Operator logo banner, on the brand color where their logo is built to sit. */}
        <div style={{ height: 268, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 60px" }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} height={150} style={{ objectFit: "contain" }} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: 1, textAlign: "center" }}>{name}</div>
          )}
        </div>

        {/* Hero photo of the day. Shown at its natural aspect, full bleed to the
            edges, never cropped: the width is fixed to the card and the height
            follows the photo. The text block below takes whatever height is
            left. */}
        <div style={{ flex: "0 0 auto", display: "flex", position: "relative", overflow: "hidden" }}>
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} width={CARD_W} style={{ display: "block" }} alt="" />
          ) : null}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 240, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 100%)" }} />
          <div style={{ position: "absolute", left: 64, bottom: 44, display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase" }}>Photo of the day</div>
        </div>

        {/* Date, trip time, species, website. Centered in whatever space the
            photo leaves, so a shorter photo lets this drift down and a taller
            photo keeps it snug under the image, but the bottom padding means it
            never sits flush against the very bottom edge. */}
        <div style={{ flex: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 64px 96px", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700 }}>{dateText}</div>
            {timeText ? (
              <div style={{ display: "flex", marginTop: 16, fontSize: 28, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase", color: SOFT }}>{timeText} Trip</div>
            ) : null}
          </div>

          {species.length ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 52 }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: 7, textTransform: "uppercase", color: SOFT }}>Sighted today</div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", marginTop: 20, maxWidth: 900 }}>
                {species.map((s) => (
                  <div key={s} style={{ display: "flex", border: `2px solid ${LINE}`, padding: "16px 32px", margin: 9, fontSize: 38, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{s}</div>
                ))}
              </div>
            </div>
          ) : null}

          {website ? (
            <div style={{ display: "flex", marginTop: 52, fontSize: 30, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", color: SOFT }}>{website}</div>
          ) : null}
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts },
  );
}
