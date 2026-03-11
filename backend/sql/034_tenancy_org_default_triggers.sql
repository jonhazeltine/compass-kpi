create or replace function public.compass_ensure_user_org(p_user_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_org_id uuid;
  v_full_name text;
begin
  select org_id, full_name
    into v_org_id, v_full_name
  from public.users
  where id = p_user_id;

  if v_org_id is not null then
    return v_org_id;
  end if;

  insert into public.organizations (name, org_type, owner_user_id)
  values (
    coalesce(nullif(trim(v_full_name), ''), concat('User ', left(p_user_id::text, 8), ' Workspace')),
    'personal',
    p_user_id
  )
  returning id into v_org_id;

  update public.users
    set org_id = v_org_id
    where id = p_user_id
      and org_id is null;

  return v_org_id;
end
$$;

create or replace function public.compass_ensure_sponsor_org(p_sponsor_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_org_id uuid;
  v_name text;
begin
  select org_id, name
    into v_org_id, v_name
  from public.sponsors
  where id = p_sponsor_id;

  if v_org_id is not null then
    return v_org_id;
  end if;

  insert into public.organizations (name, org_type)
  values (
    coalesce(nullif(trim(v_name), ''), concat('Sponsor ', left(p_sponsor_id::text, 8))),
    'sponsor'
  )
  returning id into v_org_id;

  update public.sponsors
    set org_id = v_org_id
    where id = p_sponsor_id
      and org_id is null;

  return v_org_id;
end
$$;

create or replace function public.compass_before_user_assign_org()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.org_id is null then
    v_name := coalesce(nullif(trim(new.full_name), ''), concat('User ', left(new.id::text, 8), ' Workspace'));
    insert into public.organizations (name, org_type, owner_user_id)
    values (v_name, 'personal', null)
    returning id into new.org_id;
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_users_assign_org on public.users;
create trigger trg_compass_users_assign_org
before insert on public.users
for each row
when (new.org_id is null)
execute function public.compass_before_user_assign_org();

create or replace function public.compass_after_user_bind_org_owner()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is not null then
    update public.organizations
      set owner_user_id = new.id
      where id = new.org_id
        and owner_user_id is null
        and org_type = 'personal';
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_users_bind_org_owner on public.users;
create trigger trg_compass_users_bind_org_owner
after insert or update of org_id on public.users
for each row
execute function public.compass_after_user_bind_org_owner();

create or replace function public.compass_before_team_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.created_by is not null then
    new.org_id := public.compass_ensure_user_org(new.created_by);
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_teams_assign_org on public.teams;
create trigger trg_compass_teams_assign_org
before insert or update of org_id, created_by on public.teams
for each row
when (new.org_id is null)
execute function public.compass_before_team_assign_org();

create or replace function public.compass_before_channel_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    new.org_id := coalesce(
      (select t.org_id from public.teams t where t.id = new.team_id),
      case when new.created_by is not null then public.compass_ensure_user_org(new.created_by) else null end
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_channels_assign_org on public.channels;
create trigger trg_compass_channels_assign_org
before insert or update of org_id, team_id, created_by on public.channels
for each row
when (new.org_id is null)
execute function public.compass_before_channel_assign_org();

create or replace function public.compass_before_journey_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    new.org_id := coalesce(
      (select t.org_id from public.teams t where t.id = new.team_id),
      case when new.created_by is not null then public.compass_ensure_user_org(new.created_by) else null end
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_journeys_assign_org on public.journeys;
create trigger trg_compass_journeys_assign_org
before insert or update of org_id, team_id, created_by on public.journeys
for each row
when (new.org_id is null)
execute function public.compass_before_journey_assign_org();

create or replace function public.compass_before_engagement_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.coach_id is not null then
    new.org_id := public.compass_ensure_user_org(new.coach_id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_engagements_assign_org on public.coaching_engagements;
create trigger trg_compass_engagements_assign_org
before insert or update of org_id, coach_id on public.coaching_engagements
for each row
when (new.org_id is null)
execute function public.compass_before_engagement_assign_org();

create or replace function public.compass_before_challenge_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    new.org_id := coalesce(
      (select t.org_id from public.teams t where t.id = new.team_id),
      case when new.created_by is not null then public.compass_ensure_user_org(new.created_by) else null end
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_challenges_assign_org on public.challenges;
create trigger trg_compass_challenges_assign_org
before insert or update of org_id, team_id, created_by on public.challenges
for each row
when (new.org_id is null)
execute function public.compass_before_challenge_assign_org();

create or replace function public.compass_before_sponsor_assign_org()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if new.org_id is null then
    v_name := coalesce(nullif(trim(new.name), ''), concat('Sponsor ', left(new.id::text, 8)));
    insert into public.organizations (name, org_type)
    values (v_name, 'sponsor')
    returning id into new.org_id;
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_sponsors_assign_org on public.sponsors;
create trigger trg_compass_sponsors_assign_org
before insert on public.sponsors
for each row
when (new.org_id is null)
execute function public.compass_before_sponsor_assign_org();

create or replace function public.compass_before_sponsored_challenge_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.sponsor_id is not null then
    new.org_id := public.compass_ensure_sponsor_org(new.sponsor_id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_sponsored_challenges_assign_org on public.sponsored_challenges;
create trigger trg_compass_sponsored_challenges_assign_org
before insert or update of org_id, sponsor_id on public.sponsored_challenges
for each row
when (new.org_id is null)
execute function public.compass_before_sponsored_challenge_assign_org();

create or replace function public.compass_before_challenge_participant_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null then
    new.org_id := coalesce(
      (select c.org_id from public.challenges c where c.id = new.challenge_id),
      (select sc.org_id from public.sponsored_challenges sc where sc.id = new.sponsored_challenge_id),
      case when new.user_id is not null then public.compass_ensure_user_org(new.user_id) else null end
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_challenge_participants_assign_org on public.challenge_participants;
create trigger trg_compass_challenge_participants_assign_org
before insert or update of org_id, challenge_id, sponsored_challenge_id, user_id on public.challenge_participants
for each row
when (new.org_id is null)
execute function public.compass_before_challenge_participant_assign_org();

create or replace function public.compass_before_broadcast_campaign_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.actor_user_id is not null then
    new.org_id := public.compass_ensure_user_org(new.actor_user_id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_broadcast_campaigns_assign_org on public.broadcast_campaigns;
create trigger trg_compass_broadcast_campaigns_assign_org
before insert or update of org_id, actor_user_id on public.broadcast_campaigns
for each row
when (new.org_id is null)
execute function public.compass_before_broadcast_campaign_assign_org();

create or replace function public.compass_before_broadcast_delivery_assign_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is null and new.campaign_id is not null then
    new.org_id := (select bc.org_id from public.broadcast_campaigns bc where bc.id = new.campaign_id);
  end if;
  return new;
end
$$;

drop trigger if exists trg_compass_broadcast_deliveries_assign_org on public.broadcast_deliveries;
create trigger trg_compass_broadcast_deliveries_assign_org
before insert or update of org_id, campaign_id on public.broadcast_deliveries
for each row
when (new.org_id is null)
execute function public.compass_before_broadcast_delivery_assign_org();

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'coaching_media_assets'
  ) then
    execute $sql$
      create or replace function public.compass_before_media_asset_assign_org()
      returns trigger
      language plpgsql
      as $fn$
      begin
        if new.org_id is null then
          new.org_id := coalesce(
            (select j.org_id from public.journeys j where j.id = new.journey_id),
            (select c.org_id from public.channels c where c.id = new.channel_id),
            case when new.owner_user_id is not null then public.compass_ensure_user_org(new.owner_user_id) else null end
          );
        end if;
        return new;
      end
      $fn$
    $sql$;

    execute 'drop trigger if exists trg_compass_media_assets_assign_org on public.coaching_media_assets';
    execute $sql$
      create trigger trg_compass_media_assets_assign_org
      before insert or update of org_id, journey_id, channel_id, owner_user_id on public.coaching_media_assets
      for each row
      when (new.org_id is null)
      execute function public.compass_before_media_asset_assign_org()
    $sql$;
  end if;
end
$$;
