-- Sprint 8 core schema: notification queue + dispatch audit baseline.

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_queue_status_chk check (status in ('queued', 'sent', 'failed'))
);

create index if not exists idx_notification_queue_status_schedule
  on public.notification_queue (status, scheduled_for);
create index if not exists idx_notification_queue_user_created
  on public.notification_queue (user_id, created_at desc);
