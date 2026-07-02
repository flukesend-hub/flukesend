-- White label sending domain, one per operator (Fleet tier). The operator
-- verifies their own domain with Resend via DNS records and their delivery
-- and review emails switch from slug@flukesend.com to photos@theirdomain.
-- Writes happen only through server actions with the service role (they call
-- the Resend API); members may read their own row to see status.
create table if not exists sender_domains (
  operator_id uuid primary key references operators(id) on delete cascade,
  domain text not null,
  resend_domain_id text not null,
  status text not null default 'pending',
  records jsonb not null default '[]',
  from_local text not null default 'photos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sender_domains enable row level security;

create policy sender_domains_member_select on sender_domains
  for select using (
    operator_id in (select operator_id from operator_members where user_id = auth.uid())
  );
