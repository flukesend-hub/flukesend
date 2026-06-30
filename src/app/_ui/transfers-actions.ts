/*
  Data for the Transfers drawer. Called from the client when the drawer opens.
  RLS scopes the read to the signed in operator.
*/
"use server";

import { createClient } from "@/lib/supabase/server";

export type RecentSend = {
  id: string;
  date: string;
  captain: string | null;
  guests: number;
  reviewsSent: number;
};

export async function getRecentSends(): Promise<RecentSend[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return [];
  }

  const { data } = await supabase
    .from("deliveries")
    .select("id, created_at, trip_datetime, captain_name, recipients(review_email_status)")
    .eq("operator_id", membership.operator_id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((d) => {
    const recs =
      (d.recipients as unknown as { review_email_status: string | null }[] | null) ?? [];
    return {
      id: d.id,
      date: new Date(d.trip_datetime ?? d.created_at).toLocaleDateString("en-US", {
        dateStyle: "medium",
      }),
      captain: d.captain_name,
      guests: recs.length,
      reviewsSent: recs.filter((r) => r.review_email_status === "sent").length,
    };
  });
}
