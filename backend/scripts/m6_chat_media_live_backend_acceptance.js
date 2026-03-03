#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const crypto = require("crypto");
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_PORT = process.env.M6_CHAT_MEDIA_LIVE_TEST_PORT || String(4700 + Math.floor(Math.random() * 200));
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

async function waitForHealth(baseUrl = BACKEND_URL, timeoutMs = 15000) {
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
  throw new Error("backend health check timed out");
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

function signMuxWebhookBody(secret, rawBody, timestampSeconds) {
  const signatureHex = crypto
    .createHmac("sha256", secret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest("hex");
  return `t=${timestampSeconds},v1=${signatureHex}`;
}

async function main() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DATABASE_URL"];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const webhookSecret = process.env.MUX_WEBHOOK_SECRET || "m6-chat-media-live-secret";
  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: BACKEND_PORT,
      MUX_PROVIDER_MODE: "mock",
      MUX_WEBHOOK_SECRET: webhookSecret,
      MUX_PLAYBACK_TOKEN_SECRET: process.env.MUX_PLAYBACK_TOKEN_SECRET || "m6-playback-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (buf) => process.stdout.write(buf));
  server.stderr.on("data", (buf) => process.stderr.write(buf));

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdAuthUserIds = [];
  let dbConnected = false;
  const evidence = {
    start_live: null,
    join_live: null,
    provider_unavailable: null,
  };

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const runId = Date.now();
    const password = "TempPass!23456";

    const coachEmail = `m6.media.coach.${runId}@example.com`;
    const memberEmail = `m6.media.member.${runId}@example.com`;
    const outsiderEmail = `m6.media.outsider.${runId}@example.com`;

    const coachUserId = await createAuthUser(coachEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    const outsiderUserId = await createAuthUser(outsiderEmail, password);
    createdAuthUserIds.push(coachUserId, memberUserId, outsiderUserId);

    const coachToken = await signIn(coachEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const outsiderToken = await signIn(outsiderEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'M6 Media Coach', 'active')
       on conflict (id) do update set role='coach', full_name='M6 Media Coach', account_status='active'`,
      [coachUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'M6 Media Member', 'active')
       on conflict (id) do update set role='agent', full_name='M6 Media Member', account_status='active'`,
      [memberUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'M6 Media Outsider', 'active')
       on conflict (id) do update set role='agent', full_name='M6 Media Outsider', account_status='active'`,
      [outsiderUserId]
    );

    const channelCreate = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "cohort",
        name: `M6 Media Live ${runId}`,
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

    const upload = await request(`${BACKEND_URL}/api/coaching/media/upload-url`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        journey_id: `journey-${runId}`,
        channel_id: channelId,
        filename: "m6-chat-media.mp4",
        content_type: "video/mp4",
        content_length_bytes: 2048,
        idempotency_key: `m6-media-upload-${runId}`,
      }),
    });
    assert(upload.status === 201, `upload-url expected 201, got ${upload.status}`);
    assert(upload.data.media_id, "upload response missing media_id");

    const mediaMessage = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message_type: "media_attachment",
        body: "Initial recording upload",
        media_attachment: {
          media_id: upload.data.media_id,
          caption: "Kickoff recording",
        },
      }),
    });
    assert(mediaMessage.status === 201, `media attachment message expected 201, got ${mediaMessage.status}`);
    assert(mediaMessage.data?.message?.message_type === "media_attachment", "message_type should be media_attachment");
    assert(mediaMessage.data?.message?.media_attachment?.media_id === upload.data.media_id, "media_id mismatch in message response");

    const messageThreadBeforeWebhook = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: "GET",
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(messageThreadBeforeWebhook.status === 200, `messages list expected 200, got ${messageThreadBeforeWebhook.status}`);
    const mediaMessagesBefore = (messageThreadBeforeWebhook.data?.messages || []).filter((m) => m.message_type === "media_attachment");
    assert(mediaMessagesBefore.length >= 1, "messages list should include media attachment rows");

    const createLive = await request(`${BACKEND_URL}/api/coaching/media/live-sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        title: "Weekly coaching live",
        idempotency_key: `live-${runId}`,
      }),
    });
    assert(createLive.status === 201, `create live session expected 201, got ${createLive.status}`);
    const sessionId = createLive.data?.session?.session_id;
    assert(sessionId, "live session create missing session_id");
    assert(typeof createLive.data?.host_url === "string" && createLive.data.host_url.length > 0, "create live missing host_url");
    assert(typeof createLive.data?.live_url === "string" && createLive.data.live_url.length > 0, "create live missing live_url");
    evidence.start_live = {
      status: createLive.status,
      session_id: createLive.data?.session?.session_id ?? null,
      provider: createLive.data?.provider ?? null,
      host_url: createLive.data?.host_url ?? null,
      join_url: createLive.data?.join_url ?? null,
      live_url: createLive.data?.live_url ?? null,
    };

    const replayLive = await request(`${BACKEND_URL}/api/coaching/media/live-sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: channelId,
        title: "Weekly coaching live",
        idempotency_key: `live-${runId}`,
      }),
    });
    assert(replayLive.status === 200, `idempotent live create expected 200, got ${replayLive.status}`);
    assert(replayLive.data?.idempotent_replay === true, "idempotent live create should set idempotent_replay=true");

    const memberJoin = await request(`${BACKEND_URL}/api/coaching/media/live-sessions/${sessionId}/join-token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "viewer" }),
    });
    assert(memberJoin.status === 200, `member join-token expected 200, got ${memberJoin.status}`);
    assert(memberJoin.data?.token, "member join-token response missing token");
    assert(typeof memberJoin.data?.join_url === "string" && memberJoin.data.join_url.length > 0, "join-token missing join_url");
    assert(typeof memberJoin.data?.live_url === "string" && memberJoin.data.live_url.length > 0, "join-token missing live_url");
    evidence.join_live = {
      status: memberJoin.status,
      session_id: memberJoin.data?.session?.session_id ?? null,
      provider: memberJoin.data?.provider ?? null,
      join_url: memberJoin.data?.join_url ?? null,
      live_url: memberJoin.data?.live_url ?? null,
      token_present: Boolean(memberJoin.data?.token),
    };

    const outsiderJoin = await request(`${BACKEND_URL}/api/coaching/media/live-sessions/${sessionId}/join-token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "viewer" }),
    });
    assert(outsiderJoin.status === 403, `outsider join-token expected 403, got ${outsiderJoin.status}`);

    const readyEvent = {
      id: `evt-ready-${runId}`,
      type: "video.asset.ready",
      data: {
        object: {
          id: `asset-${runId}`,
          passthrough: upload.data.upload_id,
          playback_ids: [{ id: `playback-${runId}` }],
        },
      },
    };
    const readyRaw = JSON.stringify(readyEvent);
    const readySig = signMuxWebhookBody(webhookSecret, readyRaw, Math.floor(Date.now() / 1000));
    const readyReq = await request(`${BACKEND_URL}/api/webhooks/mux`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": readySig,
      },
      body: readyRaw,
    });
    assert(readyReq.status === 200, `ready webhook expected 200, got ${readyReq.status}`);
    assert(readyReq.data.processing_status === "ready", "ready webhook should set processing status ready");

    const messageThreadAfterWebhook = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: "GET",
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(messageThreadAfterWebhook.status === 200, `messages list after webhook expected 200, got ${messageThreadAfterWebhook.status}`);
    const mediaMessagesAfter = (messageThreadAfterWebhook.data?.messages || []).filter((m) => m.message_type === "media_attachment");
    assert(mediaMessagesAfter.length >= 2, "webhook should append lifecycle media attachment message");
    const readyLifecycleMessage = mediaMessagesAfter.find((m) => m.body === "Media attachment is ready for playback.");
    assert(Boolean(readyLifecycleMessage), "lifecycle message copy not found in thread");

    const endSession = await request(`${BACKEND_URL}/api/coaching/media/live-sessions/${sessionId}/end`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
      },
    });
    assert(endSession.status === 200, `end live session expected 200, got ${endSession.status}`);
    assert(endSession.data?.session?.status === "ended", "live session should be ended after end endpoint");

    const unavailablePort = String(Number(BACKEND_PORT) + 1);
    const unavailableUrl = `http://127.0.0.1:${unavailablePort}`;
    const unavailableServer = spawn("node", ["dist/index.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: unavailablePort,
        MUX_PROVIDER_MODE: "mock",
        MUX_LIVE_PROVIDER_MODE: "unavailable",
        MUX_WEBHOOK_SECRET: webhookSecret,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    unavailableServer.stdout.on("data", (buf) => process.stdout.write(buf));
    unavailableServer.stderr.on("data", (buf) => process.stderr.write(buf));
    try {
      await waitForHealth(unavailableUrl);
      const unavailableCreate = await request(`${unavailableUrl}/api/coaching/media/live-sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${coachToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel_id: channelId,
          title: "Unavailable live provider test",
          idempotency_key: `live-unavailable-${runId}`,
        }),
      });
      assert(unavailableCreate.status === 503, `provider unavailable create expected 503, got ${unavailableCreate.status}`);
      const unavailableCode = unavailableCreate.data?.error?.code || unavailableCreate.data?.code;
      assert(unavailableCode === "provider_unavailable", `provider unavailable code expected provider_unavailable, got ${String(unavailableCode)}`);
      evidence.provider_unavailable = {
        status: unavailableCreate.status,
        code: unavailableCode,
        message: unavailableCreate.data?.error?.message || unavailableCreate.data?.message || null,
      };
    } finally {
      unavailableServer.kill("SIGTERM");
    }

    console.log("M6 live launch evidence:", JSON.stringify(evidence));
    console.log("M6 chat media + live backend acceptance passed");
  } finally {
    if (dbConnected) {
      await db.end().catch(() => {});
    }
    for (const userId of createdAuthUserIds) {
      await deleteAuthUser(userId).catch(() => {});
    }
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
