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

    const migrationCheck = await db.query(
      "select to_regclass('public.forecast_confidence_snapshots')::text as forecast_confidence_snapshots_table"
    );
    assert(
      migrationCheck.rows[0].forecast_confidence_snapshots_table === "forecast_confidence_snapshots",
      "Sprint 9 tables missing. Apply backend/sql/010_sprint9_confidence_policy_baseline.sql first."
    );

    const password = "TempPass!23456";
    const adminEmail = `sprint9.admin.${Date.now()}@example.com`;
    const memberEmail = `sprint9.member.${Date.now()}@example.com`;

    const adminUserId = await createAuthUser(adminEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(adminUserId, memberUserId);

    const adminToken = await signIn(adminEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query("insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role='admin'", [adminUserId]);
    await db.query("insert into public.users (id, role) values ($1, 'agent') on conflict (id) do update set role='agent'", [memberUserId]);

    const kpis = await db.query(
      "select id,name from public.kpis where name in ('Listings Taken','Deal Closed','Listings Pending')"
    );
    const kpiByName = Object.fromEntries(kpis.rows.map((r) => [r.name, r.id]));
    assert(kpiByName["Listings Taken"], "Listings Taken KPI seed missing");
    assert(kpiByName["Deal Closed"], "Deal Closed KPI seed missing");
    assert(kpiByName["Listings Pending"], "Listings Pending KPI seed missing");

    const nowIso = new Date().toISOString();
    const pcLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ kpi_id: kpiByName["Listings Taken"], event_timestamp: nowIso }),
    });
    assert(pcLog.status === 201, `pre-confidence PC log failed: ${pcLog.status}`);
    const actualLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ kpi_id: kpiByName["Deal Closed"], event_timestamp: nowIso, logged_value: 12000 }),
    });
    assert(actualLog.status === 201, `pre-confidence Actual log failed: ${actualLog.status}`);
    const anchorLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ kpi_id: kpiByName["Listings Pending"], event_timestamp: nowIso, logged_value: 3 }),
    });
    assert(anchorLog.status === 201, `pre-confidence anchor log failed: ${anchorLog.status}`);

    const dashboardBefore = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(dashboardBefore.status === 200, "dashboard before confidence should return 200");
    const pcBefore = Number(dashboardBefore.data?.projection?.pc_90d ?? 0);

    const snapshot = await request(`${BACKEND_URL}/api/forecast-confidence/snapshot`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(snapshot.status === 200, `confidence snapshot should be 200, got ${snapshot.status}`);
    assert(typeof snapshot.data?.confidence?.score === "number", "confidence score missing");
    assert(["green", "yellow", "red"].includes(snapshot.data?.confidence?.band), "confidence band invalid");

    const snapshotRows = await db.query(
      "select count(*)::int as c from public.forecast_confidence_snapshots where user_id = $1",
      [memberUserId]
    );
    assert(Number(snapshotRows.rows[0].c) >= 1, "confidence snapshot row should be persisted");

    const dashboardAfter = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(dashboardAfter.status === 200, "dashboard after confidence should return 200");
    const pcAfter = Number(dashboardAfter.data?.projection?.pc_90d ?? 0);
    assert(pcAfter === pcBefore, "confidence snapshot must not mutate base projection values");

    const memberPolicy = await request(`${BACKEND_URL}/ops/summary/policy`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(memberPolicy.status === 403, `non-admin policy summary should be 403, got ${memberPolicy.status}`);

    const adminPolicy = await request(`${BACKEND_URL}/ops/summary/policy`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminPolicy.status === 200, `admin policy summary should be 200, got ${adminPolicy.status}`);
    assert(
      adminPolicy.data?.summary?.checks?.gp_vp_logs_with_pc_generated !== undefined,
      "policy summary checks missing expected field"
    );

    console.log("Sprint 9 acceptance checks passed (confidence parity + policy summary baseline).");
  } finally {
    if (dbConnected) {
      if (createdAuthUserIds.length > 0) {
        await db.query("delete from public.forecast_confidence_snapshots where user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.admin_activity_log where admin_user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.notification_queue where user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.challenge_participants where user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.kpi_logs where user_id = any($1::uuid[])", [createdAuthUserIds]);
        await db.query("delete from public.pipeline_anchor_status where user_id = any($1::uuid[])", [createdAuthUserIds]);
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
