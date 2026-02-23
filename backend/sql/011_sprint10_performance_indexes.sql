-- Sprint 10 performance/index hardening.

create index if not exists idx_kpis_type_active
  on public.kpis (type, is_active);

create index if not exists idx_challenge_participants_sponsored
  on public.challenge_participants (sponsored_challenge_id)
  where sponsored_challenge_id is not null;

create index if not exists idx_challenge_templates_active
  on public.challenge_templates (is_active, created_at desc);

create index if not exists idx_notification_queue_status_attempts
  on public.notification_queue (status, attempts, scheduled_for);

create index if not exists idx_sponsored_challenges_tier_active
  on public.sponsored_challenges (required_tier, is_active, start_at, end_at);

create index if not exists idx_forecast_confidence_band_computed
  on public.forecast_confidence_snapshots (confidence_band, computed_at desc);
