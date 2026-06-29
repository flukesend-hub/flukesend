-- ============================================================
-- Migration 0006. Stripe identifiers on the subscription.
--
-- Maps an operator to its Stripe customer and subscription so the webhook can
-- find the right row when Stripe sends an event. Written server side only
-- (checkout action and webhook), so no new RLS policy is needed. No em dashes.
-- ============================================================

alter table subscriptions add column stripe_customer_id text;
alter table subscriptions add column stripe_subscription_id text;
create index on subscriptions (stripe_customer_id);
