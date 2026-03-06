-- M6: canonical KPI icon metadata for shared admin + app rendering.
-- Preserve legacy icon_file fallback while enabling richer icon-source choices.

alter table public.kpis
  add column if not exists icon_source text,
  add column if not exists icon_name text,
  add column if not exists icon_emoji text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kpis_icon_source_check'
  ) then
    alter table public.kpis
      add constraint kpis_icon_source_check
      check (icon_source is null or icon_source in ('brand_asset', 'vector_icon', 'emoji'));
  end if;
end $$;

update public.kpis
set icon_source = 'brand_asset',
    icon_name = icon_file,
    updated_at = now()
where icon_file is not null
  and btrim(icon_file) <> ''
  and (icon_source is null or btrim(icon_source) = '')
  and (icon_name is null or btrim(icon_name) = '');

create index if not exists kpis_icon_source_idx on public.kpis (icon_source);
