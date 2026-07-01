/*
  Operator setup screen. Shown to a signed in user who has no operator yet. If
  they already have one we send them to the dashboard.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // The platform admin has no operator by design. Send them to the admin
  // screen instead of nudging them to create a workspace.
  if (isAdminEmail(user.email)) {
    redirect("/admin");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main style={{ maxWidth: "1040px", margin: "0 auto", padding: "34px 22px 80px" }}>
      <div className="fl-eyebrow">One time setup</div>
      <h1 className="fl-h1" style={{ fontSize: "32px" }}>
        Set up your workspace
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
        Set this once. Every send reuses it, so your galleries and the nightly
        review asks always look like you and point to the right places.
      </p>
      <OnboardingForm />
    </main>
  );
}
