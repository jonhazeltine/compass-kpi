#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const crypto = require("crypto");
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_PORT =
  process.env.W13_MUX_TEST_PORT || String(4500 + Math.floor(Math.random() * 200));
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
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const webhookSecret = process.env.MUX_WEBHOOK_SECRET || "w13-mux-wave-b-secret";

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: BACKEND_PORT,
      MUX_PROVIDER_MODE: "mock",
      MUX_WEBHOOK_SECRET: webhookSecret,
      MUX_PLAYBACK_TOKEN_SECRET: process.env.MUX_PLAYBACK_TOKEN_SECRET || "w13-playback-secret",
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

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const runId = Date.now();
    const password = "TempPass!23456";

    const coachEmail = `w13.mux.coach.${runId}@example.com`;
    const memberEmail = `w13.mux.member.${runId}@example.com`;
    const coachUserId = await createAuthUser(coachEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(coachUserId, memberUserId);

    const coachToken = await signIn(coachEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'Mux Coach', 'active')
       on conflict (id) do update set role='coach', full_name='Mux Coach', account_status='active'`,
      [coachUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'Mux Member', 'active')
       on conflict (id) do update set role='agent', full_name='Mux Member', account_status='active'`,
      [memberUserId]
    );

    const beforeKpi = await db.query("select count(*)::int as count from public.kpi_logs where user_id=$1", [coachUserId]);
    const beforeKpiCount = Number(beforeKpi.rows[0]?.count ?? 0);

    const upload = await request(`${BACKEND_URL}/api/coaching/media/upload-url`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
        "x-request-id": `req-${runId}-upload`,
      },
      body: JSON.stringify({
        journey_id: `journey-${runId}`,
        filename: "w13-checkpoint-c.mp4",
        content_type: "video/mp4",
        content_length_bytes: 1024 * 1024,
        idempotency_key: `mux-upload-${runId}`,
      }),
    });
    assert(upload.status === 201, `upload-url expected 201, got ${upload.status}`);
    assert(upload.data.upload_id, "upload response missing upload_id");
    assert(upload.data.media_id, "upload response missing media_id");

    const memberUpload = await request(`${BACKEND_URL}/api/coaching/media/upload-url`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        journey_id: `journey-${runId}`,
        filename: "blocked.mp4",
        content_type: "video/mp4",
        content_length_bytes: 512000,
        idempotency_key: `mux-upload-member-${runId}`,
      }),
    });
    assert(memberUpload.status === 403, `member upload expected 403, got ${memberUpload.status}`);
    assert(memberUpload.data?.error?.code === "unauthorized_scope", "member upload should return unauthorized_scope");

    const playbackBeforeReady = await request(`${BACKEND_URL}/api/coaching/media/playback-token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ media_id: upload.data.media_id, viewer_context: "coach" }),
    });
    assert(playbackBeforeReady.status === 409, `playback before ready expected 409, got ${playbackBeforeReady.status}`);
    assert(playbackBeforeReady.data?.error?.code === "media_not_ready", "playback before ready should be media_not_ready");

    const invalidWebhook = {
      id: `evt-invalid-${runId}`,
      type: "video.asset.ready",
      data: {
        object: {
          id: `asset-${runId}`,
          passthrough: upload.data.upload_id,
          playback_ids: [{ id: `playback-${runId}` }],
        },
      },
    };
    const invalidWebhookReq = await request(`${BACKEND_URL}/api/webhooks/mux`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`,
      },
      body: JSON.stringify(invalidWebhook),
    });
    assert(invalidWebhookReq.status === 401, `invalid signature webhook expected 401, got ${invalidWebhookReq.status}`);
    assert(invalidWebhookReq.data?.error?.code === "invalid_signature", "invalid signature should return invalid_signature");

    const processingEvent = {
      id: `evt-processing-${runId}`,
      type: "video.asset.created",
      data: {
        object: {
          id: `asset-${runId}`,
          passthrough: upload.data.upload_id,
        },
      },
    };
    const processingRaw = JSON.stringify(processingEvent);
    const processingSig = signMuxWebhookBody(webhookSecret, processingRaw, Math.floor(Date.now() / 1000));
    const processingReq = await request(`${BACKEND_URL}/api/webhooks/mux`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": processingSig,
      },
      body: processingRaw,
    });
    assert(processingReq.status === 200, `processing webhook expected 200, got ${processingReq.status}`);
    assert(processingReq.data.verification_status === "verified", "processing webhook should be verified");

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
    assert(readyReq.data.processing_status === "ready", "ready webhook should set ready status");

    const duplicateReadyReq = await request(`${BACKEND_URL}/api/webhooks/mux`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": readySig,
      },
      body: readyRaw,
    });
    assert(duplicateReadyReq.status === 200, `duplicate webhook expected 200, got ${duplicateReadyReq.status}`);
    assert(duplicateReadyReq.data.verification_status === "duplicate_ignored", "duplicate webhook should be duplicate_ignored");

    const staleProcessingEvent = {
      id: `evt-stale-${runId}`,
      type: "video.asset.created",
      data: {
        object: {
          id: `asset-${runId}`,
          passthrough: upload.data.upload_id,
        },
      },
    };
    const staleRaw = JSON.stringify(staleProcessingEvent);
    const staleTs = Math.floor(Date.now() / 1000) - 3600;
    const staleSig = signMuxWebhookBody(webhookSecret, staleRaw, staleTs);
    const staleReq = await request(`${BACKEND_URL}/api/webhooks/mux`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": staleSig,
      },
      body: staleRaw,
    });
    assert(staleReq.status === 401, `stale webhook expected 401, got ${staleReq.status}`);
    assert(staleReq.data?.error?.code === "replay_window_exceeded", "stale webhook should be replay_window_exceeded");

    const playbackAfterReady = await request(`${BACKEND_URL}/api/coaching/media/playback-token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ media_id: upload.data.media_id, viewer_context: "coach" }),
    });
    assert(playbackAfterReady.status === 200, `playback after ready expected 200, got ${playbackAfterReady.status}`);
    assert(typeof playbackAfterReady.data.token === "string" && playbackAfterReady.data.token.length > 20, "playback token missing");

    const afterKpi = await db.query("select count(*)::int as count from public.kpi_logs where user_id=$1", [coachUserId]);
    const afterKpiCount = Number(afterKpi.rows[0]?.count ?? 0);
    assert(afterKpiCount === beforeKpiCount, "KPI logs count changed during mux runtime checks");

    console.log("W13 Mux Wave B checkpoint acceptance checks passed.");
    console.log(JSON.stringify({
      upload_media_id: upload.data.media_id,
      upload_id: upload.data.upload_id,
      playback_id: playbackAfterReady.data.playback_id,
      kpi_logs_before: beforeKpiCount,
      kpi_logs_after: afterKpiCount,
    }, null, 2));
  } finally {
    if (dbConnected) {
      if (createdAuthUserIds.length > 0) {
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
  console.error(err.message || err);
  process.exit(1);
});
