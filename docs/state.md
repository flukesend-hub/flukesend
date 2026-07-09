# Flukesend product state

Last updated: July 9, 2026.

This file is the catch-up brief. It exists so any fresh Claude session (a coding
session in this repo, or a plain chat for ideation) can get current fast: what the
product is, who is on it, what has shipped, what was decided and why, and what is
still on the list. Keep it honest and keep it short; update it when something
meaningful changes. The README covers how the code works; this file covers where the
product stands.

## What Flukesend is

Branded photo delivery plus an automatic review engine for whale watch operators.
Guests scan a QR on the boat and type their email. The operator gets home, edits,
creates a send, drops the photos in. Each guest gets a private branded gallery. The
moment a guest downloads, a branded review ask goes out. Downloads are the trigger;
reviews are the product. Photo delivery is the hook that makes the review engine run
itself.

## Who is on it

Three real operators, all on the comped full plan, all US Pacific coast:

- Enocean Tours (Moss Landing, CA). The founder's own operation, and the proving
  ground. Small six passenger boat. The founder's wife is on the team as crew.
- Princess Monterey Whale Watching (Monterey, CA). Larger boats, real guest volume,
  multiple trips a day. Live QR sign-ups every day.
- Discovery Whale Watch (Monterey, CA). Three boats that can leave at the same time,
  three photographers. The reason the Team feature exists.

## Pricing (decided July 2026)

One plan, everything included. $300 a month, or $3,000 a year (two months free).
Free trial is 3 transfers, unlimited guest emails on each, no card required.

History, so nobody relitigates it blind: it launched as three tiers (Inshore $150,
Offshore $250, Fleet $300). A $175 two tier idea was considered and dropped in the
same conversation. Reasoning: at this stage simplicity sells better than
segmentation, and every operator ends up wanting the same features anyway. The
internal plan key is still `fleet`; the customer facing display name is currently
"Standard", which is a placeholder the founder has not signed off on.

## The product today, feature by feature

- Send flow: trip details (boat, crew, times), photos straight to private storage,
  guest emails pasted or preloaded from QR captures, per species head counts.
- Guest gallery: private tokened link, no account, camera roll save on phones, zip
  on desktop. Download fires the review ask instantly.
- QR capture: one QR per operator, posted on the boat. Guest picks boat and trip
  time. A reconcile cron catches late sign-ups after the send already went out.
- Review engine: instant ask on download, cron as safety net, per destination click
  tracking.
- Social page: story card (photo of the day, species counts, brand, safe band so
  Instagram's header does not cover the logo), slideshow mp4 (client side encode, 15
  second cap, speed control), post mode (up to 10 photos for a carousel).
- Team: owner invites by email, invitee sees only a join screen, joins as crew.
  Invite email is white labeled as the operator.
- Analytics: full funnel, trend, per photographer, CSV. Everyone gets all of it.
- Expiry: whole local days, midnight Pacific, so all of a day's sends expire
  together; nightly cleanup at 2 AM Pacific removes storage, keeps history.
- White label sending domain: concierge only, set up through the admin page.
- Admin console: fleet KPIs, triage queue, per operator support tools, comping.

## Deferred, in rough priority order

1. Slideshow presets: a trip by trip recap (one branded frame per trip with that
   trip's own real counts), instead of hand picking photos. Founder explicitly said
   "I will add the presets later".
2. Social customization: layout templates, typography, themes, maybe a short
   operator name. Right now every operator's card looks the same except logo and
   color, and the founder flagged that this will start to feel generic as more
   operators join.
3. Plan display name: "Standard" is a placeholder awaiting the founder's call.
4. Tip jar (Stripe Connect): in the original spec, not started.
5. FareHarbor webhook (auto import bookings as captured guests): in the original
   spec, not started.
6. Capture rate stats (QR sign-ups versus passengers aboard): in the original spec,
   not started.
7. Multi company photographer account switcher: consciously punted. One login, one
   operator. A photographer at two companies uses two work emails.
8. Per operator time zones: expiry is hardcoded to Pacific, which is correct for
   all three current operators. Needed the day a non Pacific operator signs up.
9. Guest facing upsell surface on the gallery page (merch, next trip discount,
   membership): raised once as a future revenue idea, never scoped.

## Known rough edges

- The story card is tuned for landscape heroes. A very tall portrait hero could
  crowd the text block below it; no operator has hit it yet.
- docs/spec.md is the kickoff spec and has drifted; this file and the README are
  the current truth.
- Auth emails (password reset) still send through Supabase's default SMTP, not the
  branded Resend path.

## Operating notes

- Deploys: merge to main auto deploys to production on Vercel (Pro plan). Preview
  build on the working branch first, then merge. Cron schedules live in vercel.json.
- All three operators run on Pacific time. Cron times in UTC: cleanup 09:00 (2 AM
  PT), review sweeps 03:00 and 14:00 (8 PM and 7 AM PT), expiry reminders 16:00
  (9 AM PT), reconcile captures every 15 minutes.
- Stripe: only the $300 monthly and $3,000 yearly prices are wired. The old Inshore
  and Offshore prices still exist in Stripe but nothing references them.
- Supabase project ref: ockpylhphwhumgulhvzv. RLS by operator everywhere; the
  service role key never reaches the client.
