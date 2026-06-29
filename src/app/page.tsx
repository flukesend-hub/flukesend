/*
  Temporary landing for step 1. Confirms the app builds, runs, and that the dark
  workspace styling foundation is wired up. The real screens start in step 2.
*/

export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "80px 22px" }}>
      <div className="eyebrow">Flukesend</div>
      <h1 className="title">The workspace is standing</h1>
      <p className="sub">
        Step 1 is done. Next.js is running, the Supabase client helpers are in
        place, and the brand styling foundation from the mockup is loaded. Auth
        and the operator setup screen come next.
      </p>
    </main>
  );
}
