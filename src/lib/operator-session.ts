/*
  Fast auth plus operator resolution for pages. The proxy already verified the
  session against the Auth server on this same request (it gates every non
  public path and refreshes tokens), so pages verify the JWT locally instead:
  getClaims checks the signature against the project's cached JWKS with no
  network round trip on asymmetric keys, and falls back to a server check on
  legacy symmetric keys. That removes one Auth API call from every page view.

  Every operator page needs the same two facts (who is signed in, which
  operator they belong to), so this is also the one place that membership
  lookup lives instead of being copy pasted per page.
*/
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OperatorSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  operatorId: string;
  operatorName: string | null;
};

export async function requireOperator(): Promise<OperatorSession> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, operators(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }
  const operator = membership.operators as unknown as { name: string } | null;

  return {
    supabase,
    userId,
    operatorId: membership.operator_id as string,
    operatorName: operator?.name ?? null,
  };
}
