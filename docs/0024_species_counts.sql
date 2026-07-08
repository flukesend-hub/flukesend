-- Optional per-species head counts for a trip, keyed by the same species names
-- stored in deliveries.species. Additive and nullable: every existing reader of
-- species keeps working, and only the sightings recap reads counts. Shape is a
-- simple name to count map, e.g. { "Humpback whale": 3, "Common dolphin": 200 }.
alter table public.deliveries add column if not exists species_counts jsonb;
