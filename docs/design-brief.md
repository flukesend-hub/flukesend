# Flukesend design brief

A handoff for the visual design pass. Pair this with `docs/mockup.html` (the
clickable visual reference) and `docs/spec.md` (the product source of truth).
The app is fully built and functional; this pass is purely about look and feel.
Keep the structure and behavior of each screen, restyle the surface.

No em dashes in any copy, anywhere. This is a hard product rule.

## What the product is

Branded photo delivery plus an automatic review and tip engine for whale watch
operators. Think WeTransfer, but the download itself triggers a branded review
ask. The operator (a small crew, often one person) gets home after a trip,
logs in, creates a send, drops in photos, pastes guest emails, and ships it.
Each guest gets a branded gallery link, downloads their photos, and a few hours
later gets an automatic branded review ask.

## The one design principle: two worlds

1. **The operator workspace is dark.** Deep water. This is the back of house
   where the crew works: login, setup, dashboard, settings, the send flow,
   confirmations. Calm, focused, a single warm accent.
2. **The guest surfaces are light and branded.** The gallery and the emails are
   front of house, warm and celebratory, and they are colored by the
   operator's own brand color, not ours. Same guest, their crew's identity.

The mockup shows this split. Honor it: operator screens dark, guest screens
light and driven by the operator's chosen color.

## Palette and type (current tokens in `src/app/globals.css`)

Operator workspace (fixed):
- Background deep water: `#0c1a21`
- Panels: `#11242d`, `#16313b`
- Hairlines: `rgba(255,255,255,0.08)` and `rgba(255,255,255,0.16)`
- Text: `#e8f0f1`, muted `#8ba4ac`, dimmer `#5f7882`
- Action accent (golden hour): `#e7b14c` on ink `#3a2c0a`
- Good `#4fb286`, bad `#e87b6b`
- Corner radius: 14px

Guest surfaces (light, brand driven):
- Paper background: `#faf8f4`, paper text `#1c2b2e`
- Brand color: per operator, default `#0b5563`. This drives the gallery header
  band, the email header, and the primary buttons on guest surfaces. Treat it
  as a variable, never hard code it on guest screens.

Type: Inter for body and UI, Fraunces (serif) for large titles. Both are
already loaded.

Note: the operator screens currently ship on a plain light stopgap theme so
they are readable. That is temporary. The design pass should bring back the
dark workspace above.

## Audiences and devices

- Operators work from a phone as often as a laptop (they type up emails at home
  after a trip). Design operator screens mobile first.
- Guests almost always open on a phone. The gallery and emails must look right
  on a small screen first.

## Screens

### Operator workspace (dark)

**Login and create account** `/login`
- Purpose: sign in, or create the operator account. Email and password.
- Elements: product name, one line of warmth, email field, password field, a
  primary action, and a toggle between log in and create account, plus inline
  error text.

**Operator setup** `/onboarding`
- Purpose: first run. A brand new user names their operation and sets the
  branding that flows everywhere.
- Elements: operation name, brand color picker, default guest message, retention
  days (3 to 10 on the base plan). One primary action to create.
- State: only shown to a user with no operator yet.

**Dashboard** `/dashboard`
- Purpose: the operator home. At a glance: who they are, their branding, and
  their recent sends, with a clear way to start a new one.
- Elements: header with logo and sign out, a branding summary card (logo,
  brand color swatch, retention, default message), and a recent sends list
  (date, whale count, guest count) with a prominent New send button.

**Settings** `/settings`
- Purpose: edit branding and manage review links after onboarding.
- Elements: a branding form (logo upload with preview, brand color, default
  message, retention) and a review links manager (a list of label plus URL
  rows that can be added and removed). These links become the buttons in the
  review email.

**New send** `/send`
- Purpose: the heart of the product. Turn a trip into a delivery.
- Elements, in order:
  - Trip details: date and time, whales seen, captain, species, crew, an
    optional custom message that overrides the default.
  - Photos: a file picker that uploads straight to storage with a per file
    progress state and a removable list of selected files.
  - Guest emails: a paste box that takes any format and shows live chips below,
    valid ones in green, invalid ones flagged, duplicates dropped, with a count
    of how many guests will be sent the gallery. This interaction is the
    signature moment, give it care.
  - One primary action whose label reflects progress (uploading, then creating).

**Send confirmation and detail** `/deliveries/[id]`
- Purpose: confirm a send went out and show its contents. Also reachable later.
- Elements: a success banner reporting how many guests were emailed, the trip
  summary, the photo list, and the guest list where each guest shows their
  personal gallery link. A button to create another send.

### Guest surfaces (light, brand driven)

**Guest gallery** `/g/[token]`
- Purpose: the branded place a guest views and downloads their photos. Reached
  only by a private link, no login.
- Elements: a header band in the operator's brand color with the logo and a
  warm trip line (for example "June 29, 2026 with Captain Margo. 7 whales,
  Humpback"), the operator's message, then a responsive photo grid where each
  photo has a download action. An expired state when the delivery has aged out.
- Feel: celebratory, generous imagery, the operator's color leading. This is
  the most brand facing screen in the product, make it shine.

**Emails** (HTML templates, not pages)
- Delivery email, subject "Your photos from {operator}": a brand colored header
  with the logo, a short warm note, the trip line, and a big View your photos
  button to the gallery.
- Review ask email, subject "How was your trip with {operator}?": same branded
  frame, a short ask, and one button per review link in the operator's color.
- Both must render well in real inboxes (inline styles, single column, safe for
  Apple Mail and Gmail). No review gating, and keep any future tip jar visually
  separate from the review buttons.

## What to preserve

- The two world split (dark operator, light brand driven guest).
- The email paste box with live valid and invalid chips.
- Mobile first for both audiences.
- The brand color as a per operator variable on every guest surface.
- No em dashes.
