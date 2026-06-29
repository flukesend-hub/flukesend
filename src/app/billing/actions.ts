/*
  Billing actions. Start a Stripe Checkout session for a plan, and open the
  Stripe customer portal to manage or cancel. Subscription rows are written with
  the service role (the webhook also writes them), since members cannot write
  the subscriptions table themselves.
*/
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, priceFor, type Tier, type Cycle } from "@/lib/stripe";

type ActionResult = { url: string } | { error: string };

async function resolveOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("operator_members")
    .select("operator_id, operators(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;
  const operator = membership.operators as unknown as { name: string } | null;
  return {
    email: user.email ?? "",
    operatorId: membership.operator_id as string,
    operatorName: operator?.name ?? "Operator",
  };
}

function baseUrl(hdrs: Headers) {
  return `${hdrs.get("x-forwarded-proto") ?? "https"}://${hdrs.get("host") ?? ""}`;
}

export async function createCheckoutSession(
  tier: Tier,
  cycle: Cycle,
): Promise<ActionResult> {
  const op = await resolveOperator();
  if (!op) return { error: "Please sign in again." };
  const price = priceFor(tier, cycle);
  if (!price) return { error: "That plan is not available." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("operator_id", op.operatorId)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: op.email,
      name: op.operatorName,
      metadata: { operator_id: op.operatorId },
    });
    customerId = customer.id;
    if (sub) {
      await admin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("operator_id", op.operatorId);
    } else {
      await admin
        .from("subscriptions")
        .insert({ operator_id: op.operatorId, status: "trial", stripe_customer_id: customerId });
    }
  }

  const url = baseUrl(await headers());
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${url}/billing?status=success`,
      cancel_url: `${url}/billing?status=canceled`,
      metadata: { operator_id: op.operatorId, tier, cycle },
      subscription_data: { metadata: { operator_id: op.operatorId, tier, cycle } },
    });
    if (!session.url) return { error: "Could not start checkout. Try again." };
    return { url: session.url };
  } catch {
    return { error: "Could not start checkout. Try again." };
  }
}

export async function createPortalSession(): Promise<ActionResult> {
  const op = await resolveOperator();
  if (!op) return { error: "Please sign in again." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("operator_id", op.operatorId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return { error: "No billing account yet. Pick a plan first." };
  }

  const url = baseUrl(await headers());
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${url}/billing`,
    });
    return { url: portal.url };
  } catch {
    return { error: "Could not open the billing portal. Try again." };
  }
}
