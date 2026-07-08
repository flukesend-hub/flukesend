/*
  Story Builder (Fleet). Pick a trip day and build a branded photo-of-the-day
  story: the sightings across that day's trips, and a hero of your choice. The
  page lists the operator's recent trip days (last 30, only those with photos);
  the client does the day selection, hero pick, live preview, and download.
  Non-Fleet operators get an upsell instead.
*/
import Link from "next/link";
import { requireOperator } from "@/lib/operator-session";
import { OperatorNav } from "@/app/_ui/operator-nav";
import { getPlan } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { StoryBuilder, type StoryDay } from "./story-builder";

export const dynamic = "force-dynamic";

export default async function StoryPage() {
  const { supabase, operatorId, operatorName } = await requireOperator();
  const tier = (await getPlan(supabase, operatorId)).tier;
  const allowed = PLANS[tier]?.storyBuilder ?? false;

  if (!allowed) {
    return (
      <>
        <OperatorNav operatorName={operatorName ?? "Operator"} />
        <main style={{ maxWidth: "620px", margin: "0 auto", padding: "44px 22px 80px" }}>
          <div className="fl-eyebrow">Story Builder</div>
          <h1 className="fl-h1" style={{ fontSize: "30px" }}>A ready-to-post story from every day on the water</h1>
          <p style={{ color: "var(--muted)", fontSize: "14.5px", lineHeight: 1.6, maxWidth: "54ch", margin: "10px 0 0" }}>
            Turn a day of trips into a branded photo-of-the-day story: the species you sighted and the shot of your choice, in your own colors and logo, sized for Instagram. The Story Builder is part of the Fleet plan.
          </p>
          <Link href="/billing" className="fl-btn" style={{ display: "inline-block", marginTop: 22, textDecoration: "none", padding: "13px 22px" }}>
            See the Fleet plan
          </Link>
        </main>
      </>
    );
  }

  // Last 30 days of trips, grouped by UTC day. Only days that have photos can
  // become a card, since the card needs a hero.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: dels } = await supabase
    .from("deliveries")
    .select("id, species, trip_datetime")
    .eq("operator_id", operatorId)
    .gte("trip_datetime", since)
    .order("trip_datetime", { ascending: false });
  const deliveries = dels ?? [];
  const ids = deliveries.map((d) => d.id as string);

  let ph: { delivery_id: string }[] = [];
  if (ids.length) {
    const res = await supabase.from("photos").select("delivery_id").in("delivery_id", ids);
    ph = (res.data ?? []) as { delivery_id: string }[];
  }
  const photoCount = new Map<string, number>();
  for (const p of ph) {
    const k = p.delivery_id;
    photoCount.set(k, (photoCount.get(k) ?? 0) + 1);
  }

  const byDay = new Map<string, StoryDay>();
  for (const d of deliveries) {
    if (!d.trip_datetime) continue;
    const photos = photoCount.get(d.id as string) ?? 0;
    if (!photos) continue;
    const date = new Date(d.trip_datetime as string).toISOString().slice(0, 10);
    let day = byDay.get(date);
    if (!day) {
      day = {
        date,
        label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
        trips: 0,
        photos: 0,
        species: [],
      };
      byDay.set(date, day);
    }
    day.trips += 1;
    day.photos += photos;
    for (const raw of (d.species ?? []) as string[]) {
      const s = raw.trim();
      if (s && !day.species.some((x) => x.toLowerCase() === s.toLowerCase())) day.species.push(s);
    }
  }
  const days = [...byDay.values()];

  return (
    <>
      <OperatorNav operatorName={operatorName ?? "Operator"} />
      <StoryBuilder days={days} />
    </>
  );
}
