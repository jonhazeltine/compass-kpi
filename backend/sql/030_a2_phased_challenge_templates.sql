-- A2 phased challenge template builder support.
-- Additive migration: default_challenge_name, duration_weeks, and phased
-- template payload validation structure.
-- Phases are stored inside template_payload JSONB as phases[] array.

-- Optional prefill for runtime challenge instance naming.
alter table public.challenge_templates
  add column if not exists default_challenge_name text;

-- Explicit duration in weeks (spec requirement).
alter table public.challenge_templates
  add column if not exists duration_weeks integer;

-- Constraint: duration_weeks must be positive when set.
alter table public.challenge_templates
  drop constraint if exists challenge_templates_duration_weeks_chk;

alter table public.challenge_templates
  add constraint challenge_templates_duration_weeks_chk
  check (duration_weeks is null or duration_weeks >= 1);

-- Backfill duration_weeks from suggested_duration_days for existing active templates.
update public.challenge_templates
set duration_weeks = greatest(1, ceil(suggested_duration_days / 7.0)::integer)
where duration_weeks is null
  and suggested_duration_days is not null
  and suggested_duration_days > 0;

-- Index for admin list queries with phase-aware ordering.
create index if not exists idx_challenge_templates_active_duration
  on public.challenge_templates (is_active, duration_weeks, created_at desc);
