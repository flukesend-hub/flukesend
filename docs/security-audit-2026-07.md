# Flukesend pre-scale security and tenant-isolation audit

Date: 2026-07-07
Scope: multi-tenant data isolation before onboarding operator #2 (Ocean Ecoventures),
plus the Stripe/GitHub/ownership-move loose ends and secret hygiene.
Method: read of the real schema (`docs/0001_init.sql` through `0022_*`), the Supabase
client layer, auth/session, every server action, all tokened guest routes, the Stripe
and Resend webhooks, the cron jobs, the CSV exports, storage handling, and the admin
surface.

## How to read this

The good news first: the RLS model is coherent and I found **no concrete cross-tenant
read/write hole in the application code**. Every operator-facing query derives the
operator id server-side from `operator_members` (never from the client), and every
guest/service-role path I traced scopes by the token's own operator chain. The risks
below are about (a) controls that rest on the app layer rather than the database, (b)
the fact that none of this has ever run with two tenants, (c) live-database state I
could not verify from here, and (d) the ownership move leaving credentials and billing
in a half-migrated state.

Severity key: **CRITICAL** (can leak PII or break the product now), **HIGH** (isolation
depends on something unverified or fragile), **MEDIUM** (defense-in-depth gap or
operational hazard), **LOW** (hygiene / future-proofing).

---

## 1. Supabase: tables, RLS, and query paths

### Table-by-table isolation map

| Table | Tenant column | What enforces scoping | Notes |
| --- | --- | --- | --- |
| `operators` | `id` | RLS select/update via `operator_members` | No INSERT policy (onboarding is service-role). UPDATE policy has **no WITH CHECK** (see 1.4). |
| `operator_members` | `operator_id` | RLS `user_id = auth.uid()` (self only) | Deliberately non-recursive. Correct. |
| `branding` | `operator_id` | RLS `for all` via membership + `plan` trigger (0018) | Plan column locked to service role. Good. |
| `review_destinations` | `operator_id` | RLS `for all` via membership | Correct. |
| `deliveries` | `operator_id` | RLS `for all` via membership | Correct. |
| `photos` | via `delivery_id` -> deliveries | RLS `for all` through delivery join | `storage_key` is **app-validated only** (see 1.2). |
| `recipients` | via `delivery_id` -> deliveries | RLS `for all` through delivery join | This is the PII table (guest emails). |
| `events` | via `recipient_id` -> recipients -> deliveries | RLS `for all` through two joins | Correct. |
| `boats`, `crew_members` | `operator_id` | RLS `for all` via membership | Correct. |
| `subscriptions` | `operator_id` | RLS select only; writes service-role | Correct. |
| `usage` | `operator_id` | RLS select only; writes via `increment_recipients_used` (security definer, EXECUTE revoked from public/anon/authenticated) | Correct and well thought out. |
| `capture_links` | `operator_id` | RLS `for all` via membership | Guest submit is service-role. |
| `captured_guests` | `operator_id` | RLS **select only** via membership; writes service-role | This is also PII (guest emails). |
| `sender_domains` | `operator_id` | RLS select only; writes service-role | Correct. |

The pattern is consistent and the join-based policies (photos/recipients/events) are
written correctly. Recipient and capture tokens are `encode(gen_random_bytes(16),'hex')`
= 128 bits of entropy, which is not enumerable.

### 1.1 CRITICAL — Live RLS / storage-policy state is unverified

- **Risk:** The entire isolation story assumes every table actually has RLS *enabled*
  in the live project and that the `photos` bucket has *no* permissive object policy. The
  migration files say so, but migrations drift from what is actually deployed (someone
  can toggle a policy in the dashboard). With one tenant, a missing policy would never
  have surfaced. With two tenants it becomes a live PII leak on day one.
- **Where:** all tables; `storage.objects` for buckets `photos` (private) and `branding`
  (public).
