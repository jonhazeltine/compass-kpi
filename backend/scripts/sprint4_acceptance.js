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
    suggestionId1: null,
    suggestionId2: null,
  };
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    // Ensure Sprint 4 migration was applied.
    const migrationCheck = await db.query(
      "select to_regclass('public.ai_suggestions')::text as ai_suggestions_table"
    );
    assert(
      migrationCheck.rows[0].ai_suggestions_table === "ai_suggestions",
      "Sprint 4 tables missing. Apply backend/sql/006_sprint4_coaching_ai_core.sql first."
    );

    const password = "TempPass!23456";
    const adminEmail = `sprint4.admin.${Date.now()}@example.com`;
    const leaderEmail = `sprint4.leader.${Date.now()}@example.com`;
    const memberEmail = `sprint4.member.${Date.now()}@example.com`;

    const adminId = await createAuthUser(adminEmail, password);
    const leaderId = await createAuthUser(leaderEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    createdAuthUserIds.push(adminId, leaderId, memberId);

    const adminToken = await signIn(adminEmail, password);
    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);

    const teamOut = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ name: "Sprint4 Team" }),
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

    await db.query(
      "insert into public.users (id, role) values ($1, 'admin') on conflict (id) do update set role = excluded.role",
      [adminId]
    );

    const journeyInsert = await db.query(
      `insert into public.journeys (title, description, team_id, created_by)
       values ($1, $2, $3, $4)
       returning id`,
      ["Sprint4 Journey", "Baseline coaching journey", ids.teamId, leaderId]
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
      [ids.milestoneId, "Lesson 1", "Lesson baseline body", 1]
    );
    ids.lessonId = lessonInsert.rows[0].id;

    const journeysOut = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(journeysOut.status === 200, `journeys list failed: ${journeysOut.status}`);
    assert(
      Array.isArray(journeysOut.data.journeys) &&
      journeysOut.data.journeys.some((j) => j.id === ids.journeyId),
      "journeys response missing seeded journey"
    );

    const journeyDetailOut = await request(`${BACKEND_URL}/api/coaching/journeys/${ids.journeyId}`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(journeyDetailOut.status === 200, `journey detail failed: ${journeyDetailOut.status}`);
    assert(
      Array.isArray(journeyDetailOut.data.milestones) &&
      journeyDetailOut.data.milestones.length >= 1,
      "journey detail missing milestones"
    );

    const progressWriteOut = await request(`${BACKEND_URL}/api/coaching/lessons/${ids.lessonId}/progress`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });
    assert(progressWriteOut.status === 200, `lesson progress update failed: ${progressWriteOut.status}`);
    assert(progressWriteOut.data.progress.status === "completed", "lesson progress status should be completed");

    const progressSummaryOut = await request(`${BACKEND_URL}/api/coaching/progress`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(progressSummaryOut.status === 200, `progress summary failed: ${progressSummaryOut.status}`);
    assert(Number(progressSummaryOut.data.status_counts.completed) >= 1, "completed progress count should be >= 1");

    const unauthorizedTeamBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({
        scope_type: "team",
        scope_id: ids.teamId,
        message_body: "member broadcast",
      }),
    });
    assert(
      unauthorizedTeamBroadcast.status === 403,
      `member team broadcast should be forbidden, got ${unauthorizedTeamBroadcast.status}`
    );

    const leaderTeamBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        scope_type: "team",
        scope_id: ids.teamId,
        message_body: "leader team broadcast",
      }),
    });
    assert(leaderTeamBroadcast.status === 201, `leader team broadcast failed: ${leaderTeamBroadcast.status}`);

    const unauthorizedGlobalBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        scope_type: "global",
        message_body: "leader global broadcast",
      }),
    });
    assert(
      unauthorizedGlobalBroadcast.status === 403,
      `leader global broadcast should be forbidden, got ${unauthorizedGlobalBroadcast.status}`
    );

    const adminGlobalBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        scope_type: "global",
        message_body: "admin global broadcast",
      }),
    });
    assert(adminGlobalBroadcast.status === 201, `admin global broadcast failed: ${adminGlobalBroadcast.status}`);

    const channelMessageCountBefore = await db.query(
      "select count(*)::int as c from public.channel_messages"
    );

    const createSuggestion1 = await request(`${BACKEND_URL}/api/ai/suggestions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        user_id: memberId,
        scope: "coaching_followup",
        proposed_message: "Nice momentum. Keep going.",
      }),
    });
    assert(createSuggestion1.status === 201, `create AI suggestion failed: ${createSuggestion1.status}`);
    assert(createSuggestion1.data.suggestion.status === "pending", "new AI suggestion should be pending");
    ids.suggestionId1 = createSuggestion1.data.suggestion.id;

    const listSuggestionsForLeader = await request(`${BACKEND_URL}/api/ai/suggestions`, {
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(listSuggestionsForLeader.status === 200, "leader suggestion list failed");
    assert(
      Array.isArray(listSuggestionsForLeader.data.suggestions) &&
      listSuggestionsForLeader.data.suggestions.some((s) => s.id === ids.suggestionId1),
      "leader suggestion list missing created suggestion"
    );

    const unauthorizedApprove = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId1}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(unauthorizedApprove.status === 403, `non-admin approve should be forbidden, got ${unauthorizedApprove.status}`);

    const approveSuggestion = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId1}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(approveSuggestion.status === 200, `admin approve failed: ${approveSuggestion.status}`);
    assert(approveSuggestion.data.suggestion.status === "approved", "approved suggestion should be approved");

    const createSuggestion2 = await request(`${BACKEND_URL}/api/ai/suggestions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        user_id: memberId,
        scope: "challenge_reengagement",
        proposed_message: "Reminder to complete your next challenge KPI.",
      }),
    });
    assert(createSuggestion2.status === 201, `create second AI suggestion failed: ${createSuggestion2.status}`);
    ids.suggestionId2 = createSuggestion2.data.suggestion.id;

    const rejectSuggestion = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId2}/reject`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(rejectSuggestion.status === 200, `admin reject failed: ${rejectSuggestion.status}`);
    assert(rejectSuggestion.data.suggestion.status === "rejected", "rejected suggestion should be rejected");

    const rejectApproved = await request(`${BACKEND_URL}/api/ai/suggestions/${ids.suggestionId1}/reject`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(rejectApproved.status === 422, `rejecting approved suggestion should be 422, got ${rejectApproved.status}`);

    const channelMessageCountAfter = await db.query(
      "select count(*)::int as c from public.channel_messages"
    );
    assert(
      Number(channelMessageCountAfter.rows[0].c) === Number(channelMessageCountBefore.rows[0].c),
      "AI suggestion approval flow should not post channel messages directly"
    );

    console.log("Sprint 4 acceptance checks passed (coaching + AI approval-first baseline).");
  } finally {
    if (dbConnected) {
      if (ids.suggestionId1 || ids.suggestionId2) {
        await db.query("delete from public.ai_suggestions where id = any($1::uuid[])", [[ids.suggestionId1, ids.suggestionId2].filter(Boolean)]);
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
