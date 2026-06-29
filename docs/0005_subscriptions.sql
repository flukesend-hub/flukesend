-- ============================================================
-- Migration 0005. Operator subscription state.
--
-- Tracks whether an operator is on the free trial or a paid plan, which tier,
-- and the billing cycle. The trial allows up to 3 transfers or 30 guest emails
-- (whichever comes first); usage is counted from the deliveries and recipients
-- tables, not stored here, so there is nothing to keep in sync.
--
-- No row means trial. Writes happen server side (a Stripe webhook will set
-- status to active later), so members can read their own subscription but not
-- change it. No em dashes anywhere.
-- ============================================================

create table subscriptions (
  operator_id uuid primary key references operators(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'active', 'canceled')),
  tier text check (tier in ('single', 'two', 'fleet')),
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy subscriptions_member_select on subscriptions
  for select
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()));
