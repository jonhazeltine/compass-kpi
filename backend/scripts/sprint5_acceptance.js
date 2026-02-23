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
  const ids = {
    teamId: null,
    journeyId: null,
    milestoneId: null,
    lessonId: null,
    suggestionId: null,
  };
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const password = "TempPass!23456";
    const adminEmail = `sprint5.admin.${Date.now()}@example.com`;
    const leaderEmail = `sprint5.leader.${Date.now()}@example.com`;
    const memberEmail = `sprint5.member.${Date.now()}@example.com`;
    const outsiderEmail = `sprint5.outsider.${Date.now()}@example.com`;

    const adminId = await createAuthUser(adminEmail, password);
    const leaderId = await createAuthUser(leaderEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    const outsiderId = await createAuthUser(outsiderEmail, password);
    createdAuthUserIds.push(adminId, leaderId, memberId, outsiderId);

    const adminToken = await signIn(adminEmail, password);
    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const outsiderToken = await signIn(outsiderEmail, password);

    await db.query(
      "insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role = excluded.role",
      [adminId]
    );

    const teamOut = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ name: "Sprint5 Team" }),
    });
    assert(teamOut.status === 201, `team create failed: ${teamOut.status}`);
    ids.teamId = teamOut.data.team.id;

    const addMemberOut = await request(`${BACKEND_URL}/teams/${ids.teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ user_id: memberId }),
    });
    assert(addMemberOut.status === 201, `team member add failed: ${addMemberOut.status}`);

    const journeyInsert = await db.query(
      `insert into public.journeys (title, description, team_id, created_by)
       values ($1, $2, $3, $4)
       returning id`,
      ["Sprint5 Team Journey", "Security visibility check", ids.teamId, leaderId]
    );
    ids.journeyId = journeyInsert.rows[0].id;

    const milestoneInsert = await db.query(
      `insert into public.milestones (journey_id, title, sort_order)
       values ($1, $2, $3)
       returning id`,
      [ids.journeyId, "Milestone 1", 1]
    );
    ids.milestoneId = milestoneInsert.rows[0].id;

    const lessonInsert = await db.query(
      `insert into public.lessons (milestone_id, title, body, sort_order)
       values ($1, $2, $3, $4)
       returning id`,
      [ids.milestoneId, "Lesson 1", "Lesson baseline", 1]
    );
    ids.lessonId = lessonInsert.rows[0].id;

    const outsiderJourneys = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderJourneys.status === 200, "outsider journeys request failed");
    assert(
      !outsiderJourneys.data.journeys.some((j) => j.id === ids.journeyId),
      "outsider should not see team-scoped journey in list"
    );

    const outsiderJourneyDetail = await request(`${BACKEND_URL}/api/coaching/journeys/${ids.journeyId}`, {
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderJourneyDetail.status === 403, `outsider journey detail should be 403, got ${outsiderJourneyDetail.status}`);

    const outsiderProgress = await request(`${BACKEND_URL}/api/coaching/lessons/${ids.lessonId}/progress`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });
    assert(outsiderProgress.status === 403, `outsider lesson progress should be 403, got ${outsiderProgress.status}`);

    const memberJourneyDetail = await request(`${BACKEND_URL}/api/coaching/journeys/${ids.journeyId}`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(memberJourneyDetail.status === 200, `member journey detail should be 200, got ${memberJourneyDetail.status}`);

    const memberProgress = await request(`${BACKEND_URL}/api/coaching/lessons/${ids.lessonId}/progress`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });
    assert(memberProgress.status === 200, `member lesson progress should be 200, got ${memberProgress.status}`);

    const nonAdminTargetSuggestion = await request(`${BACKEND_URL}/api/ai/suggestions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        user_id: outsiderId,
        scope: "coaching_followup",
        proposed_message: "Try this script next call",
      }),
    });
    assert(
      nonAdminTargetSuggestion.status === 403,
      `non-admin cross-user suggestion should be 403, got ${nonAdminTargetSuggestion.status}`
    );

    const adminTargetSuggestion = await request(`${BACKEND_URL}/api/ai/suggestions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user_id: outsiderId,
        scope: "coaching_followup",
        proposed_message: "Admin-approved suggestion target",
      }),
    });
    assert(adminTargetSuggestion.status === 201, `admin target suggestion failed: ${adminTargetSuggestion.status}`);
    ids.suggestionId = adminTargetSuggestion.data.suggestion.id;

    const leaderApprove = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(leaderApprove.status === 403, `leader approve should be 403, got ${leaderApprove.status}`);

    const adminApprove = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(adminApprove.status === 200, `admin approve should be 200, got ${adminApprove.status}`);

    console.log("Sprint 5 acceptance checks passed (hardening + launch-gate policy coverage).");
  } finally {
    if (dbConnected) {
      if (ids.suggestionId) {
        await db.query("delete from public.ai_suggestions where id = $1", [ids.suggestionId]);
      }
      if (ids.lessonId) {
        await db.query("delete from public.lesson_progress where lesson_id = $1", [ids.lessonId]);
      }
      if (ids.journeyId) {
        await db.query("delete from public.lessons where milestone_id in (select id from public.milestones where journey_id = $1)", [ids.journeyId]);
        await db.query("delete from public.milestones where journey_id = $1", [ids.journeyId]);
        await db.query("delete from public.journeys where id = $1", [ids.journeyId]);
      }
      if (ids.teamId) {
        await db.query("delete from public.team_memberships where team_id = $1", [ids.teamId]);
        await db.query("delete from public.teams where id = $1", [ids.teamId]);
      }
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
  console.error(err.message);
  process.exit(1);
});
