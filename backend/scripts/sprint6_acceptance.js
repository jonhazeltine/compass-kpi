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
    sponsorId: null,
    sponsoredChallengeId: null,
    challengeId: null,
  };
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const migrationCheck = await db.query(
      "select to_regclass('public.sponsored_challenges')::text as sponsored_challenges_table"
    );
    assert(
      migrationCheck.rows[0].sponsored_challenges_table === "sponsored_challenges",
      "Sprint 6 tables missing. Apply backend/sql/007_sprint6_sponsored_and_offline_core.sql first."
    );

    const password = "TempPass!23456";
    const freeEmail = `sprint6.free.${Date.now()}@example.com`;
    const basicEmail = `sprint6.basic.${Date.now()}@example.com`;

    const freeUserId = await createAuthUser(freeEmail, password);
    const basicUserId = await createAuthUser(basicEmail, password);
    createdAuthUserIds.push(freeUserId, basicUserId);

    const freeToken = await signIn(freeEmail, password);
    const basicToken = await signIn(basicEmail, password);

    await db.query("insert into public.users (id, tier) values ($1, 'free') on conflict (id) do update set tier='free'", [freeUserId]);
    await db.query("insert into public.users (id, tier) values ($1, 'basic') on conflict (id) do update set tier='basic'", [basicUserId]);

    const challengeInsert = await db.query(
      `insert into public.challenges (name, description, mode, is_active, start_at, end_at, created_by)
       values ($1,$2,'solo',true,now() - interval '1 day', now() + interval '10 day',$3)
       returning id`,
      ["Sprint6 Sponsored Challenge", "Sponsor test challenge", basicUserId]
    );
    ids.challengeId = challengeInsert.rows[0].id;

    const callsMade = await db.query("select id from public.kpis where name='Calls Made' limit 1");
    assert(callsMade.rows[0]?.id, "Calls Made KPI seed missing");
    await db.query("insert into public.challenge_kpis (challenge_id, kpi_id) values ($1,$2)", [
      ids.challengeId,
      callsMade.rows[0].id,
    ]);

    const sponsorInsert = await db.query(
      `insert into public.sponsors (name, logo_url, brand_color, is_active)
       values ($1,$2,$3,true)
       returning id`,
      [`Sprint6 Sponsor ${Date.now()}`, "https://example.com/logo.png", "#123456"]
    );
    ids.sponsorId = sponsorInsert.rows[0].id;

    const sponsoredChallengeInsert = await db.query(
      `insert into public.sponsored_challenges
       (sponsor_id, challenge_id, name, description, reward_text, cta_label, cta_url, disclaimer, required_tier, start_at, end_at, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'basic', now() - interval '1 day', now() + interval '5 day', true)
       returning id`,
      [
        ids.sponsorId,
        ids.challengeId,
        "Sprint6 Sponsored Offer",
        "Sponsored challenge details",
        "$100 Gift Card",
        "Learn More",
        "https://example.com/cta",
        "Sponsored disclaimer",
      ]
    );
    ids.sponsoredChallengeId = sponsoredChallengeInsert.rows[0].id;

    const freeList = await request(`${BACKEND_URL}/sponsored-challenges`, {
      headers: { authorization: `Bearer ${freeToken}` },
    });
    assert(freeList.status === 200, `free tier sponsored list failed: ${freeList.status}`);
    assert(
      !freeList.data.sponsored_challenges.some((c) => c.id === ids.sponsoredChallengeId),
      "free tier should not see basic-tier sponsored challenge"
    );

    const basicList = await request(`${BACKEND_URL}/sponsored-challenges`, {
      headers: { authorization: `Bearer ${basicToken}` },
    });
    assert(basicList.status === 200, `basic tier sponsored list failed: ${basicList.status}`);
    assert(
      basicList.data.sponsored_challenges.some((c) => c.id === ids.sponsoredChallengeId),
      "basic tier should see sponsored challenge"
    );

    const freeDetail = await request(`${BACKEND_URL}/sponsored-challenges/${ids.sponsoredChallengeId}`, {
      headers: { authorization: `Bearer ${freeToken}` },
    });
    assert(freeDetail.status === 403, `free tier sponsored detail should be 403, got ${freeDetail.status}`);

    const basicDetail = await request(`${BACKEND_URL}/sponsored-challenges/${ids.sponsoredChallengeId}`, {
      headers: { authorization: `Bearer ${basicToken}` },
    });
    assert(basicDetail.status === 200, `basic tier sponsored detail should be 200, got ${basicDetail.status}`);

    const joinSponsored = await request(`${BACKEND_URL}/challenge-participants`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${basicToken}`,
      },
      body: JSON.stringify({
        challenge_id: ids.challengeId,
        sponsored_challenge_id: ids.sponsoredChallengeId,
      }),
    });
    assert(joinSponsored.status === 201, `sponsored join should be 201, got ${joinSponsored.status}`);

    const participantCheck = await db.query(
      "select sponsored_challenge_id from public.challenge_participants where challenge_id=$1 and user_id=$2",
      [ids.challengeId, basicUserId]
    );
    assert(
      participantCheck.rows[0]?.sponsored_challenge_id === ids.sponsoredChallengeId,
      "challenge participant should persist sponsored_challenge_id"
    );

    const idemKey = `sprint6-batch-${Date.now()}`;
    const batchOut = await request(`${BACKEND_URL}/kpi-logs/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${basicToken}`,
      },
      body: JSON.stringify({
        logs: [
          { kpi_id: callsMade.rows[0].id, event_timestamp: new Date().toISOString(), logged_value: 1, idempotency_key: idemKey },
          { kpi_id: callsMade.rows[0].id, event_timestamp: new Date().toISOString(), logged_value: 1, idempotency_key: idemKey },
          { kpi_id: callsMade.rows[0].id, event_timestamp: new Date().toISOString(), logged_value: 2, idempotency_key: `${idemKey}-2` },
        ],
      }),
    });
    assert(batchOut.status === 200, `kpi batch endpoint should return 200, got ${batchOut.status}`);
    assert(Number(batchOut.data.summary.created) === 2, "batch should create two logs");
    assert(Number(batchOut.data.summary.duplicates) === 1, "batch should include one duplicate");
    assert(Number(batchOut.data.summary.failed) === 0, "batch should have zero failed entries");

    console.log("Sprint 6 acceptance checks passed (sponsored challenges + offline batch ingest baseline).");
  } finally {
    if (dbConnected) {
      if (ids.challengeId) {
        await db.query("delete from public.challenge_participants where challenge_id = $1", [ids.challengeId]);
        await db.query("delete from public.challenge_kpis where challenge_id = $1", [ids.challengeId]);
        await db.query("delete from public.challenges where id = $1", [ids.challengeId]);
      }
      if (ids.sponsoredChallengeId) {
        await db.query("delete from public.sponsored_challenges where id = $1", [ids.sponsoredChallengeId]);
      }
      if (ids.sponsorId) {
        await db.query("delete from public.sponsors where id = $1", [ids.sponsorId]);
      }
      if (createdAuthUserIds.length > 0) {
        await db.query("delete from public.kpi_logs where user_id = any($1::uuid[])", [createdAuthUserIds]);
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
