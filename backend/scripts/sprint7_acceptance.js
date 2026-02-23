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
  const created = {
    kpiId: null,
    templateId: null,
  };
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const migrationCheck = await db.query(
      "select to_regclass('public.admin_activity_log')::text as admin_activity_log_table"
    );
    assert(
      migrationCheck.rows[0].admin_activity_log_table === "admin_activity_log",
      "Sprint 7 tables missing. Apply backend/sql/008_sprint7_admin_core.sql first."
    );

    const password = "TempPass!23456";
    const adminEmail = `sprint7.admin.${Date.now()}@example.com`;
    const memberEmail = `sprint7.member.${Date.now()}@example.com`;

    const adminUserId = await createAuthUser(adminEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(adminUserId, memberUserId);

    const adminToken = await signIn(adminEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query("insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role='admin'", [adminUserId]);
    await db.query("insert into public.users (id, role) values ($1, 'agent') on conflict (id) do update set role='agent'", [memberUserId]);

    const memberDenied = await request(`${BACKEND_URL}/admin/kpis`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(memberDenied.status === 403, `member admin endpoint should be 403, got ${memberDenied.status}`);

    const newKpiName = `Sprint7 KPI ${Date.now()}`;
    const createKpi = await request(`${BACKEND_URL}/admin/kpis`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: newKpiName,
        type: "GP",
        requires_direct_value_input: false,
        is_active: true,
      }),
    });
    assert(createKpi.status === 201, `admin kpi create should be 201, got ${createKpi.status}`);
    created.kpiId = createKpi.data.kpi.id;

    const listKpis = await request(`${BACKEND_URL}/admin/kpis`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(listKpis.status === 200, `admin kpi list should be 200, got ${listKpis.status}`);
    assert(listKpis.data.kpis.some((k) => k.id === created.kpiId), "created KPI missing from list");

    const updateKpi = await request(`${BACKEND_URL}/admin/kpis/${created.kpiId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ requires_direct_value_input: true }),
    });
    assert(updateKpi.status === 200, `admin kpi update should be 200, got ${updateKpi.status}`);
    assert(updateKpi.data.kpi.requires_direct_value_input === true, "kpi update did not persist");

    const deleteKpi = await request(`${BACKEND_URL}/admin/kpis/${created.kpiId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(deleteKpi.status === 200, `admin kpi delete should be 200, got ${deleteKpi.status}`);
    assert(deleteKpi.data.kpi.is_active === false, "kpi delete should soft-deactivate row");

    const newTemplateName = `Sprint7 Template ${Date.now()}`;
    const createTemplate = await request(`${BACKEND_URL}/admin/challenge-templates`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: newTemplateName, description: "template description", is_active: true }),
    });
    assert(createTemplate.status === 201, `template create should be 201, got ${createTemplate.status}`);
    created.templateId = createTemplate.data.challenge_template.id;

    const updateTemplate = await request(`${BACKEND_URL}/admin/challenge-templates/${created.templateId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ description: "updated template description" }),
    });
    assert(updateTemplate.status === 200, `template update should be 200, got ${updateTemplate.status}`);

    const deleteTemplate = await request(`${BACKEND_URL}/admin/challenge-templates/${created.templateId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(deleteTemplate.status === 200, `template delete should be 200, got ${deleteTemplate.status}`);
    assert(deleteTemplate.data.challenge_template.is_active === false, "template delete should soft-deactivate row");

    const adminUsers = await request(`${BACKEND_URL}/admin/users`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminUsers.status === 200, `admin users list should be 200, got ${adminUsers.status}`);
    assert(adminUsers.data.users.some((u) => u.id === memberUserId), "member user missing from admin users list");

    const roleUpdate = await request(`${BACKEND_URL}/admin/users/${memberUserId}/role`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: "team_leader" }),
    });
    assert(roleUpdate.status === 200, `user role update should be 200, got ${roleUpdate.status}`);
    assert(roleUpdate.data.user.role === "team_leader", "user role update failed");

    const tierUpdate = await request(`${BACKEND_URL}/admin/users/${memberUserId}/tier`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tier: "teams" }),
    });
    assert(tierUpdate.status === 200, `user tier update should be 200, got ${tierUpdate.status}`);
    assert(tierUpdate.data.user.tier === "teams", "user tier update failed");

    const statusUpdate = await request(`${BACKEND_URL}/admin/users/${memberUserId}/status`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ account_status: "deactivated" }),
    });
    assert(statusUpdate.status === 200, `user status update should be 200, got ${statusUpdate.status}`);
    assert(statusUpdate.data.user.account_status === "deactivated", "user status update failed");

    const auditRows = await db.query(
      "select count(*)::int as c from public.admin_activity_log where admin_user_id = $1",
      [adminUserId]
    );
    assert(Number(auditRows.rows[0].c) >= 6, "admin activity log should contain audit rows");

    console.log("Sprint 7 acceptance checks passed (admin core operations baseline).");
  } finally {
    if (dbConnected) {
      if (created.kpiId) {
        await db.query("delete from public.kpis where id = $1", [created.kpiId]);
      }
      if (created.templateId) {
        await db.query("delete from public.challenge_templates where id = $1", [created.templateId]);
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
