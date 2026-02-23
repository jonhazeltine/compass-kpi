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
  let dbConnected = false;
  let teamId = null;
  let channelId = null;

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const password = "TempPass!23456";
    const leaderEmail = `sprint3.leader.${Date.now()}@example.com`;
    const memberEmail = `sprint3.member.${Date.now()}@example.com`;
    const outsiderEmail = `sprint3.outsider.${Date.now()}@example.com`;

    const leaderId = await createAuthUser(leaderEmail, password);
    const memberId = await createAuthUser(memberEmail, password);
    const outsiderId = await createAuthUser(outsiderEmail, password);
    createdAuthUserIds.push(leaderId, memberId, outsiderId);

    const leaderToken = await signIn(leaderEmail, password);
    const memberToken = await signIn(memberEmail, password);
    const outsiderToken = await signIn(outsiderEmail, password);

    const teamOut = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ name: "Sprint3 Team" }),
    });
    assert(teamOut.status === 201, `team create failed: ${teamOut.status}`);
    teamId = teamOut.data.team.id;

    const addMemberOut = await request(`${BACKEND_URL}/teams/${teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ user_id: memberId, role: "member" }),
    });
    assert(addMemberOut.status === 201, `member add failed: ${addMemberOut.status}`);

    const channelOut = await request(`${BACKEND_URL}/api/channels`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({
        type: "team",
        name: "Team Chat",
        team_id: teamId,
      }),
    });
    assert(channelOut.status === 201, `channel create failed: ${channelOut.status}`);
    channelId = channelOut.data.channel.id;

    const addChannelMember = await db.query(
      "insert into public.channel_memberships (channel_id,user_id,role) values ($1,$2,'member') on conflict (channel_id,user_id) do update set role=excluded.role",
      [channelId, memberId]
    );
    assert(addChannelMember.rowCount >= 0, "failed to ensure member channel membership");

    // member can post message
    const memberMsg = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ body: "hello team" }),
    });
    assert(memberMsg.status === 201, `member message failed: ${memberMsg.status}`);

    // outsider cannot post or read
    const outsiderMsg = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({ body: "intrusion" }),
    });
    assert(outsiderMsg.status === 403, `outsider message should be forbidden, got ${outsiderMsg.status}`);

    const outsiderRead = await request(`${BACKEND_URL}/api/channels/${channelId}/messages`, {
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderRead.status === 403, `outsider read should be forbidden, got ${outsiderRead.status}`);

    // unread count increments for leader
    const leaderUnread = await request(`${BACKEND_URL}/api/messages/unread-count`, {
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(leaderUnread.status === 200, "leader unread fetch failed");
    assert(Number(leaderUnread.data.unread_count) >= 1, "leader unread should be >=1");

    // mark seen resets
    const markSeen = await request(`${BACKEND_URL}/api/messages/mark-seen`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ channel_id: channelId }),
    });
    assert(markSeen.status === 200, `mark seen failed: ${markSeen.status}`);
    const leaderUnreadAfter = await request(`${BACKEND_URL}/api/messages/unread-count`, {
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(leaderUnreadAfter.status === 200, "leader unread after fetch failed");
    assert(Number(leaderUnreadAfter.data.unread_count) === 0, "leader unread should be reset to 0");

    // non-leader member cannot broadcast
    const memberBroadcast = await request(`${BACKEND_URL}/api/channels/${channelId}/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${memberToken}`,
      },
      body: JSON.stringify({ body: "member broadcast" }),
    });
    assert(memberBroadcast.status === 403, `member broadcast should be forbidden, got ${memberBroadcast.status}`);

    // leader can broadcast
    const leaderBroadcast = await request(`${BACKEND_URL}/api/channels/${channelId}/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ body: "leader broadcast" }),
    });
    assert(leaderBroadcast.status === 201, `leader broadcast failed: ${leaderBroadcast.status}`);

    const logCheck = await db.query(
      "select count(*)::int as c from public.broadcast_log where channel_id = $1 and actor_user_id = $2",
      [channelId, leaderId]
    );
    assert(Number(logCheck.rows[0].c) >= 1, "broadcast audit log not written");

    // throttle check: prefill 10 logs in 24h then expect 429
    await db.query(
      `insert into public.broadcast_log (channel_id, actor_user_id, message_body, created_at)
       select $1, $2, 'prefilled', now() - interval '1 hour'
       from generate_series(1,10)`,
      [channelId, leaderId]
    );
    const throttle = await request(`${BACKEND_URL}/api/channels/${channelId}/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${leaderToken}`,
      },
      body: JSON.stringify({ body: "rate-limit-check" }),
    });
    assert(throttle.status === 429, `broadcast throttle should return 429, got ${throttle.status}`);

    // ops summaries are readable
    const s1 = await request(`${BACKEND_URL}/ops/summary/sprint1`, {
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    const s2 = await request(`${BACKEND_URL}/ops/summary/sprint2`, {
      headers: { authorization: `Bearer ${leaderToken}` },
    });
    assert(s1.status === 200 && s2.status === 200, "ops summary endpoints should return 200");

    console.log("Sprint 3 acceptance checks passed (communication baseline + ops summaries).");
  } finally {
    if (dbConnected) {
      if (channelId) {
        await db.query("delete from public.broadcast_log where channel_id = $1", [channelId]);
        await db.query("delete from public.message_unreads where channel_id = $1", [channelId]);
        await db.query("delete from public.channel_messages where channel_id = $1", [channelId]);
        await db.query("delete from public.channel_memberships where channel_id = $1", [channelId]);
        await db.query("delete from public.channels where id = $1", [channelId]);
      }
      if (teamId) {
        await db.query("delete from public.team_memberships where team_id = $1", [teamId]);
        await db.query("delete from public.teams where id = $1", [teamId]);
      }
      await db.query("delete from public.push_tokens where user_id = any($1::uuid[])", [createdAuthUserIds]);
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
