/*
  New send screen. Requires a signed in operator. Passes the operator's default
  guest message so the custom message field can hint at what guests see when it
  is left blank.
*/
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SendForm } from "./send-form";

export default async function SendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    redirect("/onboarding");
  }

  const { data: branding } = await supabase
    .from("branding")
    .select("default_message")
    .eq("operator_id", membership.operator_id)
    .maybeSingle();

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "2rem",
        maxWidth: "40rem",
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard" style={{ color: "#0b5563", fontSize: "0.85rem" }}>
          Back to dashboard
        </Link>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.4rem" }}>New send</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
          Trip details, photos, and the guests who should get them.
        </p>
      </header>

      <SendForm defaultMessage={branding?.default_message ?? ""} />
    </main>
  );
}
