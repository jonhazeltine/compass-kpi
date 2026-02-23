-- Sprint 12: Adaptive per-user PC weighting and calibration audit trail.

create table if not exists public.user_kpi_calibration (
  user_id uuid not null references public.users(id) on delete cascade,
  kpi_id uuid not null references public.kpis(id) on delete cascade,
  multiplier numeric(10,6) not null default 1.0,
  sample_size integer not null default 0,
  rolling_error_ratio numeric(10,6),
  rolling_abs_pct_error numeric(10,6),
  last_calibrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kpi_id),
  constraint user_kpi_calibration_multiplier_bounds_chk check (multiplier between 0.5 and 1.5),
  constraint user_kpi_calibration_sample_size_nonnegative_chk check (sample_size >= 0)
);

create index if not exists idx_user_kpi_calibration_user_id
  on public.user_kpi_calibration (user_id);

create table if not exists public.user_kpi_calibration_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actual_log_id uuid not null references public.kpi_logs(id) on delete cascade,
  close_timestamp timestamptz not null,
  actual_gci numeric(12,2) not null default 0,
  predicted_gci_window numeric(12,2) not null default 0,
  error_ratio numeric(10,6),
  attribution_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_kpi_calibration_events_user_id_created_at
  on public.user_kpi_calibration_events (user_id, created_at desc);

alter table public.kpi_logs
  add column if not exists pc_base_weight_applied numeric(10,6),
  add column if not exists pc_user_multiplier_applied numeric(10,6),
  add column if not exists pc_effective_weight_applied numeric(10,6);

update public.kpi_logs kl
set
  pc_base_weight_applied = coalesce(kl.pc_base_weight_applied, k.pc_weight, 0),
  pc_user_multiplier_applied = coalesce(kl.pc_user_multiplier_applied, 1.0),
  pc_effective_weight_applied = coalesce(kl.pc_effective_weight_applied, coalesce(k.pc_weight, 0))
from public.kpis k
where kl.kpi_id = k.id
  and k.type = 'PC'
  and (
    kl.pc_base_weight_applied is null
    or kl.pc_user_multiplier_applied is null
    or kl.pc_effective_weight_applied is null
  );
