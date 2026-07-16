# Flukesend product state

Last updated: July 10, 2026.

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

- Send flow: a four step cascade (Trip details, Photos, Guests, Review), one card
  open at a time, each gating the next, a read only review before send. Trip step
  has a segmented boat picker, trip time pills, species with snug head count chips,
  crew grid. Photos: real drag and drop onto the dropzone plus click to browse; a
  stray drop outside the box is swallowed so it cannot navigate away and lose the
  send. Photos go straight to private storage; guest emails are pasted or preloaded
  from QR captures.
- Edit trip details: an operator can correct a misclicked species, boat, time, or
  crew on a send that already went out, from the delivery's Trip card. Operator side
  only (fixes the record and analytics), never re-emails guests. RLS scoped.
- Guest gallery: private tokened link, no account, camera roll save on phones, zip
  on desktop. Download fires the review ask instantly.
- QR capture: one QR per operator, posted on the boat. Guest picks boat and trip
  time, but the time picker shows only trips that have already departed (by the
  guest's own clock), so a 9 AM guest cannot mistakenly pick the noon trip; a quiet
  "show all times" link covers odd cases. A reconcile cron catches late sign-ups
  after the send already went out.
- Review engine: instant ask on download, cron as safety net, per destination click
  tracking.
- Tip jar (link only): a "Tip your photographer" button in the gallery's post-save
  slot, opening the photographer's own Venmo, Cash App, or PayPal.me link. Two flag
  gate (operator switch, owner only, plus the photographer's own link). An optional
  second switch also shows the review links as a quiet line under the tip. Flukesend
  never touches the money.
- Branding tab (new, July 2026): one place for look and voice, moved out of
  Settings. Brand identity (logo, brand color, optional separate accent for
  buttons, header text color, a five pack font picker, a three step text darkness
  dial) plus per surface editable wording for the delivery email, review email,
  and gallery post-save moment, each with a live preview (the emails render
  through the exact production builders in a scaled iframe; the gallery preview
  mirrors the real tip-or-review logic). Copy fields are curated with character
  limits and fill-in tokens ({operator_name}, {first_name}, {species}, {date},
  {photographer_name}, {crew}); validated on save, substituted then escaped at
  send time; every field restores to default. Send-test-to-myself mails the
  current draft. All overrides are nullable (branding.accent_color,
  header_text_color, font_key, text_tone, copy_overrides jsonb; migrations 0028
  and 0029), so an untouched operator renders exactly as before. Website and
  social links also live here now; Settings keeps retention and links to
  Branding.
- Social page: story card (photo of the day, species counts, brand, safe band so
  Instagram's header does not cover the logo), slideshow mp4 (client side encode, 15
  second cap, speed control), post mode (up to 10 photos for a carousel).
- Team: owner invites by email, invitee sees only a join screen, joins as crew.
  Invite email is white labeled as the operator.
- Analytics: full funnel, trend, per photographer, CSV. Everyone gets all of it. A
  bounced email shows as a chip that links straight to its send, where the guest
  sits at the top of the list (bounced float up, tinted red) with fix and resend.
- Expiry: whole local days, midnight Pacific, so all of a day's sends expire
  together; nightly cleanup at 2 AM Pacific removes storage, keeps history.
- White label sending domain: concierge only, set up through the admin page.
- Admin console: fleet KPIs, triage queue, per operator support tools, comping.

## Deferred, in rough priority order

1. Slideshow presets: a trip by trip recap (one branded frame per trip with that
   trip's own real counts), instead of hand picking photos. Founder explicitly said
   "I will add the presets later".
2. Social customization: layout templates, themes, maybe a short operator name
   for the story cards. The Branding tab now covers fonts, accent color, and
   wording for emails and the gallery, but every operator's story card still
   looks the same except logo and color.
3. Plan display name: "Standard" is a placeholder awaiting the founder's call.
4. Tip jar payments upgrade (Stripe Connect, money through the product): the
   link only tip jar is live; in-product payment is the someday version.
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
10. Anniversary re-send (raised by PacWhale in a meeting): a year after a trip,
    email the guest "on this day last year you saw Humpback whales with us, come
    back out", a rebooking nudge in the same DNA as the review ask. The catch is
    storage. Today the 2 AM cleanup deletes photos after 3 to 90 days on purpose
    to keep storage lean, so this needs photos held for a year, which is a
    different cost curve. Two shapes. Lean: keep just one hero shot (or a few web
    res thumbnails) per send for a year, pennies of storage, and the email is
    nostalgia plus rebook. Full: keep all originals and re-deliver the whole
    gallery, a real storage cost that belongs behind a paid add on, and the
    feature that finally justifies the R2 cold storage swap the storage_key
    abstraction already anticipates. Naturally a paid tier. Re-emailing a guest a
    year later is a wider consent scope than a one time delivery, so bake in a
    quiet opt out. The yearly cron matching trip dates and the email template are
    easy; the storage backend and cost are the real decision.

## Known rough edges

- The story card is tuned for landscape heroes. A very tall portrait hero could
  crowd the text block below it; no operator has hit it yet.
- docs/spec.md is the kickoff spec and has drifted; this file and the README are
  the current truth.
- Auth emails (password reset) still send through Supabase's default SMTP, not the
  branded Resend path.

## Operating notes

- Guest facing links: every link that reaches a guest or lands in an email (gallery
  links, review links, reminders, the printed QR, team invites) must be built on
  CANONICAL_ORIGIN (src/lib/base-url.ts, defaults to www.flukesend.com), never from
  the request's Host header. This is a hard rule with a scar behind it: on the Pro
  plan, crons run on a protected .vercel.app deployment URL, so links built from the
  request host greeted guests with a Vercel login wall. Only same session redirects
  (auth callback, password reset, Stripe return) may use the request host. If you add
  a new guest facing link, use CANONICAL_ORIGIN.
- Deploys: merge to main auto deploys to production on Vercel (Pro plan). Preview
  build on the working branch first, then merge. Cron schedules live in vercel.json.
  Vercel occasionally drops the merge webhook and no production deploy starts; if a
  merge does not produce a production build within a couple of minutes, push an empty
  commit to main to re-trigger.
- All three operators run on Pacific time. Cron times in UTC: cleanup 09:00 (2 AM
  PT), review sweeps 03:00 and 14:00 (8 PM and 7 AM PT), expiry reminders 16:00
  (9 AM PT), reconcile captures every 15 minutes.
- Stripe: only the $300 monthly and $3,000 yearly prices are wired. The old Inshore
  and Offshore prices still exist in Stripe but nothing references them.
- Supabase project ref: ockpylhphwhumgulhvzv. RLS by operator everywhere; the
  service role key never reaches the client.