- **Fix (do before onboarding):** Authenticate the Supabase MCP / dashboard and run:
  - `get_advisors` (security lints) and confirm zero "RLS disabled" / "policy exists but
    RLS off" findings.
  - `select relname, relrowsecurity from pg_class where relname in
    ('operators','operator_members','branding','review_destinations','deliveries',
    'photos','recipients','events','boats','crew_members','subscriptions','usage',
    'capture_links','captured_guests','sender_domains');` — every row must be `t`.
  - `select * from storage.buckets;` — confirm `photos.public = false`.
  - `select * from pg_policies where schemaname = 'storage';` — confirm there is **no**
    policy granting `authenticated` or `anon` read/select on the `photos` bucket. Access
    to guest photos must only ever be via server-minted signed URLs.
  - Then create a throwaway second auth user with no membership and confirm that a raw
    PostgREST call (anon key + that user's JWT) against `recipients`, `deliveries`,
    `captured_guests`, and `photos` returns **zero rows**. This is the actual two-tenant
    test that has never been run.

### 1.2 HIGH — Photo ownership rests on an app-layer string check, not RLS

- **Risk:** `photos` RLS validates only that `delivery_id` belongs to the operator. It
  does **not** validate `storage_key`. The only thing stopping operator A from creating a
  photo row (on their own delivery) that points at operator B's storage object is the
  string check in `createSend`:
  `if (!p.storageKey.startsWith(`${operatorId}/`)) return error`
  (`src/app/send/actions.ts:198-202`). If that check is ever removed, weakened, or
  bypassed by a code path that inserts photos without it, operator A gets a working
  signed URL to operator B's photos through A's own gallery. Storage keys are
  `photos/<operator_id>/<send_id>/...`, and operator ids are visible (they appear in the
  showcase page source and are the storage prefix), so the target is guessable.
- **Where:** `src/app/send/actions.ts:198-202`; policy in `docs/0001_init.sql:172-181`.
- **Fix:** Keep the app check (it is correct today) but add a database-level guard so the
  control is not app-only: a `BEFORE INSERT/UPDATE` trigger on `photos` that rejects a
  `storage_key` whose leading path segment is not the owning delivery's `operator_id`.
  This makes cross-tenant photo attachment impossible even if a future insert path forgets
  the check.

### 1.3 HIGH — Guest-facing paths run entirely on the service role

- **Risk:** Every guest route (`/g/[token]` page, `download`, `zip`, `open`, `review`,
  `/j/[token]` submit) and every review-ask/cron path uses `createAdminClient()`, which
  **bypasses RLS**. Isolation in these paths depends 100% on the app correctly scoping
  each query by the token's operator chain. I traced all of them and they are correct
  today (token -> recipient -> delivery -> operator, review destination filtered by
  `operator_id`, download filtered by `delivery_id`). But this is a large blast radius:
  a single future query in these files that forgets an `.eq("operator_id", ...)` or an
  `.eq("delivery_id", ...)` becomes a cross-tenant leak with no database backstop.
- **Where:** `src/lib/gallery.ts`, `src/lib/capture.ts`, `src/lib/review-ask.ts`,
  `src/app/g/[token]/*`, `src/app/j/[token]/actions.ts`, `src/app/api/cron/*`.
- **Fix:** No code change required to ship, but (a) treat these files as a
  security-critical set that gets extra review on every change, and (b) prefer resolving
  everything through the single `getGalleryByToken` / `getCaptureByToken` helpers (already
  the pattern) so new routes inherit the scoping instead of re-querying raw.

### 1.4 MEDIUM — `operators_member_update` has no WITH CHECK; write paths lean on RLS alone

- **Risk (two parts):**
  1. The `operators` UPDATE policy (`docs/0001_init.sql:143-146`) has a `using` clause but
     no `with check`. `using` gates which rows can be touched; `with check` gates the new
     values. Without it, the new row values are not re-validated. Practically the blast
     radius is small (the only writable column the app exposes is `name`, and the PK/FKs
     block an id change), but it is inconsistent with every other `for all` policy in the
     schema, which all carry both clauses.
  2. `updateRecipientEmail` (`src/app/deliveries/[id]/actions.ts:616-633`) updates by
     `recipientId` alone and relies purely on RLS to scope it, whereas sibling actions
     (`deleteReviewLink`, `deleteNamed`, `setCrewRoles`) add a belt-and-suspenders
     `.eq("operator_id", operatorId)`. If RLS on `recipients` were ever misconfigured
     (see 1.1), this write path would let an operator change any guest's email by id.
- **Fix:** Add `with check (id in (select operator_id ...))` to `operators_member_update`.
  For `updateRecipientEmail`, scope the update to the operator's deliveries explicitly
  (join or a `delivery_id in (...)` guard) to match the codebase's own defense-in-depth
  pattern.

### 1.5 LOW — Usage/trial counts rely on RLS with no explicit filter

- `getTrialUsage` (`src/lib/trial.ts:799`) counts `recipients` with no `operator_id`
  filter at all, relying entirely on RLS to scope the count. Correct today, but if RLS
  were off it would count every tenant's guests globally (inflating/deflating trial
  gates, not leaking rows). Low, but it is the same "RLS is the only thing standing here"
  pattern; an explicit filter would be cheap insurance.

