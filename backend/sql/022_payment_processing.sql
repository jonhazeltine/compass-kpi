-- M6: Billing processing baseline (Stripe-hosted checkout + webhook sync).

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan_sku text,
  tier text not null default 'free'
    check (tier in ('free', 'basic', 'pro', 'team', 'coach', 'enterprise')),
  status text not null default 'inactive'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'inactive')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_subscriptions_user_active
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due', 'incomplete');

create index if not exists idx_subscriptions_stripe_customer
  on public.subscriptions (stripe_customer_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe'
    check (provider in ('stripe')),
  event_id text not null,
  event_type text not null,
  user_id uuid references public.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_events_provider_event_uq unique (provider, event_id)
);

create index if not exists idx_payment_events_type_created
  on public.payment_events (event_type, created_at desc);
