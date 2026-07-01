/*
  Stripe client and the plan catalog. Price IDs are not secret, so the live mode
  IDs are baked in as defaults and can still be overridden by env vars (set the
  STRIPE_PRICE_* vars to point at a different environment, e.g. a sandbox). The
  secret key comes from the environment and is server only.
*/
import "server-only";
import Stripe from "stripe";
import { PLANS, PLAN_ORDER, type PlanKey } from "./plans";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

// A Stripe tier is just a plan key. plans.ts is the source of truth for what
// each tier is named and allowed to do; this file only maps tiers to prices.
export type Tier = PlanKey;
export type Cycle = "monthly" | "yearly";

// Display names come from the plan catalog. Boats are unlimited on every plan.
export const TIERS: { key: Tier; name: string; boats: string }[] = PLAN_ORDER.map(
  (key) => ({ key, name: PLANS[key].displayName, boats: "Unlimited boats" }),
);

export const PRICE_IDS: Record<Tier, Record<Cycle, string>> = {
  single: {
    monthly: process.env.STRIPE_PRICE_SINGLE_MONTHLY || "price_1Tnp6yIteijzuz6UAGQ0tYkx",
    yearly: process.env.STRIPE_PRICE_SINGLE_YEARLY || "price_1Tnp6yIteijzuz6U7WZnfwqU",
  },
  two: {
    monthly: process.env.STRIPE_PRICE_TWO_MONTHLY || "price_1Tnp6zIteijzuz6URdGGRDkt",
    yearly: process.env.STRIPE_PRICE_TWO_YEARLY || "price_1Tnp6zIteijzuz6UFrRDSSSK",
  },
  fleet: {
    monthly: process.env.STRIPE_PRICE_FLEET_MONTHLY || "price_1Tnp6zIteijzuz6UbqyiBuZ3",
    yearly: process.env.STRIPE_PRICE_FLEET_YEARLY || "price_1Tnp6zIteijzuz6UH3L8Y9za",
  },
};

// Display prices (cents). Yearly is two months free (monthly times ten).
export const DISPLAY: Record<Tier, { monthly: number; yearlyTotal: number; yearlyMonthly: number }> = {
  single: { monthly: 150, yearlyTotal: 1500, yearlyMonthly: 125 },
  two: { monthly: 250, yearlyTotal: 2500, yearlyMonthly: 208 },
  fleet: { monthly: 300, yearlyTotal: 3000, yearlyMonthly: 250 },
};

export function priceFor(tier: Tier, cycle: Cycle): string | null {
  const map = PRICE_IDS[tier];
  if (!map) return null;
  return map[cycle] ?? null;
}

// Map a Stripe price id back to our tier + cycle (used by the webhook).
export function tierFromPrice(priceId: string): { tier: Tier; cycle: Cycle } | null {
  for (const tier of Object.keys(PRICE_IDS) as Tier[]) {
    for (const cycle of ["monthly", "yearly"] as Cycle[]) {
      if (PRICE_IDS[tier][cycle] === priceId) return { tier, cycle };
    }
  }
  return null;
}
