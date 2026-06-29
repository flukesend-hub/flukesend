-- ============================================================
-- Afterglow (placeholder name) initial schema. Migration 0001.
-- Standalone photo delivery plus review engine for whale watch operators.
-- Fresh Supabase project, separate from Trip Logger. Multi tenant by operator.
--
-- Guest gallery access is server side via the recipient token using the
-- service role key, so the RLS below only needs to scope data to the
-- operator members who own it. No anon or public policies are defined,
-- on purpose. The nightly review job also runs server side with the
-- service role and so bypasses RLS too.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

create extension if not exists pgcrypto;

-- ----- operators: the tenant and account -----
create table operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----- operator_members: links auth users to an operator.
-- One row per (operator, user). v1 has a single owner per operator, but
-- modeling membership as a table now gives crew logins later for free.
create table operator_members (
  operator_id uuid not null references operators(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','crew')),
  created_at timestamptz not null default now(),
  primary key (operator_id, user_id)
);
create index on operator_members (user_id);

-- ----- branding: one row per operator, the one time setup -----
create table branding (
  operator_id uuid primary key references operators(id) on delete cascade,
  logo_url text,
  brand_color text not null default '#0b5563',
  default_message text not null default '',
  plan text not null default 'base' check (plan in ('base','paid')),
  retention_days int not null default 5,
  created_at timestamptz not null default now(),
  -- base plan allows 3 to 10 days. paid plan raises the ceiling to 90.
  -- longer retention is real storage cost on our side, so it lives behind plan.
  constraint retention_within_plan check (
    retention_days >= 3
    and retention_days <= (case when plan = 'paid' then 90 else 10 end)
  )
);

-- ----- review_destinations: one operator, many links -----
-- A table not two fixed columns, so an operator can have one link or four
-- with no code change. These become the buttons in the review email.
create table review_destinations (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on review_destinations (operator_id, sort_order);

-- ----- deliveries: the send, one row per trip -----
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  trip_datetime timestamptz,
  whale_count int,
  species text[] not null default '{}',
  captain_name text,
  crew_names text[] not null default '{}',
  custom_message text,            -- overrides branding.default_message when set
  expires_at timestamptz not null -- stamped by the app at insert from retention_days
);
create index on deliveries (operator_id, created_at desc);
create index on deliveries (expires_at); -- used by the cleanup job

-- ----- photos: belong to a delivery -----
create table photos (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  storage_key text not null,      -- abstracted so an R2 swap later is contained
  filename text,
  size bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on photos (delivery_id, sort_order);

-- ----- recipients: the individual guest, the important one -----
-- Many per delivery. Each guest is their own row with their own token and
-- their own review trigger. A family of five becomes five asks, not one.
create table recipients (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  email text not null,
  name text,
  token text not null unique default encode(gen_random_bytes(16),'hex'),
  review_email_status text not null default 'pending'
    check (review_email_status in ('pending','scheduled','sent')),
  created_at timestamptz not null default now()
);
create index on recipients (delivery_id);
create index on recipients (review_email_status);

-- ----- events: per recipient log. The downloaded event is the trigger. -----
create table events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references recipients(id) on delete cascade,
  type text not null check (type in ('opened','downloaded')),
  occurred_at timestamptz not null default now()
);
create index on events (recipient_id, type);

-- ============================================================
-- Row level security. Everything is scoped to the operator the signed in
-- user belongs to. Onboarding (creating an operator, its branding row, and
-- the first membership row) is done server side with the service role, so
-- there is deliberately no insert policy letting a fresh user create an
-- operator from the client.
-- ============================================================

alter table operators           enable row level security;
alter table operator_members    enable row level security;
alter table branding            enable row level security;
alter table review_destinations enable row level security;
alter table deliveries          enable row level security;
alter table photos              enable row level security;
alter table recipients          enable row level security;
alter table events              enable row level security;

-- operators: a member can see and update their own operator row
create policy operators_member_select on operators
  for select using (
    id in (select operator_id from operator_members where user_id = auth.uid())
  );
create policy operators_member_update on operators
  for update using (
    id in (select operator_id from operator_members where user_id = auth.uid())
  );

-- operator_members: a user sees only their own membership rows.
-- Scoped to auth.uid() directly to avoid policy recursion on this table.
create policy members_self_select on operator_members
  for select using (user_id = auth.uid());

-- branding: full access for members of the owning operator
create policy branding_member_all on branding
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

-- review_destinations: full access for members of the owning operator
create policy review_destinations_member_all on review_destinations
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

-- deliveries: full access for members of the owning operator
create policy deliveries_member_all on deliveries
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

-- photos: scoped through the parent delivery
create policy photos_member_all on photos
  for all
  using (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ))
  with check (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ));

-- recipients: scoped through the parent delivery
create policy recipients_member_all on recipients
  for all
  using (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ))
  with check (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ));

-- events: scoped through recipient then delivery
create policy events_member_all on events
  for all
  using (recipient_id in (
    select r.id from recipients r
    join deliveries d on d.id = r.delivery_id
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ))
  with check (recipient_id in (
    select r.id from recipients r
    join deliveries d on d.id = r.delivery_id
    where d.operator_id in (select operator_id from operator_members where user_id = auth.uid())
  ));
