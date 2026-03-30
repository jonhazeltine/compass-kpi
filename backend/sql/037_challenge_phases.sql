-- 037: Challenge phases — per-phase KPI assignment for phased challenges
--
-- When a challenge has phases, each phase gets its own row here.
-- challenge_kpis.phase_id links KPIs to the phase they're active in.
-- KPIs with phase_id = NULL are active for the entire challenge (non-phased).

create table if not exists public.challenge_phases (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  phase_order integer not null default 1,
  phase_name text not null default 'Phase',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint challenge_phases_order_unique unique (challenge_id, phase_order)
);

-- Add phase_id to challenge_kpis (nullable — NULL means whole-challenge scope)
alter table public.challenge_kpis
  add column if not exists phase_id uuid references public.challenge_phases(id) on delete set null;

comment on table public.challenge_phases is
  'Phases within a challenge. Each phase has a time window and its own set of KPIs.';
comment on column public.challenge_kpis.phase_id is
  'If set, this KPI is only active during this phase. NULL means active for the entire challenge.';
