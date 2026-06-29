-- ============================================================
-- Migration 0004. Boats and crew roster.
--
-- An operator pre-adds their boats and their people once, then picks a boat,
-- a captain, and the crew aboard on each send instead of typing them. Crew is
-- one flat roster: the same person can be picked as captain on one trip and
-- checked as crew on another. The chosen names are still denormalized onto the
-- delivery (captain_name, crew_names, and the new boat_name) so the gallery and
-- emails keep reading from the delivery row with no joins.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

create table boats (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on boats (operator_id, sort_order);

create table crew_members (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on crew_members (operator_id, sort_order);

alter table deliveries add column boat_name text;

alter table boats enable row level security;
alter table crew_members enable row level security;

create policy boats_member_all on boats
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

create policy crew_members_member_all on crew_members
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));
