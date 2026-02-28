-- C2: Coach marketplace + engagement schema additions
-- Adds coach profile columns to users table and creates coaching_engagements table.

-- User profile compatibility columns expected by coach seeding/runtime views
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists avatar_url text;

-- Coach profile columns on users
alter table public.users add column if not exists is_coach boolean not null default false;
alter table public.users add column if not exists coach_specialties text[] default '{}';
alter table public.users add column if not exists coach_bio text default '';
alter table public.users add column if not exists coach_availability text not null default 'available'
  check (coach_availability in ('available', 'waitlist', 'unavailable'));

-- Coaching engagements table
create table if not exists public.coaching_engagements (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'ended')),
  entitlement_state text not null default 'allowed'
    check (entitlement_state in ('allowed', 'pending', 'blocked', 'fallback')),
  plan_tier_label text not null default 'Compass Coaching',
  status_reason text not null default '',
  next_step_cta text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coaching_engagements_client on public.coaching_engagements(client_id);
create index if not exists idx_coaching_engagements_coach on public.coaching_engagements(coach_id);
create unique index if not exists idx_coaching_engagements_client_open_unique
  on public.coaching_engagements(client_id)
  where status in ('pending', 'active');
create index if not exists idx_users_is_coach on public.users(is_coach) where is_coach = true;
