-- M6 challenge wizard + template metadata contract additions.
-- Additive migration: challenge kind, runtime template payload metadata,
-- and per-challenge KPI goal config.

alter table public.challenge_templates
  add column if not exists suggested_duration_days integer not null default 30;

alter table public.challenge_templates
  add column if not exists template_payload jsonb not null default '{}'::jsonb;

alter table public.challenge_templates
  drop constraint if exists challenge_templates_suggested_duration_days_chk;

alter table public.challenge_templates
  add constraint challenge_templates_suggested_duration_days_chk
  check (suggested_duration_days > 0);

alter table public.challenges
  add column if not exists challenge_kind text not null default 'mini';

update public.challenges
set challenge_kind = case
  when lower(coalesce(mode, '')) = 'team' then 'team'
  else 'mini'
end
where challenge_kind not in ('team', 'mini', 'sponsored')
   or challenge_kind is null;

alter table public.challenges
  drop constraint if exists challenges_challenge_kind_chk;

alter table public.challenges
  add constraint challenges_challenge_kind_chk
  check (challenge_kind in ('team', 'mini', 'sponsored'));

alter table public.challenge_kpis
  add column if not exists goal_target numeric(12,2);

alter table public.challenge_kpis
  add column if not exists goal_scope text not null default 'team';

alter table public.challenge_kpis
  add column if not exists display_order integer not null default 0;

update public.challenge_kpis
set goal_scope = case
  when lower(coalesce(goal_scope, '')) = 'individual' then 'individual'
  else 'team'
end;

alter table public.challenge_kpis
  drop constraint if exists challenge_kpis_goal_scope_chk;

alter table public.challenge_kpis
  add constraint challenge_kpis_goal_scope_chk
  check (goal_scope in ('team', 'individual'));

create index if not exists idx_challenge_kpis_challenge_display_order
  on public.challenge_kpis (challenge_id, display_order asc);
