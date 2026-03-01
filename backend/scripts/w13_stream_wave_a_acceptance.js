#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

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

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const health = await request(`${baseUrl}/health`);
      if (health.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`backend health check timed out for ${baseUrl}`);
}

function startServer({ port, streamMode }) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      STREAM_PROVIDER_MODE: streamMode,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (buf) => process.stdout.write(buf));
  server.stderr.on("data", (buf) => process.stderr.write(buf));
  return { server, baseUrl };
}

async function createAuthUser(email, password) {
  const created = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
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
    method: "DELETE",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

async function signIn(email, password) {
  const signed = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  assert(signed.status < 300, `sign in failed: ${signed.status}`);
  assert(signed.data.access_token, "missing access token");
  return signed.data.access_token;
}

async function main() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const randomizedBase = 4300 + Math.floor(Math.random() * 200);
  const primaryPort = Number(process.env.W13_STREAM_TEST_PORT || randomizedBase);
  const downPort = Number(process.env.W13_STREAM_TEST_DOWN_PORT || (primaryPort + 1));
  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const createdAuthUserIds = [];
  let dbConnected = false;
  let primaryServer;
  let downServer;

  try {
    primaryServer = startServer({ port: primaryPort, streamMode: "mock" });
    await waitForHealth(primaryServer.baseUrl);

    await db.connect();
    dbConnected = true;

    const runId = Date.now();
    const password = "TempPass!23456";
    const coachEmail = `w13.stream.coach.${runId}@example.com`;
    const memberEmail = `w13.stream.member.${runId}@example.com`;
    const outsiderEmail = `w13.stream.outsider.${runId}@example.com`;
    const coachUserId = await createAuthUser(coachEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    const outsiderUserId = await createAuthUser(outsiderEmail, password);
    createdAuthUserIds.push(coachUserId, memberUserId, outsiderUserId);

    const coachToken = await signIn(coachEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const outsiderToken = await signIn(outsiderEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'W13 Stream Coach', 'active')
       on conflict (id) do update set role='coach', full_name='W13 Stream Coach', account_status='active'`,
      [coachUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'W13 Stream Member', 'active')
       on conflict (id) do update set role='agent', full_name='W13 Stream Member', account_status='active'`,
      [memberUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'W13 Stream Outsider', 'active')
       on conflict (id) do update set role='agent', full_name='W13 Stream Outsider', account_status='active'`,
      [outsiderUserId]
    );

    const channelCreate = await request(`${primaryServer.baseUrl}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "cohort",
        name: `W13 Stream Sync ${runId}`,
      }),
    });
    assert(channelCreate.status === 201, `channel create expected 201, got ${channelCreate.status}`);
    const channelId = channelCreate.data?.channel?.id;
    assert(channelId, "channel create response missing id");

    await db.query(
      `insert into public.channel_memberships (channel_id, user_id, role)
       values ($1, $2, 'member')
       on conflict (channel_id, user_id) do update set role='member'`,
      [channelId, memberUserId]
    );
    await db.query(
      `insert into public.message_unreads (channel_id, user_id, unread_count, last_seen_at, updated_at)
       values ($1, $2, 0, now(), now())
       on conflict (channel_id, user_id) do update set unread_count=0, updated_at=now()`,
      [channelId, memberUserId]
    );

    const outsiderDenied = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "chat_read",
      }),
    });
    assert(outsiderDenied.status === 403, `outsider token should be 403, got ${outsiderDenied.status}`);
    assert(outsiderDenied.data?.error?.code === "scope_denied", "outsider token should return scope_denied");

    const readToken = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
        "x-request-id": `w13-stream-read-${runId}`,
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "chat_read",
        client_session_id: `member-session-${runId}`,
      }),
    });
    assert(readToken.status === 200, `member read token expected 200, got ${readToken.status}`);
    assert(readToken.data.provider === "stream", "read token provider should be stream");
    assert(readToken.data.scope_grants?.chat_read === true, "read token should grant chat_read");
    assert(readToken.data.scope_grants?.channel_admin === false, "member should not receive channel_admin grant");
    assert(readToken.data.provider_sync_status === "not_synced", "pre-sync state should be not_synced");

    const adminDenied = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "channel_admin",
      }),
    });
    assert(adminDenied.status === 403, `member channel_admin token should be 403, got ${adminDenied.status}`);
    assert(adminDenied.data?.error?.code === "scope_denied", "member channel_admin denial should be scope_denied");

    const invalidPurpose = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "not_a_real_scope",
      }),
    });
    assert(invalidPurpose.status === 422, `invalid token purpose should be 422, got ${invalidPurpose.status}`);
    assert(invalidPurpose.data?.error?.code === "invalid_token_purpose", "invalid token purpose code mismatch");

    const syncDenied = await request(`${primaryServer.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        sync_reason: "manual_reconcile",
      }),
    });
    assert(syncDenied.status === 403, `member sync should be 403, got ${syncDenied.status}`);
    assert(syncDenied.data?.error?.code === "scope_denied", "member sync denial should be scope_denied");

    const syncOk = await request(`${primaryServer.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        sync_reason: "manual_reconcile",
        expected_version: 0,
      }),
    });
    assert(syncOk.status === 200, `admin sync expected 200, got ${syncOk.status}`);
    assert(syncOk.data.sync_status === "synced", "sync should return synced status");
    assert(syncOk.data.sync_diff?.members_added >= 2, "sync should add at least two members on first run");
    assert(syncOk.data.authority_version === 1, "first sync authority_version should be 1");

    const syncedToken = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "chat_write",
      }),
    });
    assert(syncedToken.status === 200, `coach write token expected 200, got ${syncedToken.status}`);
    assert(syncedToken.data.provider_sync_status === "synced", "post-sync token should be synced");
    assert(syncedToken.data.provider_error_code === null, "synced token should not include provider_error_code");

    await db.query(`delete from public.channel_memberships where channel_id=$1 and user_id=$2`, [channelId, memberUserId]);

    const staleToken = await request(`${primaryServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "chat_read",
      }),
    });
    assert(staleToken.status === 200, `stale token call expected 200, got ${staleToken.status}`);
    assert(staleToken.data.provider_sync_status === "stale", "drifted token should report stale sync status");
    assert(staleToken.data.provider_error_code === "authority_state_drift", "drifted token should report authority_state_drift");

    const conflictSync = await request(`${primaryServer.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        sync_reason: "membership_change",
        expected_version: 0,
      }),
    });
    assert(conflictSync.status === 409, `sync version conflict should be 409, got ${conflictSync.status}`);
    assert(conflictSync.data?.error?.code === "reconcile_conflict", "sync version conflict code mismatch");

    const channelsList = await request(`${primaryServer.baseUrl}/api/channels`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${coachToken}`,
      },
    });
    assert(channelsList.status === 200, `channels list should be 200, got ${channelsList.status}`);
    const listed = (channelsList.data.channels || []).find((row) => row.id === channelId);
    assert(Boolean(listed), "channels list should include created channel");
    assert(listed.provider === "stream", "channels list provider should be stream");
    assert(typeof listed.provider_channel_id === "string", "channels list should include provider_channel_id");

    downServer = startServer({ port: downPort, streamMode: "down" });
    await waitForHealth(downServer.baseUrl);
    const providerDown = await request(`${downServer.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        token_purpose: "chat_read",
      }),
    });
    assert(providerDown.status === 503, `provider-down token should be 503, got ${providerDown.status}`);
    assert(providerDown.data?.error?.code === "provider_unavailable", "provider-down token code mismatch");

    console.log("W13 Stream Wave A acceptance passed");
  } finally {
    if (dbConnected) {
      await db.end().catch(() => {});
    }
    for (const userId of createdAuthUserIds) {
      await deleteAuthUser(userId).catch(() => {});
    }
    if (primaryServer?.server) {
      primaryServer.server.kill("SIGTERM");
    }
    if (downServer?.server) {
      downServer.server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("W13 Stream Wave A acceptance failed");
  console.error(error);
  process.exit(1);
});
