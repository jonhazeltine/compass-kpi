#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");
const { Client } = require("pg");

const BACKEND_URL = "http://127.0.0.1:4000";
const PASSWORD = "TempPass!23456";
const LABEL_PREFIX = "Seed Sample Coaching";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function topLevelKeys(data) {
  return data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).sort() : [];
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
  const out = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(out.status < 300, `create auth user failed (${email}): ${out.status}`);
  return out.data.id;
}

async function signIn(email, password) {
  const out = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  assert(out.status < 300, `sign in failed (${email}): ${out.status}`);
  assert(out.data.access_token, `missing access token for ${email}`);
  return out.data.access_token;
}

async function main() {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DATABASE_URL",
  ];
  for (const key of required) assert(process.env[key], `${key} is required`);

  const stamp = Date.now();
  const seedTag = `seed-${stamp}`;

  const emails = {
    coach: `${seedTag}.coach@example.com`,
    leader: `${seedTag}.coachleader@example.com`,
    member: `${seedTag}.coachmember@example.com`,
    solo: `${seedTag}.coachsolo@example.com`,
    sponsor: `${seedTag}.challengesponsor@example.com`,
  };

  const ids = {
    coachUserId: null,
    leaderUserId: null,
    memberUserId: null,
    soloUserId: null,
    sponsorUserId: null,
    teamId: null,
    challengeId: null,
    sponsorId: null,
    journeys: [],
    channels: [],
    sponsoredChallenges: [],
    kpis: {},
  };

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[backend] ${String(chunk)}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[backend] ${String(chunk)}`));

  const db = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  let dbConnected = false;
  const diagnostics = {
    seed_tag: seedTag,
    endpoint_snapshots: {},
    checks: [],
  };
  function recordEndpoint(endpoint, out) {
    diagnostics.endpoint_snapshots[endpoint] = {
      status: out.status,
      top_level_keys: topLevelKeys(out.data),
      journeys_count: asArray(out.data?.journeys).length,
      channels_count: asArray(out.data?.channels).length,
      sponsored_challenges_count: asArray(out.data?.sponsored_challenges).length,
      loggable_kpis_count: asArray(out.data?.loggable_kpis).length,
    };
  }
  function check(id, condition, message, details = {}) {
    diagnostics.checks.push({ id, ok: Boolean(condition), details });
    if (!condition) {
      const err = new Error(message);
      err.details = { id, ...details };
      throw err;
    }
  }

  try {
    await waitForHealth();
    await db.connect();
    dbConnected = true;

    const tableCheck = await db.query(
      `select
        to_regclass('public.journeys')::text as journeys,
        to_regclass('public.milestones')::text as milestones,
        to_regclass('public.lessons')::text as lessons,
        to_regclass('public.lesson_progress')::text as lesson_progress,
        to_regclass('public.channels')::text as channels,
        to_regclass('public.channel_messages')::text as channel_messages`
    );
    const t = tableCheck.rows[0];
    assert(t.journeys === "journeys", "Missing coaching tables. Apply backend/sql/006_sprint4_coaching_ai_core.sql.");
    assert(t.channels === "channels", "Missing communication tables. Apply backend/sql/005_sprint3_communication_core.sql.");

    ids.coachUserId = await createAuthUser(emails.coach, PASSWORD);
    ids.leaderUserId = await createAuthUser(emails.leader, PASSWORD);
    ids.memberUserId = await createAuthUser(emails.member, PASSWORD);
    ids.soloUserId = await createAuthUser(emails.solo, PASSWORD);
    ids.sponsorUserId = await createAuthUser(emails.sponsor, PASSWORD);

    const tokens = {
      coach: await signIn(emails.coach, PASSWORD),
      leader: await signIn(emails.leader, PASSWORD),
      member: await signIn(emails.member, PASSWORD),
      solo: await signIn(emails.solo, PASSWORD),
      sponsor: await signIn(emails.sponsor, PASSWORD),
    };

    await db.query(
      `insert into public.users (id, role)
       values ($1,'admin'), ($2,'agent'), ($3,'agent'), ($4,'agent'), ($5,'agent')
       on conflict (id) do update set role = excluded.role`,
      [ids.coachUserId, ids.leaderUserId, ids.memberUserId, ids.soloUserId, ids.sponsorUserId]
    );
    await db.query(
      `update public.users
       set tier = case
         when id = $1 then 'enterprise'
         when id = $2 then 'teams'
         when id = $3 then 'free'
         when id = $4 then 'teams'
         when id = $5 then 'enterprise'
         else tier
       end
       where id in ($1, $2, $3, $4, $5)`,
      [ids.coachUserId, ids.leaderUserId, ids.memberUserId, ids.soloUserId, ids.sponsorUserId]
    );

    const teamOut = await request(`${BACKEND_URL}/teams`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.leader}`,
      },
      body: JSON.stringify({ name: `${LABEL_PREFIX} Team ${stamp}` }),
    });
    assert(teamOut.status === 201, `team create failed: ${teamOut.status}`);
    ids.teamId = teamOut.data.team.id;

    const addMember = await request(`${BACKEND_URL}/teams/${ids.teamId}/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.leader}`,
      },
      body: JSON.stringify({ user_id: ids.memberUserId }),
    });
    assert(addMember.status === 201, `team member add failed: ${addMember.status}`);

    const challengeInsert = await db.query(
      `insert into public.challenges (name, description, mode, is_active, start_at, end_at, team_id, created_by)
       values ($1, $2, 'team', true, now() - interval '2 days', now() + interval '21 days', $3, $4)
       returning id, name`,
      [
        `${LABEL_PREFIX} Team Sprint Challenge (${seedTag})`,
        "Seeded challenge linked to sponsored coaching content.",
        ids.teamId,
        ids.leaderUserId,
      ]
    );
    ids.challengeId = challengeInsert.rows[0].id;

    // Team-scoped journey for leader/member visibility and package read model coverage.
    const teamJourneyInsert = await db.query(
      `insert into public.journeys (title, description, team_id, created_by, is_active)
       values ($1, $2, $3, $4, true)
       returning id, title`,
      [
        `${LABEL_PREFIX}: Prospecting Reset (${seedTag})`,
        "Seeded team coaching journey with mixed lesson progress states for runtime UI review.",
        ids.teamId,
        ids.leaderUserId,
      ]
    );
    const teamJourney = { id: teamJourneyInsert.rows[0].id, title: teamJourneyInsert.rows[0].title };
    ids.journeys.push(teamJourney);

    const milestoneRows = [];
    for (const [title, sortOrder] of [
      ["Week 1: Pipeline Foundations", 1],
      ["Week 2: Follow-up Discipline", 2],
    ]) {
      const out = await db.query(
        `insert into public.milestones (journey_id, title, sort_order)
         values ($1, $2, $3)
         returning id, title, sort_order`,
        [teamJourney.id, title, sortOrder]
      );
      milestoneRows.push(out.rows[0]);
    }

    const lessonRows = [];
    const lessonBlueprints = [
      [milestoneRows[0].id, "Call Block Setup", "Create a 60-minute power block and define your call list.", 1],
      [milestoneRows[0].id, "First 25 Outreach Attempts", "Complete first outreach set and note objections.", 2],
      [milestoneRows[1].id, "Follow-up Cadence", "Apply a two-touch follow-up cadence to warm leads.", 1],
      [milestoneRows[1].id, "Conversation Scorecard", "Review conversation quality and next-step rates.", 2],
    ];
    for (const [milestoneId, title, body, sortOrder] of lessonBlueprints) {
      const out = await db.query(
        `insert into public.lessons (milestone_id, title, body, sort_order, is_active)
         values ($1, $2, $3, $4, true)
         returning id, milestone_id, title`,
        [milestoneId, title, body, sortOrder]
      );
      lessonRows.push(out.rows[0]);
    }

    // Member progress: explicit examples of all three states.
    const now = new Date();
    await db.query(
      `insert into public.lesson_progress (lesson_id, user_id, status, completed_at, updated_at)
       values
         ($1, $4, 'completed', $5, $6),
         ($2, $4, 'in_progress', null, $6),
         ($3, $4, 'not_started', null, $6)
       on conflict (lesson_id, user_id) do update
       set status = excluded.status,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
      [
        lessonRows[0].id,
        lessonRows[1].id,
        lessonRows[2].id,
        ids.memberUserId,
        new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        now.toISOString(),
      ]
    );

    // Leader sees one in-progress row too.
    await db.query(
      `insert into public.lesson_progress (lesson_id, user_id, status, completed_at, updated_at)
       values ($1, $2, 'in_progress', null, $3)
       on conflict (lesson_id, user_id) do update
       set status = excluded.status, completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
      [lessonRows[3].id, ids.leaderUserId, now.toISOString()]
    );

    // Solo/global journey for solo persona baseline list/detail visibility.
    const soloJourneyInsert = await db.query(
      `insert into public.journeys (title, description, team_id, created_by, is_active)
       values ($1, $2, null, $3, true)
       returning id, title`,
      [
        `${LABEL_PREFIX}: Solo Momentum Builder (${seedTag})`,
        "Seeded solo coaching journey for non-team scoped visibility checks.",
        ids.coachUserId,
      ]
    );
    const soloJourney = { id: soloJourneyInsert.rows[0].id, title: soloJourneyInsert.rows[0].title };
    ids.journeys.push(soloJourney);

    const soloMilestone = await db.query(
      `insert into public.milestones (journey_id, title, sort_order)
       values ($1, $2, 1)
       returning id`,
      [soloJourney.id, "Solo Sprint"]
    );
    const soloLesson = await db.query(
      `insert into public.lessons (milestone_id, title, body, sort_order, is_active)
       values ($1, $2, $3, 1, true)
       returning id`,
      [soloMilestone.rows[0].id, "Daily Review Ritual", "Use a 10-minute closeout checklist after activity blocks."]
    );
    await db.query(
      `insert into public.lesson_progress (lesson_id, user_id, status, completed_at, updated_at)
       values ($1, $2, 'completed', $3, $4)
       on conflict (lesson_id, user_id) do update
       set status = excluded.status, completed_at = excluded.completed_at, updated_at = excluded.updated_at`,
      [soloLesson.rows[0].id, ids.soloUserId, now.toISOString(), now.toISOString()]
    );

    // Sponsor realism: one sponsor with free + teams sponsored challenge visibility examples.
    const sponsorInsert = await db.query(
      `insert into public.sponsors (name, logo_url, brand_color, is_active)
       values ($1, $2, $3, true)
       returning id, name`,
      [
        `${LABEL_PREFIX} Sponsor (${seedTag})`,
        "https://example.com/seed-sponsor-logo.png",
        "#1F4EBF",
      ]
    );
    ids.sponsorId = sponsorInsert.rows[0].id;

    const sponsoredChallengeRows = await db.query(
      `insert into public.sponsored_challenges (
         sponsor_id, challenge_id, name, description, reward_text, cta_label, cta_url, disclaimer, required_tier, start_at, end_at, is_active
       )
       values
         ($1, $2, $3, $4, $5, $6, $7, $8, 'free', now() - interval '1 day', now() + interval '20 days', true),
         ($1, $2, $9, $10, $11, $12, $13, $14, 'teams', now() - interval '1 day', now() + interval '20 days', true)
       returning id, name, required_tier`,
      [
        ids.sponsorId,
        ids.challengeId,
        `${LABEL_PREFIX} Free Tier Sprint (${seedTag})`,
        "Seeded free-tier sponsor challenge for runtime visibility checks.",
        "Coffee voucher",
        "Join Free Sponsor Sprint",
        "https://example.com/sponsor/free",
        "Seed sponsor disclaimer (free tier)",
        `${LABEL_PREFIX} Teams Tier Sprint (${seedTag})`,
        "Seeded teams-tier sponsor challenge for tier-gated visibility checks.",
        "Coaching stipend",
        "Unlock Teams Sprint",
        "https://example.com/sponsor/teams",
        "Seed sponsor disclaimer (teams tier)",
      ]
    );
    ids.sponsoredChallenges = sponsoredChallengeRows.rows;

    // Channels/messages: team + sponsor for message thread and sponsor/package attribution visibility.
    const channelInserts = [
      {
        type: "team",
        name: `${LABEL_PREFIX} Team Coaching Room (${seedTag})`,
        teamId: ids.teamId,
        contextId: null,
        createdBy: ids.leaderUserId,
      },
      {
        type: "sponsor",
        name: `${LABEL_PREFIX} Sponsor Coaching Bulletin (${seedTag})`,
        teamId: ids.teamId,
        contextId: ids.sponsoredChallenges.find((row) => row.required_tier === "free")?.id ?? ids.challengeId,
        createdBy: ids.sponsorUserId,
      },
      {
        type: "cohort",
        name: `${LABEL_PREFIX} Cohort Coaching Circle (${seedTag})`,
        teamId: ids.teamId,
        contextId: teamJourney.id,
        createdBy: ids.leaderUserId,
      },
    ];
    for (const ch of channelInserts) {
      const out = await db.query(
        `insert into public.channels (type, name, team_id, context_id, created_by, is_active)
         values ($1, $2, $3, $4, $5, true)
         returning id, type, name`,
        [ch.type, ch.name, ch.teamId, ch.contextId, ch.createdBy]
      );
      ids.channels.push(out.rows[0]);
    }

    const teamChannel = ids.channels.find((c) => c.type === "team");
    const sponsorChannel = ids.channels.find((c) => c.type === "sponsor");
    const cohortChannel = ids.channels.find((c) => c.type === "cohort");
    assert(teamChannel, "seeded team channel missing");
    assert(sponsorChannel, "seeded sponsor channel missing");
    assert(cohortChannel, "seeded cohort channel missing");

    const membershipRows = [
      [teamChannel.id, ids.leaderUserId, "admin"],
      [teamChannel.id, ids.memberUserId, "member"],
      [sponsorChannel.id, ids.memberUserId, "member"],
      [sponsorChannel.id, ids.sponsorUserId, "admin"],
      [cohortChannel.id, ids.leaderUserId, "admin"],
      [cohortChannel.id, ids.memberUserId, "member"],
      [cohortChannel.id, ids.soloUserId, "member"],
    ];
    for (const [channelId, userId, role] of membershipRows) {
      await db.query(
        `insert into public.channel_memberships (channel_id, user_id, role)
         values ($1, $2, $3)
         on conflict (channel_id, user_id) do update set role = excluded.role`,
        [channelId, userId, role]
      );
      await db.query(
        `insert into public.message_unreads (channel_id, user_id, unread_count, last_seen_at, updated_at)
         values ($1, $2, 0, now(), now())
         on conflict (channel_id, user_id) do update set updated_at = excluded.updated_at`,
        [channelId, userId]
      );
    }

    await db.query(
      `insert into public.channel_messages (channel_id, sender_user_id, body, message_type)
       values
         ($1, $2, $3, 'message'),
         ($1, $4, $5, 'message'),
         ($6, $7, $8, 'broadcast'),
         ($6, $4, $9, 'message'),
         ($10, $2, $11, 'message'),
         ($10, $4, $12, 'message')`,
      [
        teamChannel.id,
        ids.leaderUserId,
        `${LABEL_PREFIX}: Welcome to the team coaching room. Use this thread for weekly wins + blockers.`,
        ids.memberUserId,
        `${LABEL_PREFIX}: I completed the first call block and logged notes for objection patterns.`,
        sponsorChannel.id,
        ids.sponsorUserId,
        `${LABEL_PREFIX}: Sponsor spotlight coaching tip of the week is now available.`,
        `${LABEL_PREFIX}: Thanks — reviewing the sponsor challenge prep guide tonight.`,
        cohortChannel.id,
        `${LABEL_PREFIX}: Cohort check-in prompt — share one conversion blocker for peer feedback.`,
        `${LABEL_PREFIX}: I need objection-handling reps for price resistance conversations.`,
      ]
    );

    // KPI visibility examples for dashboard loggable KPI checks (active vs inactive).
    const kpiRows = await db.query(
      `insert into public.kpis (name, type, requires_direct_value_input, is_active)
       values
         ($1, 'Custom', true, true),
         ($2, 'Custom', false, false)
       returning id, name, is_active`,
      [
        `${LABEL_PREFIX} Member Value Capture (${seedTag})`,
        `${LABEL_PREFIX} Hidden Deprecated KPI (${seedTag})`,
      ]
    );
    for (const row of kpiRows.rows) {
      if (row.is_active) ids.kpis.activeCustomId = row.id;
      else ids.kpis.inactiveCustomId = row.id;
    }
    assert(ids.kpis.activeCustomId, "missing active sample KPI");
    assert(ids.kpis.inactiveCustomId, "missing inactive sample KPI");

    // Endpoint smoke verification for required families.
    const memberJourneys = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint("member:/api/coaching/journeys", memberJourneys);
    assert(memberJourneys.status === 200, `/api/coaching/journeys failed: ${memberJourneys.status}`);
    assert(Array.isArray(memberJourneys.data.journeys), "journeys payload missing journeys[]");
    const teamJourneyListItem = memberJourneys.data.journeys.find((j) => j.id === teamJourney.id);
    assert(teamJourneyListItem, "member journeys list missing seeded team journey");
    assert(teamJourneyListItem.packaging_read_model, "journeys list missing packaging_read_model");

    const teamJourneyDetail = await request(`${BACKEND_URL}/api/coaching/journeys/${teamJourney.id}`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint(`member:/api/coaching/journeys/${teamJourney.id}`, teamJourneyDetail);
    assert(teamJourneyDetail.status === 200, `/api/coaching/journeys/:id failed: ${teamJourneyDetail.status}`);
    assert(Array.isArray(teamJourneyDetail.data.milestones) && teamJourneyDetail.data.milestones.length >= 2, "journey detail missing seeded milestones");
    const detailLessons = teamJourneyDetail.data.milestones.flatMap((m) => m.lessons || []);
    assert(detailLessons.some((l) => l.progress_status === "in_progress"), "journey detail missing in_progress lesson");
    assert(detailLessons.some((l) => l.progress_status === "completed"), "journey detail missing completed lesson");

    const memberProgress = await request(`${BACKEND_URL}/api/coaching/progress`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint("member:/api/coaching/progress", memberProgress);
    assert(memberProgress.status === 200, `/api/coaching/progress failed: ${memberProgress.status}`);
    assert(Number(memberProgress.data.status_counts.in_progress) >= 1, "progress summary missing in_progress count");
    assert(Number(memberProgress.data.status_counts.completed) >= 1, "progress summary missing completed count");
    assert(Number(memberProgress.data.status_counts.not_started) >= 1, "progress summary missing not_started count");

    const coachJourneys = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${tokens.coach}` },
    });
    recordEndpoint("coach:/api/coaching/journeys", coachJourneys);
    assert(coachJourneys.status === 200, `/api/coaching/journeys failed (coach): ${coachJourneys.status}`);
    assert(
      coachJourneys.data.journeys.some((j) => j.id === teamJourney.id) &&
      coachJourneys.data.journeys.some((j) => j.id === soloJourney.id),
      "coach should see both team and solo journeys"
    );

    const leaderJourneys = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${tokens.leader}` },
    });
    recordEndpoint("leader:/api/coaching/journeys", leaderJourneys);
    assert(leaderJourneys.status === 200, `/api/coaching/journeys failed (leader): ${leaderJourneys.status}`);
    assert(
      leaderJourneys.data.journeys.some((j) => j.id === teamJourney.id),
      "team leader should see team journey"
    );

    const sponsorJourneys = await request(`${BACKEND_URL}/api/coaching/journeys`, {
      headers: { authorization: `Bearer ${tokens.sponsor}` },
    });
    recordEndpoint("challenge_sponsor:/api/coaching/journeys", sponsorJourneys);
    assert(sponsorJourneys.status === 200, `/api/coaching/journeys failed (challenge sponsor): ${sponsorJourneys.status}`);
    assert(
      !sponsorJourneys.data.journeys.some((j) => j.id === teamJourney.id),
      "challenge sponsor should not see team journey without team membership"
    );
    assert(
      sponsorJourneys.data.journeys.some((j) => j.id === soloJourney.id),
      "challenge sponsor should still see non-team scoped solo journey"
    );

    const memberChannels = await request(`${BACKEND_URL}/api/channels`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint("member:/api/channels", memberChannels);
    assert(memberChannels.status === 200, `/api/channels failed: ${memberChannels.status}`);
    assert(Array.isArray(memberChannels.data.channels), "channels payload missing channels[]");
    const sponsorChannelListItem = memberChannels.data.channels.find((c) => c.id === sponsorChannel.id);
    const cohortChannelListItem = memberChannels.data.channels.find((c) => c.id === cohortChannel.id);
    assert(sponsorChannelListItem, "member channels list missing seeded sponsor channel");
    assert(cohortChannelListItem, "member channels list missing seeded cohort channel");
    assert(
      sponsorChannelListItem.packaging_read_model?.display_requirements?.sponsor_attribution_required === true,
      "sponsor channel packaging attribution flag missing"
    );
    assert(
      String(cohortChannelListItem.packaging_read_model?.package_type ?? "") === "",
      "cohort channel should remain package_type null in baseline read model"
    );

    const sponsorChannels = await request(`${BACKEND_URL}/api/channels`, {
      headers: { authorization: `Bearer ${tokens.sponsor}` },
    });
    recordEndpoint("challenge_sponsor:/api/channels", sponsorChannels);
    assert(sponsorChannels.status === 200, `/api/channels failed (challenge sponsor): ${sponsorChannels.status}`);
    assert(
      sponsorChannels.data.channels.some((c) => c.id === sponsorChannel.id),
      "challenge sponsor should see sponsor channel membership"
    );
    assert(
      !sponsorChannels.data.channels.some((c) => c.id === teamChannel.id),
      "challenge sponsor should not see team channel without membership"
    );

    const coachChannels = await request(`${BACKEND_URL}/api/channels`, {
      headers: { authorization: `Bearer ${tokens.coach}` },
    });
    recordEndpoint("coach:/api/channels", coachChannels);
    assert(coachChannels.status === 200, `/api/channels failed (coach): ${coachChannels.status}`);

    const teamChannelMessages = await request(`${BACKEND_URL}/api/channels/${teamChannel.id}/messages`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint(`member:/api/channels/${teamChannel.id}/messages`, teamChannelMessages);
    assert(teamChannelMessages.status === 200, `/api/channels/:id/messages failed: ${teamChannelMessages.status}`);
    assert(Array.isArray(teamChannelMessages.data.messages), "channel messages payload missing messages[]");
    assert(teamChannelMessages.data.messages.length >= 2, "seeded message thread should contain messages");

    const cohortChannelMessages = await request(`${BACKEND_URL}/api/channels/${cohortChannel.id}/messages`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint(`member:/api/channels/${cohortChannel.id}/messages`, cohortChannelMessages);
    assert(cohortChannelMessages.status === 200, `/api/channels/:id/messages (cohort) failed: ${cohortChannelMessages.status}`);
    assert(Array.isArray(cohortChannelMessages.data.messages), "cohort channel messages payload missing messages[]");
    assert(cohortChannelMessages.data.messages.length >= 2, "seeded cohort thread should contain messages");

    const memberDashboard = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint("member:/dashboard", memberDashboard);
    assert(memberDashboard.status === 200, `/dashboard failed: ${memberDashboard.status}`);
    assert(Array.isArray(memberDashboard.data.loggable_kpis), "dashboard payload missing loggable_kpis[]");
    assert(
      memberDashboard.data.loggable_kpis.some((kpi) => kpi.id === ids.kpis.activeCustomId),
      "dashboard loggable_kpis missing active seeded KPI"
    );
    assert(
      !memberDashboard.data.loggable_kpis.some((kpi) => kpi.id === ids.kpis.inactiveCustomId),
      "dashboard loggable_kpis should not include inactive seeded KPI"
    );

    const sponsorDashboard = await request(`${BACKEND_URL}/dashboard`, {
      headers: { authorization: `Bearer ${tokens.sponsor}` },
    });
    recordEndpoint("challenge_sponsor:/dashboard", sponsorDashboard);
    assert(sponsorDashboard.status === 200, `/dashboard failed (challenge sponsor): ${sponsorDashboard.status}`);
    assert(Array.isArray(sponsorDashboard.data.loggable_kpis), "challenge sponsor dashboard missing loggable_kpis[]");
    assert(
      sponsorDashboard.data.loggable_kpis.some((kpi) => kpi.id === ids.kpis.activeCustomId),
      "challenge sponsor dashboard should include active seeded KPI"
    );
    assert(
      !sponsorDashboard.data.loggable_kpis.some((kpi) => kpi.id === ids.kpis.inactiveCustomId),
      "challenge sponsor dashboard should not include inactive seeded KPI"
    );

    const memberSponsoredList = await request(`${BACKEND_URL}/sponsored-challenges`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint("member:/sponsored-challenges", memberSponsoredList);
    assert(memberSponsoredList.status === 200, `/sponsored-challenges failed (member): ${memberSponsoredList.status}`);
    assert(Array.isArray(memberSponsoredList.data.sponsored_challenges), "sponsored challenges payload missing sponsored_challenges[]");
    const freeSponsored = ids.sponsoredChallenges.find((row) => row.required_tier === "free");
    const teamsSponsored = ids.sponsoredChallenges.find((row) => row.required_tier === "teams");
    assert(freeSponsored, "missing free-tier sponsored seed row");
    assert(teamsSponsored, "missing teams-tier sponsored seed row");
    assert(
      memberSponsoredList.data.sponsored_challenges.some((row) => row.id === freeSponsored.id),
      "free-tier sponsored challenge should be visible to free member"
    );
    assert(
      !memberSponsoredList.data.sponsored_challenges.some((row) => row.id === teamsSponsored.id),
      "teams-tier sponsored challenge should be hidden from free member"
    );

    const soloSponsoredList = await request(`${BACKEND_URL}/sponsored-challenges`, {
      headers: { authorization: `Bearer ${tokens.solo}` },
    });
    recordEndpoint("leader_like:/sponsored-challenges", soloSponsoredList);
    assert(soloSponsoredList.status === 200, `/sponsored-challenges failed (teams user): ${soloSponsoredList.status}`);
    assert(
      soloSponsoredList.data.sponsored_challenges.some((row) => row.id === freeSponsored.id) &&
      soloSponsoredList.data.sponsored_challenges.some((row) => row.id === teamsSponsored.id),
      "teams-tier user should see both free and teams sponsored challenges"
    );

    const sponsorSponsoredList = await request(`${BACKEND_URL}/sponsored-challenges`, {
      headers: { authorization: `Bearer ${tokens.sponsor}` },
    });
    recordEndpoint("challenge_sponsor:/sponsored-challenges", sponsorSponsoredList);
    assert(sponsorSponsoredList.status === 200, `/sponsored-challenges failed (challenge sponsor): ${sponsorSponsoredList.status}`);
    assert(
      sponsorSponsoredList.data.sponsored_challenges.some((row) => row.id === freeSponsored.id) &&
      sponsorSponsoredList.data.sponsored_challenges.some((row) => row.id === teamsSponsored.id),
      "challenge sponsor should see both free and teams sponsored challenges"
    );

    const sponsorDetail = await request(`${BACKEND_URL}/sponsored-challenges/${freeSponsored.id}`, {
      headers: { authorization: `Bearer ${tokens.member}` },
    });
    recordEndpoint(`member:/sponsored-challenges/${freeSponsored.id}`, sponsorDetail);
    assert(sponsorDetail.status === 200, `/sponsored-challenges/:id failed: ${sponsorDetail.status}`);
    assert(
      sponsorDetail.data.sponsored_challenge?.packaging_read_model?.display_requirements?.sponsor_attribution_required === true,
      "sponsored challenge detail should carry sponsor attribution requirement"
    );

    const memberTeamBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.member}`,
      },
      body: JSON.stringify({
        scope_type: "team",
        scope_id: ids.teamId,
        message_body: `${LABEL_PREFIX}: member team broadcast should be blocked`,
      }),
    });
    assert(memberTeamBroadcast.status === 403, `member team broadcast should be forbidden, got ${memberTeamBroadcast.status}`);

    const leaderTeamBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.leader}`,
      },
      body: JSON.stringify({
        scope_type: "team",
        scope_id: ids.teamId,
        message_body: `${LABEL_PREFIX}: leader team broadcast allowed`,
      }),
    });
    assert(leaderTeamBroadcast.status === 201, `leader team broadcast should succeed, got ${leaderTeamBroadcast.status}`);

    const sponsorTeamBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.sponsor}`,
      },
      body: JSON.stringify({
        scope_type: "team",
        scope_id: ids.teamId,
        message_body: `${LABEL_PREFIX}: challenge sponsor team broadcast should be blocked`,
      }),
    });
    assert(sponsorTeamBroadcast.status === 403, `challenge sponsor team broadcast should be forbidden, got ${sponsorTeamBroadcast.status}`);

    const coachGlobalBroadcast = await request(`${BACKEND_URL}/api/coaching/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.coach}`,
      },
      body: JSON.stringify({
        scope_type: "global",
        message_body: `${LABEL_PREFIX}: coach global broadcast visibility check`,
      }),
    });
    assert(coachGlobalBroadcast.status === 201, `coach global broadcast should succeed, got ${coachGlobalBroadcast.status}`);

    check(
      "contract.member.channels.shape",
      topLevelKeys(memberChannels.data).includes("channels"),
      "Contract mismatch: /api/channels missing channels key for member",
      { keys: topLevelKeys(memberChannels.data) }
    );
    check(
      "contract.member.sponsored.shape",
      topLevelKeys(memberSponsoredList.data).includes("sponsored_challenges"),
      "Contract mismatch: /sponsored-challenges missing sponsored_challenges key for member",
      { keys: topLevelKeys(memberSponsoredList.data) }
    );
    check(
      "contract.member.dashboard.shape",
      topLevelKeys(memberDashboard.data).includes("loggable_kpis"),
      "Contract mismatch: /dashboard missing loggable_kpis for member",
      { keys: topLevelKeys(memberDashboard.data) }
    );
    check(
      "visibility.member.channels.count",
      asArray(memberChannels.data.channels).length >= 3,
      "Member should see seeded team+sponsor+cohort channels",
      { count: asArray(memberChannels.data.channels).length }
    );
    check(
      "visibility.challenge_sponsor.channels.count",
      asArray(sponsorChannels.data.channels).length === 1,
      "Challenge sponsor should only see sponsor channel membership in seeded baseline",
      { count: asArray(sponsorChannels.data.channels).length }
    );
    check(
      "visibility.coach.channels.count",
      (() => {
        const coachChannels = diagnostics.endpoint_snapshots["coach:/api/channels"];
        return Boolean(coachChannels) && coachChannels.channels_count === 0;
      })(),
      "Coach (admin) should not implicitly inherit team/sponsor channel memberships in seeded baseline",
      { coach_snapshot: diagnostics.endpoint_snapshots["coach:/api/channels"] ?? null }
    );

    const summary = {
      seed_tag: seedTag,
      users: {
        coach: { email: emails.coach, id: ids.coachUserId },
        leader: { email: emails.leader, id: ids.leaderUserId },
        member: { email: emails.member, id: ids.memberUserId },
        solo: { email: emails.solo, id: ids.soloUserId },
        challenge_sponsor: { email: emails.sponsor, id: ids.sponsorUserId },
      },
      team: { id: ids.teamId },
      challenge: { id: ids.challengeId },
      sponsor: { id: ids.sponsorId },
      journeys: ids.journeys,
      channels: ids.channels,
      sponsored_challenges: ids.sponsoredChallenges,
      kpi_visibility_examples: ids.kpis,
      verified_endpoints: [
        "/api/coaching/journeys",
        `/api/coaching/journeys/${teamJourney.id}`,
        "/api/coaching/progress",
        "/api/coaching/broadcast",
        "/dashboard",
        "/api/channels",
        `/api/channels/${teamChannel.id}/messages`,
        `/api/channels/${cohortChannel.id}/messages`,
        "/sponsored-challenges",
        `/sponsored-challenges/${freeSponsored.id}`,
      ],
      examples_verified: {
        active_journey: true,
        in_progress_lesson: true,
        completed_lesson: true,
        message_thread_with_messages: true,
        cohort_thread_with_messages: true,
        sponsor_package_attribution_visible: true,
        sponsored_tier_gating_visible: true,
        member_kpi_visibility_examples: true,
        role_visibility_outcomes: true,
      },
      cleanup_hint: `Delete rows with names/titles containing '${seedTag}' and auth users with emails starting '${seedTag}.'`,
    };

    console.log(JSON.stringify(summary, null, 2));
    console.log("Coaching sample content seed + endpoint smoke checks passed.");
  } catch (err) {
    console.error("Coaching seed validation diagnostics:");
    console.error(JSON.stringify(diagnostics, null, 2));
    if (err && typeof err === "object" && "details" in err) {
      console.error(`Failure details: ${JSON.stringify(err.details)}`);
    }
    throw err;
  } finally {
    if (dbConnected) await db.end();
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
