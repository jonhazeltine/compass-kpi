-- Seed a few live challenge instances so mobile Challenge list/details/leaderboard
-- can be tested against real `public.challenges` rows (not templates only).
-- Idempotent by challenge name.

with creator as (
  select id
  from public.users
  order by created_at asc nulls last, id asc
  limit 1
),
seed_rows as (
  select *
  from (
    values
      (
        'Seed: 30 Day Listing Challenge',
        'Track listing-focused production actions this month.',
        'solo',
        true,
        '2026-02-01T00:00:00Z'::timestamptz,
        '2026-03-31T23:59:59Z'::timestamptz,
        false
      ),
      (
        'Seed: Conversation Sprint',
        'Momentum challenge for outreach and follow-up consistency.',
        'solo',
        true,
        '2026-03-15T00:00:00Z'::timestamptz,
        '2026-03-28T23:59:59Z'::timestamptz,
        false
      ),
      (
        'Seed: Team Open House Run',
        'Weekend event execution challenge with team leaderboard.',
        'team',
        true,
        '2026-01-01T00:00:00Z'::timestamptz,
        '2026-01-31T23:59:59Z'::timestamptz,
        true
      )
  ) as v(name, description, mode, is_active, start_at, end_at, late_join_includes_history)
),
inserted as (
  insert into public.challenges (
    name,
    description,
    mode,
    is_active,
    start_at,
    end_at,
    late_join_includes_history,
    created_by
  )
  select
    s.name,
    s.description,
    s.mode,
    s.is_active,
    s.start_at,
    s.end_at,
    s.late_join_includes_history,
    c.id
  from seed_rows s
  cross join creator c
  where not exists (
    select 1 from public.challenges ch where ch.name = s.name
  )
  returning id, name, created_by
),
seeded_challenges as (
  select ch.id, ch.name, ch.created_by
  from public.challenges ch
  where ch.name in (
    'Seed: 30 Day Listing Challenge',
    'Seed: Conversation Sprint',
    'Seed: Team Open House Run'
  )
),
seeded_kpis as (
  select id, slug
  from public.kpis
  where slug in (
    'listing_taken',
    'appointment_set_seller',
    'conversations_held',
    'sphere_call',
    'open_houses',
    'buyer_contract_signed'
  )
),
challenge_kpi_pairs as (
  select sc.id as challenge_id, sk.id as kpi_id
  from seeded_challenges sc
  join seeded_kpis sk
    on (
      (sc.name = 'Seed: 30 Day Listing Challenge' and sk.slug in ('listing_taken', 'appointment_set_seller', 'buyer_contract_signed'))
      or
      (sc.name = 'Seed: Conversation Sprint' and sk.slug in ('conversations_held', 'sphere_call'))
      or
      (sc.name = 'Seed: Team Open House Run' and sk.slug in ('open_houses', 'conversations_held', 'listing_taken'))
    )
)
insert into public.challenge_kpis (challenge_id, kpi_id)
select challenge_id, kpi_id
from challenge_kpi_pairs
on conflict (challenge_id, kpi_id) do nothing;

-- Seed creator participation for active + completed examples so at least one account
-- can immediately see joined-state behavior if testing with the seeded creator.
insert into public.challenge_participants (
  challenge_id,
  user_id,
  team_id,
  effective_start_at,
  progress_percent
)
select
  ch.id,
  ch.created_by,
  ch.team_id,
  ch.start_at,
  case
    when ch.name = 'Seed: 30 Day Listing Challenge' then 42
    when ch.name = 'Seed: Team Open House Run' then 100
    else 0
  end::numeric
from public.challenges ch
where ch.name in ('Seed: 30 Day Listing Challenge', 'Seed: Team Open House Run')
on conflict (challenge_id, user_id) do nothing;

