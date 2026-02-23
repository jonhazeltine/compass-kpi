-- Sprint 1 follow-up: set non-zero default financial inputs for projection math.
-- Requested defaults:
-- - commission_rate: 2.5% (0.025)
-- - average_price_point: 300,000

alter table public.users
  alter column commission_rate set default 0.025,
  alter column average_price_point set default 300000;

update public.users
set
  commission_rate = 0.025,
  average_price_point = 300000,
  updated_at = now()
where
  commission_rate is null
  or average_price_point is null
  or commission_rate = 0
  or average_price_point = 0;
