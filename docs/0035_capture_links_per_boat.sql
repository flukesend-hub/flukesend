-- 0035: allow a QR sign-up link per boat, not just one per operator.
--
-- The per-boat sign-up codes need a capture_links row per boat. The old
-- capture_links_operator_uniq (unique on operator_id) capped it at one link per
-- operator. Replace it with two partial uniques: the operator-wide link (boat_id
-- null) stays singular, and each boat gets at most one link. No token is read or
-- written, so every QR code already printed keeps working exactly as before.
drop index if exists capture_links_operator_uniq;

create unique index if not exists capture_links_operator_wide_uniq
  on capture_links (operator_id)
  where boat_id is null;

create unique index if not exists capture_links_boat_uniq
  on capture_links (boat_id)
  where boat_id is not null;