### 1.6 Service-role usage in request-handling paths (inventory, as requested)

Service role is used in these request-handling paths. All are either public-by-design
(guests have no session) or admin-gated. None trust a client-supplied tenant id:

- Guest paths (token-scoped): `gallery.ts`, `capture.ts`, `g/[token]/*`, `j/[token]`.
- Onboarding (`onboarding/actions.ts`) — no operators INSERT policy exists on purpose.
- Storage signing/upload/removal (`send/actions.ts`, `logo-upload.ts`, `deliveries`
  delete, cron cleanup) — storage has no member policies, so this is required.
- Usage increment (`usage.ts`) via a locked-down security-definer RPC.
- Billing (`billing/actions.ts`) and webhooks — no user session by nature.
- Admin (`admin/actions.ts`, `admin/**/page.tsx`) — all behind `requireAdmin`.
- Public showcase (`(site)/operators/page.tsx`) — exposes only name/color/logo/website.

The one to keep flagged is the guest set (1.3): highest volume, highest blast radius.

---

## 2. Auth and session

- Operator identity is always derived server-side. Pages use `requireOperator`
  (`getClaims()` local JWT verify) and actions use `resolveOperator` (`getUser()`), then
  look up `operator_members` by `auth.uid()`. The operator id is **never** read from a
  form, query param, or client body in any operator path. Good.
- The proxy (`src/lib/supabase/proxy.ts`) gates every non-public path via `getUser()` and
  redirects signed-out users to `/login`. Public paths are correctly limited to marketing,
  the tokened guest routes, cron, and webhooks.
- Admin gating (`requireAdmin`) checks the signed-in user's email against `ADMIN_EMAILS`
  (default `slater@flukesend.com`) and returns 404 to non-admins. Admin actions that take
  an `operator_id`/`recipientId` from the client are all behind `requireAdmin`, so the
  client-supplied id is an intended admin capability, not a tenant-trust bug.
- `auth/callback` correctly rejects non-relative `next` values (open-redirect guard).

### 2.1 MEDIUM — `.maybeSingle()` on membership assumes one operator per user

`requireOperator`, `resolveOperator`, `getRecentSends`, and the export routes all use
`.maybeSingle()` on `operator_members` filtered by `user_id`. Today each user owns exactly
one operator, so this is fine. The moment the "crew logins later" feature (already modeled
in the schema) puts one user on two operators, `.maybeSingle()` errors out (returns null),
silently bouncing the user to `/onboarding`. Not a leak, but it will break as soon as
membership is many-to-one, which is plausibly near. Flagging so it is a conscious decision,
not a surprise. Fix when that feature lands: select an explicit "active operator" rather
than assuming a single row.

---

## 3. Storage

- `photos` bucket is private; guests only ever get short-lived signed URLs
  (`createSignedUrl(s)`, 120s for downloads, 3600s for gallery view) minted server-side.
  Operators upload via server-minted `createSignedUploadUrl`. No object-level policies, so
  no anon/authenticated direct access — **assuming 1.1 confirms no permissive policy was
  added in the dashboard.**
- Paths are namespaced `photos/<operator_id>/<send_id>/<file>` and
  `branding/<operator_id>/logo.<ext>`. The `branding` bucket is public, but a logo is not
  sensitive and is deliberately public (rendered in galleries/emails).
- Enumeration: the private bucket cannot be listed or read by path without a signed URL,
  and signing happens only after a token resolves to the owning delivery. A guessable path
  alone does **not** leak photos. The one caveat is 1.2 (a crafted `storage_key` in a photo
  row), which is app-guarded today.
- Download filenames are sanitized against header injection
  (`src/app/g/[token]/download/route.ts:229`), and zip entry names strip path separators.

No cross-tenant storage leak found in code. The residual risk is entirely 1.1 (live policy
state) and 1.2 (app-only key check).

