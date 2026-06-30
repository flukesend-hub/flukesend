-- ============================================================
-- Migration 0009. Crew roles and trip credits.
--
-- Crew members gain role tags so the send form can offer one dropdown per role
-- (captain, crew, naturalist, photographer) drawn from the people tagged for it.
-- A person can hold several roles at once. Deliveries gain naturalist_name and
-- photographer_name, denormalized like captain_name so the gallery and emails
-- keep reading from the delivery row with no joins.
--
-- Whales seen is being retired from the product: species seen is enough. The
-- whale_count column stays in place (harmless and nullable) so old deliveries
-- keep their data, but nothing writes or shows it anymore.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

alter table crew_members
  add column roles text[] not null default '{}'
  check (roles <@ array['captain','crew','naturalist','photographer']::text[]);

-- Backfill existing people so current sends keep working: until an operator
-- refines them in Settings, everyone can be picked as captain or crew.
update crew_members set roles = '{captain,crew}' where roles = '{}';

alter table deliveries add column naturalist_name text;
alter table deliveries add column photographer_name text;
