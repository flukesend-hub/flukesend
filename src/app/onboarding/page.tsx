/*
  Operator setup screen. Shown to a signed in user who has no operator yet. If
  they already have one we send them to the dashboard.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { signout } from "@/app/auth/actions";
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
      {/* Anyone here is signed in but belongs to no operator. Often that just
          means they logged in with the wrong account (a phone reusing another
          Google login), so name the account and give them a way straight out
          instead of stranding them on a create-a-workspace form. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 14px",
          marginBottom: "24px",
          padding: "11px 15px",
          borderRadius: "10px",
          background: "var(--surface, #f6f4ef)",
          border: "1px solid var(--hairline, #e7e0d4)",
          fontSize: "13.5px",
          color: "var(--muted)",
        }}
      >
        <span>
          Signed in as{" "}
          <strong style={{ color: "var(--ink, #1c2b2e)" }}>{user.email}</strong>.
          Not you, or need a different account?
        </span>
        <form action={signout}>
          <button
            type="submit"
            style={{
              font: "inherit",
              fontWeight: 600,
              color: "var(--signal, #1f6f9c)",
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
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
