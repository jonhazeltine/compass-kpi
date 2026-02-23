-- Sprint 16 (follow-up): add canonical v3 KPI catalog additions.
-- Sources:
--   docs/spec/appendix/KPI_MASTER_CATALOG_CANONICAL.md
--   docs/spec/appendix/kpi_master_catalog.json
--
-- Adds:
-- - PC: Biz Post
-- - GP: platform-specific social post KPIs

insert into public.kpis (
  name,
  slug,
  type,
  requires_direct_value_input,
  pc_weight,
  ttc_days,
  ttc_definition,
  delay_days,
  hold_days,
  decay_days,
  gp_value,
  vp_value,
  icon_file,
  is_active
)
values
  -- Canonical PC % values are stored as decimal fractions in DB (e.g. 0.02% => 0.0002).
  ('Biz Post', 'biz_post', 'PC', false, 0.0002, 180, '120-180 days', 120, 60, 180, null, null, 'pc_biz_post_v1.png', true),
  ('Instagram Post Shared', 'instagram_post_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_instagram_post_shared_v1.png', true),
  ('Facebook Post Shared', 'facebook_post_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_facebook_post_shared_v1.png', true),
  ('TikTok Post Shared', 'tiktok_post_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_tiktok_post_shared_v1.png', true),
  ('X Post Shared', 'x_post_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_x_post_shared_v1.png', true),
  ('LinkedIn Post Shared', 'linkedin_post_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_linkedin_post_shared_v1.png', true),
  ('YouTube Short Posted', 'youtube_short_posted', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_youtube_short_posted_v1.png', true)
on conflict (name) do update
set
  slug = excluded.slug,
  type = excluded.type,
  requires_direct_value_input = excluded.requires_direct_value_input,
  pc_weight = excluded.pc_weight,
  ttc_days = excluded.ttc_days,
  ttc_definition = excluded.ttc_definition,
  delay_days = excluded.delay_days,
  hold_days = excluded.hold_days,
  decay_days = excluded.decay_days,
  gp_value = excluded.gp_value,
  vp_value = excluded.vp_value,
  icon_file = excluded.icon_file,
  is_active = excluded.is_active,
  updated_at = now();

-- Reassert point-field/type integrity for newly added GP rows.
update public.kpis
set gp_value = coalesce(gp_value, 1),
    vp_value = null,
    updated_at = now()
where slug in (
  'instagram_post_shared',
  'facebook_post_shared',
  'tiktok_post_shared',
  'x_post_shared',
  'linkedin_post_shared',
  'youtube_short_posted'
);
