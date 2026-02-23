-- Sprint 4 core schema: Coaching + AI suggestion queue baseline.

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  team_id uuid references public.teams(id) on delete set null,
  created_by uuid not null references public.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  title text not null,
  body text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'not_started',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_status_chk check (status in ('not_started', 'in_progress', 'completed')),
  constraint lesson_progress_lesson_user_uq unique (lesson_id, user_id)
);

create table if not exists public.coach_broadcasts (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  scope_type text not null,
  scope_id uuid,
  message_body text not null,
  created_at timestamptz not null default now(),
  constraint coach_broadcasts_scope_type_chk check (scope_type in ('team', 'journey', 'global'))
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope text not null,
  proposed_message text not null,
  status text not null default 'pending',
  created_by uuid not null references public.users(id) on delete cascade,
  approved_by uuid references public.users(id) on delete set null,
  rejected_by uuid references public.users(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_suggestions_status_chk check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists idx_milestones_journey on public.milestones (journey_id, sort_order);
create index if not exists idx_lessons_milestone on public.lessons (milestone_id, sort_order);
create index if not exists idx_lesson_progress_user on public.lesson_progress (user_id);
create index if not exists idx_ai_suggestions_user_status on public.ai_suggestions (user_id, status);
create index if not exists idx_ai_suggestions_created_by on public.ai_suggestions (created_by, created_at desc);
