import { LoginForm } from "./login-form";

export default function LoginPage() {
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
          maxWidth: "22rem",
          background: "white",
          borderRadius: "0.9rem",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.4rem" }}>Flukesend</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.9rem" }}>
          Sign in to send a gallery.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
