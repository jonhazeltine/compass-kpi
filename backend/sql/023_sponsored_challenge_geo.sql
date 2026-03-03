-- M6: Sponsored challenge geo eligibility controls.

alter table public.sponsored_challenges
  add column if not exists geo_scope text not null default 'national';

alter table public.sponsored_challenges
  add column if not exists geo_target_values text[] not null default '{}';

alter table public.sponsored_challenges
  drop constraint if exists sponsored_challenges_geo_scope_chk;

alter table public.sponsored_challenges
  add constraint sponsored_challenges_geo_scope_chk
  check (geo_scope in ('city', 'state', 'multi_state', 'national'));

alter table public.users
  add column if not exists geo_city text;

alter table public.users
  add column if not exists geo_state text;

create index if not exists idx_sponsored_challenges_geo_scope
  on public.sponsored_challenges (geo_scope);

create index if not exists idx_users_geo_state
  on public.users (geo_state);
