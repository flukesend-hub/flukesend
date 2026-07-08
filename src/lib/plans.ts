/*
  Single source of truth for the plan catalog. Every limit and feature flag the
  product enforces lives here, keyed by the internal plan key. Stripe price IDs
  stay in stripe.ts; this file is the shape of what each plan is allowed to do.

  The cap that matters is on recipients, meaning guest addresses on a send, one
  per guest. The customer facing word is "emails", but the unit here is
  recipients: a monthly cap of 250 means 250 guests reached in a period, even
  though Flukesend sends roughly twice that many raw emails (a delivery email
  now and a review ask later). A null limit means unlimited. Boats are unlimited
  on every plan.
*/

export type PlanKey = "single" | "two" | "fleet";
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
  single: {
    key: "single",
    displayName: "Inshore",
    emailsPerSend: 25,
    emailsPerMonth: 250,
    boats: null,
    analytics: "basic",
    video: false,
    whiteLabel: false,
    expiryReminder: false,
    storyBuilder: false,
  },
  two: {
    key: "two",
    displayName: "Offshore",
    emailsPerSend: 50,
    emailsPerMonth: 500,
    boats: null,
    analytics: "full",
    video: false,
    whiteLabel: false,
    expiryReminder: true,
    storyBuilder: false,
  },
  fleet: {
    key: "fleet",
    displayName: "Fleet",
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

// Cheapest to most expensive, the order plans are shown in.
export const PLAN_ORDER: PlanKey[] = ["single", "two", "fleet"];

export function planFor(key: PlanKey): Plan {
  return PLANS[key];
}
