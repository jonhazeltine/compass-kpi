#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");
const crypto = require("crypto");

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
  throw new Error(`backend health check timed out for ${baseUrl}`);
}

function startServer(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      STREAM_PROVIDER_MODE: "mock",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (buf) => process.stdout.write(buf));
  server.stderr.on("data", (buf) => process.stderr.write(buf));
  return { server, baseUrl };
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
  assert(created.status < 300, `create user failed (${email}): ${created.status}`);
  return created.data.id;
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
  assert(signed.data.access_token, "missing access token");
  return signed.data.access_token;
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

  const randomizedBase = 4600 + Math.floor(Math.random() * 200);
  const port = Number(process.env.W13_STREAM_POLICY_TEST_PORT || randomizedBase);
  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const runId = Date.now();
  const password = "TempPass!23456";
  const createdAuthUserIds = [];
  let serverHandle;
  let dbConnected = false;
  const created = {
    teamId: null,
    sponsorId: null,
    teamChannelId: null,
    sponsorChannelId: null,
    challengeChannelId: null,
    directChannelId: null,
  };

  try {
    serverHandle = startServer(port);
    await waitForHealth(serverHandle.baseUrl);

    await db.connect();
    dbConnected = true;

    const coachEmail = `w13.policy.coach.${runId}@example.com`;
    const leaderEmail = `w13.policy.leader.${runId}@example.com`;
    const memberEmail = `w13.policy.member.${runId}@example.com`;
    const sponsorEmail = `w13.policy.sponsor.${runId}@example.com`;

    const coachUserId = await createAuthUser(coachEmail, password);
    const leaderUserId = await createAuthUser(leaderEmail, password);
    const memberUserId = await createAuthUser(memberEmail, password);
    const sponsorUserId = await createAuthUser(sponsorEmail, password);
    createdAuthUserIds.push(coachUserId, leaderUserId, memberUserId, sponsorUserId);

    const coachToken = await signIn(coachEmail, password);
    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const sponsorToken = await signIn(sponsorEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values
       ($1, 'coach', 'W13 Policy Coach', 'active'),
       ($2, 'team_leader', 'W13 Policy Leader', 'active'),
       ($3, 'agent', 'W13 Policy Member', 'active'),
       ($4, 'challenge_sponsor', 'W13 Policy Sponsor', 'active')
       on conflict (id) do update set
         role = excluded.role,
         full_name = excluded.full_name,
         account_status = excluded.account_status`,
      [coachUserId, leaderUserId, memberUserId, sponsorUserId]
    );

    const teamOut = await db.query(
      `insert into public.teams (name, created_by)
       values ($1, $2)
       returning id`,
      [`W13 Policy Team ${runId}`, coachUserId]
    );
    created.teamId = teamOut.rows[0].id;

    await db.query(
      `insert into public.team_memberships (team_id, user_id, role)
       values
       ($1, $2, 'team_leader'),
       ($1, $3, 'member')
       on conflict (team_id, user_id) do update set role = excluded.role`,
      [created.teamId, leaderUserId, memberUserId]
    );

    const sponsorOut = await db.query(
      `insert into public.sponsors (name)
       values ($1)
       returning id`,
      [`W13 Policy Sponsor ${runId}`]
    );
    created.sponsorId = sponsorOut.rows[0].id;

    const teamChannelOut = await db.query(
      `insert into public.channels (type, name, team_id, created_by, is_active)
       values ('team', $1, $2, $3, true)
       returning id`,
      [`W13 Team Channel ${runId}`, created.teamId, coachUserId]
    );
    created.teamChannelId = teamChannelOut.rows[0].id;

    const sponsorChannelOut = await db.query(
      `insert into public.channels (type, name, context_id, created_by, is_active)
       values ('sponsor', $1, $2, $3, true)
       returning id`,
      [`W13 Sponsor Channel ${runId}`, created.sponsorId, coachUserId]
    );
    created.sponsorChannelId = sponsorChannelOut.rows[0].id;

    const challengeChannelOut = await db.query(
      `insert into public.channels (type, name, context_id, created_by, is_active)
       values ('challenge', $1, $2, $3, true)
       returning id`,
      [`W13 Challenge Channel ${runId}`, crypto.randomUUID(), coachUserId]
    );
    created.challengeChannelId = challengeChannelOut.rows[0].id;

    const directChannelOut = await db.query(
      `insert into public.channels (type, name, created_by, is_active)
       values ('direct', $1, $2, true)
       returning id`,
      [`W13 Direct Channel ${runId}`, coachUserId]
    );
    created.directChannelId = directChannelOut.rows[0].id;

    const membershipRows = [
      [created.teamChannelId, leaderUserId, "admin"],
      [created.teamChannelId, memberUserId, "member"],
      [created.teamChannelId, sponsorUserId, "member"],
      [created.sponsorChannelId, coachUserId, "admin"],
      [created.sponsorChannelId, sponsorUserId, "admin"],
      [created.sponsorChannelId, memberUserId, "member"],
      [created.challengeChannelId, sponsorUserId, "admin"],
      [created.challengeChannelId, leaderUserId, "admin"],
      [created.directChannelId, leaderUserId, "admin"],
      [created.directChannelId, memberUserId, "member"],
    ];
    for (const [channelId, userId, role] of membershipRows) {
      await db.query(
        `insert into public.channel_memberships (channel_id, user_id, role)
         values ($1, $2, $3)
         on conflict (channel_id, user_id) do update set role = excluded.role`,
        [channelId, userId, role]
      );
    }

    const leaderTeamToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel_id: created.teamChannelId, token_purpose: "chat_read" }),
    });
    assert(leaderTeamToken.status === 200, `team_leader team token expected 200, got ${leaderTeamToken.status}`);

    const coachSponsorToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, token_purpose: "chat_write" }),
    });
    assert(coachSponsorToken.status === 200, `coach sponsor token expected 200, got ${coachSponsorToken.status}`);

    const memberDirectMessage = await request(`${serverHandle.baseUrl}/api/channels/${created.directChannelId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "member direct ping" }),
    });
    assert(memberDirectMessage.status === 201, `member direct message expected 201, got ${memberDirectMessage.status}`);

    const memberSponsorDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, token_purpose: "chat_read" }),
    });
    assert(memberSponsorDenied.status === 403, `member sponsor token expected 403, got ${memberSponsorDenied.status}`);
    assert(memberSponsorDenied.data?.error?.code === "scope_denied", "member sponsor token should use scope_denied");

    const sponsorChallengeToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sponsorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel_id: created.challengeChannelId, token_purpose: "chat_read" }),
    });
    assert(sponsorChallengeToken.status === 200, `sponsor challenge token expected 200, got ${sponsorChallengeToken.status}`);

    const sponsorTeamDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sponsorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel_id: created.teamChannelId, token_purpose: "chat_read" }),
    });
    assert(sponsorTeamDenied.status === 403, `sponsor team token expected 403, got ${sponsorTeamDenied.status}`);
    assert(sponsorTeamDenied.data?.error?.code === "scope_denied", "sponsor team token should use scope_denied");

    const sponsorTeamThreadDenied = await request(`${serverHandle.baseUrl}/api/channels/${created.teamChannelId}/messages`, {
      method: "GET",
      headers: { authorization: `Bearer ${sponsorToken}` },
    });
    assert(sponsorTeamThreadDenied.status === 403, `sponsor team thread expected 403, got ${sponsorTeamThreadDenied.status}`);

    const leaderSponsorSyncDenied = await request(`${serverHandle.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: created.sponsorChannelId,
        sync_reason: "manual_reconcile",
      }),
    });
    assert(leaderSponsorSyncDenied.status === 403, `team_leader sponsor sync expected 403, got ${leaderSponsorSyncDenied.status}`);
    assert(leaderSponsorSyncDenied.data?.error?.code === "scope_denied", "team_leader sponsor sync should use scope_denied");

    const leaderTeamSyncOk = await request(`${serverHandle.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        channel_id: created.teamChannelId,
        sync_reason: "manual_reconcile",
        expected_version: 0,
      }),
    });
    assert(leaderTeamSyncOk.status === 200, `team_leader team sync expected 200, got ${leaderTeamSyncOk.status}`);
    assert(leaderTeamSyncOk.data.sync_status === "synced", "team_leader sync should return synced");

    console.log("W13 Stream comms role policy hardening acceptance passed");
  } finally {
    if (dbConnected) {
      try {
        if (created.directChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.directChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.teamChannelId]);
        await db.query(`delete from public.message_unreads where user_id = any($1::uuid[])`, [createdAuthUserIds]);
        if (created.directChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.directChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.teamChannelId]);
        if (created.directChannelId) await db.query(`delete from public.channels where id = $1`, [created.directChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.channels where id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.channels where id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.channels where id = $1`, [created.teamChannelId]);
        if (created.sponsorId) await db.query(`delete from public.sponsors where id = $1`, [created.sponsorId]);
        if (created.teamId) await db.query(`delete from public.team_memberships where team_id = $1`, [created.teamId]);
        if (created.teamId) await db.query(`delete from public.teams where id = $1`, [created.teamId]);
        await db.query(`delete from public.users where id = any($1::uuid[])`, [createdAuthUserIds]);
      } finally {
        await db.end().catch(() => {});
      }
    }
    for (const userId of createdAuthUserIds) {
      await deleteAuthUser(userId).catch(() => {});
    }
    if (serverHandle?.server) {
      serverHandle.server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("W13 Stream comms role policy hardening acceptance failed");
  console.error(error);
  process.exit(1);
});
