/*
  Stripe webhook. The source of truth for subscription status: when a checkout
  completes or a subscription changes, Stripe calls here and we update the
  operator's subscription row (status active/canceled, tier, cycle). Verified by
  signature; written with the service role since there is no user session.
*/
import type Stripe from "stripe";
import { stripe, tierFromPrice, type Tier, type Cycle } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function mapStatus(s: Stripe.Subscription.Status): "active" | "canceled" {
  // active and trialing keep them paid; ended/unpaid states cancel. Past due and
  // incomplete keep them active so Stripe's retries are not interrupted.
  if (s === "canceled" || s === "unpaid" || s === "incomplete_expired") {
    return "canceled";
  }
  return "active";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not set", { status: 503 });
  }
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  const admin = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription, operatorIdHint?: string | null) {
    const operatorId = sub.metadata?.operator_id ?? operatorIdHint ?? null;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const mapped = priceId ? tierFromPrice(priceId) : null;

    const row = {
      status: mapStatus(sub.status),
      tier: (mapped?.tier ?? null) as Tier | null,
      billing_cycle: (mapped?.cycle ?? null) as Cycle | null,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    };

    if (operatorId) {
      await admin
        .from("subscriptions")
        .upsert({ operator_id: operatorId, ...row }, { onConflict: "operator_id" });
    } else if (customerId) {
      await admin.from("subscriptions").update(row).eq("stripe_customer_id", customerId);
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub, session.metadata?.operator_id ?? null);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