---

## 4. Stripe + GitHub + ownership move (slater@flukesend.com)

This is the area with the most half-done state, and it is coupled to isolation only
indirectly (via who holds the keys, section 5).

### 4.1 HIGH — Live Stripe price IDs and secrets belong to the pre-move account

- **Risk:** `src/lib/stripe.ts` bakes in **live-mode** price IDs
  (`price_1Tnp6y...` etc.) as defaults, and the Stripe secret + webhook secret come from
  env. If the ownership move to slater@flukesend.com involves a **new Stripe account** (or
  the old account is closed/transferred), those price IDs, the `STRIPE_SECRET_KEY`, and the
  `STRIPE_WEBHOOK_SECRET` all belong to the old account. What breaks if it stays this way:
  - Checkout: `priceFor()` returns an id that does not exist in the new account ->
    `checkout.sessions.create` fails -> operators cannot subscribe.
  - Webhook: events are signed with the old account's secret -> `constructEvent` throws ->
    every subscription state change is silently dropped (the handler returns 400 and Stripe
    stops retrying) -> comped/paid status never updates.
  - Customer mapping: `syncSubscription` matches on `stripe_customer_id`; customers created
    under the old account will not exist under the new one.
- **Fix / sequence for the move:**
  1. Decide whether billing stays on the existing Stripe account (simplest: transfer the
     account to the new owner, keep all ids and customers) or moves to a new account.
  2. If a new account: recreate products/prices, set `STRIPE_PRICE_*` env overrides (the
     code already supports these), migrate or recreate customers, and re-map
     `subscriptions.stripe_customer_id`/`stripe_subscription_id`.
  3. Rotate `STRIPE_SECRET_KEY` and register a new webhook endpoint + `STRIPE_WEBHOOK_SECRET`
     in Vercel.
  4. Verify with a Stripe test event that `/api/webhooks/stripe` returns 200 and updates a
     row.
- **Note:** Princess Whale Watch (the one existing customer) — confirm whether they are on
  a real Stripe subscription or a comp. If comped (`status=active`, no `stripe_customer_id`),
  the admin panel `setPlan` still works regardless of Stripe, so they are insulated from the
  Stripe move; only new paid signups are blocked until 4.1 is resolved.

### 4.2 MEDIUM — GitHub ownership swap: confirm access, secrets, and deploy hooks

- The repo is `flukesend-hub/flukesend`; the invite link and deploy target hardcode
  `www.flukesend.com`. Nothing in the code breaks on a GitHub org/owner change, but the
  operational couplings do:
  - Vercel's Git integration is tied to the GitHub account/installation. If GitHub
    ownership moves without reconnecting Vercel, `main` auto-deploy stops.
  - Any GitHub Actions secrets / deploy tokens tied to the old owner become invalid.
- **Fix:** After the GitHub transfer, reconnect the Vercel project to the repo under the new
  owner, re-authorize the GitHub app/installation, and confirm a test push to `main`
  deploys. Verify no Actions or webhooks reference the old owner's PATs.

---

## 5. Secrets, webhooks, and Resend

### 5.1 CRITICAL — Rotate all shared secrets on the ownership move, or the prior owner keeps full PII access

- **Risk:** README states local dev runs against the **production** Supabase project
  (`.env.local` points at prod). That means anyone who has ever had `.env.local` holds the
  production `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses RLS on every table**. It also
  means the prod `RESEND_API_KEY`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, and webhook secrets
  have likely been on multiple machines. If ownership is moving to slater@flukesend.com and
  these are not rotated, the previous owner retains unrestricted read/write to *all*
  operators' galleries and guest emails (Princess Whale Watch's and Ocean Ecoventures'
  PII) indefinitely, entirely outside RLS. This is the single biggest threat to the trust
  proposition, and it is an ownership-hygiene issue, not a code bug.
- **Fix (do before onboarding operator #2):** Rotate and re-set in Vercel (and locally):
  - `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard -> API -> roll the service role key;
    also consider rolling the anon key and JWT secret).
  - `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`.
  - `CRON_SECRET`.
  - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (ties into 4.1).
  - Confirm the new owner controls the Supabase org, the Vercel project, the Resend
    account, and the Stripe account. Remove the prior owner's dashboard access.
  - Consider standing up a separate dev/staging Supabase project so local dev stops running
    against production data (pre-existing hazard, worth fixing while touching env anyway).

