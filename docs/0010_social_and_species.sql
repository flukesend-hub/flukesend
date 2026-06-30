-- ============================================================
-- Migration 0010. Website and social links plus a per operator species list.
--
-- Branding gains six optional link columns (website, facebook, instagram,
-- tiktok, youtube, x) that render as icons in the footer of the delivery and
-- review emails. It also gains species_options, the operator's own species
-- list for the send form. Until an operator sets one, the send form falls back
-- to a built in catalog, so empty is fine.
--
-- All columns are nullable or defaulted, so existing operators keep working
-- with no backfill.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

alter table branding add column if not exists website_url   text;
alter table branding add column if not exists facebook_url   text;
alter table branding add column if not exists instagram_url  text;
alter table branding add column if not exists tiktok_url     text;
alter table branding add column if not exists youtube_url    text;
alter table branding add column if not exists x_url          text;

alter table branding
  add column if not exists species_options text[] not null default '{}';
