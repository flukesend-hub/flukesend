-- 0036: optional per-operator capture subdomain for white-labeled QR links.
--
-- A capture QR can point at {slug}.flukesend.com instead of www.flukesend.com,
-- so the URL a guest lands on reads as the operator (princess-whale-watching)
-- rather than Flukesend. The slug is set by us, not the operator, and is left
-- null for everyone by default, so QR generation falls back to the canonical
-- www origin and nothing changes until a slug is assigned. Unique so two
-- operators can never claim the same subdomain on the shared domain.
alter table operators add column if not exists capture_subdomain text;

create unique index if not exists operators_capture_subdomain_uniq
  on operators (capture_subdomain)
  where capture_subdomain is not null;
