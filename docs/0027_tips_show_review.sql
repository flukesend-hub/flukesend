-- Let an operator show the review ask underneath the tip, instead of the tip
-- replacing it. Off by default: tips stay the single primary ask unless the
-- owner opts in to also asking for a review (rendered as a quiet secondary link
-- below the tip button, never a second competing button).
alter table public.operators
  add column if not exists tips_show_review boolean not null default false;
