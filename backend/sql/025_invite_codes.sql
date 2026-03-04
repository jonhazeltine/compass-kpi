-- M6 avatar/invite flow: invite code issuance + redemption tracking.

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  invite_type text not null check (invite_type in ('team', 'coach', 'challenge')),
  target_id uuid not null,
  created_by uuid not null references public.users(id) on delete cascade,
  max_uses int not null default 25 check (max_uses > 0),
  uses_count int not null default 0 check (uses_count >= 0),
  expires_at timestamptz not null default (now() + interval '14 days'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invite_codes_type_target on public.invite_codes(invite_type, target_id);
create index if not exists idx_invite_codes_created_by on public.invite_codes(created_by);
create index if not exists idx_invite_codes_active_expires on public.invite_codes(is_active, expires_at);

create table if not exists public.invite_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes(id) on delete cascade,
  redeemed_by uuid not null references public.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint invite_code_redemptions_unique_redeemer unique (invite_code_id, redeemed_by)
);

create index if not exists idx_invite_code_redemptions_user on public.invite_code_redemptions(redeemed_by);
