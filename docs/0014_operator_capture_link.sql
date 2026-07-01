-- ============================================================
-- Migration 0014. One operator wide capture link.
--
-- The capture QR is now per operator, not per boat. A code taped to a specific
-- vessel breaks the moment that boat is sold or swapped the morning of a trip,
-- so instead there is a single standing link for the whole operation. The guest
-- still tells us which boat and trip time on the form, so nothing about grouping
-- a send changes; only the printed code stops being pinned to a hull.
--
-- Existing per boat links are removed (no codes are distributed yet) and the per
-- boat unique index is dropped in favor of one link per operator. boat_id stays
-- on the table, nullable, and is simply left null for these operator wide links.
-- No em dashes anywhere.
-- ============================================================

drop index if exists capture_links_boat_uniq;

delete from capture_links where boat_id is not null;

create unique index if not exists capture_links_operator_uniq
  on capture_links (operator_id);
