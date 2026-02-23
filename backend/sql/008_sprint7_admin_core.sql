-- Sprint 7 core schema: admin activity audit baseline.

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id) on delete cascade,
  target_table text not null,
  target_id text not null,
  action text not null,
  change_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_admin_created
  on public.admin_activity_log (admin_user_id, created_at desc);
create index if not exists idx_admin_activity_target
  on public.admin_activity_log (target_table, target_id, created_at desc);
