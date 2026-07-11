-- 0032: guest-facing language for the Branding tab. The operator picks the one
-- language their guests read (English, French, or Spanish), chosen at
-- onboarding. Every guest-facing surface (emails first, then the gallery and
-- QR capture page) renders its structural strings and its default copy in this
-- language. Nullable-with-default 'en' means untouched operators are unchanged.
alter table branding add column if not exists guest_locale text not null default 'en';

alter table branding
  add constraint branding_guest_locale_check
  check (guest_locale in ('en', 'fr', 'es'));
