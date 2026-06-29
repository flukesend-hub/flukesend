-- ============================================================
-- Migration 0003. Storage bucket for delivery photos.
--
-- Private, unlike the branding bucket. Guest photos are not public: the guest
-- gallery (Session 2) reads them server side using the recipient token with the
-- service role, so there is no public read here. Operators upload to their own
-- namespace through short lived signed upload URLs minted server side, and the
-- photos table keeps the storage_key so swapping to R2 later stays contained.
--
-- Files are namespaced photos/<operator_id>/<send_id>/<filename>. All access is
-- server side (service role), so there are deliberately no object level RLS
-- policies on this bucket.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  false,
  52428800, -- 50 MB per photo
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
