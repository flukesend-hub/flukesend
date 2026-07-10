-- 0031: crew faces. Each employee on the roster can carry a photo and a
-- guest-visibility flag, and the review email can show the aboard crew's faces
-- behind a per-operator toggle (default off, so nothing changes until an
-- operator opts in). Photos live in the public branding bucket under
-- crew/{operator_id}/, the same public-URL setup as the logo, so email clients
-- can render them.
alter table crew_members
  add column if not exists photo_url text,
  add column if not exists show_to_guests boolean not null default true;

alter table branding
  add column if not exists review_show_crew boolean not null default false;
