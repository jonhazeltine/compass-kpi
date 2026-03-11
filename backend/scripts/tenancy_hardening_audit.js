#!/usr/bin/env node
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const dc = createClient(supabaseUrl, serviceRole);

function isSchemaGap(error) {
  if (!error) return false;
  const code = String(error.code || "");
  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }
  const message = String(error.message || "").toLowerCase();
  return message.includes("does not exist") || message.includes("could not find");
}

async function hasColumns(table, columns) {
  const { error } = await dc.from(table).select(columns.join(",")).limit(1);
  return !isSchemaGap(error);
}

async function countNullOrg(table) {
  const { count, error } = await dc.from(table).select("*", { count: "exact", head: true }).is("org_id", null);
  if (error) throw error;
  return Number(count || 0);
}

async function fetchRows(table, columns, limit = 5000) {
  const { data, error } = await dc.from(table).select(columns.join(",")).limit(limit);
  if (error) throw error;
  return data || [];
}

async function main() {
  const checks = [];
  let failures = 0;

  const requiredTables = [
    ["organizations", ["id", "name", "org_type"]],
    ["users", ["id", "org_id"]],
    ["teams", ["id", "org_id", "created_by"]],
    ["channels", ["id", "org_id", "team_id", "created_by"]],
    ["journeys", ["id", "org_id", "team_id", "created_by"]],
    ["coaching_engagements", ["id", "org_id", "coach_id", "client_id"]],
    ["challenges", ["id", "org_id", "team_id", "created_by"]],
    ["challenge_participants", ["id", "org_id", "challenge_id", "user_id", "sponsored_challenge_id"]],
    ["sponsors", ["id", "org_id"]],
    ["sponsored_challenges", ["id", "org_id", "sponsor_id"]],
    ["broadcast_campaigns", ["id", "org_id", "actor_user_id"]],
    ["broadcast_deliveries", ["id", "org_id", "campaign_id", "recipient_user_id"]],
  ];

  const optionalTables = [
    ["coaching_media_assets", ["media_id", "org_id", "owner_user_id", "journey_id", "channel_id"]],
  ];

  const available = new Map();

  for (const [table, columns] of requiredTables) {
    const ok = await hasColumns(table, columns);
    available.set(table, ok);
    if (!ok) {
      failures += 1;
      checks.push({ type: "missing", table, detail: `required columns missing: ${columns.join(", ")}` });
    }
  }

  for (const [table, columns] of optionalTables) {
    const ok = await hasColumns(table, columns);
    available.set(table, ok);
    if (!ok) {
      failures += 1;
      checks.push({ type: "missing", table, detail: `expected optional/high-risk table missing org columns: ${columns.join(", ")}` });
    }
  }

  for (const [table, columns] of [...requiredTables, ...optionalTables]) {
    if (!columns.includes("org_id")) continue;
    if (!available.get(table)) continue;
    const nullCount = await countNullOrg(table);
    if (nullCount > 0) {
      failures += 1;
      checks.push({ type: "null_org", table, detail: `${nullCount} rows with null org_id` });
    }
  }

  if (available.get("users") && available.get("teams")) {
    const [users, teams] = await Promise.all([
      fetchRows("users", ["id", "org_id"]),
      fetchRows("teams", ["id", "org_id", "created_by"]),
    ]);
    const userOrg = new Map(users.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = teams.filter((row) => {
      const createdByOrg = userOrg.get(String(row.created_by || "")) || "";
      return createdByOrg && String(row.org_id || "") !== createdByOrg;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "teams", detail: `${mismatches} teams do not match creator org_id` });
    }
  }

  if (available.get("teams") && available.get("channels")) {
    const [teams, channels] = await Promise.all([
      fetchRows("teams", ["id", "org_id"]),
      fetchRows("channels", ["id", "org_id", "team_id"]),
    ]);
    const teamOrg = new Map(teams.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = channels.filter((row) => {
      const teamId = String(row.team_id || "");
      if (!teamId) return false;
      const expected = teamOrg.get(teamId) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "channels", detail: `${mismatches} team-scoped channels do not match team org_id` });
    }
  }

  if (available.get("teams") && available.get("journeys")) {
    const [teams, journeys] = await Promise.all([
      fetchRows("teams", ["id", "org_id"]),
      fetchRows("journeys", ["id", "org_id", "team_id"]),
    ]);
    const teamOrg = new Map(teams.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = journeys.filter((row) => {
      const teamId = String(row.team_id || "");
      if (!teamId) return false;
      const expected = teamOrg.get(teamId) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "journeys", detail: `${mismatches} team-scoped journeys do not match team org_id` });
    }
  }

  if (available.get("users") && available.get("coaching_engagements")) {
    const [users, engagements] = await Promise.all([
      fetchRows("users", ["id", "org_id"]),
      fetchRows("coaching_engagements", ["id", "org_id", "coach_id"]),
    ]);
    const userOrg = new Map(users.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = engagements.filter((row) => {
      const expected = userOrg.get(String(row.coach_id || "")) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "coaching_engagements", detail: `${mismatches} engagements do not match coach org_id` });
    }
  }

  if (available.get("sponsors") && available.get("sponsored_challenges")) {
    const [sponsors, sponsoredChallenges] = await Promise.all([
      fetchRows("sponsors", ["id", "org_id"]),
      fetchRows("sponsored_challenges", ["id", "org_id", "sponsor_id"]),
    ]);
    const sponsorOrg = new Map(sponsors.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = sponsoredChallenges.filter((row) => {
      const expected = sponsorOrg.get(String(row.sponsor_id || "")) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "sponsored_challenges", detail: `${mismatches} sponsored challenges do not match sponsor org_id` });
    }
  }

  if (available.get("challenges") && available.get("challenge_participants")) {
    const [challenges, participants] = await Promise.all([
      fetchRows("challenges", ["id", "org_id"]),
      fetchRows("challenge_participants", ["id", "org_id", "challenge_id"]),
    ]);
    const challengeOrg = new Map(challenges.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = participants.filter((row) => {
      const expected = challengeOrg.get(String(row.challenge_id || "")) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "challenge_participants", detail: `${mismatches} challenge participants do not match challenge org_id` });
    }
  }

  if (available.get("broadcast_campaigns") && available.get("broadcast_deliveries")) {
    const [campaigns, deliveries] = await Promise.all([
      fetchRows("broadcast_campaigns", ["id", "org_id"]),
      fetchRows("broadcast_deliveries", ["id", "org_id", "campaign_id"]),
    ]);
    const campaignOrg = new Map(campaigns.map((row) => [String(row.id), String(row.org_id || "")]));
    const mismatches = deliveries.filter((row) => {
      const expected = campaignOrg.get(String(row.campaign_id || "")) || "";
      return expected && String(row.org_id || "") !== expected;
    }).length;
    if (mismatches > 0) {
      failures += 1;
      checks.push({ type: "mismatch", table: "broadcast_deliveries", detail: `${mismatches} deliveries do not match campaign org_id` });
    }
  }

  console.log("TENANCY HARDENING AUDIT");
  console.log("=======================");
  if (checks.length === 0) {
    console.log("PASS: org_id ownership and high-risk relationship checks are clean.");
  } else {
    for (const check of checks) {
      console.log(`FAIL [${check.type}] ${check.table}: ${check.detail}`);
    }
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("TENANCY AUDIT FAILED", error?.message || error);
  process.exit(1);
});
