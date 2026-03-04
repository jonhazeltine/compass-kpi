#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { Client } = require("pg");

function toMs(value) {
  const ms = new Date(String(value ?? "")).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isSeedName(name) {
  const raw = String(name ?? "");
  return /^Seed:/i.test(raw) || /^Seed Sample .* Team Sprint Challenge \(/i.test(raw);
}

function pickSlot(rows, slot, nowMs) {
  const decorated = rows
    .map((row) => {
      const startMs = toMs(row.start_at);
      const endMs = toMs(row.end_at);
      if (startMs == null || endMs == null) return null;
      return {
        row,
        startMs,
        endMs,
        isSeed: isSeedName(row.name),
      };
    })
    .filter(Boolean);

  const preferNonSeed = (a, b) => Number(a.isSeed) - Number(b.isSeed);

  if (slot === "completed") {
    return (
      decorated
        .filter((entry) => entry.endMs < nowMs)
        .sort((a, b) => {
          const seedDelta = preferNonSeed(a, b);
          if (seedDelta !== 0) return seedDelta;
          return b.endMs - a.endMs;
        })[0]?.row ?? null
    );
  }
  if (slot === "active") {
    return (
      decorated
        .filter((entry) => entry.startMs <= nowMs && entry.endMs >= nowMs)
        .sort((a, b) => {
          const seedDelta = preferNonSeed(a, b);
          if (seedDelta !== 0) return seedDelta;
          return a.startMs - b.startMs;
        })[0]?.row ?? null
    );
  }
  return (
    decorated
      .filter((entry) => entry.startMs > nowMs)
      .sort((a, b) => {
        const seedDelta = preferNonSeed(a, b);
        if (seedDelta !== 0) return seedDelta;
        return a.startMs - b.startMs;
      })[0]?.row ?? null
  );
}

async function main() {
  if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error("SUPABASE_DATABASE_URL is required");
  }
  const db = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
  await db.connect();

  try {
    const now = new Date();
    const nowMs = now.getTime();
    const { rows: seededRows } = await db.query(
      `select id, team_id, name, start_at, end_at
       from public.challenges
       where mode = 'team'
         and is_active = true
         and team_id is not null
         and (
           name ilike 'Seed:%'
           or name ilike 'Seed Sample % Team Sprint Challenge (%)'
         )`
    );

    if (!seededRows.length) {
      console.log("No active seeded team challenges found. Nothing to clean.");
      return;
    }

    const teamIds = Array.from(new Set(seededRows.map((row) => String(row.team_id ?? "")).filter(Boolean)));
    const { rows: teamChallengeRows } = await db.query(
      `select id, team_id, name, start_at, end_at
       from public.challenges
       where mode = 'team'
         and is_active = true
         and team_id = any($1::uuid[])`,
      [teamIds]
    );

    const byTeam = new Map();
    for (const row of teamChallengeRows) {
      const teamId = String(row.team_id ?? "");
      const list = byTeam.get(teamId) ?? [];
      list.push(row);
      byTeam.set(teamId, list);
    }

    const keepIds = new Set();
    for (const rows of byTeam.values()) {
      const keepCompleted = pickSlot(rows, "completed", nowMs);
      const keepActive = pickSlot(rows, "active", nowMs);
      const keepUpcomingCandidate = pickSlot(rows, "upcoming", nowMs);
      const activeEndMs = keepActive ? toMs(keepActive.end_at) : null;
      const upcomingStartMs = keepUpcomingCandidate ? toMs(keepUpcomingCandidate.start_at) : null;
      const keepUpcoming =
        keepUpcomingCandidate &&
        (activeEndMs == null || upcomingStartMs == null || upcomingStartMs > activeEndMs)
          ? keepUpcomingCandidate
          : null;

      [keepCompleted, keepActive, keepUpcoming].forEach((row) => {
        if (!row) return;
        const id = String(row.id ?? "");
        if (id) keepIds.add(id);
      });
    }

    const deactivateIds = seededRows
      .map((row) => String(row.id ?? ""))
      .filter((id) => id && !keepIds.has(id));

    if (deactivateIds.length === 0) {
      console.log(`Seed cleanup complete. Active seeded rows already within limits across ${teamIds.length} team(s).`);
      return;
    }

    await db.query(
      `update public.challenges
       set is_active = false
       where id = any($1::uuid[])`,
      [deactivateIds]
    );

    console.log(
      `Seed cleanup complete. Deactivated ${deactivateIds.length} seeded team challenge(s) across ${teamIds.length} team(s).`
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("m6 team challenge seed cleanup failed:", err);
  process.exit(1);
});
