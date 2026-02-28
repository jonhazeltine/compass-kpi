#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_PORT = "4010";
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
    env: { ...process.env, HOST: "127.0.0.1", PORT: BACKEND_PORT },
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

    const password = "TempPass!23456";
    const runId = Date.now();
    const memberEmail = `coaching.member.${runId}@example.com`;
    const coachEmail = `coaching.coach.${runId}@example.com`;
    const unavailableCoachEmail = `coaching.coach.unavailable.${runId}@example.com`;

    const memberUserId = await createAuthUser(memberEmail, password);
    const coachUserId = await createAuthUser(coachEmail, password);
    const unavailableCoachUserId = await createAuthUser(unavailableCoachEmail, password);
    createdAuthUserIds.push(memberUserId, coachUserId, unavailableCoachUserId);

    const memberToken = await signIn(memberEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, is_coach, coach_specialties, coach_bio, coach_availability)
       values ($1, 'member', 'Member Zero', false, '{}', '', 'available')
       on conflict (id) do update set
         role = excluded.role,
         full_name = excluded.full_name,
         is_coach = excluded.is_coach,
         coach_specialties = excluded.coach_specialties,
         coach_bio = excluded.coach_bio,
         coach_availability = excluded.coach_availability`,
      [memberUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, is_coach, coach_specialties, coach_bio, coach_availability)
       values ($1, 'member', 'Coach One', true, '{"prospecting","mindset"}', 'Bio', 'available')
       on conflict (id) do update set
         role = excluded.role,
         full_name = excluded.full_name,
         is_coach = excluded.is_coach,
         coach_specialties = excluded.coach_specialties,
         coach_bio = excluded.coach_bio,
         coach_availability = excluded.coach_availability`,
      [coachUserId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, is_coach, coach_specialties, coach_bio, coach_availability)
       values ($1, 'member', 'Coach Two', true, '{"listings"}', 'Bio', 'unavailable')
       on conflict (id) do update set
         role = excluded.role,
         full_name = excluded.full_name,
         is_coach = excluded.is_coach,
         coach_specialties = excluded.coach_specialties,
         coach_bio = excluded.coach_bio,
         coach_availability = excluded.coach_availability`,
      [unavailableCoachUserId]
    );

    const badAvailability = await request(`${BACKEND_URL}/api/coaching/coaches?availability=idle`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(badAvailability.status === 422, `invalid availability expected 422, got ${badAvailability.status}`);

    const emptyCoaches = await request(`${BACKEND_URL}/api/coaching/coaches?specialty=never-match`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(emptyCoaches.status === 200, `coaches empty filter expected 200, got ${emptyCoaches.status}`);
    assert(Array.isArray(emptyCoaches.data.coaches) && emptyCoaches.data.coaches.length === 0, "coaches should be empty");
    assert(emptyCoaches.data.total === 0, "coaches total should be 0");
    assert(emptyCoaches.data.empty_state?.code === "no_coaches_found", "coaches empty_state code mismatch");

    const emptyEngagements = await request(`${BACKEND_URL}/api/coaching/engagements/me`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(emptyEngagements.status === 200, `engagements empty expected 200, got ${emptyEngagements.status}`);
    assert(Array.isArray(emptyEngagements.data.engagements) && emptyEngagements.data.engagements.length === 0, "engagements should be empty");
    assert(emptyEngagements.data.engagement_status === "none", "engagement_status should be none");
    assert(emptyEngagements.data.empty_state?.code === "no_engagements", "engagements empty_state code mismatch");

    const unavailableCreate = await request(`${BACKEND_URL}/api/coaching/engagements`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ coach_id: unavailableCoachUserId }),
    });
    assert(unavailableCreate.status === 409, `unavailable coach create expected 409, got ${unavailableCreate.status}`);

    const createEngagement = await request(`${BACKEND_URL}/api/coaching/engagements`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ coach_id: coachUserId }),
    });
    assert(createEngagement.status === 201, `engagement create expected 201, got ${createEngagement.status}`);
    assert(createEngagement.data?.engagement?.coach_id === coachUserId, "created engagement coach_id mismatch");

    const createConflict = await request(`${BACKEND_URL}/api/coaching/engagements`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ coach_id: coachUserId }),
    });
    assert(createConflict.status === 409, `engagement conflict expected 409, got ${createConflict.status}`);

    const emptyAssignments = await request(`${BACKEND_URL}/api/coaching/assignments/me`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert(emptyAssignments.status === 200, `assignments empty expected 200, got ${emptyAssignments.status}`);
    assert(Array.isArray(emptyAssignments.data.assignments) && emptyAssignments.data.assignments.length === 0, "assignments should be empty");
    assert(emptyAssignments.data.total === 0, "assignments total should be 0");
    assert(emptyAssignments.data.empty_state?.code === "no_assignments", "assignments empty_state code mismatch");

    console.log("Coaching endpoint hardening acceptance checks passed.");
  } finally {
    if (dbConnected) {
      if (createdAuthUserIds.length > 0) {
        await db.query("delete from public.coaching_engagements where client_id = any($1::uuid[]) or coach_id = any($1::uuid[])", [createdAuthUserIds]);
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
