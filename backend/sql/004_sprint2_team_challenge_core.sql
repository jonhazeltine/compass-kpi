-- Sprint 2 core schema: Team + Challenge baseline.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint team_memberships_role_chk check (role in ('team_leader', 'member')),
  constraint team_memberships_team_user_uq unique (team_id, user_id)
);

create table if not exists public.challenge_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.challenge_templates(id),
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  description text,
  mode text not null default 'solo',
  is_active boolean not null default true,
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  late_join_includes_history boolean not null default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_mode_chk check (mode in ('solo', 'team'))
);

create table if not exists public.challenge_kpis (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  kpi_id uuid not null references public.kpis(id),
  created_at timestamptz not null default now(),
  constraint challenge_kpis_challenge_kpi_uq unique (challenge_id, kpi_id)
);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  joined_at timestamptz not null default now(),
  effective_start_at timestamptz not null default now(),
  progress_percent numeric(5,2) not null default 0,
  sponsored_challenge_id uuid,
  created_at timestamptz not null default now(),
  constraint challenge_participants_challenge_user_uq unique (challenge_id, user_id)
);

create index if not exists idx_team_memberships_user on public.team_memberships (user_id);
create index if not exists idx_challenges_team on public.challenges (team_id);
create index if not exists idx_challenge_participants_user on public.challenge_participants (user_id);
create index if not exists idx_challenge_kpis_challenge on public.challenge_kpis (challenge_id);
