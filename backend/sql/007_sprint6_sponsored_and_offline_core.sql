-- Sprint 6 core schema: sponsored challenges baseline.

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text,
  brand_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsored_challenges (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete set null,
  name text not null,
  description text,
  reward_text text,
  cta_label text,
  cta_url text,
  disclaimer text,
  required_tier text not null default 'free',
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsored_challenges_required_tier_chk check (required_tier in ('free', 'basic', 'teams', 'enterprise')),
  constraint sponsored_challenges_window_chk check (end_at > start_at)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'challenge_participants_sponsored_challenge_fk'
  ) then
    alter table public.challenge_participants
      add constraint challenge_participants_sponsored_challenge_fk
      foreign key (sponsored_challenge_id)
      references public.sponsored_challenges(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_sponsored_challenges_active_window
  on public.sponsored_challenges (is_active, start_at, end_at);
create index if not exists idx_sponsored_challenges_sponsor
  on public.sponsored_challenges (sponsor_id);
