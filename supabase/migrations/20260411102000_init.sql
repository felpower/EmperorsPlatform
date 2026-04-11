create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  code text primary key,
  label text not null
);

insert into public.roles (code, label)
values
  ('player', 'Player'),
  ('coach', 'Coach'),
  ('admin', 'Administrator'),
  ('finance_admin', 'Finance administrator'),
  ('tech_admin', 'Technical administrator')
on conflict (code) do nothing;

create table if not exists public.member_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.roles(code) on delete restrict,
  primary key (profile_id, role_code)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  email text not null,
  jersey_number integer,
  membership_status text not null default 'pending',
  player_pass_status text not null default 'valid',
  player_pass_expires_on date,
  notes text,
  created_at timestamptz not null default now(),
  constraint members_membership_status_check
    check (membership_status in ('active', 'pending', 'inactive')),
  constraint members_player_pass_status_check
    check (player_pass_status in ('valid', 'expiring', 'expired'))
);

create table if not exists public.membership_fees (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  season_label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null check (event_type in ('practice', 'game', 'meeting')),
  starts_at timestamptz not null,
  location text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_recipients (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  response text not null default 'pending'
    check (response in ('pending', 'confirmed', 'maybe', 'declined')),
  responded_at timestamptz,
  primary key (event_id, member_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0
);

alter table public.profiles enable row level security;
alter table public.member_roles enable row level security;
alter table public.members enable row level security;
alter table public.membership_fees enable row level security;
alter table public.events enable row level security;
alter table public.event_recipients enable row level security;
alter table public.invites enable row level security;

create or replace function public.has_role(check_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.member_roles mr
    where mr.profile_id = auth.uid()
      and mr.role_code = check_role
  );
$$;

drop policy if exists "Members can read their own profile" on public.profiles;
create policy "Members can read their own profile"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles
for select
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('finance_admin')
  or public.has_role('tech_admin')
);

drop policy if exists "Admins manage members" on public.members;
create policy "Admins manage members"
on public.members
for all
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('finance_admin')
  or public.has_role('tech_admin')
)
with check (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('finance_admin')
  or public.has_role('tech_admin')
);

drop policy if exists "Members can read member list" on public.members;
create policy "Members can read member list"
on public.members
for select
using (auth.role() = 'authenticated');

drop policy if exists "Finance admins manage fees" on public.membership_fees;
create policy "Finance admins manage fees"
on public.membership_fees
for all
using (
  public.has_role('admin')
  or public.has_role('finance_admin')
)
with check (
  public.has_role('admin')
  or public.has_role('finance_admin')
);

drop policy if exists "Authenticated users read fees" on public.membership_fees;
create policy "Authenticated users read fees"
on public.membership_fees
for select
using (auth.role() = 'authenticated');

drop policy if exists "Coaches and admins manage events" on public.events;
create policy "Coaches and admins manage events"
on public.events
for all
using (
  public.has_role('admin')
  or public.has_role('coach')
)
with check (
  public.has_role('admin')
  or public.has_role('coach')
);

drop policy if exists "Authenticated users read events" on public.events;
create policy "Authenticated users read events"
on public.events
for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users read attendance" on public.event_recipients;
create policy "Authenticated users read attendance"
on public.event_recipients
for select
using (auth.role() = 'authenticated');

drop policy if exists "Coaches and admins manage attendance" on public.event_recipients;
create policy "Coaches and admins manage attendance"
on public.event_recipients
for all
using (
  public.has_role('admin')
  or public.has_role('coach')
)
with check (
  public.has_role('admin')
  or public.has_role('coach')
);

drop policy if exists "Authenticated users read invites" on public.invites;
create policy "Authenticated users read invites"
on public.invites
for select
using (auth.role() = 'authenticated');

drop policy if exists "Admins and coaches create invites" on public.invites;
create policy "Admins and coaches create invites"
on public.invites
for insert
with check (
  public.has_role('admin')
  or public.has_role('coach')
);
