-- M6: User-owned custom KPIs share canonical KPI table.

alter table public.kpis
  add column if not exists created_by uuid references public.users(id) on delete set null;

create index if not exists idx_kpis_created_by
  on public.kpis (created_by);

create unique index if not exists idx_kpis_custom_owner_slug_uq
  on public.kpis (created_by, slug)
  where created_by is not null;
