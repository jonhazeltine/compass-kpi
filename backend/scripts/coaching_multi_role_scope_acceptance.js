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
  throw new Error("backend health check timed out");
}

async function createAuthUser(email, password, metadata = {}) {
  const created = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: metadata,
      user_metadata: metadata,
    }),
  });
  assert(created.status < 300, `create user failed (${email}): ${created.status}`);
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
  assert(signed.status < 300, `sign in failed (${email}): ${signed.status}`);
  assert(signed.data.access_token, `missing access token (${email})`);
  return signed.data.access_token;
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

function authHeaders(token, extra = {}) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function main() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) assert(process.env[key], `${key} is required`);

  const port = process.env.COACHING_MULTI_ROLE_TEST_PORT || "4017";
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: "127.0.0.1", PORT: port },
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
    await waitForHealth(baseUrl);
    await db.connect();
    dbConnected = true;

    const runId = Date.now();
    const password = `RoleScope!${runId}`;

    const dualEmail = `multi.dual.${runId}@example.com`;
    const coachEmail = `multi.coach.${runId}@example.com`;
    const leaderEmail = `multi.leader.${runId}@example.com`;
    const superAdminEmail = `multi.super.${runId}@example.com`;

    const dualId = await createAuthUser(dualEmail, password, {
      role: "team_leader",
      roles: ["coach", "team_leader"],
    });
    const coachId = await createAuthUser(coachEmail, password, { role: "coach", roles: ["coach"] });
    const leaderId = await createAuthUser(leaderEmail, password, { role: "team_leader", roles: ["team_leader"] });
    const superAdminId = await createAuthUser(superAdminEmail, password, { role: "super_admin", roles: ["super_admin"] });
    createdAuthUserIds.push(dualId, coachId, leaderId, superAdminId);

    const dualToken = await signIn(dualEmail, password);
    const coachToken = await signIn(coachEmail, password);
    const leaderToken = await signIn(leaderEmail, password);
    const superAdminToken = await signIn(superAdminEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'team_leader', 'Multi Dual', 'active')
       on conflict (id) do update set role='team_leader', full_name='Multi Dual', account_status='active'`,
      [dualId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'Multi Coach', 'active')
       on conflict (id) do update set role='coach', full_name='Multi Coach', account_status='active'`,
      [coachId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'team_leader', 'Multi Leader', 'active')
       on conflict (id) do update set role='team_leader', full_name='Multi Leader', account_status='active'`,
      [leaderId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'super_admin', 'Multi Super', 'active')
       on conflict (id) do update set role='super_admin', full_name='Multi Super', account_status='active'`,
      [superAdminId]
    );

    const teamInsert = await db.query(
      `insert into public.teams (name, created_by)
       values ($1, $2)
       returning id`,
      [`Multi Role Team ${runId}`, coachId]
    );
    const teamId = teamInsert.rows[0].id;

    await db.query(
      `insert into public.team_memberships (team_id, user_id, role)
       values ($1, $2, 'team_leader'), ($1, $3, 'team_leader')
       on conflict (team_id, user_id) do update set role=excluded.role`,
      [teamId, leaderId, dualId]
    );

    const leaderTeamJourney = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: authHeaders(leaderToken),
      body: JSON.stringify({
        title: "Leader Team Journey",
        description: "Team scoped by leader",
        team_id: teamId,
      }),
    });
    assert(leaderTeamJourney.status === 201, `team leader should create team journey (got ${leaderTeamJourney.status})`);

    const leaderGlobalDenied = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: authHeaders(leaderToken),
      body: JSON.stringify({
        title: "Leader global denied",
        description: "No team scope should fail",
      }),
    });
    assert(leaderGlobalDenied.status === 403, `team leader global write should be denied (got ${leaderGlobalDenied.status})`);

    const dualGlobalJourney = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: authHeaders(dualToken),
      body: JSON.stringify({
        title: "Dual Role Global Journey",
        description: "Coach + team leader union write",
      }),
    });
    assert(dualGlobalJourney.status === 201, `dual-role global create should pass (got ${dualGlobalJourney.status})`);

    const dualListMy = await request(`${baseUrl}/api/coaching/journeys?scope=my`, {
      method: "GET",
      headers: { authorization: `Bearer ${dualToken}` },
    });
    assert(dualListMy.status === 200, `dual-role my scope should load (got ${dualListMy.status})`);
    assert((dualListMy.data?.journeys ?? []).length >= 1, "dual-role my scope should include authored journey");

    const dualListTeam = await request(`${baseUrl}/api/coaching/journeys?scope=team`, {
      method: "GET",
      headers: { authorization: `Bearer ${dualToken}` },
    });
    assert(dualListTeam.status === 200, `dual-role team scope should load (got ${dualListTeam.status})`);
    assert((dualListTeam.data?.journeys ?? []).length >= 1, "dual-role team scope should include team journey");

    const dualListAllAllowed = await request(`${baseUrl}/api/coaching/journeys?scope=all_allowed`, {
      method: "GET",
      headers: { authorization: `Bearer ${dualToken}` },
    });
    assert(dualListAllAllowed.status === 200, `dual-role all_allowed scope should load (got ${dualListAllAllowed.status})`);
    assert(Array.isArray(dualListAllAllowed.data?.access_context?.effective_roles), "journeys access_context should include effective_roles");
    assert(
      dualListAllAllowed.data.access_context.effective_roles.includes("coach") &&
        dualListAllAllowed.data.access_context.effective_roles.includes("team_leader"),
      "dual-role effective_roles should include coach + team_leader"
    );

    const superAdminDefaultDenied = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: authHeaders(superAdminToken),
      body: JSON.stringify({
        title: "Super admin denied by default",
      }),
    });
    assert(
      superAdminDefaultDenied.status === 403,
      `super admin writes should be read-only by default (got ${superAdminDefaultDenied.status})`
    );

    const superAdminElevatedAllowed = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: authHeaders(superAdminToken, { "x-coach-elevated-edit": "true" }),
      body: JSON.stringify({
        title: "Super admin elevated write",
      }),
    });
    assert(
      superAdminElevatedAllowed.status === 201,
      `super admin elevated write should pass (got ${superAdminElevatedAllowed.status})`
    );

    const superAdminScopeRead = await request(`${baseUrl}/api/coaching/library/assets?scope=all_allowed`, {
      method: "GET",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    assert(superAdminScopeRead.status === 200, `super admin all_allowed read should pass (got ${superAdminScopeRead.status})`);
    assert(
      superAdminScopeRead.data?.access_context?.can_global_view === true,
      "super admin should report can_global_view=true in library access_context"
    );

    const coachScopeRead = await request(`${baseUrl}/api/coaching/cohorts?scope=my`, {
      method: "GET",
      headers: { authorization: `Bearer ${coachToken}` },
    });
    assert(coachScopeRead.status === 200, `coach scoped read should pass (got ${coachScopeRead.status})`);

    console.log("Coaching multi-role scope acceptance passed");
  } finally {
    if (dbConnected) await db.end().catch(() => {});
    for (const userId of createdAuthUserIds) {
      await deleteAuthUser(userId).catch(() => {});
    }
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
