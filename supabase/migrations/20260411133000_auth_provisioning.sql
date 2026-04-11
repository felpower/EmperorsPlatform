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
