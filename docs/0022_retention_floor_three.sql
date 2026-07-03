-- Raise the retention floor from 1 to 3 days and default new operators to 7.
-- Real usage showed guests open galleries days later (they are tourists on
-- vacation, often not at a laptop until they get home), so a 1 or 2 day
-- gallery dies before a chunk of guests ever open it. Base ceiling stays 10,
-- paid stays 90.
alter table branding drop constraint retention_within_plan;
alter table branding add constraint retention_within_plan check (
  retention_days >= 3
  and retention_days <= (case when plan = 'paid' then 90 else 10 end)
);
alter table branding alter column retention_days set default 7;
