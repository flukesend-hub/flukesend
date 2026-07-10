-- 0030: logo alignment for the Branding tab. Positions the logo (or the name
-- fallback) in the header band of both emails and the gallery hero. Nullable;
-- null means left, today's look, so untouched operators are unchanged.
alter table branding add column if not exists logo_align text;
