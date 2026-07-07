# Flukesend pre-scale security and tenant-isolation audit

Date: 2026-07-07
Scope: multi-tenant data isolation before onboarding operator #2 (Ocean Ecoventures),
plus the Stripe/GitHub/ownership-move loose ends and secret hygiene.
Method: read of the real schema (`docs/0001_init.sql` through `0022_*`), the Supabase
client layer, auth/session, every server action, all tokened guest routes, the Stripe
and Resend webhooks, the cron jobs, the CSV exports, storage handling, and the admin
surface.

## Ownership state (clarified 2026-07-07)

slater@flukesend.com was **added** to every part of the stack (Supabase, Vercel, Resend,
Stripe, GitHub). **Nothing was removed** from flukesend@gmail.com, which retains full
control. So this is an *add-a-second-admin*, not an account migration. That corrects two
things in the original draft: (a) nothing broke, because no account, key, price id, or
webhook was moved or revoked; and (b) there is no orphaned or leftover access to clean up
as an incident. The findings in sections 4 and 5 below are recalibrated accordingly. The
only standing note that survives is that flukesend@gmail.com now guards production access
to all-tenant PII (the service role bypasses RLS), so that Gmail account's own security is
a single point of failure worth hardening (5.1). None of this blocks onboarding operator
#2. The genuine blockers are all in section 1 (live RLS verification and the two-tenant
test), which the ownership situation does not touch.

## Live verification (2026-07-07, project ockpylhphwhumgulhvzv)

Run directly against the production database via the Supabase connector. This closes MUST
items 1 and 2 below; they are no longer pending.

- **RLS enabled on all 15 public tables**, with policy counts matching the migrations
  (`operators` has 2, every other table 1). No table in the exposed `public` schema has RLS
  off. PASS.
- **`photos` bucket is private**: `storage.buckets.public = false` for `photos` (and `true`
  for `branding`, as intended for logos). `storage.objects` has RLS **enabled with zero
  policies**, so no `anon`/`authenticated` role can read, list, or write objects by path.
  The only access is the service role (server-only) or a server-minted signed URL. A guessed
  path returns 403. PASS.
- **Cross-tenant read test passed with real data.** Three operators already hold data in
  prod (`dbb9e0a2` = 303 recipients is the live customer; `0d2fb4e9` and `0a01d601` are
  demo/showcase tenants), so isolation is already exercised at the data layer. Impersonating
  operator `0d2fb4e9`'s user under RLS returned **10 recipients / 5 deliveries / 1 operator /
  49 photos** (their own), not the 314 / 22 / 3 totals. Impersonating a membership-less
  authenticated user returned **0 rows on every table** (recipients, deliveries,
  captured_guests, photos, operators, operator_members, subscriptions). PASS.
- **`SECURITY DEFINER` functions are safe**: both `increment_recipients_used` and
  `protect_branding_plan` pin `search_path=public`. Execute on `increment_recipients_used`
  is revoked from `anon`/`authenticated` (only the service role can call it). PASS.
- **Security Advisor result (dashboard, 2026-07-07): 0 errors, 3 warnings, 0 info.** No
  errors is the headline: the scanner found no RLS-disabled tables and no cross-tenant
  exposure, matching the manual tests. The three warnings and their disposition:
  1. "Public can execute SECURITY DEFINER function" on `protect_branding_plan()` -> fixed
     in migration 0023 (execute revoked from public/anon/authenticated). Was never
     REST-callable anyway (trigger return type), but now clean.
  2. "Signed-in users can execute SECURITY DEFINER function" on `protect_branding_plan()`
     -> same fix, migration 0023.
  3. "Leaked Password Protection Disabled" (Auth) -> **still open, a dashboard toggle for
     the owner.** Enable Authentication -> Policies -> Password security -> "Leaked password
     protection" so breached passwords are rejected at signup. The app only enforces 8+
     chars today, so this is a real hardening win. Not code, not a blocker.

### Migration 0023 applied (2026-07-07)

`docs/0023_isolation_hardening.sql`, applied to production and verified live. Three
defense-in-depth changes, none of which change behavior for a correct client:

