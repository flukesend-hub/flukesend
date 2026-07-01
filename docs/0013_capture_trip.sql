-- ============================================================
-- Migration 0013. Trip on a captured guest.
--
-- A capture is now tied to a specific trip, not just a boat: the guest picks
-- which departure they were on (a 30 minute slot, since whale watch boats leave
-- on the hour or half hour) and the day is stamped automatically. The operator
-- then picks the same boat and trip time on the send and exactly those guests
-- load.
--
-- Both columns are nullable so the rows captured before this migration keep
-- working; they simply will not match a trip filter until re-captured. No em
-- dashes anywhere.
-- ============================================================

alter table captured_guests add column if not exists trip_date date;
alter table captured_guests add column if not exists trip_time text; -- "HH:MM" 24 hour slot

-- The send side looks up un-consumed guests for a boat, day, and slot.
create index if not exists captured_guests_trip_idx
  on captured_guests (operator_id, boat_id, trip_date, trip_time, consumed_at);
