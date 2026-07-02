-- Lock the billing-relevant branding.plan column. The branding row is member
-- writable (logo, color, retention), which left plan self-serviceable via
-- PostgREST: an operator could set plan='paid' with their own JWT and unlock
-- 90 day retention without paying. This trigger allows plan changes only from
-- the service role (the admin panel and Stripe webhook paths).
create or replace function public.protect_branding_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role','') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.plan is distinct from 'base' then
      raise exception 'plan is managed by the platform';
    end if;
  elsif new.plan is distinct from old.plan then
    raise exception 'plan is managed by the platform';
  end if;
  return new;
end $$;

drop trigger if exists branding_plan_guard on public.branding;
create trigger branding_plan_guard before insert or update on public.branding
  for each row execute function public.protect_branding_plan();
