#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");
const crypto = require("crypto");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
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

  const port = Number(process.env.M6_RECIPIENT_SCOPE_TEST_PORT || 4810 + Math.floor(Math.random() * 100));
  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const runId = Date.now();
  const password = "TempPass!23456";
  const createdAuthUserIds = [];
  const created = {
    teamId: null,
    sponsorId: null,
    teamChannelId: null,
    sponsorChannelId: null,
    challengeChannelId: null,
    directChannelId: null,
    directApiChannelId: null,
  };
  const checks = [];
  let serverHandle;
  let dbConnected = false;

  const record = (persona, check, passed, detail) => {
    checks.push({ persona, check, passed, detail });
  };

  try {
    serverHandle = startServer(port);
    await waitForHealth(serverHandle.baseUrl);

    await db.connect();
    dbConnected = true;

    const coachEmail = `m6.recipient.coach.${runId}@example.com`;
    const leaderEmail = `m6.recipient.leader.${runId}@example.com`;
    const memberEmail = `m6.recipient.member.${runId}@example.com`;
    const sponsorEmail = `m6.recipient.sponsor.${runId}@example.com`;

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
       ($1, 'coach', 'M6 Scope Coach', 'active'),
       ($2, 'team_leader', 'M6 Scope Leader', 'active'),
       ($3, 'agent', 'M6 Scope Member', 'active'),
       ($4, 'challenge_sponsor', 'M6 Scope Sponsor', 'active')
       on conflict (id) do update set
         role = excluded.role,
         full_name = excluded.full_name,
         account_status = excluded.account_status`,
      [coachUserId, leaderUserId, memberUserId, sponsorUserId]
    );

    const teamOut = await db.query(
      `insert into public.teams (name, created_by) values ($1, $2) returning id`,
      [`M6 Scope Team ${runId}`, coachUserId]
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

    const teamDetail = await request(`${serverHandle.baseUrl}/teams/${created.teamId}`, {
      method: "GET",
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    record("team_leader", "GET /teams/:id returns roster summaries", teamDetail.status === 200, `status=${teamDetail.status}`);
    assert(teamDetail.status === 200, `team detail expected 200, got ${teamDetail.status}`);
    const teamMembers = Array.isArray(teamDetail.data?.members) ? teamDetail.data.members : [];
    assert(teamMembers.length >= 2, "team detail should include at least leader + member rows");
    const teamMemberIds = teamMembers.map((row) => row.user_id);
    assert(teamMemberIds.every((id) => isUuid(id)), "team detail members.user_id should be UUID values");
    const leaderSummary = teamMembers.find((row) => String(row.user_id) === String(leaderUserId));
    assert(leaderSummary, "team detail should include leader summary row");
    assert(
      typeof leaderSummary.full_name === "string" && leaderSummary.full_name.length > 0,
      "team detail leader summary should include full_name"
    );

    const directCreatePayload = {
      type: "direct",
      name: `M6 Direct API ${runId}`,
      context_id: memberUserId,
      member_user_ids: [memberUserId],
    };
    console.log("Direct create payload snippet:", JSON.stringify(directCreatePayload));
    const directCreate = await request(`${serverHandle.baseUrl}/api/channels`, {
      method: "POST",
      headers: { authorization: `Bearer ${leaderToken}`, "content-type": "application/json" },
      body: JSON.stringify(directCreatePayload),
    });
    record(
      "team_leader",
      "direct create with real roster UUID target",
      directCreate.status === 200 || directCreate.status === 201,
      `status=${directCreate.status}`
    );
    assert(
      directCreate.status === 200 || directCreate.status === 201,
      `direct create expected 200/201, got ${directCreate.status}`
    );
    assert(directCreate.data?.channel?.id, "direct create response should include channel id");
    created.directApiChannelId = directCreate.data.channel.id;

    const sponsorOut = await db.query(
      `insert into public.sponsors (name) values ($1) returning id`,
      [`M6 Scope Sponsor ${runId}`]
    );
    created.sponsorId = sponsorOut.rows[0].id;

    const teamChannelOut = await db.query(
      `insert into public.channels (type, name, team_id, created_by, is_active)
       values ('team', $1, $2, $3, true)
       returning id`,
      [`M6 Team Channel ${runId}`, created.teamId, coachUserId]
    );
    created.teamChannelId = teamChannelOut.rows[0].id;

    const sponsorChannelOut = await db.query(
      `insert into public.channels (type, name, context_id, created_by, is_active)
       values ('sponsor', $1, $2, $3, true)
       returning id`,
      [`M6 Sponsor Channel ${runId}`, created.sponsorId, coachUserId]
    );
    created.sponsorChannelId = sponsorChannelOut.rows[0].id;

    const challengeChannelOut = await db.query(
      `insert into public.channels (type, name, context_id, created_by, is_active)
       values ('challenge', $1, $2, $3, true)
       returning id`,
      [`M6 Challenge Channel ${runId}`, crypto.randomUUID(), coachUserId]
    );
    created.challengeChannelId = challengeChannelOut.rows[0].id;

    const directChannelOut = await db.query(
      `insert into public.channels (type, name, created_by, is_active)
       values ('direct', $1, $2, true)
       returning id`,
      [`M6 Direct Channel ${runId}`, coachUserId]
    );
    created.directChannelId = directChannelOut.rows[0].id;

    const membershipRows = [
      [created.teamChannelId, coachUserId, "admin"],
      [created.teamChannelId, leaderUserId, "admin"],
      [created.teamChannelId, memberUserId, "member"],
      [created.teamChannelId, sponsorUserId, "member"],
      [created.sponsorChannelId, coachUserId, "admin"],
      [created.sponsorChannelId, sponsorUserId, "admin"],
      [created.sponsorChannelId, memberUserId, "member"],
      [created.challengeChannelId, coachUserId, "admin"],
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

    const coachAdminToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${coachToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, token_purpose: "channel_admin" }),
    });
    record("coach", "channel_admin token on sponsor channel", coachAdminToken.status === 200, `status=${coachAdminToken.status}`);
    assert(coachAdminToken.status === 200, `coach channel_admin token expected 200, got ${coachAdminToken.status}`);

    const coachSync = await request(`${serverHandle.baseUrl}/api/channels/sync`, {
      method: "POST",
      headers: { authorization: `Bearer ${coachToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, sync_reason: "manual_reconcile", expected_version: 0 }),
    });
    record("coach", "sync sponsor channel", coachSync.status === 200, `status=${coachSync.status}`);
    assert(coachSync.status === 200, `coach sync expected 200, got ${coachSync.status}`);

    const coachBroadcast = await request(`${serverHandle.baseUrl}/api/channels/${created.sponsorChannelId}/broadcast`, {
      method: "POST",
      headers: { authorization: `Bearer ${coachToken}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "coach sponsor broadcast" }),
    });
    record("coach", "broadcast on sponsor channel", coachBroadcast.status === 201, `status=${coachBroadcast.status}`);
    assert(coachBroadcast.status === 201, `coach broadcast expected 201, got ${coachBroadcast.status}`);

    const leaderTeamToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${leaderToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.teamChannelId, token_purpose: "channel_admin" }),
    });
    record("team_leader", "channel_admin token on team channel", leaderTeamToken.status === 200, `status=${leaderTeamToken.status}`);
    assert(leaderTeamToken.status === 200, `team_leader team token expected 200, got ${leaderTeamToken.status}`);

    const leaderSponsorDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${leaderToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, token_purpose: "channel_admin" }),
    });
    record(
      "team_leader",
      "channel_admin token on sponsor channel denied",
      leaderSponsorDenied.status === 403 && leaderSponsorDenied.data?.error?.code === "scope_denied",
      `status=${leaderSponsorDenied.status},code=${leaderSponsorDenied.data?.error?.code ?? "none"}`
    );
    assert(leaderSponsorDenied.status === 403, `team_leader sponsor token expected 403, got ${leaderSponsorDenied.status}`);
    assert(leaderSponsorDenied.data?.error?.code === "scope_denied", "team_leader sponsor denial should return scope_denied");

    const memberDirectMessage = await request(`${serverHandle.baseUrl}/api/channels/${created.directChannelId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "member direct ping" }),
    });
    record("member", "send direct message as channel member", memberDirectMessage.status === 201, `status=${memberDirectMessage.status}`);
    assert(memberDirectMessage.status === 201, `member direct message expected 201, got ${memberDirectMessage.status}`);

    const memberTeamAdminDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.teamChannelId, token_purpose: "channel_admin" }),
    });
    record(
      "member",
      "channel_admin token denied",
      memberTeamAdminDenied.status === 403 && memberTeamAdminDenied.data?.error?.code === "scope_denied",
      `status=${memberTeamAdminDenied.status},code=${memberTeamAdminDenied.data?.error?.code ?? "none"}`
    );
    assert(memberTeamAdminDenied.status === 403, `member channel_admin token expected 403, got ${memberTeamAdminDenied.status}`);
    assert(memberTeamAdminDenied.data?.error?.code === "scope_denied", "member channel_admin denial should return scope_denied");

    const memberSponsorDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.sponsorChannelId, token_purpose: "chat_read" }),
    });
    record(
      "member",
      "sponsor channel token denied",
      memberSponsorDenied.status === 403 && memberSponsorDenied.data?.error?.code === "scope_denied",
      `status=${memberSponsorDenied.status},code=${memberSponsorDenied.data?.error?.code ?? "none"}`
    );
    assert(memberSponsorDenied.status === 403, `member sponsor token expected 403, got ${memberSponsorDenied.status}`);

    const memberBroadcastDenied = await request(`${serverHandle.baseUrl}/api/channels/${created.teamChannelId}/broadcast`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "member broadcast denied" }),
    });
    record("member", "broadcast denied", memberBroadcastDenied.status === 403, `status=${memberBroadcastDenied.status}`);
    assert(memberBroadcastDenied.status === 403, `member broadcast expected 403, got ${memberBroadcastDenied.status}`);

    const sponsorChallengeToken = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${sponsorToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.challengeChannelId, token_purpose: "chat_read" }),
    });
    record("sponsor", "challenge channel token allowed", sponsorChallengeToken.status === 200, `status=${sponsorChallengeToken.status}`);
    assert(sponsorChallengeToken.status === 200, `sponsor challenge token expected 200, got ${sponsorChallengeToken.status}`);

    const sponsorTeamDenied = await request(`${serverHandle.baseUrl}/api/channels/token`, {
      method: "POST",
      headers: { authorization: `Bearer ${sponsorToken}`, "content-type": "application/json" },
      body: JSON.stringify({ channel_id: created.teamChannelId, token_purpose: "chat_read" }),
    });
    record(
      "sponsor",
      "team channel token denied",
      sponsorTeamDenied.status === 403 && sponsorTeamDenied.data?.error?.code === "scope_denied",
      `status=${sponsorTeamDenied.status},code=${sponsorTeamDenied.data?.error?.code ?? "none"}`
    );
    assert(sponsorTeamDenied.status === 403, `sponsor team token expected 403, got ${sponsorTeamDenied.status}`);

    const sponsorBroadcast = await request(`${serverHandle.baseUrl}/api/channels/${created.challengeChannelId}/broadcast`, {
      method: "POST",
      headers: { authorization: `Bearer ${sponsorToken}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "sponsor challenge broadcast" }),
    });
    record("sponsor", "broadcast in sponsor/challenge scope", sponsorBroadcast.status === 201, `status=${sponsorBroadcast.status}`);
    assert(sponsorBroadcast.status === 201, `sponsor broadcast expected 201, got ${sponsorBroadcast.status}`);

    const byPersona = new Map();
    for (const row of checks) {
      const current = byPersona.get(row.persona) ?? { passed: 0, total: 0 };
      current.total += 1;
      if (row.passed) current.passed += 1;
      byPersona.set(row.persona, current);
    }

    console.log("M6 comms recipient scope runtime hardening acceptance passed");
    console.log("Policy matrix:");
    for (const persona of ["coach", "team_leader", "member", "sponsor"]) {
      const item = byPersona.get(persona) ?? { passed: 0, total: 0 };
      const status = item.passed === item.total ? "PASS" : "FAIL";
      console.log(`- ${persona}: ${status} (${item.passed}/${item.total})`);
    }
  } finally {
    if (dbConnected) {
      try {
        if (created.directChannelId) await db.query(`delete from public.broadcast_log where channel_id = $1`, [created.directChannelId]);
        if (created.directApiChannelId) await db.query(`delete from public.broadcast_log where channel_id = $1`, [created.directApiChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.broadcast_log where channel_id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.broadcast_log where channel_id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.broadcast_log where channel_id = $1`, [created.teamChannelId]);
        if (created.directChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.directChannelId]);
        if (created.directApiChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.directApiChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.channel_messages where channel_id = $1`, [created.teamChannelId]);
        await db.query(`delete from public.message_unreads where user_id = any($1::uuid[])`, [createdAuthUserIds]);
        if (created.directChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.directChannelId]);
        if (created.directApiChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.directApiChannelId]);
        if (created.challengeChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.challengeChannelId]);
        if (created.sponsorChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.sponsorChannelId]);
        if (created.teamChannelId) await db.query(`delete from public.channel_memberships where channel_id = $1`, [created.teamChannelId]);
        if (created.directChannelId) await db.query(`delete from public.channels where id = $1`, [created.directChannelId]);
        if (created.directApiChannelId) await db.query(`delete from public.channels where id = $1`, [created.directApiChannelId]);
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
  console.error("M6 comms recipient scope runtime hardening acceptance failed");
  console.error(error);
  process.exit(1);
});
