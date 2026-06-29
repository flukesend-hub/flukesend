-- ============================================================
-- Migration 0002. Storage bucket for operator logos.
--
-- One public bucket holds each operator's logo. Public so the logo URL
-- renders in the guest gallery and the review email with no signing step.
-- A logo is not sensitive, so public read is fine.
--
-- All writes happen server side with the service role (the onboarding and
-- settings actions), which bypasses storage RLS, so there are deliberately
-- no object level policies here. Files are namespaced by operator id, e.g.
-- branding/<operator_id>/<filename>, so one operator can never read or
-- clobber another's path through the app.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;
