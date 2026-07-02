-- Storage cleanup bookkeeping. cleaned_at marks a delivery whose photo
-- objects have been removed from storage after expiry; the nightly cleanup
-- cron targets expired deliveries where this is null. Photo rows stay so the
-- delivery page keeps its counts and filenames.
alter table deliveries add column if not exists cleaned_at timestamptz;
