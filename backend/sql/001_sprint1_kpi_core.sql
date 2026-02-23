-- Sprint 1 core schema for KPI logging and dashboard foundations.
-- Non-negotiables preserved:
-- 1) PC vs Actual are separated by dedicated delta columns.
-- 2) GP/VP contribute via points fields only.
-- 3) Confidence remains display-layer data (not persisted as base PC mutation here).
-- 4) Pipeline anchors are persisted in dedicated status table.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'agent',
  tier text not null default 'free',
  account_status text not null default 'active',
  average_price_point numeric(14,2) not null default 0,
  commission_rate numeric(8,6) not null default 0,
  last_activity_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_account_status_chk check (account_status in ('active', 'deactivated'))
);

create table if not exists public.kpis (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null,
  requires_direct_value_input boolean not null default false,
  pc_weight numeric(10,6),
  ttc_days integer,
  decay_days integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpis_type_chk check (type in ('PC', 'GP', 'VP', 'Actual', 'Pipeline_Anchor', 'Custom')),
  constraint kpis_pc_fields_chk check (
    (type = 'PC' and pc_weight is not null and ttc_days is not null and decay_days is not null)
    or (type <> 'PC')
  )
);

create table if not exists public.kpi_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kpi_id uuid not null references public.kpis(id),
  event_timestamp timestamptz not null,
  logged_value numeric(14,2),
  challenge_instance_id uuid,
  sponsored_challenge_id uuid,
  pc_generated numeric(14,2) not null default 0,
  ttc_end_date timestamptz,
  decay_end_date timestamptz,
  points_generated numeric(14,2) not null default 0,
  actual_gci_delta numeric(14,2) not null default 0,
  deals_closed_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_anchor_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kpi_id uuid not null references public.kpis(id),
  anchor_type text not null,
  anchor_value numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint pipeline_anchor_status_user_kpi_uq unique (user_id, kpi_id)
);

create index if not exists idx_kpi_logs_user_event_ts on public.kpi_logs (user_id, event_timestamp desc);
create index if not exists idx_kpi_logs_kpi_id on public.kpi_logs (kpi_id);
create index if not exists idx_pipeline_anchor_user on public.pipeline_anchor_status (user_id);

insert into public.kpis (name, type, requires_direct_value_input, pc_weight, ttc_days, decay_days)
values
  ('Listings Taken', 'PC', false, 0.35, 90, 30),
  ('Buyers Signed', 'PC', false, 0.25, 75, 30),
  ('Calls Made', 'GP', false, null, null, null),
  ('Open Houses', 'VP', false, null, null, null),
  ('Deal Closed', 'Actual', true, null, null, null),
  ('Listings Pending', 'Pipeline_Anchor', true, null, null, null),
  ('Buyers UC', 'Pipeline_Anchor', true, null, null, null),
  ('Custom KPI', 'Custom', true, null, null, null)
on conflict (name) do update
set
  type = excluded.type,
  requires_direct_value_input = excluded.requires_direct_value_input,
  pc_weight = excluded.pc_weight,
  ttc_days = excluded.ttc_days,
  decay_days = excluded.decay_days,
  updated_at = now();
