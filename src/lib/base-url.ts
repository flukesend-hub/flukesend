/*
  The canonical public origin for every link that reaches a guest or lands in
  an email: gallery links, review links, reminder links, the printed QR, team
  invites. Never build these from the request's own Host header. Cron jobs are
  invoked on the deployment's generated .vercel.app URL, which sits behind
  Vercel deployment protection (a guest clicking it gets a Vercel login wall
  instead of their photos), and a person browsing a preview URL would bake that
  protected host into links the same way. Request-host building is fine only
  for same-session redirects (auth callbacks, Stripe return URLs), where the
  link goes back to the person who is already on that host.
*/
export const CANONICAL_ORIGIN =
  (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "") || "https://www.flukesend.com";

// The apex domain that per-operator capture subdomains live on, e.g.
// princess-whale-watching.flukesend.com. Always the real production domain
// (never a preview host): a printed QR lives on a boat for years, and the
// wildcard *.flukesend.com only resolves here. Used only to build capture URLs
// for operators that have a capture_subdomain set; everyone else stays on
// CANONICAL_ORIGIN.
export const CAPTURE_APEX = "flukesend.com";
