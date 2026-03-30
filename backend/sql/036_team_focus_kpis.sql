-- 036: Add focus_kpi_ids to teams table
-- Stores the team leader's selected focus KPI IDs as a JSON array of strings.
-- Members inherit these KPIs on their team dashboard.

alter table public.teams
  add column if not exists focus_kpi_ids jsonb not null default '[]'::jsonb;

comment on column public.teams.focus_kpi_ids is
  'JSON array of KPI ID strings selected by the team leader as focus KPIs for the team.';
