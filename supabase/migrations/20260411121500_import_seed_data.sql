create extension if not exists unaccent;

with imported_members(member_import_id, normalized_key, email, first_name, last_name, display_name, position, jersey_number, active, rookie, in_clubee, membership_status, notes) as (
  values
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a01', 'sample|playerone', 'demo_member_01', 'Sample', 'PlayerOne', 'Sample PlayerOne', 'QB', 12, true, false, true, 'active', 'Synthetic seed data'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a02', 'sample|playertwo', 'demo_member_02', 'Sample', 'PlayerTwo', 'Sample PlayerTwo', 'WR', 81, true, true, true, 'active', 'Synthetic rookie profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a03', 'sample|coachone', 'demo_member_03', 'Sample', 'CoachOne', 'Sample CoachOne', null, null, true, false, false, 'active', 'Synthetic staff profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a04', 'sample|inactive', 'demo_member_04', 'Sample', 'Inactive', 'Sample Inactive', 'DL', 55, false, false, false, 'inactive', 'Synthetic inactive profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a05', 'sample|pending', 'demo_member_05', 'Sample', 'Pending', 'Sample Pending', 'LB', 44, true, true, false, 'pending', 'Synthetic pending profile'),
  ('2e5ea8ea-3e41-4b60-a664-0f878ec63a06', 'sample|goalie', 'demo_member_06', 'Sample', 'Goalie', 'Sample Goalie', 'DB', 23, true, false, true, 'active', 'Synthetic player profile')
),
inserted_members as (
  insert into public.members (id, email, first_name, last_name, display_name, position, jersey_number, active, rookie, in_clubee, membership_status, notes)
  select
    member_import_id::uuid,
    email,
    first_name,
    last_name,
    display_name,
    position,
    jersey_number::integer,
    active::boolean,
    rookie::boolean,
    in_clubee::boolean,
    membership_status,
    notes
  from imported_members
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    position = excluded.position,
    jersey_number = excluded.jersey_number,
    active = excluded.active,
    rookie = excluded.rookie,
    in_clubee = excluded.in_clubee,
    membership_status = excluded.membership_status,
    notes = excluded.notes
  returning id
),
member_keys as (
  select
    id,
    lower(regexp_replace(unaccent(coalesce(first_name, '')), '[^a-z0-9]+', '', 'g')) || '|' ||
      lower(regexp_replace(unaccent(coalesce(last_name, '')), '[^a-z0-9]+', '', 'g')) as normalized_key
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
imported_fees(fee_import_id, normalized_key, season_label, fee_period, amount_cents, paid_cents, status, iban, mandate_id, sepa_link, status_note) as (
  select
    gen_random_uuid() as fee_import_id,
    mk.normalized_key,
    qp.season_label,
    qp.fee_period,
    8250 as amount_cents,
    case
      when mk.normalized_key = 'sample|inactive' then 0
      when mk.normalized_key = 'sample|pending' and qp.fee_period in ('Q1_2026', 'Q2_2026') then 0
      when mk.normalized_key = 'sample|playertwo' and qp.fee_period = 'Q2_2026' then 4125
      else 8250
    end as paid_cents,
    case
      when mk.normalized_key = 'sample|inactive' then 'exit'
      when mk.normalized_key = 'sample|pending' and qp.fee_period in ('Q1_2026', 'Q2_2026') then 'pending'
      when mk.normalized_key = 'sample|playertwo' and qp.fee_period = 'Q2_2026' then 'partial'
      else 'paid'
    end as status,
    ('DEMO_IBAN_' || right(mk.id::text, 4)) as iban,
    null::text as mandate_id,
    null::text as sepa_link,
    null::text as status_note
  from member_keys mk
  cross join quarter_periods qp
)
insert into public.membership_fees (id, member_id, season_label, fee_period, amount_cents, paid_cents, status, iban, mandate_id, sepa_link, status_note)
select
  imported_fees.fee_import_id::uuid,
  mk.id,
  imported_fees.season_label,
  imported_fees.fee_period,
  imported_fees.amount_cents::integer,
  imported_fees.paid_cents::integer,
  imported_fees.status,
  imported_fees.iban,
  imported_fees.mandate_id,
  imported_fees.sepa_link,
  imported_fees.status_note
from imported_fees
join member_keys mk on mk.normalized_key = imported_fees.normalized_key;
