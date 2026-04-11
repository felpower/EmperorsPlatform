create extension if not exists unaccent;

with imported_members(member_import_id, normalized_key, email, display_name, jersey_number, membership_status, notes) as (
  values
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a01', 'sample|playerone', 'demo_member_01', 'Sample PlayerOne', 12, 'active', 'Synthetic seed data'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a02', 'sample|playertwo', 'demo_member_02', 'Sample PlayerTwo', 81, 'active', 'Synthetic rookie profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a03', 'sample|coachone', 'demo_member_03', 'Sample CoachOne', null, 'active', 'Synthetic staff profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a04', 'sample|inactive', 'demo_member_04', 'Sample Inactive', 55, 'inactive', 'Synthetic inactive profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a05', 'sample|pending', 'demo_member_05', 'Sample Pending', 44, 'pending', 'Synthetic pending profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a06', 'sample|goalie', 'demo_member_06', 'Sample Goalie', 23, 'active', 'Synthetic player profile')
),
inserted_members as (
  insert into public.members (id, email, display_name, jersey_number, membership_status, notes)
  select
    member_import_id::uuid,
    email,
    display_name,
    jersey_number::integer,
    membership_status,
    notes
  from imported_members
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    jersey_number = excluded.jersey_number,
    membership_status = excluded.membership_status,
    notes = excluded.notes
  returning id
),
member_keys as (
  select
    id,
    lower(regexp_replace(unaccent(split_part(coalesce(display_name, ''), ' ', 1)), '[^a-z0-9]+', '', 'g')) || '|' ||
      lower(regexp_replace(unaccent(coalesce(nullif(split_part(coalesce(display_name, ''), ' ', 2), ''), split_part(coalesce(display_name, ''), ' ', 1))), '[^a-z0-9]+', '', 'g')) as normalized_key
  from public.members
  where id in (select id from inserted_members)
),
quarter_periods(season_label, fee_period) as (
  values
  ('2025', 'Q1_2025'),
  ('2025', 'Q2_2025'),
  ('2025', 'Q3_2025'),
  ('2025', 'Q4_2025'),
  ('2026', 'Q1_2026'),
  ('2026', 'Q2_2026')
),
imported_fees(fee_import_id, normalized_key, season_label, amount_cents, paid_cents) as (
  select
    gen_random_uuid() as fee_import_id,
    mk.normalized_key,
    qp.season_label,
    8250 as amount_cents,
    case
      when mk.normalized_key = 'sample|inactive' then 0
      when mk.normalized_key = 'sample|pending' and qp.fee_period in ('Q1_2026', 'Q2_2026') then 0
      when mk.normalized_key = 'sample|playertwo' and qp.fee_period = 'Q2_2026' then 4125
      else 8250
    end as paid_cents
  from member_keys mk
  cross join quarter_periods qp
)
insert into public.membership_fees (id, member_id, season_label, amount_cents, paid_cents)
select
  imported_fees.fee_import_id::uuid,
  mk.id,
  imported_fees.season_label,
  imported_fees.amount_cents::integer,
  imported_fees.paid_cents::integer
from imported_fees
join member_keys mk on mk.normalized_key = imported_fees.normalized_key;
