alter table public.channel_messages
  add column if not exists message_kind text not null default 'text';

update public.channel_messages
set message_kind = 'text'
where message_kind is null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'channel_messages_message_kind_chk'
  ) THEN
    ALTER TABLE public.channel_messages
      ADD CONSTRAINT channel_messages_message_kind_chk
      CHECK (message_kind in ('text', 'coach_task', 'coach_goal_link', 'personal_task'));
  END IF;
END $$;

alter table public.channel_messages
  add column if not exists assignment_ref jsonb;

create index if not exists idx_channel_messages_task_events
  on public.channel_messages (channel_id, created_at desc)
  where message_kind in ('coach_task', 'personal_task');
