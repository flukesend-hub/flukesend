-- 0034: the deferred half of the RLS init-plan optimization plus the covering
-- indexes. Held back from 0033 and applied after the day's QR signups wind
-- down, because these are the only statements that briefly lock a table on the
-- live capture path (capture_links is read to resolve a token, captured_guests
-- receives the QR insert). Same no-op wrap as 0033: (select auth.uid())
-- returns the same value, so nothing about behavior or isolation changes.

alter policy "capture_links_member_all" on public.capture_links
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "captured_guests_member_select" on public.captured_guests
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

-- Covering indexes for the three foreign keys the linter flagged.
create index if not exists capture_links_boat_id_idx on public.capture_links (boat_id);
create index if not exists captured_guests_boat_id_idx on public.captured_guests (boat_id);
create index if not exists deliveries_created_by_idx on public.deliveries (created_by);
