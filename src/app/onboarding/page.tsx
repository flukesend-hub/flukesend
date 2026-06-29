/*
  Operator setup screen. Shown to a signed in user who has no operator yet. If
  they already have one we send them on to the dashboard, so this route is only
  ever the first run experience.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
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
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background: "#f1f5f9",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "26rem",
          background: "white",
          borderRadius: "0.9rem",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.4rem" }}>
          Set up your operator
        </h1>
        <p
          style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.9rem" }}
        >
          A few details to brand your galleries and review asks. You can change
          these any time.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
