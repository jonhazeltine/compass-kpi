-- Sprint 16: Align KPI catalog to canonical v2 spec sources.
-- Sources:
--   docs/spec/appendix/KPI_MASTER_CATALOG_CANONICAL.md
--   docs/spec/appendix/kpi_master_catalog.json
--
-- Goals:
-- 1) Preserve historical semantics for previously-seeded VP rows that are now canonically PC
--    by renaming/deactivating legacy rows before canonical upsert.
-- 2) Add icon_file metadata column for source asset linkage.
-- 3) Upsert full canonical KPI catalog v2 (PC/GP/VP/Actual/Pipeline_Anchor).
--
-- Notes:
-- - GP/VP point values default to 1 where canonical spec placeholders are still TBD/null.
-- - Custom KPI row is preserved as an app/runtime row and is intentionally outside canonical seed list.

alter table public.kpis
  add column if not exists icon_file text;

-- Preserve legacy semantics for KPIs that were historically seeded as VP but are now canonical PC.
-- This avoids mutating old KPI logs/calibration history in-place.

update public.kpis
set name = 'Seasonal Check-In Call (Legacy VP)',
    slug = 'seasonal_check_in_call_legacy_vp',
    is_active = false,
    updated_at = now()
where name = 'Seasonal Check-In Call'
  and type = 'VP'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Seasonal Check-In Call (Legacy VP)'
      and k2.id <> public.kpis.id
  );

update public.kpis
set name = 'Pop-By Delivered (Legacy VP)',
    slug = 'pop_by_delivered_legacy_vp',
    is_active = false,
    updated_at = now()
where name = 'Pop-By Delivered'
  and type = 'VP'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Pop-By Delivered (Legacy VP)'
      and k2.id <> public.kpis.id
  );

update public.kpis
set name = 'Holiday Card Sent (Legacy VP)',
    slug = 'holiday_card_sent_legacy_vp',
    is_active = false,
    updated_at = now()
where name = 'Holiday Card Sent'
  and type = 'VP'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Holiday Card Sent (Legacy VP)'
      and k2.id <> public.kpis.id
  );

