-- ============================================================
-- Migration 0011. Monthly recipient usage.
--
-- One row per operator per calendar month. recipients_used is the number of
-- guest addresses reached in that period, one per guest on a send. It is the
-- customer facing "emails" number, even though Flukesend sends roughly twice
-- that many raw emails (a delivery email now and a review ask later). The
-- review ask is downstream and is never metered.
--
-- Reads: an operator can read their own usage rows. Writes happen only through
-- the admin client, via increment_recipients_used below, so there is no insert
-- or update policy. No em dashes anywhere, per the standing rule.
-- ============================================================

create table usage (
  operator_id uuid not null references operators(id) on delete cascade,
  period text not null,
  recipients_used int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (operator_id, period)
);

alter table usage enable row level security;

create policy usage_member_select on usage
  for select
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

-- Atomic add for the period counter. Security definer so it can write through
-- RLS, but it only ever touches the usage table and only bumps the count, so a
-- send flow cannot use it to reach another operator's data. Called from the
-- admin client in the create-send flow.
create function increment_recipients_used(
  p_operator_id uuid,
  p_period text,
  p_count int
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into usage (operator_id, period, recipients_used, updated_at)
  values (p_operator_id, p_period, p_count, now())
  on conflict (operator_id, period)
  do update set
    recipients_used = usage.recipients_used + excluded.recipients_used,
    updated_at = now();
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would let
-- any signed in (or even anon) caller bump another operator's counter through
-- the REST RPC endpoint. The admin client uses the service role and bypasses
-- these grants, so lock the function down to server code only.
revoke execute on function increment_recipients_used(uuid, text, int) from public, anon, authenticated;
