-- Team invites. An operator owner invites a teammate by email; the teammate
-- later joins under the same operator (shared branding, one bill) with their own
-- login. Invites are written server side with the service role (no client write
-- policy); members of the operator can read their own operator's invites.
create table if not exists public.operator_invites (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid
);
create index if not exists operator_invites_operator_idx on public.operator_invites(operator_id);
create index if not exists operator_invites_email_idx on public.operator_invites((lower(email)));

alter table public.operator_invites enable row level security;
drop policy if exists operator_invites_member_read on public.operator_invites;
create policy operator_invites_member_read on public.operator_invites
  for select using (
    exists (
      select 1 from public.operator_members m
      where m.operator_id = operator_invites.operator_id and m.user_id = auth.uid()
    )
  );
