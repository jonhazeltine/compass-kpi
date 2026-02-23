-- Sprint 15: remove legacy KPI alias `Listings Taken` and purge its logs.
-- Canonical KPI is `Listing Taken`.

with legacy as (
  select id
  from public.kpis
  where lower(name) = 'listings taken'
),
canonical as (
  select id
  from public.kpis
  where lower(name) = 'listing taken'
  order by created_at asc
  limit 1
),
remap_challenge_kpis as (
  update public.challenge_kpis ck
  set kpi_id = (select id from canonical)
  where ck.kpi_id in (select id from legacy)
    and exists (select 1 from canonical)
    and not exists (
      select 1
      from public.challenge_kpis ck2
      where ck2.challenge_id = ck.challenge_id
        and ck2.kpi_id = (select id from canonical)
    )
  returning ck.id
),
delete_duplicate_challenge_kpis as (
  delete from public.challenge_kpis ck
  where ck.kpi_id in (select id from legacy)
  returning ck.id
),
delete_logs as (
  delete from public.kpi_logs
  where kpi_id in (select id from legacy)
  returning id
),
delete_pipeline_status as (
  delete from public.pipeline_anchor_status
  where kpi_id in (select id from legacy)
  returning id
),
delete_calibration_rows as (
  delete from public.user_kpi_calibration
  where kpi_id in (select id from legacy)
  returning user_id
),
delete_legacy_kpi as (
  delete from public.kpis
  where id in (select id from legacy)
  returning id
)
select
  (select count(*) from delete_logs) as deleted_kpi_logs,
  (select count(*) from delete_calibration_rows) as deleted_calibration_rows,
  (select count(*) from remap_challenge_kpis) as remapped_challenge_rows,
  (select count(*) from delete_duplicate_challenge_kpis) as deleted_challenge_rows,
  (select count(*) from delete_legacy_kpi) as deleted_kpi_rows;
