/*
  Stripe client and the plan catalog. Price IDs are not secret, so the test mode
  IDs are baked in as defaults and can be overridden by env vars for live mode
  (re-run the setup script in live mode and set the STRIPE_PRICE_* vars in
  Vercel). The secret key comes from the environment and is server only.
*/
import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export type Tier = "single" | "two" | "fleet";
export type Cycle = "monthly" | "yearly";

export const TIERS: { key: Tier; name: string; boats: string }[] = [
  { key: "single", name: "Single boat", boats: "1 boat" },
  { key: "two", name: "Two boats", boats: "Up to 2 boats" },
  { key: "fleet", name: "Fleet", boats: "Unlimited boats" },
];

export const PRICE_IDS: Record<Tier, Record<Cycle, string>> = {
  single: {
    monthly: process.env.STRIPE_PRICE_SINGLE_MONTHLY || "price_1TnncaINd7gF1a0tA5f2mORz",
    yearly: process.env.STRIPE_PRICE_SINGLE_YEARLY || "price_1TnncbINd7gF1a0t3YREBY3W",
  },
  two: {
    monthly: process.env.STRIPE_PRICE_TWO_MONTHLY || "price_1TnncbINd7gF1a0tbzdApofK",
    yearly: process.env.STRIPE_PRICE_TWO_YEARLY || "price_1TnncbINd7gF1a0txZCfzBLo",
  },
  fleet: {
    monthly: process.env.STRIPE_PRICE_FLEET_MONTHLY || "price_1TnnccINd7gF1a0tTRpnjbYJ",
    yearly: process.env.STRIPE_PRICE_FLEET_YEARLY || "price_1TnnccINd7gF1a0tqp54WQs0",
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
