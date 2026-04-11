alter table public.player_passes
  drop constraint if exists player_passes_pass_status_check;

alter table public.player_passes
  add constraint player_passes_pass_status_check
  check (pass_status in ('valid', 'expiring', 'expired', 'missing', 'pending'));
