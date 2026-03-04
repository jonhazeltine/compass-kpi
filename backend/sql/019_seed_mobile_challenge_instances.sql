-- Seed challenge instances for mobile challenge list/details/leaderboard with:
-- - team timeline capped to three rows (completed + active + upcoming)
-- - no team date overlap
-- - mini challenge examples for solo-compatible creation flow
-- Idempotent by challenge name.

with creator as (
  select id
  from public.users
  order by created_at asc nulls last, id asc
  limit 1
),
creator_team as (
  select tm.team_id
  from public.team_memberships tm
  join creator c on c.id = tm.user_id
  order by tm.created_at asc nulls last, tm.team_id asc
  limit 1
),
seed_rows as (
  select *
  from (
    values
      (
        'Seed: Mini Listing Sprint',
        'Mini challenge starter for listing-focused production actions.',
        'solo',
        false,
        true,
        '2026-02-15T00:00:00Z'::timestamptz,
        '2026-03-15T23:59:59Z'::timestamptz,
        false
      ),
      (
        'Seed: Mini Conversation Sprint',
        'Mini challenge for outreach and follow-up consistency.',
        'solo',
        false,
        true,
        '2026-03-20T00:00:00Z'::timestamptz,
        '2026-04-05T23:59:59Z'::timestamptz,
        false
      ),
      (
        'Seed: Team Momentum Completed',
        'Completed team challenge slot for timeline continuity.',
        'team',
        true,
        true,
        '2026-01-01T00:00:00Z'::timestamptz,
        '2026-01-31T23:59:59Z'::timestamptz,
        true
      ),
      (
        'Seed: Team Momentum Active',
        'Active team challenge slot for current operations.',
        'team',
        true,
        true,
        '2026-03-01T00:00:00Z'::timestamptz,
        '2026-03-20T23:59:59Z'::timestamptz,
        true
      ),
      (
        'Seed: Team Momentum Upcoming',
        'Upcoming team challenge slot with no overlap to active window.',
        'team',
        true,
        true,
        '2026-03-25T00:00:00Z'::timestamptz,
        '2026-04-12T23:59:59Z'::timestamptz,
        false
      )
  ) as v(name, description, mode, requires_team, is_active, start_at, end_at, late_join_includes_history)
),
inserted as (
  insert into public.challenges (
    name,
    description,
    mode,
    team_id,
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
    case when s.requires_team then ct.team_id else null end,
    s.is_active,
    s.start_at,
    s.end_at,
    s.late_join_includes_history,
    c.id
  from seed_rows s
  cross join creator c
  left join creator_team ct on true
  where not exists (
    select 1 from public.challenges ch where ch.name = s.name
  )
    and (s.requires_team = false or ct.team_id is not null)
  returning id, name, created_by
),
seeded_challenges as (
  select ch.id, ch.name, ch.created_by
  from public.challenges ch
  where ch.name in (
    'Seed: Mini Listing Sprint',
    'Seed: Mini Conversation Sprint',
    'Seed: Team Momentum Completed',
    'Seed: Team Momentum Active',
    'Seed: Team Momentum Upcoming'
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
      (sc.name = 'Seed: Mini Listing Sprint' and sk.slug in ('listing_taken', 'appointment_set_seller', 'buyer_contract_signed'))
      or
      (sc.name = 'Seed: Mini Conversation Sprint' and sk.slug in ('conversations_held', 'sphere_call'))
      or
      (sc.name = 'Seed: Team Momentum Completed' and sk.slug in ('open_houses', 'conversations_held', 'listing_taken'))
      or
      (sc.name = 'Seed: Team Momentum Active' and sk.slug in ('appointment_set_seller', 'listing_taken', 'conversations_held'))
      or
      (sc.name = 'Seed: Team Momentum Upcoming' and sk.slug in ('buyer_contract_signed', 'open_houses', 'sphere_call'))
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
    when ch.name = 'Seed: Mini Listing Sprint' then 42
    when ch.name = 'Seed: Team Momentum Completed' then 100
    when ch.name = 'Seed: Team Momentum Active' then 35
    else 0
  end::numeric
from public.challenges ch
where ch.name in ('Seed: Mini Listing Sprint', 'Seed: Team Momentum Completed', 'Seed: Team Momentum Active')
on conflict (challenge_id, user_id) do nothing;
