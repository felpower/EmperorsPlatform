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
