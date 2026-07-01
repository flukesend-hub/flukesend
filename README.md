# Flukesend

Branded photo delivery plus an automatic review engine for whale watch operators.
Think WeTransfer, but the download itself triggers a branded review ask. An operator
gets home, edits the trip photos, logs in, creates a send, drops the photos in, and
pastes the guest emails. Each guest opens a private branded gallery and downloads. A
few hours later they get an automatic, branded ask to leave a review.

The source of truth for scope is `docs/spec.md`. The database schema is `docs/0001_init.sql`
plus the later numbered migrations in `docs/`.

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

## Routes

Marketing (public, route group `src/app/(site)`):
- `/` landing, `/pricing` plans and FAQ.

Auth:
- `/login` email plus password, Continue with Google, and a Forgot password flow.
- `/reset-password` set a new password after a reset link.
- `/auth/callback` exchanges the OAuth or recovery code for a session.

Operator app (requires an operator):
- `/send` the home screen: create a send (trip details, photos, guest emails).
- `/deliveries/[id]` the send confirmation, WeTransfer finished-send style.
- `/settings` branding, website and social links, species list, boats and employees, review links.
- `/billing` Stripe checkout and customer portal.
- `/onboarding` first-run operator setup. `/dashboard` redirects to `/send`.

Admin (platform owner only, gated by email allowlist):
- `/admin` set each operator's plan and open the support branding editor.
- `/admin/operators/[id]` edit an operator's branding on their behalf.

Guest (tokened, no account):
- `/g/[token]` the branded gallery. `/g/[token]/download` streams a photo and writes the download event. `/g/[token]/open` logs an open.

API:
- `/api/cron/review-emails` the nightly review job (Bearer `CRON_SECRET`).
- `/api/webhooks/stripe` Stripe webhook (signature verified).
- `/api/export/recipients` CSV export of the operator's guest emails.

## The main flow

1. Create a send (`/send`). Photos upload straight to a private Storage bucket. One
   `deliveries` row is written, plus one `photos` row per file and one `recipients`
   row per guest email (each with its own gallery token). Each guest is emailed their
   `/g/<token>` link via Resend.
2. A guest opens their gallery and downloads. The download writes a `downloaded`
   event, which is the trigger for the review ask.
3. The nightly cron runs twice a day (03:00 and 14:00 UTC, which is 8 PM and 7 AM
   Pacific in summer). It emails a branded review ask to every guest who has
   downloaded and has not been asked yet. `REVIEW_DELAY_HOURS` is 0, so a download is
   eligible at the next run.
4. The send confirmation page shows each guest move through Sent, Opened, Downloaded,
   Review sent.

## Roster and credits

Operators add their boats and their people (employees) once in Settings, and tag each
person with roles: captain, crew, naturalist, or photographer. On a send the operator
just checks who was aboard. Each person is credited exactly once, by their highest
ranked role (captain, then naturalist, then photographer, then crew), so nobody is
named twice in the email. See `src/lib/roles.ts`.

## Species

Each operator keeps their own species list (`branding.species_options`), chosen from a
built-in US West Coast catalog or typed in. The send form shows that list as pills and
falls back to a default when unset. See `src/lib/species.ts`.

## Branding and theme

Two separate color systems, do not confuse them:

- Flukesend's own chrome (app UI and marketing) is a sea-green on white theme, driven
  by CSS variables in `src/app/globals.css` (`--signal` #3f7a4d for buttons, white
  surfaces, dark readable text).
- Each operator's own brand color, logo, and message drive their guest galleries and
  emails. This is per operator and set in Settings; it never uses the Flukesend green.

## Email

- Guest emails (gallery delivery and the review ask) are built in `src/lib/delivery-email.ts`
  and `src/lib/review-email.ts` and sent through Resend. They are white labeled as the
  operator: the From is `"Operator Name" <slug@flukesend.com>` and the Reply-To is the
  operator's signup email.
- The social icons in the email footer are hosted in the public Supabase Storage bucket
  at `branding/app/social/*.png`, referenced by a fixed public URL so they render from
  anywhere (see `src/lib/email-social.ts`).
- Auth emails (password reset) are sent by Supabase Auth. For branding and reliability,
  point Supabase custom SMTP at Resend and use a branded template.

## Billing and plans

- Plans are single (1 boat), two (2 boats), and fleet (unlimited), monthly or yearly.
  Catalog and price IDs live in `src/lib/stripe.ts`.
- New operators are on a free trial: `TRIAL_TRANSFERS` (3) or `TRIAL_EMAILS` (30),
  whichever comes first (`src/lib/trial.ts`). Past the wall, sending is blocked with an
  upgrade prompt.
- Boat count is gated by plan. Adding past the limit prompts an upgrade.
- Subscription state lives in the `subscriptions` table (status trial, active, or
  canceled; tier; billing cycle). No row reads as trial. Canceled means no plan, so
  sending is blocked until they subscribe.
- Comping: the admin sets an operator to active with a tier and no Stripe ids, which is
  unlimited free use. Removing a comp drops them back to the trial so they can subscribe
  normally.

## Admin

The platform admin (`/admin`) is gated by `requireAdmin` in `src/lib/admin.ts` against
an email allowlist (`ADMIN_EMAILS`, defaulting to the owner). Non admins get a 404. The
admin can set any operator's plan from a dropdown and edit any operator's branding for
support. The admin account has no operator of its own.

## Environment variables

Set these in `.env.local` for local dev and in Vercel for production.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe in the client, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `RESEND_API_KEY` | Resend API key for sending guest emails |
| `REVIEW_FROM_EMAIL` | Fallback From address for review emails |
| `CRON_SECRET` | Bearer secret the cron job checks |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_*` | Optional overrides for the baked-in price IDs |
| `ADMIN_EMAILS` | Optional comma separated admin allowlist |

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dev server reads `.env.local`, which points at the
production Supabase project, so server actions and the review job run against real data.

## Migrations

SQL migrations are numbered files in `docs/` (`0001_init.sql` onward). They are applied
to the Supabase project. When you change the schema, add the next numbered file and
apply it.

## Deployment

Vercel auto-deploys `main` to production (https://www.flukesend.com). Branches get a
preview URL. Environment variable changes only take effect on a new deploy.
