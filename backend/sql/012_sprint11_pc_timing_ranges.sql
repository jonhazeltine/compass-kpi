-- Sprint 11: explicit PC timing ranges for TTC parity (delay + hold + decay).
-- Adds canonical timing fields to KPI definitions and persists applied timing on KPI logs.

alter table public.kpis
  add column if not exists ttc_definition text,
  add column if not exists delay_days integer,
  add column if not exists hold_days integer;

update public.kpis
set ttc_definition = concat(ttc_days, ' days')
where type = 'PC'
  and ttc_days is not null
  and (ttc_definition is null or btrim(ttc_definition) = '');

update public.kpis
set delay_days = coalesce(delay_days, 0),
    hold_days = coalesce(hold_days, greatest(0, ttc_days - coalesce(delay_days, 0)))
where type = 'PC'
  and (delay_days is null or hold_days is null);

alter table public.kpis
  drop constraint if exists kpis_pc_timing_nonnegative_chk;

alter table public.kpis
  add constraint kpis_pc_timing_nonnegative_chk
  check (
    (delay_days is null or delay_days >= 0)
    and (hold_days is null or hold_days >= 0)
  );

alter table public.kpi_logs
  add column if not exists payoff_start_date timestamptz,
  add column if not exists delay_days_applied integer,
  add column if not exists hold_days_applied integer,
  add column if not exists decay_days_applied integer;

update public.kpi_logs
set payoff_start_date = coalesce(payoff_start_date, event_timestamp)
where payoff_start_date is null;

update public.kpi_logs
set delay_days_applied = coalesce(delay_days_applied, 0),
    hold_days_applied = coalesce(
      hold_days_applied,
      greatest(
        0,
        floor(extract(epoch from (coalesce(ttc_end_date, event_timestamp) - event_timestamp)) / 86400)::int
      )
    ),
    decay_days_applied = coalesce(
      decay_days_applied,
      greatest(
        1,
        floor(
          extract(
            epoch from (
              coalesce(decay_end_date, coalesce(ttc_end_date, event_timestamp) + interval '180 days')
              - coalesce(ttc_end_date, event_timestamp)
            )
          ) / 86400
        )::int
      )
    )
where delay_days_applied is null
   or hold_days_applied is null
   or decay_days_applied is null;

alter table public.kpi_logs
  drop constraint if exists kpi_logs_pc_timing_nonnegative_chk;

alter table public.kpi_logs
  add constraint kpi_logs_pc_timing_nonnegative_chk
  check (
    (delay_days_applied is null or delay_days_applied >= 0)
    and (hold_days_applied is null or hold_days_applied >= 0)
    and (decay_days_applied is null or decay_days_applied >= 1)
  );

