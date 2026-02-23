#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_URL = "http://127.0.0.1:4000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const out = await request(`${BACKEND_URL}/health`);
      if (out.status === 200) return;
    } catch {
      // wait and retry
    }
    await sleep(250);
  }
  throw new Error("backend health check timed out");
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

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  let dbConnected = false;

  let tempUserId = null;
  try {
    await waitForHealth();

    const email = `sprint1.acceptance.${Date.now()}@example.com`;
    const password = "TempPass!23456";

    const createUser = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    assert(createUser.status < 300, `user create failed: ${createUser.status}`);
    tempUserId = createUser.data.id;

    const signIn = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: process.env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    assert(signIn.status < 300, `sign in failed: ${signIn.status}`);
    const token = signIn.data.access_token;
    assert(token, "missing access_token");

    // Scenario #1: /me
    const me = await request(`${BACKEND_URL}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(me.status === 200, "scenario #1 failed: /me should return 200");
    assert(me.data.id === tempUserId, "scenario #1 failed: /me id mismatch");

    await db.connect();
    dbConnected = true;
    const kpiRows = await db.query(
      "select id,name,type from public.kpis where name in ('Listings Taken','Calls Made','Open Houses','Deal Closed','Listings Pending')"
    );
    const kpiByName = Object.fromEntries(kpiRows.rows.map((r) => [r.name, r]));
    const now = new Date().toISOString();

    // Scenario #2: PC log creates projection contribution
    const pcLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kpi_id: kpiByName["Listings Taken"].id, event_timestamp: now }),
    });
    assert(pcLog.status === 201, "scenario #2 failed: PC log should return 201");
    assert(
      Number(pcLog.data?.log?.pc_generated) > 0,
      "scenario #2 failed: PC log should generate positive pc_generated"
    );

    // Scenario #3: GP log does not generate PC
    const gpLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Calls Made"].id,
        event_timestamp: now,
        logged_value: 7,
      }),
    });
    assert(gpLog.status === 201, "scenario #3 failed: GP log should return 201");
    assert(
      Number(gpLog.data?.log?.pc_generated) === 0,
      "scenario #3 failed: GP log must not generate PC"
    );

    // Scenario #4: Actual log updates actuals only
    const actualLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Deal Closed"].id,
        event_timestamp: now,
        logged_value: 15000,
      }),
    });
    assert(actualLog.status === 201, "scenario #4 failed: Actual log should return 201");
    assert(
      Number(actualLog.data?.log?.pc_generated) === 0,
      "scenario #4 failed: Actual log must not generate PC"
    );
    assert(
      Number(actualLog.data?.log?.actual_gci_delta) === 15000,
      "scenario #4 failed: Actual GCI delta mismatch"
    );

    // Scenario #6: Pipeline anchor persistence + dashboard reflection
    const anchorLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Listings Pending"].id,
        event_timestamp: now,
        logged_value: 3,
      }),
    });
    assert(anchorLog.status === 201, "scenario #6 failed: anchor log should return 201");

    // Scenario E3: missing required direct value input
    const missingValue = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Deal Closed"].id,
        event_timestamp: now,
      }),
    });
    assert(missingValue.status === 422, "E3 failed: missing logged_value should return 422");

    // Scenario E7: malformed request body
    const malformed = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "null",
    });
    assert(malformed.status === 400, "E7 failed: malformed body should return 400");

    // Scenario E1: idempotency behavior
    const idemKey = `idem-${Date.now()}`;
    const idemFirst = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Open Houses"].id,
        event_timestamp: now,
        logged_value: 2,
        idempotency_key: idemKey,
      }),
    });
    assert(idemFirst.status === 201, "E1 failed: first idempotent write should return 201");
    const idemSecond = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        kpi_id: kpiByName["Open Houses"].id,
        event_timestamp: now,
        logged_value: 2,
        idempotency_key: idemKey,
      }),
    });
    assert(idemSecond.status === 200, "E1 failed: duplicate idempotent write should return 200");
    assert(idemSecond.data?.status === "duplicate", "E1 failed: duplicate response status mismatch");

    const dashboard = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(dashboard.status === 200, "dashboard should return 200");

    // Scenario #5: confidence exists as display-layer object and projection remains numeric
    assert(
      typeof dashboard.data?.projection?.confidence?.score === "number",
      "scenario #5 failed: confidence score missing"
    );
    assert(
      ["green", "yellow", "red"].includes(dashboard.data?.projection?.confidence?.band),
      "scenario #5 failed: confidence band invalid"
    );
    assert(
      typeof dashboard.data?.projection?.pc_90d === "number",
      "scenario #5 failed: pc_90d missing"
    );

    assert(Number(dashboard.data?.actuals?.actual_gci) === 15000, "scenario #4 failed in dashboard");
    assert(Number(dashboard.data?.points?.gp) === 7, "scenario #3 failed in dashboard GP points");
    assert(Array.isArray(dashboard.data?.projection?.required_pipeline_anchors), "scenario #6 failed: anchors missing");
    assert(
      dashboard.data.projection.required_pipeline_anchors.length >= 1,
      "scenario #6 failed: expected at least one anchor record"
    );
    assert(
      Array.isArray(dashboard.data?.chart?.past_actual_6m) &&
        dashboard.data.chart.past_actual_6m.length === 6,
      "scenario #5 failed: chart.past_actual_6m must contain 6 points"
    );
    assert(
      Array.isArray(dashboard.data?.chart?.future_projected_12m) &&
        dashboard.data.chart.future_projected_12m.length === 12,
      "scenario #5 failed: chart.future_projected_12m must contain 12 points"
    );
    assert(
      ["green", "yellow", "red"].includes(dashboard.data?.projection?.confidence?.band),
      "scenario #5 failed: confidence band missing"
    );
    assert(
      typeof dashboard.data?.projection?.confidence?.components?.historical_accuracy_score === "number" &&
        typeof dashboard.data?.projection?.confidence?.components?.pipeline_health_score === "number" &&
        typeof dashboard.data?.projection?.confidence?.components?.inactivity_score === "number",
      "scenario #5 failed: confidence components missing from dashboard"
    );

    const pcBeforeSnapshot = Number(dashboard.data?.projection?.pc_90d ?? 0);
    const confidenceSnapshot = await request(`${BACKEND_URL}/api/forecast-confidence/snapshot`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
    });
    assert(confidenceSnapshot.status === 200, "scenario #5 failed: confidence snapshot should return 200");
    assert(
      typeof confidenceSnapshot.data?.confidence?.components?.historical_accuracy_score === "number",
      "scenario #5 failed: confidence snapshot components missing"
    );
    const dashboardAfterSnapshot = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(dashboardAfterSnapshot.status === 200, "scenario #5 failed: dashboard after snapshot should return 200");
    const pcAfterSnapshot = Number(dashboardAfterSnapshot.data?.projection?.pc_90d ?? 0);
    assert(
      Math.abs(pcBeforeSnapshot - pcAfterSnapshot) < 0.0001,
      "scenario #5 failed: confidence snapshot must not mutate base projection values"
    );

    // Scenario E4: deactivated account blocks writes
    await db.query("update public.users set account_status = 'deactivated' where id = $1", [tempUserId]);
    const blocked = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kpi_id: kpiByName["Calls Made"].id, event_timestamp: now, logged_value: 1 }),
    });
    assert(blocked.status === 403, "E4 failed: deactivated account should block log writes");

    console.log("Sprint 1 acceptance checks passed (#1-#6 + E1/E3/E4/E7).");
  } finally {
    if (tempUserId) {
      await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${tempUserId}`, {
        method: "DELETE",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }

    if (dbConnected) {
      await db.end();
    }

    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
