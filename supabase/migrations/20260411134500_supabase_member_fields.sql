alter table public.members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists positions_json jsonb not null default '[]'::jsonb,
  add column if not exists roles_json jsonb not null default '["player"]'::jsonb,
  add column if not exists deleted_at timestamptz;

alter table public.membership_fees
  add column if not exists fee_period text,
  add column if not exists status text,
  add column if not exists iban text,
  add column if not exists status_note text;

update public.membership_fees
set fee_period = coalesce(nullif(fee_period, ''), season_label)
where fee_period is null or fee_period = '';

update public.membership_fees
set status = case
  when coalesce(paid_cents, 0) >= coalesce(amount_cents, 0) and coalesce(amount_cents, 0) > 0 then 'paid'
  when coalesce(paid_cents, 0) > 0 then 'partial'
  else 'pending'
end
where status is null or status = '';

alter table public.membership_fees
  alter column fee_period set not null,
  alter column status set not null,
  alter column status set default 'pending';

drop policy if exists "Members can read own roles" on public.member_roles;
create policy "Members can read own roles"
on public.member_roles
for select
using (
  profile_id = auth.uid()
  or public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('finance_admin')
  or public.has_role('tech_admin')
);

drop policy if exists "Admins manage roles" on public.member_roles;
create policy "Admins manage roles"
on public.member_roles
for all
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "Members can update own member record" on public.members;
create policy "Members can update own member record"
on public.members
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
