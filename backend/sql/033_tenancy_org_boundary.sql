-- Tenancy hardening: introduce org_id home ownership plus explicit cross-scope sharing.
-- Home-owned records become private to their org by default.
-- Cross-org access remains valid only through explicit membership / relationship tables.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null default 'personal',
  owner_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_org_type_chk
    check (org_type in ('personal', 'team', 'sponsor', 'brokerage', 'enterprise', 'recovery'))
);

alter table public.users add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.teams add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.channels add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.journeys add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.coaching_engagements add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.challenges add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.challenge_participants add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.sponsors add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.sponsored_challenges add column if not exists org_id uuid references public.organizations(id) on delete restrict;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute 'alter table public.coaching_media_assets add column if not exists org_id uuid references public.organizations(id) on delete restrict';
  end if;
end
$$;

create table if not exists public.broadcast_campaigns (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete restrict,
  content_type text not null,
  targets jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  total_recipients integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  live_session_id text,
  replay_published boolean not null default false,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broadcast_campaigns_content_type_chk
    check (content_type in ('message', 'video', 'live', 'task'))
);

create unique index if not exists idx_broadcast_campaigns_actor_idempotency
  on public.broadcast_campaigns (actor_user_id, idempotency_key);

create table if not exists public.broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.broadcast_campaigns(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete restrict,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  dm_channel_id uuid references public.channels(id) on delete set null,
  message_id uuid references public.channel_messages(id) on delete set null,
  status text not null,
  error_detail text,
  created_at timestamptz not null default now(),
  constraint broadcast_deliveries_status_chk
    check (status in ('delivered', 'dm_create_failed', 'message_insert_failed', 'skipped'))
);

create index if not exists idx_broadcast_campaigns_org on public.broadcast_campaigns (org_id, created_at desc);
create index if not exists idx_broadcast_deliveries_campaign on public.broadcast_deliveries (campaign_id);
create index if not exists idx_broadcast_deliveries_org on public.broadcast_deliveries (org_id, created_at desc);

do $$
declare
  team_row record;
  sponsor_row record;
  user_row record;
  home_org_id uuid;
  fallback_org_id uuid;
