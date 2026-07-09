/*
  Operator setup screen. Shown to a signed in user who has no operator yet. If
  they already have one we send them to the dashboard.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { signout } from "@/app/auth/actions";
import { OnboardingForm } from "./onboarding-form";
import { acceptInvite } from "./actions";

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

  // A pending invite for this signed in email means a team is waiting for them.
  // Offer to join it instead of forcing them to build their own operator. Read
  // with the service role, since a not yet member cannot read invites by RLS.
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("operator_invites")
    .select("id, operator_id")
    .ilike("email", (user.email ?? "").trim().toLowerCase())
    .is("accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let inviteOperatorName: string | null = null;
  if (invite) {
    const { data: op } = await admin
      .from("operators")
      .select("name")
      .eq("id", invite.operator_id as string)
      .maybeSingle();
    inviteOperatorName = (op?.name as string) ?? null;
  }
  const showInvite = Boolean(invite && inviteOperatorName);

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
      {showInvite ? (
        <div
          style={{
            marginBottom: "30px",
            padding: "22px 24px",
            borderRadius: "16px",
            border: "1px solid var(--hairline, #e7e0d4)",
            background: "var(--surface, #f6f4ef)",
          }}
        >
          <div className="fl-eyebrow">Team invite</div>
          <h1 className="fl-h1" style={{ fontSize: "28px", margin: "2px 0 8px" }}>
            Join {inviteOperatorName} on Flukesend
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "58ch", margin: "0 0 18px" }}>
            You have been invited to join {inviteOperatorName} as a team member.
            You will share their account and branding, with your own login.
          </p>
          <form action={acceptInvite}>
            <input type="hidden" name="inviteId" value={String(invite?.id ?? "")} />
            <button type="submit" className="fl-btn" style={{ padding: "13px 24px" }}>
              Join {inviteOperatorName}
            </button>
          </form>
        </div>
      ) : null}

      <div className="fl-eyebrow">{showInvite ? "Or start your own" : "One time setup"}</div>
      <h1 className="fl-h1" style={{ fontSize: showInvite ? "24px" : "32px" }}>
        {showInvite ? "Set up your own operation" : "Set up your workspace"}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "14.5px", maxWidth: "62ch", margin: 0 }}>
        Set this once. Every send reuses it, so your galleries and the nightly
        review asks always look like you and point to the right places.
      </p>
      <OnboardingForm />
    </main>
  );
}
