-- M6: Challenge-first pricing tiers + entitlement policy (direct migration, dev-mode).

update public.users
set tier = 'team'
where lower(tier) = 'teams';

update public.users
set tier = 'basic'
where lower(tier) = 'pro';

alter table public.users
  drop constraint if exists users_tier_chk;

alter table public.users
  add constraint users_tier_chk
  check (tier in ('free', 'basic', 'pro', 'team', 'coach', 'enterprise'));

update public.sponsored_challenges
set required_tier = 'team'
where lower(required_tier) = 'teams';

alter table public.sponsored_challenges
  drop constraint if exists sponsored_challenges_required_tier_chk;

alter table public.sponsored_challenges
  drop constraint if exists sponsored_challenges_required_tier_check;

alter table public.sponsored_challenges
  add constraint sponsored_challenges_required_tier_chk
  check (required_tier in ('free', 'basic', 'pro', 'team', 'coach', 'enterprise'));

create table if not exists public.tier_entitlements (
  tier text not null,
  entitlement_key text not null,
  entitlement_value jsonb not null default 'true'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tier_entitlements_tier_chk check (tier in ('free', 'basic', 'pro', 'team', 'coach', 'enterprise')),
  constraint tier_entitlements_pk primary key (tier, entitlement_key)
);

-- Shared baseline (non-negotiables + product constraints)
insert into public.tier_entitlements (tier, entitlement_key, entitlement_value)
values
  ('free', 'kpi_cap_per_category', '8'::jsonb),
  ('basic', 'kpi_cap_per_category', '8'::jsonb),
  ('pro', 'kpi_cap_per_category', '8'::jsonb),
  ('team', 'kpi_cap_per_category', '8'::jsonb),
  ('coach', 'kpi_cap_per_category', '8'::jsonb),
  ('enterprise', 'kpi_cap_per_category', '8'::jsonb),
  ('free', 'active_challenge_participation_limit', '1'::jsonb),
  ('basic', 'active_challenge_participation_limit', '1'::jsonb),
  ('pro', 'active_challenge_participation_limit', '1'::jsonb),
  ('team', 'active_challenge_participation_limit', '1'::jsonb),
  ('coach', 'active_challenge_participation_limit', '1'::jsonb),
  ('enterprise', 'active_challenge_participation_limit', '1'::jsonb),
  ('free', 'can_join_challenges', 'true'::jsonb),
  ('basic', 'can_join_challenges', 'true'::jsonb),
  ('pro', 'can_join_challenges', 'true'::jsonb),
  ('team', 'can_join_challenges', 'true'::jsonb),
  ('coach', 'can_join_challenges', 'true'::jsonb),
  ('enterprise', 'can_join_challenges', 'true'::jsonb),
  ('free', 'can_start_challenges', 'true'::jsonb),
  ('basic', 'can_start_challenges', 'true'::jsonb),
  ('pro', 'can_start_challenges', 'true'::jsonb),
  ('team', 'can_start_challenges', 'true'::jsonb),
  ('coach', 'can_start_challenges', 'true'::jsonb),
  ('enterprise', 'can_start_challenges', 'true'::jsonb),
  ('free', 'challenge_invite_limit', '3'::jsonb),
  ('basic', 'challenge_invite_limit', '-1'::jsonb),
  ('pro', 'challenge_invite_limit', '-1'::jsonb),
  ('team', 'challenge_invite_limit', '-1'::jsonb),
  ('coach', 'challenge_invite_limit', '-1'::jsonb),
  ('enterprise', 'challenge_invite_limit', '-1'::jsonb),
  ('free', 'can_create_custom_kpis', 'false'::jsonb),
  ('basic', 'can_create_custom_kpis', 'true'::jsonb),
  ('pro', 'can_create_custom_kpis', 'true'::jsonb),
  ('team', 'can_create_custom_kpis', 'true'::jsonb),
  ('coach', 'can_create_custom_kpis', 'true'::jsonb),
  ('enterprise', 'can_create_custom_kpis', 'true'::jsonb),
  ('free', 'advanced_insights', 'false'::jsonb),
  ('basic', 'advanced_insights', 'true'::jsonb),
  ('pro', 'advanced_insights', 'true'::jsonb),
  ('team', 'advanced_insights', 'true'::jsonb),
  ('coach', 'advanced_insights', 'true'::jsonb),
  ('enterprise', 'advanced_insights', 'true'::jsonb),
  ('free', 'can_export', 'false'::jsonb),
  ('basic', 'can_export', 'true'::jsonb),
  ('pro', 'can_export', 'true'::jsonb),
  ('team', 'can_export', 'true'::jsonb),
  ('coach', 'can_export', 'true'::jsonb),
  ('enterprise', 'can_export', 'true'::jsonb),
  ('free', 'history_days', '30'::jsonb),
  ('basic', 'history_days', '365'::jsonb),
  ('pro', 'history_days', '365'::jsonb),
  ('team', 'history_days', '365'::jsonb),
  ('coach', 'history_days', '365'::jsonb),
  ('enterprise', 'history_days', '3650'::jsonb),
  ('free', 'can_host_team_challenges', 'false'::jsonb),
  ('basic', 'can_host_team_challenges', 'false'::jsonb),
  ('pro', 'can_host_team_challenges', 'false'::jsonb),
  ('team', 'can_host_team_challenges', 'true'::jsonb),
  ('coach', 'can_host_team_challenges', 'false'::jsonb),
  ('enterprise', 'can_host_team_challenges', 'true'::jsonb),
  ('free', 'team_private_cross_team_limit', '0'::jsonb),
  ('basic', 'team_private_cross_team_limit', '0'::jsonb),
  ('pro', 'team_private_cross_team_limit', '0'::jsonb),
  ('team', 'team_private_cross_team_limit', '1'::jsonb),
  ('coach', 'team_private_cross_team_limit', '0'::jsonb),
  ('enterprise', 'team_private_cross_team_limit', '-1'::jsonb),
  ('free', 'coach_private_challenge_unlimited', 'false'::jsonb),
  ('basic', 'coach_private_challenge_unlimited', 'false'::jsonb),
  ('pro', 'coach_private_challenge_unlimited', 'false'::jsonb),
  ('team', 'coach_private_challenge_unlimited', 'false'::jsonb),
  ('coach', 'coach_private_challenge_unlimited', 'true'::jsonb),
  ('enterprise', 'coach_private_challenge_unlimited', 'true'::jsonb)
on conflict (tier, entitlement_key)
do update set
  entitlement_value = excluded.entitlement_value,
  updated_at = now();