insert into public.kpis (
  name,
  slug,
  type,
  requires_direct_value_input,
  pc_weight,
  ttc_days,
  ttc_definition,
  delay_days,
  hold_days,
  decay_days,
  gp_value,
  vp_value,
  icon_file,
  is_active
)
values
  ('Phone Call Logged', 'phone_call_logged', 'PC', false, 0.00025, 120, '90-120 days', 90, 30, 180, null, null, 'pc_phone_call_logged_v1.png', true),
  ('Sphere Call', 'sphere_call', 'PC', false, 0.0004, 90, '60-90 days', 60, 30, 180, null, null, 'pc_sphere_call_v1.png', true),
  ('FSBO/Expired Call', 'fsbo_expired_call', 'PC', false, 0.0005, 60, '30-60 days', 30, 30, 180, null, null, 'pc_fsbo_expired_call_v1.png', true),
  ('Door Knock Logged', 'door_knock_logged', 'PC', false, 0.0003, 150, '90-150 days', 90, 60, 180, null, null, 'pc_door_knock_logged_v1.png', true),
  ('Appointment Set (Buyer)', 'appointment_set_buyer', 'PC', false, 0.005, 60, '30-60 days', 30, 30, 180, null, null, 'pc_appointment_set_buyer_v1.png', true),
  ('Appointment Set (Seller)', 'appointment_set_seller', 'PC', false, 0.005, 60, '30-60 days', 30, 30, 180, null, null, 'pc_appointment_set_seller_v1.png', true),
  ('Coffee/Lunch with Sphere', 'coffee_lunch_with_sphere', 'PC', false, 0.001, 150, '90-150 days', 90, 60, 180, null, null, 'pc_coffee_lunch_with_sphere_v1.png', true),
  ('Conversations Held', 'conversations_held', 'PC', false, 0.001, 150, '90-150 days', 90, 60, 180, null, null, 'pc_conversations_held_v1.png', true),
  ('Listing Taken', 'listing_taken', 'PC', false, 0.07, 30, '30 days', 0, 30, 180, null, null, 'pc_listing_taken_v1.png', true),
  ('Buyer Contract Signed', 'buyer_contract_signed', 'PC', false, 0.05, 30, '30 days', 0, 30, 180, null, null, 'pc_buyer_contract_signed_v1.png', true),
  ('New Client Logged', 'new_client_logged', 'PC', false, 0.0125, 90, '30-90 days', 30, 60, 180, null, null, 'pc_new_client_logged_v1.png', true),
  ('Text/DM Conversation', 'text_dm_conversation', 'PC', false, 0.0001, 120, '90-120 days', 90, 30, 180, null, null, 'pc_text_dm_conversation_v1.png', true),
  ('Open House Logged', 'open_house_logged', 'PC', false, 0.002, 120, '60-120 days', 60, 60, 180, null, null, 'pc_open_house_logged_v1.png', true),
  ('Seasonal Check-In Call', 'seasonal_check_in_call', 'PC', false, 0.001, 150, '90-150 days', 90, 60, 180, null, null, 'pc_seasonal_check_in_call_v1.png', true),
  ('Pop-By Delivered', 'pop_by_delivered', 'PC', false, 0.0008, 150, '90-150 days', 90, 60, 180, null, null, 'pc_pop_by_delivered_v1.png', true),
  ('Holiday Card Sent', 'holiday_card_sent', 'PC', false, 0.0003, 180, '120-180 days', 120, 60, 180, null, null, 'pc_holiday_card_sent_v1.png', true),
  ('Deal Closed', 'deal_closed', 'Actual', true, null, null, null, null, null, null, null, null, null, true),
  ('Pipeline Anchor: Listings Pending', 'pipeline_anchor_listings_pending', 'Pipeline_Anchor', true, null, null, null, null, null, null, null, null, null, true),
  ('Pipeline Anchor: Buyers UC', 'pipeline_anchor_buyers_uc', 'Pipeline_Anchor', true, null, null, null, null, null, null, null, null, null, true),
  ('Time Blocks Honored', 'time_blocks_honored', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_time_blocks_honored_v1.png', true),
  ('Social Posts Shared', 'social_posts_shared', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_social_posts_shared_v1.png', true),
  ('CRM Tag Applied', 'crm_tag_applied', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_crm_tag_applied_v1.png', true),
  ('Smart Plan Activated', 'smart_plan_activated', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_smart_plan_activated_v1.png', true),
  ('Email Subscribers Added', 'email_subscribers_added', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_email_subscribers_added_v1.png', true),
  ('Listing Video Created', 'listing_video_created', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_listing_video_created_v1.png', true),
  ('Listing Presentation Given', 'listing_presentation_given', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_listing_presentation_given_v1.png', true),
  ('Buyer Consult Held', 'buyer_consult_held', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_buyer_consult_held_v1.png', true),
  ('Business Book Completed', 'business_book_completed', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_business_book_completed_v1.png', true),
  ('Pipeline Cleaned Up', 'pipeline_cleaned_up', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_pipeline_cleaned_up_v1.png', true),
  ('Automation Rule Added', 'automation_rule_added', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_automation_rule_added_v1.png', true),
  ('Roleplay Session Completed', 'roleplay_session_completed', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_roleplay_session_completed_v1.png', true),
  ('Script Practice Session', 'script_practice_session', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_script_practice_session_v1.png', true),
  ('Objection Handling Reps Logged', 'objection_handling_reps_logged', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_objection_handling_reps_logged_v1.png', true),
  ('CMA Created (Practice or Live)', 'cma_created_practice_or_live', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_cma_created_practice_or_live_v1.png', true),
  ('Market Stats Review (Weekly)', 'market_stats_review_weekly', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_market_stats_review_weekly_v1.png', true),
  ('Offer Strategy Review Completed', 'offer_strategy_review_completed', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_offer_strategy_review_completed_v1.png', true),
  ('Deal Review / Postmortem Completed', 'deal_review_postmortem_completed', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_deal_review_postmortem_completed_v1.png', true),
  ('Negotiation Practice Session', 'negotiation_practice_session', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_negotiation_practice_session_v1.png', true),
  ('Content Batch Created', 'content_batch_created', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_content_batch_created_v1.png', true),
  ('Database Segmented / Cleaned', 'database_segmented_cleaned', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_database_segmented_cleaned_v1.png', true),
  ('SOP Created or Updated', 'sop_created_or_updated', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_sop_created_or_updated_v1.png', true),
  ('Weekly Scorecard Review', 'weekly_scorecard_review', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_weekly_scorecard_review_v1.png', true),
  ('Coaching Session Attended', 'coaching_session_attended', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_coaching_session_attended_v1.png', true),
  ('Training Module Completed', 'training_module_completed', 'GP', false, null, null, null, null, null, null, 1, null, 'gp_training_module_completed_v1.png', true),
  ('Gratitude Entry', 'gratitude_entry', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_gratitude_entry_v1.png', true),
  ('Good Night of Sleep', 'good_night_of_sleep', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_good_night_of_sleep_v1.png', true),
  ('Exercise Session', 'exercise_session', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_exercise_session_v1.png', true),
  ('Prayer/Meditation Time', 'prayer_meditation_time', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_prayer_meditation_time_v1.png', true),
  ('Hydration Goal Met', 'hydration_goal_met', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_hydration_goal_met_v1.png', true),
  ('Whole Food Meal Logged', 'whole_food_meal_logged', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_whole_food_meal_logged_v1.png', true),
  ('Steps Goal Met / Walk Completed', 'steps_goal_met_walk_completed', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_steps_goal_met_walk_completed_v1.png', true),
  ('Stretching / Mobility Session', 'stretching_mobility_session', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_stretching_mobility_session_v1.png', true),
  ('Outdoor Time Logged', 'outdoor_time_logged', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_outdoor_time_logged_v1.png', true),
  ('Screen Curfew Honored', 'screen_curfew_honored', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_screen_curfew_honored_v1.png', true),
  ('Mindfulness / Breath Reset', 'mindfulness_breath_reset', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_mindfulness_breath_reset_v1.png', true),
  ('Sabbath Block Honored (Rest)', 'sabbath_block_honored_rest', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_sabbath_block_honored_rest_v1.png', true),
  ('Social Connection (Non-work)', 'social_connection_non_work', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_social_connection_non_work_v1.png', true),
  ('Journal Entry (Non-gratitude)', 'journal_entry_non_gratitude', 'VP', false, null, null, null, null, null, null, null, 1, 'vp_journal_entry_non_gratitude_v1.png', true)

on conflict (name) do update
set
  slug = excluded.slug,
  type = excluded.type,
  requires_direct_value_input = excluded.requires_direct_value_input,
  pc_weight = excluded.pc_weight,
  ttc_days = excluded.ttc_days,
  ttc_definition = excluded.ttc_definition,
  delay_days = excluded.delay_days,
  hold_days = excluded.hold_days,
  decay_days = excluded.decay_days,
  gp_value = excluded.gp_value,
  vp_value = excluded.vp_value,
  icon_file = excluded.icon_file,
  is_active = excluded.is_active,
  updated_at = now();

-- Reassert point-field/type integrity with default point fallback for TBD GP/VP spec values.
update public.kpis
set gp_value = coalesce(gp_value, 1),
    vp_value = null,
    updated_at = now()
where type = 'GP';

update public.kpis
set vp_value = coalesce(vp_value, 1),
    gp_value = null,
    updated_at = now()
where type = 'VP';

update public.kpis
set gp_value = null,
    vp_value = null,
    updated_at = now()
where type not in ('GP', 'VP');

-- Reassert PC timing defaults where canonical row or legacy rows are missing parsed timing details.
update public.kpis
set
  ttc_definition = coalesce(nullif(btrim(ttc_definition), ''), concat(coalesce(ttc_days, 30), ' days')),
  delay_days = coalesce(delay_days, 0),
  hold_days = coalesce(hold_days, greatest(0, coalesce(ttc_days, 30) - coalesce(delay_days, 0))),
  decay_days = coalesce(decay_days, 180),
  updated_at = now()
where type = 'PC';

create index if not exists kpis_icon_file_idx on public.kpis (icon_file);
