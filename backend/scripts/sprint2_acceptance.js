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
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

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
  let teamId = null;
  const challengeIds = [];

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const password = "TempPass!23456";
    const leaderEmail = `sprint2.leader.${Date.now()}@example.com`;
    const memberEmail = `sprint2.member.${Date.now()}@example.com`;
    const outsiderEmail = `sprint2.outsider.${Date.now()}@example.com`;

    const leaderUserId = await createAuthUser(leaderEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    const outsiderUserId = await createAuthUser(outsiderEmail, password);
    createdAuthUserIds.push(leaderUserId, memberUserId, outsiderUserId);

    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);

    const createTeam = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ name: "Sprint 2 Test Team" }),
    });
    assert(createTeam.status === 201, `team create failed: ${createTeam.status}`);
    teamId = createTeam.data.team.id;

    // #8: non-leader cannot add members
    const addByMember = await request(`${BACKEND_URL}/teams/${teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ user_id: outsiderUserId }),
    });
    assert(addByMember.status === 403, `#8 failed: expected 403 for non-leader add, got ${addByMember.status}`);

    // #8: leader can add members
    const addByLeader = await request(`${BACKEND_URL}/teams/${teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ user_id: memberUserId, role: "member" }),
    });
    assert(addByLeader.status === 201, `#8 failed: leader should add member (got ${addByLeader.status})`);

    const addOutsiderByLeader = await request(`${BACKEND_URL}/teams/${teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ user_id: outsiderUserId, role: "member" }),
    });
    assert(addOutsiderByLeader.status === 201, `#8 failed: leader should add outsider (got ${addOutsiderByLeader.status})`);

    const callsMade = await db.query("select id from public.kpis where name='Calls Made' limit 1");
    assert(callsMade.rows[0]?.id, "Calls Made KPI seed missing");
    const callsMadeKpiId = callsMade.rows[0].id;

    const now = Date.now();
    const startAt = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const endAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    const preJoinEventTs = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    // Challenge A: late join OFF
    const challengeA = await db.query(
      `insert into public.challenges (name, mode, team_id, start_at, end_at, late_join_includes_history, created_by)
       values ($1, 'team', $2, $3, $4, false, $5)
       returning id`,
      ["Sprint2 Challenge LateOff", teamId, startAt, endAt, leaderUserId]
    );
    const challengeAId = challengeA.rows[0].id;
    challengeIds.push(challengeAId);
    await db.query("insert into public.challenge_kpis (challenge_id, kpi_id) values ($1, $2)", [
      challengeAId,
      callsMadeKpiId,
    ]);

    // Challenge B: late join ON
    const challengeB = await db.query(
      `insert into public.challenges (name, mode, team_id, start_at, end_at, late_join_includes_history, created_by)
       values ($1, 'team', $2, $3, $4, true, $5)
       returning id`,
      ["Sprint2 Challenge LateOn", teamId, startAt, endAt, leaderUserId]
    );
    const challengeBId = challengeB.rows[0].id;
    challengeIds.push(challengeBId);
    await db.query("insert into public.challenge_kpis (challenge_id, kpi_id) values ($1, $2)", [
      challengeBId,
      callsMadeKpiId,
    ]);

    // Pre-join activity log should only count for challenge B.
    const preJoinLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        kpi_id: callsMadeKpiId,
        event_timestamp: preJoinEventTs,
        logged_value: 1,
      }),
    });
    assert(preJoinLog.status === 201, `failed to create pre-join log (${preJoinLog.status})`);

    const joinA = await request(`${BACKEND_URL}/challenge-participants`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ challenge_id: challengeAId }),
    });
    assert(joinA.status === 201, `#7/E6 failed: join challenge A (${joinA.status})`);
    assert(
      Number(joinA.data?.participant?.progress_percent) === 0,
      "#7/E6 failed: challenge A should start at 0 progress for late-join OFF"
    );

    const joinB = await request(`${BACKEND_URL}/challenge-participants`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ challenge_id: challengeBId }),
    });
    assert(joinB.status === 201, `E6 failed: join challenge B (${joinB.status})`);
    assert(
      Number(joinB.data?.participant?.progress_percent) > 0,
      "E6 failed: challenge B should include pre-join logs"
    );

    // #7: challenge-mapped KPI activity updates progress and leaderboard.
    const postJoinLog = await request(`${BACKEND_URL}/kpi-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        kpi_id: callsMadeKpiId,
        event_timestamp: new Date().toISOString(),
        logged_value: 2,
      }),
    });
    assert(postJoinLog.status === 201, `#7 failed: post-join log failed (${postJoinLog.status})`);

    const challengeList = await request(`${BACKEND_URL}/challenges`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(challengeList.status === 200, `#7 failed: GET /challenges (${challengeList.status})`);

    const list = challengeList.data?.challenges ?? [];
    const cA = list.find((c) => c.id === challengeAId);
    assert(cA, "#7 failed: challenge A not returned");
    assert(
      Number(cA.my_participation?.progress_percent) > 0,
      "#7 failed: challenge A progress should reflect mapped KPI activity"
    );
    assert(Array.isArray(cA.leaderboard_top), "#7 failed: leaderboard should be present");
    assert(
      cA.leaderboard_top.some((row) => row.user_id === memberUserId),
      "#7 failed: member should appear in leaderboard"
    );

    console.log("Sprint 2 acceptance checks passed (#7, #8, E6).");
  } finally {
    if (dbConnected) {
      if (challengeIds.length > 0) {
        await db.query("delete from public.challenge_participants where challenge_id = any($1::uuid[])", [challengeIds]);
        await db.query("delete from public.challenge_kpis where challenge_id = any($1::uuid[])", [challengeIds]);
        await db.query("delete from public.challenges where id = any($1::uuid[])", [challengeIds]);
      }
      if (teamId) {
        await db.query("delete from public.team_memberships where team_id = $1", [teamId]);
        await db.query("delete from public.teams where id = $1", [teamId]);
      }
      await db.query("delete from public.kpi_logs where user_id = any($1::uuid[])", [createdAuthUserIds]);
      await db.query("delete from public.users where id = any($1::uuid[])", [createdAuthUserIds]);
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