- **Revoked EXECUTE on `protect_branding_plan()`** from public/anon/authenticated (clears
  advisor warnings 1 and 2; the trigger still fires normally).
- **Added `WITH CHECK` to `operators_member_update`** (closes finding 1.4's policy half).
- **Added trigger `photos_storage_key_owner_guard`** enforcing that a photo's `storage_key`
  is under the owning delivery's `operator_id` namespace (closes finding 1.2). Verified all
  254 existing photos already conform, then tested live: a cross-tenant insert on operator
  A's delivery with operator B's key was **rejected** ("storage_key ... is outside operator
  ... namespace"), and a legitimate own-namespace insert was **accepted**. Both test rows
  rolled back; zero rows left behind.

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

### 1.1 CONFIRMED (was CRITICAL) — Live RLS / storage-policy state verified 2026-07-07

- **Status:** Verified against production on 2026-07-07 (see "Live verification" at the top).
  All 15 tables have RLS enabled, `photos` is private with no permissive storage policy, and
  both the positive control (operator sees only their own rows) and the negative test
  (membership-less user sees zero) passed against real multi-tenant data. No leak. The only
  residual is running `get_advisors` interactively as a final confirmation.
- **Original risk (now closed):** The isolation story assumed every table actually had RLS
  *enabled* in the live project and that `photos` had *no* permissive object policy.
  Migrations can drift from what is deployed, and with one tenant a missing policy would
  never surface. This is exactly what the verification confirmed is not the case.
- **Where:** all tables; `storage.objects` for buckets `photos` (private) and `branding`
  (public).
- **How it was verified (re-runnable):**
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

### 1.2 FIXED (was HIGH) — Photo ownership now enforced by a DB trigger (migration 0023)

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
- **Status:** Done in migration 0023. The `photos_storage_key_owner_guard` trigger rejects
  any `storage_key` whose leading path segment is not the owning delivery's `operator_id`,
  so cross-tenant photo attachment is now impossible even if a future insert path forgets the
  app check. Verified live (cross-tenant insert rejected, own-namespace insert accepted). The
  app check in `createSend` stays as the friendly first line of defense.

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

### 1.4 PARTIALLY FIXED (was MEDIUM) — `operators_member_update` WITH CHECK added (migration 0023)

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
- **Status:** Part 1 done in migration 0023: `operators_member_update` now carries a
  `WITH CHECK` matching its `USING` clause. Part 2 (scoping `updateRecipientEmail`
  explicitly by operator) is a **code** change in `src/app/deliveries/[id]/actions.ts`, not
  applied here since it touches app code rather than schema; it remains on the "should fix
  soon" list. RLS already protects that path, so this is defense-in-depth, not an open hole.

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

### 4.1 RESOLVED (was HIGH) — Stripe keeps working; nothing was moved

- **Status:** Recalibrated after the ownership clarification. slater@flukesend.com was
  added to the existing Stripe account and the old account was not closed or transferred,
  so the baked-in live price IDs (`price_1Tnp6y...`), `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET` still point at the same live account. Checkout, webhook signature
  verification, and `stripe_customer_id` mapping all keep working. No action required for
  the product to run.
- **Residual (LOW):** The live price IDs are hard-coded as defaults in `src/lib/stripe.ts`.
  That is fine while billing stays on this account. Only relevant if you ever *do* move to a
  different Stripe account, at which point set the `STRIPE_PRICE_*` env overrides (already
  supported) and rotate the two Stripe secrets. Nothing to do now.
- **Note:** Confirm slater's Stripe access is actually functional (login works, correct role),
  since "added" can silently fail if the invite was never accepted.

### 4.2 RESOLVED (was MEDIUM) — GitHub/Vercel deploys keep working

- **Status:** The repo (`flukesend-hub/flukesend`) was not transferred to a different owner;
  slater was added as a collaborator/member and flukesend@gmail.com still owns it. The
  Vercel Git integration and any Actions secrets are unchanged, so `main` still auto-deploys.
  No action required.
- **Residual (LOW):** If you later transfer the repo or Vercel project ownership outright,
  reconnect the Vercel <-> GitHub integration and confirm a test push to `main` deploys.
  Not a now-item.

---

## 5. Secrets, webhooks, and Resend

### 5.1 MEDIUM (was CRITICAL) — flukesend@gmail.com now guards all-tenant PII; secret rotation is not a now-item

- **Recalibration:** The original CRITICAL assumed a handoff where a *former* owner kept
  leftover access. That is not the situation: flukesend@gmail.com deliberately still has
  full control, and no keys were rotated or revoked. There is no orphaned access and no
  active compromise, so **rotating secrets is not required before onboarding operator #2.**
- **What is still true:** Both flukesend@gmail.com and slater@flukesend.com now hold
  admin/owner access to the Supabase project, whose service role key **bypasses RLS on every
  table**. So each of those two accounts is, in effect, a master key to every operator's
  guest emails and galleries. That makes the security of the Gmail account itself (strong
  unique password + 2FA, and no shared inbox access) a single point of failure for all
  tenant PII. README also notes local dev runs against the **production** Supabase project,
  so the service role key has likely been on developer machines.
- **Fix (hygiene, not a blocker):**
  - Confirm flukesend@gmail.com and slater@flukesend.com both have 2FA on every dashboard
    (Supabase, Vercel, Resend, Stripe, GitHub, and the Gmail account itself).
  - Stand up a separate dev/staging Supabase project so local dev stops running against
    production PII. This is the highest-value item here because it stops copies of the prod
    service role key from spreading further.
  - Rotate the shared secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
    `RESEND_WEBHOOK_SECRET`, `CRON_SECRET`, Stripe secrets) **only if/when you actually
    offboard an account or suspect a key has leaked** — not as part of adding slater.

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

These are the real blockers. None of them are affected by the ownership change; they are
all about the isolation boundary itself.

1. **[DONE 2026-07-07] Live RLS confirmed on every table** (1.1): `relrowsecurity = t` on all
   15 tables verified; a membership-less authenticated user returned zero rows from
   `recipients`, `deliveries`, `captured_guests`, `photos`, and more; and a real operator saw
   only their own 10 recipients, not the 314 total. PASS. Remaining sub-item: run
   `get_advisors` (security) once from the dashboard as a final confirmation (needs an
   interactive approval this session could not grant).
2. **[DONE 2026-07-07] `photos` bucket confirmed private with no permissive storage policy**
   (1.1, 3): `photos.public = false`, `storage.objects` RLS enabled with zero policies. PASS.
3. **[TODO] Second-tenant smoke test in the app itself:** create Ocean Ecoventures as a real
   operator, then, signed in as each operator, confirm neither sees the other's sends,
   galleries, guest emails (Transfers drawer + `/api/export/recipients`), analytics, boats,
   crew, review links, or captured guests. Confirm one operator's gallery token cannot be
   made to render the other's photos. (The database layer is now proven; this confirms the
   app layer end-to-end through the actual UI and API routes.)

(Removed from the MUST list after the ownership clarification: secret rotation and the
Stripe/GitHub cutover items. Nothing was moved or revoked, so nothing there breaks or
leaks. See 4.1, 4.2, and 5.1.)

## Should fix soon

- **[DONE, migration 0023] 1.2** DB trigger enforcing `photos.storage_key` prefix = owning
  delivery's `operator_id`. Applied and verified live.
- **[PARTIAL, migration 0023] 1.4** `WITH CHECK` added to `operators_member_update` (done).
  Still open: scope `updateRecipientEmail` by operator explicitly in
  `src/app/deliveries/[id]/actions.ts` to match the codebase's defense-in-depth pattern
  (code change, low priority since RLS covers it).
- **[Advisor] Enable Leaked Password Protection** in Auth -> Policies -> Password security.
  Dashboard toggle, closes the one remaining advisor warning.
- **5.1** Stand up a dedicated dev/staging Supabase project so local development stops
  running against production PII, and confirm 2FA is on for both admin accounts (Gmail
  included) since each is a service-role master key to all tenant data.
- **5.4** Confirm the `slater@flukesend.com` auth account exists (or set `ADMIN_EMAILS`),
  and that slater's Stripe/Vercel/GitHub invites were actually accepted, not just sent.

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
