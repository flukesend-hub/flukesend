import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
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
          <img src="/brand/flukesend-wordmark.png" alt="Flukesend" style={{ height: "42px", width: "auto" }} />
          <p style={{ color: "var(--muted)", fontSize: "14.5px", margin: "8px auto 0", maxWidth: "30ch" }}>
            Choose a new password for your account.
          </p>
        </div>
        <ResetForm />
      </div>
    </main>
  );
}
