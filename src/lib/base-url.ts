/*
  The canonical public origin for links that leave the app in email. Code
  running in a user's request can build links from the caller's own Host header
  (the operator is browsing www.flukesend.com, so those come out right), but
  cron jobs are invoked on the deployment's generated .vercel.app URL. Since
  the move to the Pro plan those URLs sit behind Vercel deployment protection,
  so a guest clicking such a link gets a Vercel login wall instead of their
  photos. Anything a cron emails must build its links on this origin instead.
*/
export const CANONICAL_ORIGIN =
  (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "") || "https://www.flukesend.com";
