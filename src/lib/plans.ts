/*
  Single source of truth for the plan catalog. Every limit and feature flag the
  product enforces lives here, keyed by the internal plan key. Stripe price IDs
  stay in stripe.ts; this file is the shape of what each plan is allowed to do.

  There is one paid plan now: a single flat price with everything on. The key
  stays "fleet" so existing subscription rows (all already on it) need no data
  migration; the customer facing name lives in displayName. If tiers ever return,
  add keys here and the rest of the app follows.

  The cap that matters is on recipients, meaning guest addresses on a send, one
  per guest. The customer facing word is "emails", but the unit here is
  recipients: even an unlimited monthly plan sends roughly twice that many raw
  emails (a delivery email now and a review ask later). A null limit means
  unlimited. Boats are unlimited.
*/

export type PlanKey = "fleet";
export type AnalyticsTier = "basic" | "full";

export type Plan = {
  key: PlanKey;
  displayName: string;
  // Max recipients on a single send.
  emailsPerSend: number;
  // Max recipients reached in a calendar month, or null for unlimited.
  emailsPerMonth: number | null;
  // Max boats, or null for unlimited. Unlimited on every plan today.
  boats: number | null;
  analytics: AnalyticsTier;
  video: boolean;
  // Send guest email from the operator's own domain (photos@theirs.com).
  whiteLabel: boolean;
  // Automatic expiring-soon nudge to guests who have not downloaded.
  expiryReminder: boolean;
  // The Story Builder: a branded "photo of the day" social card built from a
  // trip day, with the sightings across that day's trips and a hero of choice.
  storyBuilder: boolean;
};

export const PLANS: Record<PlanKey, Plan> = {
  fleet: {
    key: "fleet",
    displayName: "Standard",
    emailsPerSend: 100,
    emailsPerMonth: null,
    boats: null,
    analytics: "full",
    video: true,
    whiteLabel: true,
    expiryReminder: true,
    storyBuilder: true,
  },
};

// The order plans are shown in. One plan today.
export const PLAN_ORDER: PlanKey[] = ["fleet"];

export function planFor(key: PlanKey): Plan {
  return PLANS[key];
}
