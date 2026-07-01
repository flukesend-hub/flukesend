-- ============================================================
-- Migration 0015. Review click event.
--
-- The review email's buttons now route through a tracking redirect so we can
-- record when a guest actually taps through to leave a review. That is a new
-- event type alongside 'opened' and 'downloaded'. We cannot see whether they
-- finish a review on Google or Tripadvisor, but we can at least see the click.
--
-- No em dashes anywhere.
-- ============================================================

alter table events drop constraint events_type_check;
alter table events add constraint events_type_check
  check (type in ('opened', 'downloaded', 'review_clicked'));
