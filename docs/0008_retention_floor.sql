-- Lower the retention floor so an operator can keep photos as little as 1 day.
-- The onboarding and settings controls now offer 1, 3, or 7 days instead of a
-- 3 to 10 slider. The paid ceiling (90) is unchanged.
alter table branding drop constraint retention_within_plan;
alter table branding add constraint retention_within_plan check (
  retention_days >= 1
  and retention_days <= (case when plan = 'paid' then 90 else 10 end)
);