### 5.2 GOOD — Webhook signature verification is correct

- Stripe (`/api/webhooks/stripe`): verifies `stripe-signature` via `constructEvent`, 503s
  if the secret is unset, 400s on bad signature. Correct.
- Resend (`/api/webhooks/resend`): verifies the Svix HMAC by hand, rejects missing headers
  (401), enforces a 5-minute replay window, and uses `timingSafeEqual`. Correct. It writes
  only `email_status` on a recipient matched by `resend_email_id`; no tenant id is trusted
  from the payload.
- Cron (`/api/cron/*`): `cronAuthorized` does a constant-time bearer compare and 503s if
  `CRON_SECRET` is unset. Correct.

### 5.3 GOOD — Service-role key cannot reach the client

`admin.ts` has a `window` guard and reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC`
prefix, so never bundled). Only two client components import the browser client, and both
use the anon key only. No secret leakage into client bundles found. No live secrets are
committed to the repo or its git history (checked).

### 5.4 LOW — Admin allowlist depends on an auth account existing for slater@flukesend.com

`requireAdmin` matches on the signed-in user's email. After the move, confirm a Supabase
auth user with email `slater@flukesend.com` actually exists (and that the address is
controlled by the new owner), or set `ADMIN_EMAILS` explicitly. Otherwise the admin console
is unreachable. Operational, not a leak.

---

## MUST be true before I onboard operator #2

1. **Live RLS confirmed on every table** (1.1): `get_advisors` clean, `relrowsecurity = t`
   on all 15 tables, and a real anon-JWT test with a membership-less user returns zero rows
   from `recipients`, `deliveries`, `captured_guests`, and `photos`. This is the two-tenant
   test that has never actually run.
2. **`photos` bucket confirmed private with no permissive storage policy** (1.1, 3):
   `photos.public = false` and no `anon`/`authenticated` select policy on `storage.objects`
   for that bucket.
3. **All shared secrets rotated and owned by the new owner** (5.1): service role key
   (mandatory), anon/JWT, Resend key + webhook secret, cron secret, Stripe secret + webhook
   secret. Prior owner's dashboard access removed.
4. **Stripe billing path works end-to-end under the new ownership** (4.1): checkout creates
   a session with valid price ids, and a test webhook event returns 200 and updates a
   subscription row. (If Princess Whale Watch is comped, they are insulated; new paid
   signups are not.)
5. **Second-tenant smoke test in the app itself:** create Ocean Ecoventures as a real
   operator, then, signed in as each operator, confirm neither sees the other's sends,
   galleries, guest emails (Transfers drawer + `/api/export/recipients`), analytics, boats,
   crew, review links, or captured guests. Confirm one operator's gallery token cannot be
   made to render the other's photos.

## Should fix soon

- **1.2** Add a DB trigger enforcing `photos.storage_key` prefix = owning delivery's
  `operator_id`, so cross-tenant photo attachment is impossible even if the app check is
  lost.
- **1.4** Add `WITH CHECK` to `operators_member_update`; scope `updateRecipientEmail` by
  operator explicitly to match the codebase's defense-in-depth pattern.
- **4.2** Reconnect Vercel <-> GitHub under the new owner and confirm `main` auto-deploys;
  purge old-owner Actions secrets/tokens.
- **5.4** Confirm the `slater@flukesend.com` auth account exists (or set `ADMIN_EMAILS`).
- Stand up a dedicated dev/staging Supabase project so local development stops running
  against production PII (5.1).

## Nice to have

- **1.5** Add explicit `operator_id` filters to the trial/usage counts for defense in
  depth, even though RLS covers them.
- **2.1** Plan for the many-to-one membership case before shipping crew logins; today's
  `.maybeSingle()` on `operator_members` will break the moment a user belongs to two
  operators.
- **1.3** Keep the guest/service-role file set (`gallery.ts`, `capture.ts`, `review-ask.ts`,
  `g/[token]/*`, `j/[token]`, `api/cron/*`) on a short list that always gets extra review,
  since they run without the RLS backstop.
- Treat `?preview=1` on the gallery as operator-only if it ever matters for metrics
  integrity; today any token holder can pass it to suppress the open/download/review-ask
  events (not an isolation issue, just a data-quality one).
