#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_PORT = process.env.M6_DM_DIRECT_CHANNEL_TEST_PORT || String(4860 + Math.floor(Math.random() * 120));
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

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
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
  assert(signed.status < 300, `sign in failed: ${signed.status}`);
  return signed.data.access_token;
}

async function main() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DATABASE_URL"];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: BACKEND_PORT,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (buf) => process.stdout.write(buf));
  server.stderr.on("data", (buf) => process.stderr.write(buf));

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdAuthUserIds = [];
  const createdTeamIds = [];
  const createdChannelIds = new Set();
  let dbConnected = false;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const runId = Date.now();
    const password = "TempPass!23456";

    const leaderEmail = `m6.dm.leader.${runId}@example.com`;
    const memberEmail = `m6.dm.member.${runId}@example.com`;
    const peerEmail = `m6.dm.peer.${runId}@example.com`;
    const outsiderEmail = `m6.dm.outsider.${runId}@example.com`;
    const sponsorEmail = `m6.dm.sponsor.${runId}@example.com`;
    const coachEmail = `m6.dm.coach.${runId}@example.com`;

    const leaderId = await createAuthUser(leaderEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    const peerId = await createAuthUser(peerEmail, password);
    const outsiderId = await createAuthUser(outsiderEmail, password);
    const sponsorId = await createAuthUser(sponsorEmail, password);
    const coachId = await createAuthUser(coachEmail, password);
    createdAuthUserIds.push(leaderId, memberId, peerId, outsiderId, sponsorId, coachId);

    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const sponsorToken = await signIn(sponsorEmail, password);
    const coachToken = await signIn(coachEmail, password);

    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'team_leader', 'DM Leader', 'active')
       on conflict (id) do update set role='team_leader', full_name='DM Leader', account_status='active'`,
      [leaderId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'DM Member', 'active')
       on conflict (id) do update set role='agent', full_name='DM Member', account_status='active'`,
      [memberId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'DM Peer', 'active')
       on conflict (id) do update set role='agent', full_name='DM Peer', account_status='active'`,
      [peerId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'agent', 'DM Outsider', 'active')
       on conflict (id) do update set role='agent', full_name='DM Outsider', account_status='active'`,
      [outsiderId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'challenge_sponsor', 'DM Sponsor', 'active')
       on conflict (id) do update set role='challenge_sponsor', full_name='DM Sponsor', account_status='active'`,
      [sponsorId]
    );
    await db.query(
      `insert into public.users (id, role, full_name, account_status)
       values ($1, 'coach', 'DM Coach', 'active')
       on conflict (id) do update set role='coach', full_name='DM Coach', account_status='active'`,
      [coachId]
    );

    const teamCreate = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: `DM Team ${runId}` }),
    });
    assert(teamCreate.status === 201, `team create expected 201, got ${teamCreate.status}`);
    const teamId = teamCreate.data?.team?.id;
    assert(teamId, "team create missing team id");
    createdTeamIds.push(teamId);

    const addMember = async (userId, role = "member") => {
      const added = await request(`${BACKEND_URL}/teams/${teamId}/members`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${leaderToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ user_id: userId, role }),
      });
      assert(added.status === 201, `team member add failed for ${userId}: ${added.status}`);
    };

    await addMember(memberId, "member");
    await addMember(peerId, "member");

    const directCreate = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [memberId],
      }),
    });
    if (directCreate.status !== 201) {
      console.log("directCreate failure payload", directCreate.data);
    }
    assert(directCreate.status === 201, `leader direct channel create expected 201, got ${directCreate.status}`);
    assert(directCreate.data?.idempotent_replay === false, "first direct create should not be idempotent replay");
    const directChannelId = directCreate.data?.channel?.id;
    assert(directChannelId, "direct create missing channel id");
    createdChannelIds.add(directChannelId);

    const directCreateReplay = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [memberId],
      }),
    });
    assert(directCreateReplay.status === 200, `direct channel replay expected 200, got ${directCreateReplay.status}`);
    assert(directCreateReplay.data?.idempotent_replay === true, "replay create should mark idempotent_replay=true");
    assert(
      directCreateReplay.data?.channel?.id === directChannelId,
      "replay create should return existing direct channel id"
    );

    const membershipRows = await db.query(
      `select user_id, role from public.channel_memberships where channel_id = $1 order by user_id`,
      [directChannelId]
    );
    assert(membershipRows.rows.length === 2, "direct channel should have exactly two channel_memberships");
    const membershipByUser = new Map(membershipRows.rows.map((row) => [String(row.user_id), String(row.role)]));
    assert(membershipByUser.get(leaderId) === "admin", "leader should be direct-channel admin");
    assert(membershipByUser.get(memberId) === "member", "target should be direct-channel member");

    const unreadRows = await db.query(`select user_id, unread_count from public.message_unreads where channel_id = $1`, [directChannelId]);
    assert(unreadRows.rows.length === 2, "direct channel should initialize unread rows for all members");

    const memberPeerDm = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [peerId],
      }),
    });
    assert(memberPeerDm.status === 201, `member->peer same-team direct create expected 201, got ${memberPeerDm.status}`);
    createdChannelIds.add(memberPeerDm.data?.channel?.id);

    const memberOutOfScopeDm = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [outsiderId],
      }),
    });
    assert(memberOutOfScopeDm.status === 403, `member->outsider direct create should be 403, got ${memberOutOfScopeDm.status}`);

    const invalidUserIdDm = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${leaderToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: ["not-a-uuid"],
      }),
    });
    assert(invalidUserIdDm.status === 422, `invalid member_user_ids format should be 422, got ${invalidUserIdDm.status}`);

    const sponsorDm = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sponsorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [memberId],
      }),
    });
    assert(sponsorDm.status === 403, `challenge_sponsor direct create should be 403, got ${sponsorDm.status}`);

    const coachDm = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${coachToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "direct",
        member_user_ids: [outsiderId],
      }),
    });
    assert(coachDm.status === 201, `coach direct create to outsider expected 201, got ${coachDm.status}`);
    createdChannelIds.add(coachDm.data?.channel?.id);

    console.log("M6 DM direct channel create backend acceptance passed");
  } finally {
    if (dbConnected) {
      try {
        if (createdChannelIds.size > 0) {
          await db.query(`delete from public.message_unreads where channel_id = any($1::uuid[])`, [Array.from(createdChannelIds)]);
          await db.query(`delete from public.channel_memberships where channel_id = any($1::uuid[])`, [Array.from(createdChannelIds)]);
          await db.query(`delete from public.channel_messages where channel_id = any($1::uuid[])`, [Array.from(createdChannelIds)]);
          await db.query(`delete from public.channels where id = any($1::uuid[])`, [Array.from(createdChannelIds)]);
        }
        if (createdTeamIds.length > 0) {
          await db.query(`delete from public.team_memberships where team_id = any($1::uuid[])`, [createdTeamIds]);
          await db.query(`delete from public.teams where id = any($1::uuid[])`, [createdTeamIds]);
        }
      } catch (cleanupError) {
        console.error("cleanup warning", cleanupError);
      }
      await db.end().catch(() => {});
    }

    for (const userId of createdAuthUserIds) {
      await deleteAuthUser(userId).catch(() => {});
    }

    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
