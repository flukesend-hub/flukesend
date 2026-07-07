-- ============================================================
-- Migration 0023. Isolation hardening after the pre-scale audit.
--
-- Three defense in depth changes, none of which alter behavior for a correct
-- client. See docs/security-audit-2026-07.md for the findings.
--
-- 1. Lock EXECUTE on the branding plan guard. It is a trigger function and was
--    never reachable through PostgREST (a trigger return type is not exposed as
--    an RPC), but the security advisor flags any SECURITY DEFINER function that
--    anon or authenticated can execute. Revoking matches what 0011 already did
--    for increment_recipients_used. The trigger still fires normally: trigger
--    execution does not check the caller's EXECUTE privilege.
--
-- 2. Add WITH CHECK to operators_member_update. The policy gated which rows a
--    member could update but did not re-validate the new row, unlike every
--    other for-all policy in the schema. This makes the write side explicit.
--
-- 3. Enforce photo storage_key ownership in the database. A photo row's
--    storage_key is namespaced <operator_id>/<send_id>/<file>; until now only
--    the app (createSend) checked that the key belongs to the operator. This
--    trigger makes cross tenant photo attachment impossible even if a future
--    insert path forgets the check. Verified against all 254 existing photos:
--    every one already conforms.
--
-- No em dashes anywhere, per the standing rule.
-- ============================================================

-- 1. Revoke execute on the plan guard trigger function.
revoke execute on function public.protect_branding_plan() from public, anon, authenticated;

-- 2. Re-validate the new row on operator updates (matches the select/using scope).
alter policy operators_member_update on public.operators
  with check (
    id in (select operator_id from operator_members where user_id = auth.uid())
  );

-- 3. Photo storage_key must live under the owning delivery's operator namespace.
create or replace function public.enforce_photo_storage_key_owner()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_operator uuid;
begin
  select operator_id into v_operator from deliveries where id = new.delivery_id;
  if v_operator is null then
    raise exception 'photo references unknown delivery %', new.delivery_id;
  end if;
  if split_part(new.storage_key, '/', 1) is distinct from v_operator::text then
    raise exception 'photo storage_key % is outside operator % namespace',
      new.storage_key, v_operator;
  end if;
  return new;
end $$;

-- Lock the new definer function down too, so it does not re-trip the advisor.
revoke execute on function public.enforce_photo_storage_key_owner() from public, anon, authenticated;

drop trigger if exists photos_storage_key_owner_guard on public.photos;
create trigger photos_storage_key_owner_guard
  before insert or update of storage_key, delivery_id on public.photos
  for each row execute function public.enforce_photo_storage_key_owner();
