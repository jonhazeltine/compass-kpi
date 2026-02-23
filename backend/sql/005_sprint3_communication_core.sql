-- Sprint 3 core schema: Communication baseline.

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  team_id uuid references public.teams(id) on delete set null,
  context_id uuid,
  created_by uuid not null references public.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channels_type_chk check (type in ('team', 'challenge', 'sponsor', 'cohort', 'direct'))
);

create table if not exists public.channel_memberships (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint channel_memberships_role_chk check (role in ('admin', 'member')),
  constraint channel_memberships_channel_user_uq unique (channel_id, user_id)
);

create table if not exists public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  message_type text not null default 'message',
  created_at timestamptz not null default now(),
  constraint channel_messages_type_chk check (message_type in ('message', 'broadcast'))
);

create table if not exists public.message_unreads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  unread_count integer not null default 0,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint message_unreads_non_negative_chk check (unread_count >= 0),
  constraint message_unreads_channel_user_uq unique (channel_id, user_id)
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text not null default 'expo',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_chk check (platform in ('expo', 'ios', 'android')),
  constraint push_tokens_user_token_uq unique (user_id, token)
);

create table if not exists public.broadcast_log (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  message_id uuid references public.channel_messages(id) on delete set null,
  message_body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_memberships_user on public.channel_memberships (user_id);
create index if not exists idx_channel_messages_channel_created on public.channel_messages (channel_id, created_at desc);
create index if not exists idx_message_unreads_user on public.message_unreads (user_id);
create index if not exists idx_broadcast_log_actor_created on public.broadcast_log (actor_user_id, created_at desc);
