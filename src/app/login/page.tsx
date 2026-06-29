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
          <div className="fl-display" style={{ fontSize: "34px" }}>
            Flukesend
          </div>
          <p
            style={{
              color: "var(--muted)",
              fontSize: "14.5px",
              margin: "8px auto 0",
              maxWidth: "30ch",
            }}
          >
            The calm back room where your trip photos turn into galleries and
            quiet review asks.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
