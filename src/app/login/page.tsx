import { LoginForm } from "./login-form";

export default function LoginPage() {
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
