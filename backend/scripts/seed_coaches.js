#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Seed fake coach profiles into the users table.
 *
 * Usage:
 *   node backend/scripts/seed_coaches.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env (or .env file).
 * Creates auth users + marks them as coaches with specialties/bio/availability.
 */
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.COACH_SEED_PASSWORD;

if (!SUPABASE_URL || !SERVICE_KEY || !PASSWORD) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COACH_SEED_PASSWORD");
  process.exit(1);
}

const coaches = [
  {
    email: "coach.sarah.wellbeing@example.com",
    full_name: "Sarah Chen",
    specialties: ["Wellness", "Stress Management", "Work-Life Balance"],
    bio: "Certified wellness coach with 12 years of experience helping professionals find balance. Specializing in burnout prevention and mindful leadership.",
    availability: "available",
  },
  {
    email: "coach.marcus.performance@example.com",
    full_name: "Marcus Rivera",
    specialties: ["Sales Performance", "Pipeline Management", "Goal Setting"],
    bio: "Former VP of Sales turned executive coach. I help sales teams crush their targets through disciplined goal-setting and accountability frameworks.",
    availability: "available",
  },
  {
    email: "coach.priya.leadership@example.com",
    full_name: "Priya Patel",
    specialties: ["Leadership Development", "Team Building", "Executive Presence"],
    bio: "ICF-certified leadership coach. I partner with emerging and established leaders to develop authentic leadership styles that inspire teams.",
    availability: "available",
  },
  {
    email: "coach.james.fitness@example.com",
    full_name: "James Okafor",
    specialties: ["Fitness", "Nutrition", "Habit Formation"],
    bio: "NASM-certified personal trainer and nutrition coach. Building sustainable health habits for busy professionals, one day at a time.",
    availability: "waitlist",
  },
  {
    email: "coach.elena.career@example.com",
    full_name: "Elena Vasquez",
    specialties: ["Career Transitions", "Resume Strategy", "Interview Prep"],
    bio: "Career strategist who has helped 500+ professionals navigate job changes, promotions, and industry pivots. Let's map your next move.",
    availability: "available",
  },
  {
    email: "coach.david.financial@example.com",
    full_name: "David Kim",
    specialties: ["Financial Wellness", "Budgeting", "Real Estate Investing"],
    bio: "CFP® and real estate investor. I coach individuals and teams on building wealth through smart financial habits and investment literacy.",
    availability: "unavailable",
  },
];

const ALLOWED_AVAILABILITY = new Set(["available", "waitlist", "unavailable"]);

async function authRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}

async function ensureAuthUser(email) {
  // Try to create user
  const create = await authRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {},
    }),
  });
  if (create.status === 200 || create.status === 201) {
    return create.data.id;
  }
  // Already exists — list and find
  const list = await authRequest(`/auth/v1/admin/users?page=1&per_page=1000`);
  if (list.status === 200 && Array.isArray(list.data?.users)) {
    const found = list.data.users.find((u) => u.email === email);
    if (found) return found.id;
  }
  throw new Error(`Failed to create/find auth user ${email}: ${JSON.stringify(create.data)}`);
}

async function upsertProfile(userId, coach) {
  const availability = String(coach.availability || "").toLowerCase();
  if (!ALLOWED_AVAILABILITY.has(availability)) {
    console.error(`  ✗ Invalid availability "${coach.availability}" for ${coach.full_name}`);
    return false;
  }
  const specialties = Array.isArray(coach.specialties)
    ? coach.specialties.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : [];
  if (specialties.length === 0) {
    console.error(`  ✗ Coach ${coach.full_name} must include at least one specialty`);
    return false;
  }

  // Use the REST API to upsert into public.users
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      full_name: coach.full_name,
      is_coach: true,
      coach_specialties: specialties,
      coach_bio: coach.bio,
      coach_availability: availability,
    }),
  });
  const text = await res.text();
  if (res.status >= 300) {
    // Maybe user row doesn't exist yet — try insert
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: userId,
        full_name: coach.full_name,
        is_coach: true,
        coach_specialties: specialties,
        coach_bio: coach.bio,
        coach_availability: availability,
      }),
    });
    const insertText = await insertRes.text();
    if (insertRes.status >= 300) {
      console.error(`  ✗ Failed to upsert profile for ${coach.full_name}: ${insertText}`);
      return false;
    }
  }
  return true;
}

async function main() {
  console.log("Seeding coach profiles...\n");
  let seededCount = 0;
  let failedCount = 0;

  for (const coach of coaches) {
    process.stdout.write(`  ${coach.full_name} (${coach.email})... `);
    try {
      const userId = await ensureAuthUser(coach.email);
      const ok = await upsertProfile(userId, coach);
      if (ok) {
        seededCount += 1;
        console.log(`ok ${coach.availability}`);
      } else {
        failedCount += 1;
      }
    } catch (err) {
      failedCount += 1;
      console.error(`✗ ${err.message}`);
    }
  }

  console.log("\nCoach seeding complete.");
  console.log(`  processed: ${coaches.length}`);
  console.log(`  seeded: ${seededCount}`);
  console.log(`  failed: ${failedCount}`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
