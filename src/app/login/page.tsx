import { redirect } from "next/navigation";
import { postAuthDestination } from "@/lib/operator-session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in (a pre-logged-in browser hitting Log in): go straight to
  // where this account belongs instead of showing the form and bouncing.
  const dest = await postAuthDestination();
  if (dest !== "/login") {
    redirect(dest);
  }
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "40px 22px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/flukesend-wordmark-black.png" alt="Flukesend" style={{ height: "30px", width: "auto" }} />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
