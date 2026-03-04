-- 028_team_identity_persistence.sql
-- Persist leader-managed Team identity presentation fields so all members
-- see the same icon/background across sessions/devices.

alter table public.teams
  add column if not exists identity_avatar text not null default '🛡️',
  add column if not exists identity_background text not null default '#dff0da';

alter table public.teams
  drop constraint if exists teams_identity_background_hex_check;

alter table public.teams
  add constraint teams_identity_background_hex_check
  check (identity_background ~ '^#[0-9A-Fa-f]{6}$');

alter table public.teams
  drop constraint if exists teams_identity_avatar_length_check;

alter table public.teams
  add constraint teams_identity_avatar_length_check
  check (char_length(identity_avatar) between 1 and 8);
