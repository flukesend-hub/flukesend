-- Photographer tip jar. Optional, link only: the guest gallery can show a "Tip
-- your photographer" button that opens the photographer's own payment link
-- (Venmo, Cash App, PayPal.me). Money goes straight from guest to photographer;
-- Flukesend never processes or holds it. Two flags gate the button: an operator
-- level switch (policy) and the photographer's own link. Either missing, no button.

-- Operator policy switch. Off by default; only the owner flips it (enforced in
-- the server action, since the existing operators update policy is any-member).
alter table public.operators
  add column if not exists tips_enabled boolean not null default false;

-- Per photographer (their login membership row): their display name for the
-- tip attribution, their chosen provider, and their normalized handle. All
-- nullable; blank until they set it. Writes go through a server action scoped
-- to the caller's own row (user_id = auth.uid()); reads on the gallery use the
-- service role, and a member reads their own row via members_self_select.
alter table public.operator_members
  add column if not exists display_name text,
  add column if not exists tip_provider text,
  add column if not exists tip_handle text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operator_members_tip_provider_check'
  ) then
    alter table public.operator_members
      add constraint operator_members_tip_provider_check
      check (tip_provider is null or tip_provider in ('venmo', 'cashapp', 'paypal'));
  end if;
end $$;

-- A tapped tip button is tracked like a review link tap, so operators can see
-- tip interest. We never see amounts (the payment happens off platform).
alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('opened', 'downloaded', 'review_clicked', 'tip_clicked'));
