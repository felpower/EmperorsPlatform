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
  first_name text,
  last_name text,
  display_name text not null,
  email text not null,
  positions_json jsonb not null default '[]'::jsonb,
  roles_json jsonb not null default '["player"]'::jsonb,
  jersey_number integer,
  membership_status text not null default 'pending',
  notes text,
  deleted_at timestamptz,
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint members_membership_status_check
    check (membership_status in ('active', 'pending', 'inactive'))
);

create table if not exists public.player_passes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  pass_status text not null default 'valid'
    check (pass_status in ('valid', 'expiring', 'expired', 'missing', 'pending')),
  expires_on date,
  federation_reference text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_fees (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  fee_period text not null,
  season_label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  status text not null default 'pending'
    check (status in ('paid', 'partial', 'pending', 'not_collected', 'exempt', 'exit', 'not_applicable')),
  iban text,
  status_note text,
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
alter table public.player_passes enable row level security;
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

create policy "Members can read their own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "Admins can read all profiles"
on public.profiles
for select
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('finance_admin')
  or public.has_role('tech_admin')
);

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

create policy "Admins manage roles"
on public.member_roles
for all
using (public.has_role('admin'))
with check (public.has_role('admin'));

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

create policy "Admins manage roles"
on public.member_roles
for all
using (public.has_role('admin'))
with check (public.has_role('admin'));

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

create policy "Members can update own member record"
on public.members
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Members can update own member record"
on public.members
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Members can read member list"
on public.members
for select
using (auth.role() = 'authenticated');

create policy "Restricted roles read player passes"
on public.player_passes
for select
using (
  public.has_role('admin')
  or public.has_role('coach')
  or public.has_role('tech_admin')
);

create policy "Players can read own player pass"
on public.player_passes
for select
using (
  exists (
    select 1
    from public.members m
    where m.id = player_passes.member_id
      and m.profile_id = auth.uid()
  )
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

create policy "Finance admins read fees"
on public.membership_fees
for select
using (
  public.has_role('admin')
  or public.has_role('finance_admin')
);

create policy "Players can read own membership fees"
on public.membership_fees
for select
using (
  exists (
    select 1
    from public.members m
    where m.id = membership_fees.member_id
      and m.profile_id = auth.uid()
  )
);

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

create policy "Authenticated users read events"
on public.events
for select
using (auth.role() = 'authenticated');

create policy "Authenticated users read attendance"
on public.event_recipients
for select
using (auth.role() = 'authenticated');

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

create policy "Authenticated users read invites"
on public.invites
for select
using (auth.role() = 'authenticated');

create policy "Admins and coaches create invites"
on public.invites
for insert
with check (
  public.has_role('admin')
  or public.has_role('coach')
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  raw_roles jsonb;
begin
  profile_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))), '');
  if profile_name is null then
    profile_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, full_name, email)
  values (new.id, profile_name, new.email)
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email;

  update public.members
  set profile_id = new.id,
      email = coalesce(nullif(new.email, ''), email),
      display_name = coalesce(nullif(display_name, ''), profile_name)
  where lower(email) = lower(new.email)
    and profile_id is null;

  raw_roles := coalesce(new.raw_user_meta_data->'roles', '["player"]'::jsonb);
  if jsonb_typeof(raw_roles) <> 'array' then
    raw_roles := '["player"]'::jsonb;
  end if;

  insert into public.member_roles (profile_id, role_code)
  select new.id, role_code
  from jsonb_array_elements_text(raw_roles) as role_code
  where exists (
    select 1
    from public.roles r
    where r.code = role_code
  )
  on conflict do nothing;

  if not exists (
    select 1
    from public.member_roles
    where profile_id = new.id
  ) then
    insert into public.member_roles (profile_id, role_code)
    values (new.id, 'player')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
