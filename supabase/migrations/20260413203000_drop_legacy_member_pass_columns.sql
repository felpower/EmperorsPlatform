alter table if exists public.members
  drop constraint if exists members_player_pass_status_check;

alter table if exists public.members
  drop column if exists player_pass_status,
  drop column if exists player_pass_expires_on;
