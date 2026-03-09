#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();
const { spawn } = require('child_process');
const { Client } = require('pg');

const BACKEND_PORT = process.env.M6_MESSAGE_LINKED_TASK_TEST_PORT || String(4920 + Math.floor(Math.random() * 120));
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await request(`${BACKEND_URL}/health`);
      if (health.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('backend health check timed out');
}

async function createAuthUser(email, password) {
  const created = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(created.status < 300, `create user failed: ${created.status}`);
  return created.data.id;
}

async function deleteAuthUser(userId) {
  await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

async function signIn(email, password) {
  const signed = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  assert(signed.status < 300, `sign in failed: ${signed.status}`);
  return signed.data.access_token;
}

async function ensureTaskMessageColumns(db) {
  await db.query(`
    alter table public.channel_messages
      add column if not exists message_kind text not null default 'text';
    update public.channel_messages set message_kind = 'text' where message_kind is null;
    alter table public.channel_messages
      add column if not exists assignment_ref jsonb;
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'channel_messages_message_kind_chk'
      ) THEN
        ALTER TABLE public.channel_messages
          ADD CONSTRAINT channel_messages_message_kind_chk
          CHECK (message_kind in ('text', 'coach_task', 'coach_goal_link', 'personal_task'));
      END IF;
    END $$;
  `);
}

async function main() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DATABASE_URL'];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: BACKEND_PORT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (buf) => process.stdout.write(buf));
  server.stderr.on('data', (buf) => process.stderr.write(buf));

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdAuthUserIds = [];
  const createdChannelIds = new Set();
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;
    await ensureTaskMessageColumns(db);

    const runId = Date.now();
    const password = 'TempPass!23456';
    const coachEmail = `m6.task.coach.${runId}@example.com`;
    const memberEmail = `m6.task.member.${runId}@example.com`;

    const coachId = await createAuthUser(coachEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(coachId, memberId);

    const coachToken = await signIn(coachEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'Thread Coach', 'active')
       on conflict (id) do update set role='coach', full_name='Thread Coach', account_status='active'`,
      [coachId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'Thread Member', 'active')
       on conflict (id) do update set role='agent', full_name='Thread Member', account_status='active'`,
      [memberId]
    );

    const directCreate = await request(`${BACKEND_URL}/api/channels`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${coachToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'direct',
        member_user_ids: [memberId],
      }),
    });
    assert(directCreate.status === 201, `coach direct channel create expected 201, got ${directCreate.status}`);
    const channelId = directCreate.data?.channel?.id;
    assert(channelId, 'direct channel id missing');
    createdChannelIds.add(channelId);

    const personalCreate = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message_kind: 'personal_task',
        task_action: 'create',
        task_card_draft: {
          task_type: 'personal_task',
          title: 'Call the buyer back',
          description: 'Confirm timeline and next showing window.',
          assignee_id: memberId,
          due_at: '2026-03-20',
        },
      }),
    });
    assert(personalCreate.status === 201, `personal_task create expected 201, got ${personalCreate.status}`);
    assert(personalCreate.data?.message?.linked_task_card?.task_type === 'personal_task', 'personal_task create missing linked_task_card');
    const personalTaskId = personalCreate.data?.message?.linked_task_card?.task_id;
    assert(personalTaskId, 'personal task id missing');

    const memberCoachTaskDenied = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message_kind: 'coach_task',
        task_action: 'create',
        task_card_draft: {
          task_type: 'coach_task',
          title: 'Coach-owned task should fail',
          assignee_id: memberId,
        },
      }),
    });
    assert(memberCoachTaskDenied.status === 403, `member coach_task create expected 403, got ${memberCoachTaskDenied.status}`);

    const coachCreate = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${coachToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message_kind: 'coach_task',
        task_action: 'create',
        task_card_draft: {
          task_type: 'coach_task',
          title: 'Submit listing packet draft',
          description: 'Share first draft before the afternoon review.',
          assignee_id: memberId,
          due_at: '2026-03-18',
        },
      }),
    });
    assert(coachCreate.status === 201, `coach_task create expected 201, got ${coachCreate.status}`);
    const coachTaskCard = coachCreate.data?.message?.linked_task_card;
    assert(coachTaskCard?.task_type === 'coach_task', 'coach_task create missing linked_task_card');
    const coachTaskId = coachTaskCard?.task_id;
    assert(coachTaskId, 'coach task id missing');

    const memberCoachEditDenied = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message_kind: 'coach_task',
        task_action: 'update',
        task_card_draft: {
          task_type: 'coach_task',
          task_id: coachTaskId,
          title: 'Member cannot retitle this',
          status: 'in_progress',
        },
      }),
    });
    assert(memberCoachEditDenied.status === 403, `member coach_task title edit expected 403, got ${memberCoachEditDenied.status}`);

    const memberCoachComplete = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${memberToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        body: 'Draft sent to coach for review.',
        message_kind: 'coach_task',
        task_action: 'complete',
        task_card_draft: {
          task_type: 'coach_task',
          task_id: coachTaskId,
          status: 'completed',
        },
      }),
    });
    assert(memberCoachComplete.status === 201, `member coach_task complete expected 201, got ${memberCoachComplete.status}`);
    assert(memberCoachComplete.data?.message?.linked_task_card?.status === 'completed', 'completed coach_task should return completed status');

    const threadRead = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(threadRead.status === 200, `thread read expected 200, got ${threadRead.status}`);
    const threadMessages = Array.isArray(threadRead.data?.messages) ? threadRead.data.messages : [];
    const latestCoachTaskEvent = [...threadMessages].reverse().find((row) => row?.linked_task_card?.task_id === coachTaskId);
    assert(latestCoachTaskEvent?.linked_task_card?.status === 'completed', 'latest coach task event should be completed in thread read');

    const assignmentsRead = await request(`${BACKEND_URL}/api/coaching/assignments/me`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(assignmentsRead.status === 200, `assignments read expected 200, got ${assignmentsRead.status}`);
    const assignments = Array.isArray(assignmentsRead.data?.assignments) ? assignmentsRead.data.assignments : [];
    const personalAssignment = assignments.find((row) => row.id === personalTaskId);
    const coachAssignment = assignments.find((row) => row.id === coachTaskId);
    assert(personalAssignment?.source === 'message_linked', 'personal task missing from assignments feed');
    assert(coachAssignment?.status === 'completed', 'coach task status should sync to assignments feed');
    assert(coachAssignment?.source_message_id, 'coach task assignment should include source_message_id');
    assert(coachAssignment?.rights?.can_mark_complete === true, 'assignee should retain completion right on coach task');
    const coachTaskRows = assignments.filter((row) => row.id === coachTaskId);
    assert(coachTaskRows.length === 1, 'assignments feed should dedupe to latest event per task id');

    console.log('\nM6 message-linked task cards acceptance: PASS');
    console.log(JSON.stringify({
      channel_id: channelId,
      personal_task_id: personalTaskId,
      coach_task_id: coachTaskId,
      latest_coach_status: coachAssignment?.status,
      assignment_total: assignments.length,
    }, null, 2));
  } finally {
    if (dbConnected) {
      for (const channelId of createdChannelIds) {
        await db.query('delete from public.message_unreads where channel_id = $1', [channelId]).catch(() => undefined);
        await db.query('delete from public.channel_memberships where channel_id = $1', [channelId]).catch(() => undefined);
        await db.query('delete from public.channel_messages where channel_id = $1', [channelId]).catch(() => undefined);
        await db.query('delete from public.channels where id = $1', [channelId]).catch(() => undefined);
      }
      for (const userId of createdAuthUserIds) {
        await db.query('delete from public.users where id = $1', [userId]).catch(() => undefined);
      }
      await db.end().catch(() => undefined);
    }
    await Promise.all(createdAuthUserIds.map((userId) => deleteAuthUser(userId).catch(() => undefined)));
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('\nM6 message-linked task cards acceptance: FAIL');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
