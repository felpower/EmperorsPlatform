create table if not exists public.player_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  pass_status text not null default 'valid'
    check (pass_status in ('valid', 'expiring', 'expired')),
  expires_on date,
  federation_reference text,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.player_passes (member_id, pass_status, expires_on)
select
  m.id,
  coalesce(m.player_pass_status, 'valid'),
  m.player_pass_expires_on
from public.members m
where not exists (
  select 1
  from public.player_passes pp
  where pp.member_id = m.id
);

alter table public.player_passes enable row level security;

drop policy if exists "Authenticated users read fees" on public.membership_fees;

create policy "Finance admins read fees"
on public.membership_fees
for select
using (
  public.has_role('admin')
  or public.has_role('finance_admin')
);

create policy "Restricted roles read player passes"
on public.player_passes
for select
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('tech_admin')
);

create policy "Restricted roles manage player passes"
on public.player_passes
for all
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('tech_admin')
)
with check (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('tech_admin')
);
