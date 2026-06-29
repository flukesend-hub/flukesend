# Afterglow (placeholder name) — Product Spec & Build Handoff

A standalone web product: a branded photo-delivery tool for whale watch operators with an automatic review-and-tip engine baked in. Think WeTransfer, but built for one niche, where the download itself triggers a branded review ask with no Gmail script anywhere.

This doc is the source of truth for the project. The clickable frontend reference lives in `afterglow_mockup.html`.

---

## 1. What this is, and what it is not

**It is** a website. The photographer or crew member gets home, edits, logs in, creates a send, drops in photos, pastes guest emails, ships it. Guests open a branded gallery, download, and a few hours later get an automatic branded review ask. Nothing is instant, nothing happens on the boat.

**It is not** an app, and it is not part of Trip Logger. This is a completely separate product: its own repo, its own Supabase project, its own auth. It happens to touch similar data (a trip, some sightings) but its job is delivery plus reputation, full stop. Do not share code or database with Trip Logger.

**Why it beats WeTransfer:** WeTransfer is a dumb pipe. The real product was always the funnel: branded delivery, email capture, download event, triggered review ask. Owning the delivery layer turns the download into a clean database event we control, which deletes the entire Gmail-script workaround.

---

## 2. The one decision everything hangs on

**Recipients are individuals, not a throwaway address list.**

When the photographer pastes five guest emails into one send, that becomes five recipient rows tied to the same photo set, each with its own gallery token and its own review trigger. A family of five booked under one name becomes five review asks, not one. That single choice is the whole difference between a file-transfer tool and a review engine, and it costs nothing to get right on day one.

---

## 3. Data model

Separate Supabase project. Multi-tenant from the start (operator is the tenant). RLS by `operator_id`.

**operators** — the account/tenant
- `id`, `name`, `created_at`
- auth users map to an operator (single user per operator in v1, crew logins later for free if linked now)

**branding** — one-time setup, one row per operator
- `operator_id`, `logo_url`, `brand_color`, `default_message`
- `retention_days` (constrained 3 to 10 on base plan)
- `plan` flag that raises the retention ceiling above 10 on the paid tier
- tip settings get added here later

**review_destinations** — child of operator, one operator many links
- `operator_id`, `label` (e.g. "Leave us a Google review"), `url`, `sort_order`
- a table, not two fixed columns, so an operator can have one link or four without code changes

**deliveries** — the "send", one row per trip
- `operator_id`, `created_by`, `created_at`
- trip form: `trip_datetime`, `whale_count`, `species` (list, multiple per trip), `captain_name`, `crew_names`, optional `custom_message` (overrides default)
- `expires_at` = `created_at` + operator's `retention_days`, used by cleanup job

**photos** — belongs to a delivery
- `delivery_id`, `storage_key` (abstracted so R2 swap later is contained), `filename`, `size`, `sort_order`

**recipients** — the important one, the individual guest, many per delivery
- `delivery_id`, `email`, optional `name`, unique unguessable `token` (the guest's personal gallery link)
- `review_email_status` (pending / scheduled / sent) so nothing double-fires and no dedupe label is ever needed

**events** — per-recipient log
- `recipient_id`, `type` (opened / downloaded), `occurred_at`
- the download event is the trigger

---

## 4. The trigger flow (what replaces the Gmail script)

1. Guest opens their tokened gallery and clicks download.
2. The download button is our code, so the click streams the file AND writes a `downloaded` event row in the same moment.
3. A scheduled job (simple cron, evening cadence) finds recipients who downloaded, have status not yet sent, and are past the delay window.
4. It sends the branded review email using that operator's template, then flips status to sent.

No Gmail account, no notification scraping, no "princess-followup-sent" label. The database already knows exactly who downloaded and who has been emailed.

---

## 5. Product rules and details

- **Email paste box:** the naturalist pastes straight from their notes in any format. On send it splits on any whitespace or punctuation, trims, lowercases, drops duplicates, validates each address, and shows removable chips with bad ones flagged. No commas required. (Working in the mockup.)
- **Brand color set once flows everywhere:** the operator's chosen color drives the guest gallery header and the review email band. Logo and default message likewise.
- **Trip form is copy, not metadata:** captain, whale count, and species flow into the gallery hero and the email so the review ask reads warm ("your 9:00 AM trip with Captain Margo, 7 humpbacks") instead of robotic. Warm asks convert.
- **Retention tiering:** base plan 3 to 10 days, set by the operator. Longer than 10 is a paid add-on, because longer retention is real storage cost on our side. Each delivery stamps its own `expires_at`.
- **The email list is the operator's asset, not ours.** They own and can export every email. We are the processor; they are the sender of record. This is a feature we sell and what keeps us clean on CAN-SPAM.
- **No review gating.** Solicit every guest who downloads, not just the happy ones. Never tie the tip to leaving a review. Keep the tip jar visually and logically independent of the review buttons. (FTC review rules.)

---

## 6. Stack

- **Next.js on Vercel** — gives auth, the server route for uploads and sends, the token-based gallery page, and the review-email cron in one deployable unit.
- **Supabase** — fresh project, Auth, Postgres, RLS by `operator_id`.
- **Storage: Supabase Storage for v1**, not R2. At one-operator test volume egress is negligible, and it removes an external service. Abstract `storage_key` so swapping to Cloudflare R2 later (zero egress, the right call at scale) is a contained change, not a rewrite.
- **Email: Resend or Postmark** with proper SPF / DKIM / DMARC. This is the unglamorous part that decides whether review asks across many domains land in the inbox instead of spam. Do not cut corners here.
- **Tips (later): Stripe Connect Express.** Money flows to the operator's own Stripe, we take a small platform fee, we never touch their funds.

---

## 7. Build order

**Session 1 (the day-off plan):**
1. Mockup as visual reference (done: `afterglow_mockup.html`).
2. Fresh repo, fresh Supabase project, run the migration from section 3.
3. Auth + branding setup screen (log in, save logo, color, message, review links, retention).
4. The send flow: trip form, photo upload, and the email paste box writing real recipient rows with tokens. This is the heart, give it the most time.

End the session with one real working send rather than four half-finished screens.

**Session 2:**
- Guest gallery page (tokened, branded), the download event write, and the scheduled review email.

**Later, bolts on without touching the core:**
- Tip jar (Stripe Connect).
- FareHarbor webhook: auto-creates the trip skeleton and gives passenger count, which yields a capture-rate metric (emails captured / passengers aboard). Note: FareHarbor webhooks are not self-serve, you create the URL then their support enables it per account, and there are API fee terms in some markets.
- Capture-rate stats and source tagging (booking vs onboard) to prove onboard emails convert better.

---

## 8. Parked, on purpose

- FareHarbor integration (entire thing) is out of v1. Removes the hardest external dependency.
- Onboard / mobile capture is out. Email collection stays paper-and-pen on the boat, typed in at home.
- Anything instant. Everything is the get-home-and-edit flow.

---

## 9. Standing constraints

- No em dashes in any copy or code comments.
- Build and execute step by step, one step at a time.
- Operator is always a tenant. Enocean is just row one in the mockup seed data, nothing Enocean-specific leaks into other operators' workspaces.
- Name "Afterglow" is a placeholder, rename freely.
