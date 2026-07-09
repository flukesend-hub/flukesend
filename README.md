# Flukesend

Branded photo delivery plus an automatic review engine for whale watch operators.
Think WeTransfer, but the download itself triggers a branded review ask. Guests sign
up on the boat by scanning a QR code, the operator gets home and edits the trip
photos, logs in, creates a send, and drops the photos in. Each guest opens a private
branded gallery and downloads. The moment they download, they get an automatic,
branded ask to leave a review.

The source of truth for scope is `docs/spec.md` (written at kickoff; the product has
grown past it in places). The current product state and idea backlog live in
`docs/state.md`. The database schema is `docs/0001_init.sql` plus the later numbered
migrations in `docs/` (through `0025_*` at time of writing).

Standing rules for this repo: no em dashes anywhere in copy or comments; the operator
is always the tenant (multi tenant with Row Level Security by operator); the Supabase
service role key is server only and must never reach the client.

## Stack

- Next.js (App Router, TypeScript) on Vercel
- Supabase for Auth, Postgres, and Storage (project ref `ockpylhphwhumgulhvzv`)
- Resend for transactional email (domain `flukesend.com`)
- Stripe for operator subscriptions

## Supabase clients

- `src/lib/supabase/browser.ts`: browser client, anon key, RLS enforced.
- `src/lib/supabase/server.ts`: SSR client bound to request cookies, anon key, RLS enforced. Use in Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/admin.ts`: server only client, service role key, bypasses RLS. For trusted work: onboarding writes, guest gallery reads, the review job, admin actions, and signing private photos.

Any read that can return more than 1000 rows (the funnel aggregates, the admin health
rollup) pages through `fetchAllRows` in `src/lib/db-page.ts`. PostgREST caps a response
at 1000 rows and `.limit()` cannot raise it, so an unpaged read would silently
undercount. Do not add a large analytics read without paging it.

## Routes

Marketing (public, route group `src/app/(site)`):
- `/` landing, `/how-it-works` the guest-to-review walkthrough, `/operators` the crews-using-it showcase, `/pricing` plans and FAQ.

Auth:
- `/login` email plus password, Continue with Google, and a Forgot password flow.
- `/reset-password` set a new password after a reset link.
- `/auth/callback` exchanges the OAuth or recovery code for a session.

Operator app (requires an operator):
- `/send` the home screen: create a send (trip details, photos, guest emails, per-species head counts), with QR-captured guests preloaded by trip time.
- `/deliveries/[id]` the send confirmation, WeTransfer finished-send style: per-guest status, add a guest, fix or resend a bounce, delete the send, and a "Make a story" link into the Social page for that trip day.
- `/story` the Social page: build a branded story card, a slideshow video, or a photo set for a regular post from any recent trip day. See the Social section below.
- `/analytics` the funnel dashboard: reached, opened, downloaded, review clicks, recent sends, trend, per-photographer breakdown, CSV export.
- `/settings` branding, trip times, website and social links, species list, boats and employees, the team (invite teammates), review links.
- `/billing` Stripe checkout and customer portal.
- `/onboarding` first-run operator setup, or the join screen when a team invite is waiting. `/dashboard` redirects to `/send`.

Admin (platform owner only, gated by email allowlist):
- `/admin` the support console: fleet KPIs for the month, a triage queue of operators needing attention, and a brand-colored card per operator (their logo, live health, plan control, invite link).
- `/admin/operators/[id]` act on one operator's behalf: branding, review links, bounced guests (fix and resend, or delete a dead address), and the white-label sender domain.

Guest (tokened, no account):
- `/j/[token]` the on-boat QR sign-up: a guest picks their trip time and types their email, which lands as a captured guest for the operator's next send.
- `/g/[token]` the branded gallery. `/g/[token]/download` streams a photo and writes the download event (and fires the review ask). `/g/[token]/zip` downloads the whole set. `/g/[token]/open` logs an open. `/g/[token]/review?d=<id>` logs a review-link tap and redirects to the destination.

API:
- `/api/cron/review-emails` the review sweep, safety net for the instant ask (Bearer `CRON_SECRET`).
- `/api/cron/expiry-reminders` reminds guests whose gallery is about to expire.
- `/api/cron/cleanup` removes storage for expired sends (09:00 UTC, which is 2 AM Pacific).
- `/api/cron/reconcile-captures` every 15 minutes, catches QR sign-ups that arrived after their trip's send went out and emails them their gallery.
- `/api/webhooks/stripe` Stripe webhook (signature verified).
- `/api/webhooks/resend` Resend bounce and complaint webhook (writes `email_status`).
- `/api/export/recipients` CSV of the operator's guest emails. `/api/export/analytics` CSV of every send with its funnel.

## The main flow

1. Guests sign up on the boat by scanning the operator's QR code (`/j/<token>`),
   picking their trip time and entering their email. These land as `captured_guests`.
2. The operator creates a send (`/send`). Photos upload straight to a private Storage
   bucket. One `deliveries` row is written, plus one `photos` row per file and one
   `recipients` row per guest (each with its own gallery token). Guests captured for
   that trip time are preloaded. Each guest is emailed their `/g/<token>` link via Resend.
3. A guest opens their gallery and downloads. The download writes a `downloaded` event,
   which is the trigger for the review ask.
4. The review ask fires immediately on download, via `next/server` `after()`, so it
   goes out while the trip is fresh (`src/lib/review-ask.ts`). `REVIEW_DELAY_HOURS` is
   0. The cron (`/api/cron/review-emails`, 03:00 and 14:00 UTC) is now a safety-net
   sweeper: it retries anything that failed and catches operators who added review
   links after their guests already downloaded.
5. The send confirmation and `/analytics` show each guest move through Sent, Opened,
   Downloaded, Review clicked.

## Roster and credits

Operators add their boats and their people (employees) once in Settings, and tag each
person with roles: captain, crew, naturalist, or photographer. On a send the operator
just checks who was aboard. Each person is credited exactly once, by their highest
ranked role (captain, then naturalist, then photographer, then crew), so nobody is
named twice in the email. See `src/lib/roles.ts`.

## Species and trip times

Each operator keeps their own species list (`branding.species_options`), chosen from a
built-in US West Coast catalog or typed in, and their own trip times
(`branding.trip_times`). The send form and the QR sign-up both read the trip times; the
send form shows the species list as pills, each with an optional head count
(`deliveries.species_counts`, migration `0024`). See `src/lib/species.ts` and
`src/lib/trip-times.ts`.

## Social (the Story Builder)

`/story` turns a trip day into ready-to-post content in the operator's brand
(`src/app/story/story-builder.tsx`, shared renderer `src/lib/story-card.tsx`):

- Story, single: a 1080x1920 "Photo of the day" card with the operator's logo on the
  brand color, a hero photo, the date and trip time, the species sighted, and the
  website. With head counts recorded, sightings show as number plus name; across a
  multi-trip day the count per species is the highest single-trip count, not the sum,
  since the same animals are usually seen on more than one trip.
- Story, slideshow: the chosen photos encoded client side into one branded .mp4
  (WebCodecs plus mp4-muxer, `src/app/story/make-video.ts`), 15 seconds max, with a
  Fast, Medium, Slow speed control. Frames are labeled "Photos from today".
- Post: pick up to 10 photos and download them as a set for a regular carousel post.

The card reserves a 180px top band so Instagram's own story header (avatar, username)
never covers the logo. `CARD_V` in the builder versions the card preview URLs; bump it
whenever the card design changes, since the browser caches a rendered card for 10
minutes per URL.

## Team

One operator, several logins. The owner invites a teammate by email in Settings
(`operator_invites`, migration `0025`); the invite email is white labeled as the
operator. When the invited person signs up with that email, onboarding shows only a
"Join {Operator}" screen and binds them as `crew` (the roles CHECK allows only owner
and crew). Crew have full operational access by membership; only the owner manages the
team. One login belongs to one operator by design; a photographer working for two
companies uses two work emails.

## Branding and theme

Two separate color systems, do not confuse them:

- Flukesend's own chrome (app UI and marketing) is an ocean-blue on white/cream theme,
  driven by CSS variables in `src/app/globals.css` (`--signal` #1f6f9c for buttons and
  accents, `--signal-2` #1c5578, navy text). Success greens (`--good`) are deliberately
  kept green.
- Each operator's own brand color, logo, and message drive their guest galleries and
  emails. This is per operator and set in Settings; it never uses the Flukesend blue.

## Email

- Guest emails (gallery delivery, the review ask, the expiry reminder) and team invites
  are built in `src/lib/delivery-email.ts`, `src/lib/review-email.ts`,
  `src/lib/reminder-email.ts`, and `src/app/settings/actions.ts`, and sent through
  Resend. They are white labeled as the operator: the From is
  `"Operator Name" <slug@flukesend.com>` and the Reply-To is the operator's reply-to
  address set in Settings.
- White-label sending domains: an operator can send from their own domain instead of
  the shared `flukesend.com` sender once it is verified. `resolveFromAddress`
  (`src/lib/sender-domain.ts`) picks the verified operator domain when present. This is
  concierge-only, set up for the operator through the admin support page (migration
  `0020_sender_domains.sql`).
- Bounces and complaints: the Resend webhook (`/api/webhooks/resend`) writes
  `recipients.email_status`, which surfaces the guest in the admin bounced-guests panel
  and stops counting against the operator's reached number. Requires
  `RESEND_WEBHOOK_SECRET` and the webhook configured in the Resend dashboard.
- The social icons in the email footer are hosted in the public Supabase Storage bucket
  at `branding/app/social/*.png`, referenced by a fixed public URL (see
  `src/lib/email-social.ts`).
- Auth emails (password reset) are sent by Supabase Auth. For branding and reliability,
  point Supabase custom SMTP at Resend and use a branded template.

## Analytics

`/analytics` (`src/lib/analytics.ts`) is the operator's funnel: guests reached, opened,
downloaded, and review clicks for the current month, drawn as shrinking bars, plus
recent sends, a monthly trend, a per-photographer breakdown, and CSV export. The single
plan includes all of it.

## Billing and plans

- One paid plan, everything included: $300 a month or $3,000 a year (two months free).
  Unlimited emails a month, up to 100 per send, unlimited boats, full analytics, the
  Social page, white label sending, expiry reminders. The internal plan key is still
  `fleet` (so no data migration was needed when the tiers collapsed); the display name
  lives in `src/lib/plans.ts`. Price IDs live in `src/lib/stripe.ts`.
- New operators are on a free trial: `TRIAL_TRANSFERS` (3) free transfers, each
  reaching as many guests as they like (`src/lib/trial.ts`). Past the wall, sending is
  blocked with an upgrade prompt.
- Subscription state lives in the `subscriptions` table (status trial, active, or
  canceled; tier; billing cycle). No row reads as trial. Canceled means no plan, so
  sending is blocked until they subscribe.
- Comping: the admin sets an operator to active with no Stripe ids, which is unlimited
  free use. Removing a comp drops them back to the trial so they can subscribe normally.

## Retention and cleanup

Every delivery stamps `expires_at` when created: whole local days, not hours. A send on
July 1 with 7 day retention stays live through all of July 8 and expires at midnight
Pacific, so every send on a day expires together and the guest keeps the full final
day (`src/lib/retention.ts`, anchored to `America/Los_Angeles` until per operator time
zones exist). The nightly cleanup cron (2 AM Pacific) then removes the storage objects
for expired sends; delivery rows, photo rows, and events stay for history and
analytics.

## Admin

The platform admin (`/admin`) is gated by `requireAdmin` in `src/lib/admin.ts` against
an email allowlist (`ADMIN_EMAILS`, defaulting to the owner). Non admins get a 404. The
admin account has no operator of its own.

The console shows fleet KPIs for the month (real operators only, demo tenants excluded),
a "needs attention" triage queue built from per-operator health (`src/lib/admin-health.ts`),
and a brand-colored card per operator with their logo, this month's numbers, an inline
plan control, and an invite link (operators self-onboard; the admin hands them the
signup URL). The per-operator support page can edit branding, review links, and the
sender domain, fix or delete bounced guests, and set the plan, all on the operator's
behalf.

## Environment variables

Set these in `.env.local` for local dev and in Vercel for production.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe in the client, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `RESEND_API_KEY` | Resend API key for sending guest emails |
| `REVIEW_FROM_EMAIL` | Fallback From address for review emails |
| `RESEND_WEBHOOK_SECRET` | Signing secret for the Resend bounce webhook |
| `CRON_SECRET` | Bearer secret the cron jobs check |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_*` | Optional overrides for the baked-in price IDs |
| `ADMIN_EMAILS` | Optional comma separated admin allowlist (overrides the default owner) |

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dev server reads `.env.local`, which points at the
production Supabase project, so server actions and the review job run against real data.

## Migrations

SQL migrations are numbered files in `docs/` (`0001_init.sql` onward, currently through
`0025_*`). They are applied to the Supabase project. When you change the schema, add the
next numbered file and apply it.

## Deployment

Vercel auto-deploys `main` to production (https://www.flukesend.com). Branches get a
preview URL. Environment variable changes only take effect on a new deploy. Cron
schedules live in `vercel.json`.
