-- 0029: text tone for the Branding tab. One shared control (standard, darker,
-- darkest) that deepens the small gray text across the guest emails, for
-- operators who find the default gray too light. Nullable; null means the
-- standard grays, so untouched operators render exactly as before.
alter table branding add column if not exists text_tone text;
