/**
 * KPI Slug Migration Script
 *
 * Applies all approved mappings:
 * - Known renames (same KPI, cleaner slug)
 * - Type changes (GP → PC for listing_presentation, buyer_consultation, cma_prepared)
 * - Deactivations (platform-specific social posts, legacy/broken slugs, test data)
 *
 * Run: npx tsx backend/scripts/run-kpi-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey);

// ── All approved mappings ──

// Known renames: DB slug → { new_slug, new_name, new_icon }
const RENAMES: Record<string, { slug: string; name: string; icon?: string }> = {
  // PC renames
  phone_call_logged:          { slug: "phone_call",          name: "Phone Call",          icon: "phone" },
  door_knock_logged:          { slug: "door_knock",          name: "Door Knock",          icon: "hand-waving" },
  open_house_logged:          { slug: "open_house",          name: "Open House Held",     icon: "door-open" },
  fsbo_expired_call:          { slug: "fsbo_call",           name: "FSBO Call",           icon: "megaphone-simple" },

  // GP renames
  listing_video_created:      { slug: "listing_video",       name: "Listing Video Created",   icon: "video-camera" },
  script_practice_session:    { slug: "script_practiced",    name: "Script Practiced",        icon: "microphone-stage" },
  market_stats_review_weekly: { slug: "market_update",       name: "Market Update Shared",    icon: "chart-line-up" },
  business_book_completed:    { slug: "book_chapter_read",   name: "Book Chapter Read",       icon: "book-open-text" },
  roleplay_session_completed: { slug: "roleplay_session",    name: "Roleplay Session",        icon: "users" },
  deal_review_postmortem_completed: { slug: "deal_review_postmortem", name: "Deal Review / Postmortem", icon: "magnifying-glass" },

  // VP renames
  exercise_session:                { slug: "exercise",        name: "Exercise",              icon: "barbell" },
  prayer_meditation_time:          { slug: "meditation",      name: "Meditation",            icon: "flower-lotus" },
  hydration_goal_met:              { slug: "water_intake",    name: "Water Intake",          icon: "drop" },
  good_night_of_sleep:             { slug: "sleep_goal",      name: "Sleep 7+ Hours",        icon: "moon-stars" },
  whole_food_meal_logged:          { slug: "healthy_meal",    name: "Healthy Meal",          icon: "bowl-food" },
  steps_goal_met_walk_completed:   { slug: "walk_steps",      name: "Walk / Steps Goal",     icon: "sneaker-move" },
  stretching_mobility_session:     { slug: "stretch_yoga",    name: "Stretch / Yoga",        icon: "person-simple-tai-chi" },
  screen_curfew_honored:           { slug: "screen_break",    name: "Screen Break",          icon: "eye" },
  mindfulness_breath_reset:        { slug: "deep_breathing",  name: "Deep Breathing",        icon: "wind" },
  journal_entry_non_gratitude:     { slug: "journaling",      name: "Journaling",            icon: "notebook" },
  social_connection_non_work:      { slug: "family_time",     name: "Family Time",           icon: "house" },
  outdoor_time_logged:             { slug: "outdoor_time",    name: "Outdoor Time",          icon: "tree" },
  sabbath_block_honored_rest:      { slug: "sabbath_rest",    name: "Sabbath / Rest Block",  icon: "couch" },
};

// Type changes: GP → PC (slug + name + type change)
const TYPE_CHANGES: Record<string, { slug: string; name: string; type: string; icon?: string }> = {
  listing_presentation_given:    { slug: "listing_presentation", name: "Listing Presentation", type: "PC", icon: "presentation-chart" },
  buyer_consult_held:            { slug: "buyer_consultation",   name: "Buyer Consultation",   type: "PC", icon: "handshake" },
  cma_created_practice_or_live:  { slug: "cma_prepared",         name: "CMA Prepared",         type: "PC", icon: "chart-bar" },
};

// Deactivations: slugs to set is_active = false
const DEACTIVATE_SLUGS = [
  // Platform-specific social posts (replaced by generic social_posts_shared)
  "instagram_post_shared",
  "facebook_post_shared",
  "tiktok_post_shared",
  "x_post_shared",
  "linkedin_post_shared",
  "youtube_short_posted",
  // Redundant training/coaching (training_attended wins)
  "coaching_session_attended",
  "training_module_completed",
  // Redundant/overlapping GP
  "database_segmented_cleaned",    // overlaps pipeline_cleaned_up
  "objection_handling_reps_logged", // fold into roleplay
  "offer_strategy_review_completed", // fold into deal_review_postmortem
  "negotiation_practice_session",   // fold into roleplay
  // Legacy broken slugs
  "_alls_ade",  // broken "Calls Made" slug, overlaps phone_call_logged
  // Test data
  "test",
];

// Icon updates for existing exact-match slugs that just need icon/name polish
const ICON_UPDATES: Record<string, { name?: string; icon: string }> = {
  sphere_call:          { icon: "phone-call" },
  appointment_set_buyer:  { name: "Buyer Appt Set", icon: "calendar-check" },
  appointment_set_seller: { name: "Seller Appt Set", icon: "calendar-plus" },
  listing_taken:        { icon: "sign-post" },
  buyer_contract_signed:{ icon: "file-text" },
  new_client_logged:    { icon: "user-plus" },
  biz_post:             { name: "Business Post", icon: "newspaper" },
  gratitude_entry:      { icon: "heart" },
  // DB-only KPIs that already have matching catalog slugs — set their icons
  coffee_lunch_with_sphere: { icon: "coffee" },
  conversations_held:       { icon: "chats-circle" },
  text_dm_conversation:     { icon: "chat-dots" },
  holiday_card_sent:        { icon: "gift" },
  seasonal_check_in_call:   { icon: "phone-incoming" },
  pop_by_delivered:         { icon: "package" },
  social_posts_shared:      { name: "Social Media Post", icon: "share-network" },
  time_blocks_honored:      { icon: "clock-countdown" },
  crm_tag_applied:          { icon: "tag" },
  automation_rule_added:    { icon: "lightning" },
  content_batch_created:    { icon: "stack" },
  pipeline_cleaned_up:      { icon: "broom" },
  smart_plan_activated:     { icon: "rocket-launch" },
  email_subscribers_added:  { icon: "user-list" },
  sop_created_or_updated:   { name: "SOP Created/Updated", icon: "file-doc" },
  weekly_scorecard_review:  { icon: "list-checks" },
  con_ed:                   { name: "Con-Ed Hour", icon: "certificate" },
  training_attended:        { icon: "graduation-cap" },  // in case it exists as known rename target
};

async function run() {
  console.log("═══ KPI Slug Migration ═══\n");

  // Fetch all DB KPIs
  const { data: allKpis, error } = await db
    .from("kpis")
    .select("id, slug, name, type, is_active, icon_source, icon_name");
  if (error) { console.error("Failed to fetch KPIs:", error.message); process.exit(1); }

  const bySlug = new Map<string, any>();
  for (const row of allKpis ?? []) {
    if (row.slug) bySlug.set(row.slug, row);
  }

  let renamed = 0, typeChanged = 0, deactivated = 0, iconUpdated = 0, errors = 0;

  // ── Step 1: Renames ──
  console.log("── Renames ──");
  for (const [oldSlug, target] of Object.entries(RENAMES)) {
    const row = bySlug.get(oldSlug);
    if (!row) { console.log(`  SKIP ${oldSlug} (not in DB)`); continue; }

    const updates: Record<string, any> = {
      slug: target.slug,
      name: target.name,
    };
    if (target.icon) {
      updates.icon_source = "phosphor";
      updates.icon_name = target.icon;
    }

    const { error: updateErr } = await db.from("kpis").update(updates).eq("id", row.id);
    if (updateErr) {
      console.log(`  ERROR ${oldSlug}: ${updateErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${oldSlug} → ${target.slug} ("${target.name}")`);
      renamed++;
    }
  }

  // ── Step 2: Type changes ──
  console.log("\n── Type Changes ──");
  for (const [oldSlug, target] of Object.entries(TYPE_CHANGES)) {
    const row = bySlug.get(oldSlug);
    if (!row) { console.log(`  SKIP ${oldSlug} (not in DB)`); continue; }

    const updates: Record<string, any> = {
      slug: target.slug,
      name: target.name,
      type: target.type,
      // Clear GP/VP values since it's now PC
      gp_value: null,
      vp_value: null,
    };
    if (target.icon) {
      updates.icon_source = "phosphor";
      updates.icon_name = target.icon;
    }

    const { error: updateErr } = await db.from("kpis").update(updates).eq("id", row.id);
    if (updateErr) {
      console.log(`  ERROR ${oldSlug}: ${updateErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${oldSlug} → ${target.slug} (${row.type} → ${target.type})`);
      typeChanged++;
    }
  }

  // ── Step 3: Deactivations ──
  console.log("\n── Deactivations ──");
  for (const slug of DEACTIVATE_SLUGS) {
    const row = bySlug.get(slug);
    if (!row) { console.log(`  SKIP ${slug} (not in DB)`); continue; }
    if (!row.is_active) { console.log(`  SKIP ${slug} (already inactive)`); continue; }

    const { error: updateErr } = await db.from("kpis").update({ is_active: false }).eq("id", row.id);
    if (updateErr) {
      console.log(`  ERROR ${slug}: ${updateErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${slug} → deactivated`);
      deactivated++;
    }
  }

  // ── Step 4: Icon & name updates for existing slugs ──
  console.log("\n── Icon/Name Updates ──");
  for (const [slug, target] of Object.entries(ICON_UPDATES)) {
    const row = bySlug.get(slug);
    if (!row) { console.log(`  SKIP ${slug} (not in DB)`); continue; }

    const updates: Record<string, any> = {
      icon_source: "phosphor",
      icon_name: target.icon,
    };
    if (target.name) updates.name = target.name;

    const { error: updateErr } = await db.from("kpis").update(updates).eq("id", row.id);
    if (updateErr) {
      console.log(`  ERROR ${slug}: ${updateErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${slug} → icon:${target.icon}${target.name ? ' name:"' + target.name + '"' : ''}`);
      iconUpdated++;
    }
  }

  // ── Step 5: Delete null-slug test rows ──
  console.log("\n── Cleanup: null-slug seed data ──");
  const { data: nullSlugs } = await db
    .from("kpis")
    .select("id, name")
    .is("slug", null);

  let deleted = 0;
  for (const row of nullSlugs ?? []) {
    if (row.name?.includes("Seed Sample")) {
      const { error: delErr } = await db.from("kpis").update({ is_active: false }).eq("id", row.id);
      if (delErr) {
        console.log(`  ERROR deactivating "${row.name}": ${delErr.message}`);
        errors++;
      } else {
        console.log(`  ✓ deactivated "${row.name}"`);
        deleted++;
      }
    }
  }

  // ── Summary ──
  console.log("\n═══ Migration Complete ═══");
  console.log(`  Renamed:      ${renamed}`);
  console.log(`  Type changed: ${typeChanged}`);
  console.log(`  Deactivated:  ${deactivated}`);
  console.log(`  Icons set:    ${iconUpdated}`);
  console.log(`  Seeds cleaned: ${deleted}`);
  console.log(`  Errors:       ${errors}`);

  if (errors > 0) {
    console.log("\n⚠️  Some operations failed. Check errors above.");
    process.exit(1);
  } else {
    console.log("\n✅ All operations succeeded.");
  }
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
