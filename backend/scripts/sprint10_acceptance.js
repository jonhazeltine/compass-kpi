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
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const expectedIndexes = [
      "idx_kpis_type_active",
      "idx_challenge_participants_sponsored",
      "idx_challenge_templates_active",
      "idx_notification_queue_status_attempts",
      "idx_sponsored_challenges_tier_active",
      "idx_forecast_confidence_band_computed",
    ];
    const indexRows = await db.query(
      "select indexname from pg_indexes where schemaname = 'public' and indexname = any($1::text[])",
      [expectedIndexes]
    );
    const found = new Set(indexRows.rows.map((r) => r.indexname));
    for (const idx of expectedIndexes) {
      assert(found.has(idx), `missing expected index: ${idx}`);
    }

    const password = "TempPass!23456";
    const adminEmail = `sprint10.admin.${Date.now()}@example.com`;
    const adminUserId = await createAuthUser(adminEmail, password);
    createdAuthUserIds.push(adminUserId);
    const adminToken = await signIn(adminEmail, password);
    await db.query("insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role='admin'", [adminUserId]);

    const policyOut = await request(`${BACKEND_URL}/ops/summary/policy`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(policyOut.status === 200, `policy summary should return 200, got ${policyOut.status}`);

    const queueOut = await request(`${BACKEND_URL}/api/notifications/queue`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(queueOut.status === 200, `notification queue should return 200, got ${queueOut.status}`);

    console.log("Sprint 10 acceptance checks passed (performance indexes + backend MVP gate baseline).");
  } finally {
    if (dbConnected) {
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
