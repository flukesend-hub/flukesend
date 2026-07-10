-- 0028: branding look and voice, for the Branding tab.
-- All nullable overrides so an operator who touches nothing renders exactly
-- as today. brand_color stays the canonical header/primary color;
-- accent_color overrides buttons and links when set; header_text_color only
-- matters when there is no logo (the header falls back to the name in type);
-- font_key picks a curated font pack; copy_overrides holds per-surface copy
-- (field key to value, absent key means the template default).
alter table branding
  add column if not exists accent_color text,
  add column if not exists header_text_color text,
  add column if not exists font_key text,
  add column if not exists copy_overrides jsonb not null default '{}'::jsonb;