begin
  -- Team-owned orgs.
  for team_row in
    select id, name, created_by
    from public.teams
    where org_id is null
  loop
    insert into public.organizations (name, org_type, owner_user_id)
    values (coalesce(nullif(trim(team_row.name), ''), 'Team Workspace'), 'team', team_row.created_by)
    returning id into home_org_id;

    update public.teams
      set org_id = home_org_id
      where id = team_row.id;
  end loop;

  -- Sponsor-owned orgs.
  for sponsor_row in
    select id, name
    from public.sponsors
    where org_id is null
  loop
    insert into public.organizations (name, org_type)
    values (coalesce(nullif(trim(sponsor_row.name), ''), 'Sponsor Workspace'), 'sponsor')
    returning id into home_org_id;

    update public.sponsors
      set org_id = home_org_id
      where id = sponsor_row.id;
  end loop;

  -- Users inherit org from team they created first.
  update public.users u
    set org_id = team_org.org_id
    from (
      select distinct on (created_by) created_by, org_id
      from public.teams
      where created_by is not null and org_id is not null
      order by created_by, created_at asc
    ) as team_org
    where u.id = team_org.created_by
      and u.org_id is null;

  -- Users inherit org from the first team they belong to.
  update public.users u
    set org_id = member_org.org_id
    from (
      select distinct on (tm.user_id) tm.user_id, t.org_id
      from public.team_memberships tm
      join public.teams t on t.id = tm.team_id
      where t.org_id is not null
      order by tm.user_id, case when tm.role = 'team_leader' then 0 else 1 end, tm.created_at asc
    ) as member_org
    where u.id = member_org.user_id
      and u.org_id is null;

  -- Remaining users get personal orgs.
  for user_row in
    select id, full_name
    from public.users
    where org_id is null
  loop
    insert into public.organizations (name, org_type, owner_user_id)
    values (
      coalesce(nullif(trim(user_row.full_name), ''), concat('User ', left(user_row.id::text, 8), ' Workspace')),
      'personal',
      user_row.id
    )
    returning id into home_org_id;

    update public.users
      set org_id = home_org_id
      where id = user_row.id;
  end loop;

  -- Core home-owned tables.
  update public.channels c
    set org_id = coalesce(
      (select t.org_id from public.teams t where t.id = c.team_id),
      (select u.org_id from public.users u where u.id = c.created_by)
    )
    where c.org_id is null;

  update public.journeys j
    set org_id = coalesce(
      (select t.org_id from public.teams t where t.id = j.team_id),
      (select u.org_id from public.users u where u.id = j.created_by)
    )
    where j.org_id is null;

  update public.coaching_engagements ce
    set org_id = coach.org_id
    from public.users coach
    where coach.id = ce.coach_id
      and ce.org_id is null;

  update public.challenges c
    set org_id = coalesce(
      (select t.org_id from public.teams t where t.id = c.team_id),
      (select u.org_id from public.users u where u.id = c.created_by)
    )
    where c.org_id is null;

  update public.challenge_participants cp
    set org_id = coalesce(
      (select ch.org_id from public.challenges ch where ch.id = cp.challenge_id),
      (select sc.org_id from public.sponsored_challenges sc where sc.id = cp.sponsored_challenge_id),
      (select u.org_id from public.users u where u.id = cp.user_id)
    )
    where cp.org_id is null;

  update public.sponsored_challenges sc
    set org_id = s.org_id
    from public.sponsors s
    where s.id = sc.sponsor_id
      and sc.org_id is null;

  update public.broadcast_campaigns bc
    set org_id = u.org_id
    from public.users u
    where u.id = bc.actor_user_id
      and bc.org_id is null;

  update public.broadcast_deliveries bd
    set org_id = bc.org_id
    from public.broadcast_campaigns bc
    where bc.id = bd.campaign_id
      and bd.org_id is null;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute $sql$
      update public.coaching_media_assets a
        set org_id = coalesce(
          (select j.org_id from public.journeys j where j.id = a.journey_id),
          (select c.org_id from public.channels c where c.id = a.channel_id),
          (select u.org_id from public.users u where u.id = a.owner_user_id)
        )
        where a.org_id is null
    $sql$;
  end if;

  -- Final recovery org for any pre-existing orphaned rows.
  insert into public.organizations (name, org_type)
  values ('Compass Recovery Org', 'recovery')
  on conflict do nothing;

  select id into fallback_org_id
  from public.organizations
  where org_type = 'recovery'
  order by created_at asc
  limit 1;

  update public.channels set org_id = fallback_org_id where org_id is null;
  update public.journeys set org_id = fallback_org_id where org_id is null;
  update public.coaching_engagements set org_id = fallback_org_id where org_id is null;
  update public.challenges set org_id = fallback_org_id where org_id is null;
  update public.challenge_participants set org_id = fallback_org_id where org_id is null;
  update public.sponsored_challenges set org_id = fallback_org_id where org_id is null;
  update public.broadcast_campaigns set org_id = fallback_org_id where org_id is null;
  update public.broadcast_deliveries set org_id = fallback_org_id where org_id is null;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute format('update public.coaching_media_assets set org_id = %L where org_id is null', fallback_org_id::text);
  end if;
end
$$;

alter table public.users alter column org_id set not null;
alter table public.teams alter column org_id set not null;
alter table public.channels alter column org_id set not null;
alter table public.journeys alter column org_id set not null;
alter table public.coaching_engagements alter column org_id set not null;
alter table public.challenges alter column org_id set not null;
alter table public.challenge_participants alter column org_id set not null;
alter table public.sponsors alter column org_id set not null;
alter table public.sponsored_challenges alter column org_id set not null;
alter table public.broadcast_campaigns alter column org_id set not null;
alter table public.broadcast_deliveries alter column org_id set not null;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute 'alter table public.coaching_media_assets alter column org_id set not null';
  end if;
end
$$;

create index if not exists idx_users_org on public.users (org_id);
create index if not exists idx_teams_org on public.teams (org_id);
create index if not exists idx_channels_org on public.channels (org_id, created_at desc);
create index if not exists idx_journeys_org on public.journeys (org_id, created_at desc);
create index if not exists idx_coaching_engagements_org on public.coaching_engagements (org_id, created_at desc);
create index if not exists idx_challenges_org on public.challenges (org_id, created_at desc);
create index if not exists idx_challenge_participants_org on public.challenge_participants (org_id, user_id);
create index if not exists idx_sponsors_org on public.sponsors (org_id);
create index if not exists idx_sponsored_challenges_org on public.sponsored_challenges (org_id, created_at desc);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute 'create index if not exists idx_coaching_media_assets_org on public.coaching_media_assets (org_id, created_at desc)';
  end if;
end
$$;
