-- Sprint 9 core schema: forecast confidence snapshots.

create table if not exists public.forecast_confidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recency_score numeric(5,2) not null,
  accuracy_score numeric(5,2) not null,
  anchor_score numeric(5,2) not null,
  inactivity_days integer not null default 0,
  confidence_score numeric(5,2) not null,
  confidence_band text not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint forecast_confidence_snapshots_band_chk check (confidence_band in ('green', 'yellow', 'red'))
);

create index if not exists idx_forecast_confidence_user_computed
  on public.forecast_confidence_snapshots (user_id, computed_at desc);
