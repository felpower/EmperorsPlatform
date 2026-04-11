-- Repairs production role/profile links so RLS-protected datasets (fees/passes) are readable.
-- Safe to run multiple times.

-- 1) Ensure profiles exist for all auth users.
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ) as full_name,
  u.email
from auth.users u
where u.email is not null
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email;

-- 2) Link existing members to auth users by email when profile_id is missing.
update public.members m
set profile_id = p.id
from public.profiles p
where m.profile_id is null
  and lower(coalesce(m.email, '')) = lower(coalesce(p.email, ''));

-- 3) Backfill member_roles from auth metadata roles.
with auth_roles as (
  select
    u.id as profile_id,
    coalesce(
      case when jsonb_typeof(u.raw_app_meta_data->'roles') = 'array' then u.raw_app_meta_data->'roles' end,
      case when jsonb_typeof(u.raw_user_meta_data->'roles') = 'array' then u.raw_user_meta_data->'roles' end,
      '["player"]'::jsonb
    ) as roles_json
  from auth.users u
)
insert into public.member_roles (profile_id, role_code)
select ar.profile_id, role_code
from auth_roles ar
cross join lateral jsonb_array_elements_text(ar.roles_json) as role_code
where exists (
  select 1
  from public.roles r
  where r.code = role_code
)
on conflict do nothing;

-- 4) Backfill member_roles from members.roles_json for linked members.
insert into public.member_roles (profile_id, role_code)
select m.profile_id, role_code
from public.members m
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(m.roles_json) = 'array' then m.roles_json
    else '["player"]'::jsonb
  end
) as role_code
where m.profile_id is not null
  and exists (
    select 1
    from public.roles r
    where r.code = role_code
  )
on conflict do nothing;

-- 5) Guarantee each profile has at least one role.
insert into public.member_roles (profile_id, role_code)
select p.id, 'player'
from public.profiles p
where not exists (
  select 1
  from public.member_roles mr
  where mr.profile_id = p.id
)
on conflict do nothing;

-- 6) Ensure every member has a player pass row, using legacy member fields as fallback.
insert into public.player_passes (member_id, pass_status, expires_on, federation_reference)
select
  m.id,
  case
    when coalesce(m.player_pass_status, 'valid') in ('valid', 'expiring', 'expired') then m.player_pass_status
    else 'valid'
  end,
  m.player_pass_expires_on,
  null
from public.members m
where not exists (
  select 1
  from public.player_passes pp
  where pp.member_id = m.id
);
