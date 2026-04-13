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
