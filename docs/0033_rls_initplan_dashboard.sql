-- 0033: RLS init-plan optimization, no behavior change.
--
-- Every policy calls auth.uid() inside a membership subquery, which Postgres
-- re-evaluates per row. Wrapping it as (select auth.uid()) makes it an
-- InitPlan, evaluated once per query. The boolean result is identical (same
-- scalar value), so tenant isolation is unchanged; this is purely a scale
-- optimization. Done with ALTER POLICY so no policy is ever dropped, even
-- momentarily.
--
-- This file covers the 15 dashboard tables only. The two tables the live QR
-- capture flow touches (capture_links, captured_guests) plus the covering
-- indexes are deferred to 0034, applied after the day's QR signups wind down,
-- so nothing locks the capture path during a live capture day. (The capture
-- flow runs as the service role and bypasses RLS anyway; this split is belt
-- and suspenders.)

alter policy "boats_member_all" on public.boats
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "branding_member_all" on public.branding
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "crew_members_member_all" on public.crew_members
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "deliveries_member_all" on public.deliveries
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "events_member_all" on public.events
  using (recipient_id in (
    select r.id from recipients r
      join deliveries d on d.id = r.delivery_id
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))))
  with check (recipient_id in (
    select r.id from recipients r
      join deliveries d on d.id = r.delivery_id
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))));

alter policy "operator_invites_member_read" on public.operator_invites
  using (exists (
    select 1 from operator_members m
    where m.operator_id = operator_invites.operator_id and m.user_id = (select auth.uid())));

alter policy "members_self_select" on public.operator_members
  using (user_id = (select auth.uid()));

alter policy "operators_member_select" on public.operators
  using (id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "operators_member_update" on public.operators
  using (id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "photos_member_all" on public.photos
  using (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))))
  with check (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))));

alter policy "recipients_member_all" on public.recipients
  using (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))))
  with check (delivery_id in (
    select d.id from deliveries d
    where d.operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid()))));

alter policy "review_destinations_member_all" on public.review_destinations
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())))
  with check (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "sender_domains_member_select" on public.sender_domains
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "subscriptions_member_select" on public.subscriptions
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));

alter policy "usage_member_select" on public.usage
  using (operator_id in (select operator_members.operator_id from operator_members where operator_members.user_id = (select auth.uid())));
