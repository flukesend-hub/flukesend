-- ============================================================
-- Migration 0012. QR self capture.
--
-- Guests aboard scan a per boat QR, type their email and optional name, and
-- land in a staging table. The operator pulls them into the next send for that
-- boat, so nobody pastes addresses by hand.
--
-- Two tables:
--
-- capture_links: one standing link per boat, shown as a QR. The token is the
-- public handle in /j/[token]. active lets an operator retire a link without
-- deleting the captured history. boat_id is nullable to leave room for an
-- operator wide link later, but today one is created per boat.
--
-- captured_guests: the staging inbox. A row per submission, tied to the boat.
-- consumed_at is stamped when the row is imported into a send, so the same
-- guest is never pulled twice. ip_hash is a salted hash of the submitter IP,
-- kept only to rate limit abuse, never the raw address.
--
-- Why a separate staging table rather than reusing recipients with a pending
-- status: recipients hang off a delivery and carry a gallery token, a review
-- status, and events. Bending them to hold guests with no delivery yet would
-- leak half formed rows into the gallery, trial, and usage queries that all
-- assume a recipient belongs to a send. A small staging table keeps the capture
-- inbox fully separate until the operator imports, and the import is the clean
-- place to meter and validate. The cost is one extra table and an explicit copy
-- step on import, which is where metering should happen anyway.
--
-- RLS: an operator manages their own capture_links and reads their own
-- captured_guests. Every guest facing write (the public /j submit) and the
-- import happen through the admin client, which bypasses RLS, so there is no
-- guest write policy. No em dashes anywhere.
-- ============================================================

create table capture_links (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  boat_id uuid references boats(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on capture_links (operator_id);
-- At most one link per boat.
create unique index capture_links_boat_uniq on capture_links (boat_id) where boat_id is not null;

create table captured_guests (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  boat_id uuid references boats(id) on delete set null,
  email text not null,
  name text,
  ip_hash text,
  captured_at timestamptz not null default now(),
  consumed_at timestamptz
);
-- Import looks up un-consumed guests for a boat; the rate limiter counts recent
-- rows per ip_hash.
create index on captured_guests (operator_id, boat_id, consumed_at);
create index on captured_guests (ip_hash, captured_at);

alter table capture_links enable row level security;
alter table captured_guests enable row level security;

create policy capture_links_member_all on capture_links
  for all
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()))
  with check (operator_id in (select operator_id from operator_members where user_id = auth.uid()));

create policy captured_guests_member_select on captured_guests
  for select
  using (operator_id in (select operator_id from operator_members where user_id = auth.uid()));
