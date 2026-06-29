/*
  Protected operator home. The proxy already bounces signed out visitors, but we
  re-check the user here because auth checks belong close to the data, not only
  in the proxy. We then look up which operator this user belongs to. RLS limits
  that read to the user's own membership row.

  If there is no membership yet the operator has signed up but not set up their
  account. The real operator setup screen is the next step; for now this shows a
  placeholder so the auth slice is testable on its own.
*/
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, role, operators(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  const operator = membership?.operators as { name: string } | null | undefined;

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "2rem",
        maxWidth: "42rem",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Flukesend</h1>
        <form action={signout}>
          <button
            type="submit"
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "0.5rem",
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <p style={{ color: "#64748b" }}>
        Signed in as <strong>{user.email}</strong>
      </p>

      {operator ? (
        <p>
          Operator: <strong>{operator.name}</strong>
        </p>
      ) : (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            borderRadius: "0.75rem",
            border: "1px dashed #cbd5e1",
            background: "#f8fafc",
          }}
        >
          <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>
            No operator set up yet.
          </p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
            The operator setup screen is the next step. Once it exists, this is
            where you will name your operation and set your branding.
          </p>
        </div>
      )}
    </main>
  );
}
