-- Operator trip times. An operator runs a handful of trips a day, so instead
-- of every 30 minute slot showing on the send form and the guest QR form, the
-- operator picks their actual departure times here. Empty array means not yet
-- configured, in which case the app falls back to the full slot list.
alter table branding add column if not exists trip_times text[] not null default '{}';
