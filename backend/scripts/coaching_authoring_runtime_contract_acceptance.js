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

async function deleteAuthUser(userId) {
  await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

async function main() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) assert(process.env[key], `${key} is required`);

  const port = process.env.CHECKPOINT_H_TEST_PORT || "4015";
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
    const password = "TempPass!23456";

    const coachEmail = `h.coach.${runId}@example.com`;
    const leaderEmail = `h.leader.${runId}@example.com`;
    const sponsorEmail = `h.sponsor.${runId}@example.com`;
    const memberEmail = `h.member.${runId}@example.com`;

    const coachId = await createAuthUser(coachEmail, password);
    const leaderId = await createAuthUser(leaderEmail, password);
    const sponsorId = await createAuthUser(sponsorEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(coachId, leaderId, sponsorId, memberId);

    const coachToken = await signIn(coachEmail, password);
    const leaderToken = await signIn(leaderEmail, password);
    const sponsorToken = await signIn(sponsorEmail, password);
    const memberToken = await signIn(memberEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'H Coach', 'active')
       on conflict (id) do update set role='coach', full_name='H Coach', account_status='active'`,
      [coachId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'team_leader', 'H Team Leader', 'active')
       on conflict (id) do update set role='team_leader', full_name='H Team Leader', account_status='active'`,
      [leaderId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'challenge_sponsor', 'H Sponsor', 'active')
       on conflict (id) do update set role='challenge_sponsor', full_name='H Sponsor', account_status='active'`,
      [sponsorId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'H Member', 'active')
       on conflict (id) do update set role='agent', full_name='H Member', account_status='active'`,
      [memberId]
    );

    const teamInsert = await db.query(
      `insert into public.teams (name, created_by)
       values ($1, $2)
       returning id`,
      [`Checkpoint H Team ${runId}`, coachId]
    );
    const teamId = teamInsert.rows[0].id;

    await db.query(
      `insert into public.team_memberships (team_id, user_id, role)
       values ($1, $2, 'team_leader'), ($1, $3, 'member')
       on conflict (team_id, user_id) do update set role=excluded.role`,
      [teamId, leaderId, memberId]
    );

    const journeyCreate = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Checkpoint H Journey",
        description: "Authoring contract coverage",
        team_id: teamId,
      }),
    });
    assert(journeyCreate.status === 201, `coach journey create expected 201, got ${journeyCreate.status}`);
    const journeyId = journeyCreate.data?.journey?.id;
    assert(journeyId, "journey create missing id");

    const sponsorCreateBlocked = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sponsorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Blocked sponsor journey",
        team_id: teamId,
      }),
    });
    assert(sponsorCreateBlocked.status === 403, `sponsor create should be 403, got ${sponsorCreateBlocked.status}`);
    assert(sponsorCreateBlocked.data?.error?.code === "scope_denied", "sponsor create should return scope_denied");

    const leaderGlobalBlocked = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Leader without team scope",
      }),
    });
    assert(leaderGlobalBlocked.status === 403, `team leader create without team should be 403, got ${leaderGlobalBlocked.status}`);

    const lessonCreate = await request(`${baseUrl}/api/coaching/journeys/${journeyId}/lessons`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Lesson 1" }),
    });
    assert(lessonCreate.status === 201, `lesson create expected 201, got ${lessonCreate.status}`);
    const lessonId = lessonCreate.data?.lesson?.id;
    assert(lessonId, "lesson create missing id");

    const taskCreateA = await request(`${baseUrl}/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Task A", body: "Body A" }),
    });
    const taskCreateB = await request(`${baseUrl}/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Task B", body: "Body B" }),
    });
    assert(taskCreateA.status === 201 && taskCreateB.status === 201, "task create endpoints should return 201");
    const taskAId = taskCreateA.data?.task?.id;
    const taskBId = taskCreateB.data?.task?.id;
    assert(taskAId && taskBId, "task create missing ids");

    const taskReorder = await request(`${baseUrl}/api/coaching/journeys/${journeyId}/lessons/${lessonId}/tasks/reorder`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ task_ids: [taskBId, taskAId] }),
    });
    assert(taskReorder.status === 200, `task reorder expected 200, got ${taskReorder.status}`);

    const journeyDetail = await request(`${baseUrl}/api/coaching/journeys/${journeyId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    assert(journeyDetail.status === 200, `member journey detail expected 200, got ${journeyDetail.status}`);
    assert(Array.isArray(journeyDetail.data?.milestones), "journey detail should include milestones");

    const cohortList = await request(`${baseUrl}/api/coaching/cohorts`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${leaderToken}`,
      },
    });
    assert(cohortList.status === 200, `cohort list expected 200, got ${cohortList.status}`);
    assert((cohortList.data?.cohorts || []).some((cohort) => cohort.id === teamId), "cohort list should include scoped team");

    const cohortUpdate = await request(`${baseUrl}/api/coaching/cohorts/${teamId}/members`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ member_user_ids: [memberId] }),
    });
    assert(cohortUpdate.status === 200, `cohort update expected 200, got ${cohortUpdate.status}`);
    assert((cohortUpdate.data?.member_user_ids || []).includes(memberId), "cohort update should keep member id");

    await db.query(
      `insert into public.channels (type, name, team_id, context_id, created_by, is_active)
       values ('team', $1, $2, null, $3, true),
              ('sponsor', $4, null, null, $3, true)
       returning id`,
      [`Team Channel ${runId}`, teamId, coachId, `Sponsor Channel ${runId}`]
    );

    const channelsResponse = await request(`${baseUrl}/api/coaching/channels`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${coachToken}`,
      },
    });
    assert(channelsResponse.status === 200, `coaching channels expected 200, got ${channelsResponse.status}`);
    assert(Array.isArray(channelsResponse.data?.channels), "coaching channels should return array");
    assert(channelsResponse.data.channels.length >= 1, "coaching channels should include records");

    const unauthenticated = await request(`${baseUrl}/api/coaching/journeys`, {
      method: "GET",
    });
    assert(unauthenticated.status === 401, `unauthenticated journeys list should be 401, got ${unauthenticated.status}`);
    assert(unauthenticated.data?.error?.code === "unauthenticated", "unauthenticated journeys should return deterministic envelope");

    console.log("Checkpoint H coaching authoring/runtime contract acceptance passed");
  } finally {
    if (dbConnected) await db.end().catch(() => {});
    for (const id of createdAuthUserIds) {
      await deleteAuthUser(id).catch(() => {});
    }
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error("Checkpoint H coaching authoring/runtime contract acceptance failed");
  console.error(error);
  process.exit(1);
});
