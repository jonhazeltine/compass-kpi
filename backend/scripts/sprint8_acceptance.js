#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_URL = "http://127.0.0.1:4000";

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

async function waitForHealth(timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await request(`${BACKEND_URL}/health`);
      if (health.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("backend health check timed out");
}

async function createAuthUser(email, password) {
  const create = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(create.status < 300, `create user failed: ${create.status}`);
  return create.data.id;
}

async function signIn(email, password) {
  const signInOut = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  assert(signInOut.status < 300, `sign in failed: ${signInOut.status}`);
  assert(signInOut.data.access_token, "missing access token");
  return signInOut.data.access_token;
}

async function main() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) assert(process.env[key], `${key} is required`);

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdAuthUserIds = [];
  const ids = {
    queuedId1: null,
    queuedId2: null,
  };
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const migrationCheck = await db.query(
      "select to_regclass('public.notification_queue')::text as notification_queue_table"
    );
    assert(
      migrationCheck.rows[0].notification_queue_table === "notification_queue",
      "Sprint 8 tables missing. Apply backend/sql/009_sprint8_notification_queue.sql first."
    );

    const password = "TempPass!23456";
    const adminEmail = `sprint8.admin.${Date.now()}@example.com`;
    const memberEmail = `sprint8.member.${Date.now()}@example.com`;
    const targetEmail = `sprint8.target.${Date.now()}@example.com`;

    const adminUserId = await createAuthUser(adminEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    const targetUserId = await createAuthUser(targetEmail, password);
    createdAuthUserIds.push(adminUserId, memberUserId, targetUserId);

    const adminToken = await signIn(adminEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query("insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role='admin'", [adminUserId]);
    await db.query("insert into public.users (id, role) values ($1, 'agent') on conflict (id) do update set role='agent'", [memberUserId]);
    await db.query("insert into public.users (id, role) values ($1, 'agent') on conflict (id) do update set role='agent'", [targetUserId]);

    const forbiddenEnqueue = await request(`${BACKEND_URL}/api/notifications/enqueue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
        "x-request-id": "sprint8-forbidden",
      },
      body: JSON.stringify({
        user_id: targetUserId,
        category: "system",
        title: "Denied",
        body: "Should not enqueue",
      }),
    });
    assert(forbiddenEnqueue.status === 403, `non-admin enqueue should be 403, got ${forbiddenEnqueue.status}`);
    assert(forbiddenEnqueue.data?.error?.code === "forbidden", "forbidden envelope code mismatch");
    assert(forbiddenEnqueue.data?.error?.request_id === "sprint8-forbidden", "request_id should echo header when supplied");

    const enqueue1 = await request(`${BACKEND_URL}/api/notifications/enqueue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user_id: targetUserId,
        category: "challenge",
        title: "Challenge Reminder",
        body: "Daily challenge check-in",
      }),
    });
    assert(enqueue1.status === 201, `admin enqueue should be 201, got ${enqueue1.status}`);
    ids.queuedId1 = enqueue1.data.notification.id;
    assert(enqueue1.data.notification.status === "queued", "new notification should be queued");

    const enqueue2 = await request(`${BACKEND_URL}/api/notifications/enqueue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user_id: targetUserId,
        category: "coaching",
        title: "Coaching Nudge",
        body: "Follow-up with your member today",
      }),
    });
    assert(enqueue2.status === 201, `second enqueue should be 201, got ${enqueue2.status}`);
    ids.queuedId2 = enqueue2.data.notification.id;

    const queueList = await request(`${BACKEND_URL}/api/notifications/queue`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(queueList.status === 200, `queue list should be 200, got ${queueList.status}`);
    assert(queueList.data.notifications.some((n) => n.id === ids.queuedId1), "queue list missing notification");

    const dispatchSuccess = await request(`${BACKEND_URL}/api/notifications/${ids.queuedId1}/dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ success: true, provider_message_id: "provider-123" }),
    });
    assert(dispatchSuccess.status === 200, `dispatch success should be 200, got ${dispatchSuccess.status}`);
    assert(dispatchSuccess.data.notification.status === "sent", "notification should be marked sent");

    const dispatchFailure = await request(`${BACKEND_URL}/api/notifications/${ids.queuedId2}/dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ success: false, error: "provider timeout" }),
    });
    assert(dispatchFailure.status === 200, `dispatch failure should be 200, got ${dispatchFailure.status}`);
    assert(dispatchFailure.data.notification.status === "failed", "notification should be marked failed");
    assert(Number(dispatchFailure.data.notification.attempts) === 1, "failed dispatch should increment attempts");

    const missingDispatch = await request(`${BACKEND_URL}/api/notifications/00000000-0000-0000-0000-000000000000/dispatch`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "x-request-id": "sprint8-missing",
      },
    });
    assert(missingDispatch.status === 404, `missing dispatch should be 404, got ${missingDispatch.status}`);
    assert(missingDispatch.data?.error?.code === "not_found", "missing dispatch should return standardized code");
    assert(missingDispatch.data?.error?.request_id === "sprint8-missing", "missing dispatch request_id mismatch");

    console.log("Sprint 8 acceptance checks passed (notification queue + error envelope baseline).");
  } finally {
    if (dbConnected) {
      if (ids.queuedId1 || ids.queuedId2) {
        await db.query("delete from public.notification_queue where id = any($1::uuid[])", [[ids.queuedId1, ids.queuedId2].filter(Boolean)]);
      }
      if (createdAuthUserIds.length > 0) {
        await db.query("delete from public.admin_activity_log where admin_user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.users where id = any($1::uuid[])", [createdAuthUserIds]);
      }
      await db.end();
    }

    for (const userId of createdAuthUserIds) {
      await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }

    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
