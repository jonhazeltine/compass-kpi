-- Sprint 1: idempotency support for offline-safe KPI log ingestion.

alter table public.kpi_logs
  add column if not exists idempotency_key text;

create unique index if not exists ux_kpi_logs_user_idempotency_key
  on public.kpi_logs (user_id, idempotency_key)
  where idempotency_key is not null;
