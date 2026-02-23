# KPI Master Catalog (Canonical v2)

Fields: name, slug, type, pc_weight, ttc, delay, hold, decay, gp_value, vp_value, icon_file, enabled

Machine-readable companion: `kpi_master_catalog_v2.json`

## Canonical Table

| name                               | slug                             | type            |   pc_weight | ttc          | delay   | hold         |   decay | gp_value   | vp_value   | icon_file                                  | enabled   |
|:-----------------------------------|:---------------------------------|:----------------|------------:|:-------------|:--------|:-------------|--------:|:-----------|:-----------|:-------------------------------------------|:----------|
| Phone Call Logged                  | phone_call_logged                | PC              |       0.025 | 90–120 days  |         | 90–120 days  |     180 |            |            | pc_phone_call_logged_v1.png                | True      |
| Sphere Call                        | sphere_call                      | PC              |       0.04  | 60–90 days   |         | 60–90 days   |     180 |            |            | pc_sphere_call_v1.png                      | True      |
| FSBO/Expired Call                  | fsbo_expired_call                | PC              |       0.05  | 30–60 days   |         | 30–60 days   |     180 |            |            | pc_fsbo_expired_call_v1.png                | True      |
| Door Knock Logged                  | door_knock_logged                | PC              |       0.03  | 90–150 days  |         | 90–150 days  |     180 |            |            | pc_door_knock_logged_v1.png                | True      |
| Appointment Set (Buyer)            | appointment_set_buyer            | PC              |       0.5   | 30–60 days   |         | 30–60 days   |     180 |            |            | pc_appointment_set_buyer_v1.png            | True      |
| Appointment Set (Seller)           | appointment_set_seller           | PC              |       0.5   | 30–60 days   |         | 30–60 days   |     180 |            |            | pc_appointment_set_seller_v1.png           | True      |
| Coffee/Lunch with Sphere           | coffee_lunch_with_sphere         | PC              |       0.1   | 90–150 days  |         | 90–150 days  |     180 |            |            | pc_coffee_lunch_with_sphere_v1.png         | True      |
| Conversations Held                 | conversations_held               | PC              |       0.1   | 90–150 days  |         | 90–150 days  |     180 |            |            | pc_conversations_held_v1.png               | True      |
| Listing Taken                      | listing_taken                    | PC              |       7     | 30 days      |         | 30 days      |     180 |            |            | pc_listing_taken_v1.png                    | True      |
| Buyer Contract Signed              | buyer_contract_signed            | PC              |       5     | 30 days      |         | 30 days      |     180 |            |            | pc_buyer_contract_signed_v1.png            | True      |
| New Client Logged                  | new_client_logged                | PC              |       1.25  | 30–90 days   |         | 30–90 days   |     180 |            |            | pc_new_client_logged_v1.png                | True      |
| Text/DM Conversation               | text_dm_conversation             | PC              |       0.01  | 90–120 days  |         | 90–120 days  |     180 |            |            | pc_text_dm_conversation_v1.png             | True      |
| Open House Logged                  | open_house_logged                | PC              |       0.2   | 60–120 days  |         | 60–120 days  |     180 |            |            | pc_open_house_logged_v1.png                | True      |
| Seasonal Check-In Call             | seasonal_check_in_call           | PC              |       0.1   | 90–150 days  |         | 90–150 days  |     180 |            |            | pc_seasonal_check_in_call_v1.png           | True      |
| Pop-By Delivered                   | pop_by_delivered                 | PC              |       0.08  | 90–150 days  |         | 90–150 days  |     180 |            |            | pc_pop_by_delivered_v1.png                 | True      |
| Holiday Card Sent                  | holiday_card_sent                | PC              |       0.03  | 120–180 days |         | 120–180 days |     180 |            |            | pc_holiday_card_sent_v1.png                | True      |
| Deal Closed                        | deal_closed                      | Actual          |     nan     | Immediate    |         |              |     nan |            |            |                                            | True      |
| Pipeline Anchor: Listings Pending  | pipeline_anchor_listings_pending | Pipeline_Anchor |     nan     | 30 days      |         | 30 days      |     nan |            |            |                                            | True      |
| Pipeline Anchor: Buyers UC         | pipeline_anchor_buyers_uc        | Pipeline_Anchor |     nan     | 30 days      |         | 30 days      |     nan |            |            |                                            | True      |
| Time Blocks Honored                | time_blocks_honored              | GP              |     nan     |              |         |              |     nan |            |            | gp_time_blocks_honored_v1.png              | True      |
| Social Posts Shared                | social_posts_shared              | GP              |     nan     |              |         |              |     nan |            |            | gp_social_posts_shared_v1.png              | True      |
| CRM Tag Applied                    | crm_tag_applied                  | GP              |     nan     |              |         |              |     nan |            |            | gp_crm_tag_applied_v1.png                  | True      |
| Smart Plan Activated               | smart_plan_activated             | GP              |     nan     |              |         |              |     nan |            |            | gp_smart_plan_activated_v1.png             | True      |
| Email Subscribers Added            | email_subscribers_added          | GP              |     nan     |              |         |              |     nan |            |            | gp_email_subscribers_added_v1.png          | True      |
| Listing Video Created              | listing_video_created            | GP              |     nan     |              |         |              |     nan |            |            | gp_listing_video_created_v1.png            | True      |
| Listing Presentation Given         | listing_presentation_given       | GP              |     nan     |              |         |              |     nan |            |            | gp_listing_presentation_given_v1.png       | True      |
| Buyer Consult Held                 | buyer_consult_held               | GP              |     nan     |              |         |              |     nan |            |            | gp_buyer_consult_held_v1.png               | True      |
| Business Book Completed            | business_book_completed          | GP              |     nan     |              |         |              |     nan |            |            | gp_business_book_completed_v1.png          | True      |
| Pipeline Cleaned Up                | pipeline_cleaned_up              | GP              |     nan     |              |         |              |     nan |            |            | gp_pipeline_cleaned_up_v1.png              | True      |
| Automation Rule Added              | automation_rule_added            | GP              |     nan     |              |         |              |     nan |            |            | gp_automation_rule_added_v1.png            | True      |
| Roleplay Session Completed         | roleplay_session_completed       | GP              |     nan     |              |         |              |     nan |            |            | gp_roleplay_session_completed_v1.png       | True      |
| Script Practice Session            | script_practice_session          | GP              |     nan     |              |         |              |     nan |            |            | gp_script_practice_session_v1.png          | True      |
| Objection Handling Reps Logged     | objection_handling_reps_logged   | GP              |     nan     |              |         |              |     nan |            |            | gp_objection_handling_reps_logged_v1.png   | True      |
| CMA Created (Practice or Live)     | cma_created_practice_or_live     | GP              |     nan     |              |         |              |     nan |            |            | gp_cma_created_practice_or_live_v1.png     | True      |
| Market Stats Review (Weekly)       | market_stats_review_weekly       | GP              |     nan     |              |         |              |     nan |            |            | gp_market_stats_review_weekly_v1.png       | True      |
| Offer Strategy Review Completed    | offer_strategy_review_completed  | GP              |     nan     |              |         |              |     nan |            |            | gp_offer_strategy_review_completed_v1.png  | True      |
| Deal Review / Postmortem Completed | deal_review_postmortem_completed | GP              |     nan     |              |         |              |     nan |            |            | gp_deal_review_postmortem_completed_v1.png | True      |
| Negotiation Practice Session       | negotiation_practice_session     | GP              |     nan     |              |         |              |     nan |            |            | gp_negotiation_practice_session_v1.png     | True      |
| Content Batch Created              | content_batch_created            | GP              |     nan     |              |         |              |     nan |            |            | gp_content_batch_created_v1.png            | True      |
| Database Segmented / Cleaned       | database_segmented_cleaned       | GP              |     nan     |              |         |              |     nan |            |            | gp_database_segmented_cleaned_v1.png       | True      |
| SOP Created or Updated             | sop_created_or_updated           | GP              |     nan     |              |         |              |     nan |            |            | gp_sop_created_or_updated_v1.png           | True      |
| Weekly Scorecard Review            | weekly_scorecard_review          | GP              |     nan     |              |         |              |     nan |            |            | gp_weekly_scorecard_review_v1.png          | True      |
| Coaching Session Attended          | coaching_session_attended        | GP              |     nan     |              |         |              |     nan |            |            | gp_coaching_session_attended_v1.png        | True      |
| Training Module Completed          | training_module_completed        | GP              |     nan     |              |         |              |     nan |            |            | gp_training_module_completed_v1.png        | True      |
| Gratitude Entry                    | gratitude_entry                  | VP              |     nan     |              |         |              |     nan |            |            | vp_gratitude_entry_v1.png                  | True      |
| Good Night of Sleep                | good_night_of_sleep              | VP              |     nan     |              |         |              |     nan |            |            | vp_good_night_of_sleep_v1.png              | True      |
| Exercise Session                   | exercise_session                 | VP              |     nan     |              |         |              |     nan |            |            | vp_exercise_session_v1.png                 | True      |
| Prayer/Meditation Time             | prayer_meditation_time           | VP              |     nan     |              |         |              |     nan |            |            | vp_prayer_meditation_time_v1.png           | True      |
| Hydration Goal Met                 | hydration_goal_met               | VP              |     nan     |              |         |              |     nan |            |            | vp_hydration_goal_met_v1.png               | True      |
| Whole Food Meal Logged             | whole_food_meal_logged           | VP              |     nan     |              |         |              |     nan |            |            | vp_whole_food_meal_logged_v1.png           | True      |
| Steps Goal Met / Walk Completed    | steps_goal_met_walk_completed    | VP              |     nan     |              |         |              |     nan |            |            | vp_steps_goal_met_walk_completed_v1.png    | True      |
| Stretching / Mobility Session      | stretching_mobility_session      | VP              |     nan     |              |         |              |     nan |            |            | vp_stretching_mobility_session_v1.png      | True      |
| Outdoor Time Logged                | outdoor_time_logged              | VP              |     nan     |              |         |              |     nan |            |            | vp_outdoor_time_logged_v1.png              | True      |
| Screen Curfew Honored              | screen_curfew_honored            | VP              |     nan     |              |         |              |     nan |            |            | vp_screen_curfew_honored_v1.png            | True      |
| Mindfulness / Breath Reset         | mindfulness_breath_reset         | VP              |     nan     |              |         |              |     nan |            |            | vp_mindfulness_breath_reset_v1.png         | True      |
| Sabbath Block Honored (Rest)       | sabbath_block_honored_rest       | VP              |     nan     |              |         |              |     nan |            |            | vp_sabbath_block_honored_rest_v1.png       | True      |
| Social Connection (Non-work)       | social_connection_non_work       | VP              |     nan     |              |         |              |     nan |            |            | vp_social_connection_non_work_v1.png       | True      |
| Journal Entry (Non-gratitude)      | journal_entry_non_gratitude      | VP              |     nan     |              |         |              |     nan |            |            | vp_journal_entry_non_gratitude_v1.png      | True      |

## Notes

| name                               | notes                                                                                     |
|:-----------------------------------|:------------------------------------------------------------------------------------------|
| Phone Call Logged                  |                                                                                           |
| Sphere Call                        |                                                                                           |
| FSBO/Expired Call                  |                                                                                           |
| Door Knock Logged                  |                                                                                           |
| Appointment Set (Buyer)            |                                                                                           |
| Appointment Set (Seller)           |                                                                                           |
| Coffee/Lunch with Sphere           |                                                                                           |
| Conversations Held                 | (New)                                                                                     |
| Listing Taken                      |                                                                                           |
| Buyer Contract Signed              |                                                                                           |
| New Client Logged                  |                                                                                           |
| Text/DM Conversation               |                                                                                           |
| Open House Logged                  |                                                                                           |
| Seasonal Check-In Call             | Added as PC (sphere nurture). Suggested range 0.08%–0.15%.                                |
| Pop-By Delivered                   | Added as PC (sphere nurture). Suggested range 0.05%–0.12%.                                |
| Holiday Card Sent                  | Added as PC (sphere nurture). Suggested range 0.02%–0.06%.                                |
| Deal Closed                        | Requires direct value input (GCI). Secondary prompt: Enter GCI Amount.                    |
| Pipeline Anchor: Listings Pending  | Logged status/count for PC forecasting; influences Forecast Confidence (Pipeline Health). |
| Pipeline Anchor: Buyers UC         | Logged status/count for PC forecasting; influences Forecast Confidence (Pipeline Health). |
| Time Blocks Honored                | GP_Value TBD.                                                                             |
| Social Posts Shared                | GP_Value TBD.                                                                             |
| CRM Tag Applied                    | GP_Value TBD.                                                                             |
| Smart Plan Activated               | GP_Value TBD.                                                                             |
| Email Subscribers Added            | GP_Value TBD.                                                                             |
| Listing Video Created              | GP_Value TBD.                                                                             |
| Listing Presentation Given         | GP_Value TBD.                                                                             |
| Buyer Consult Held                 | GP_Value TBD.                                                                             |
| Business Book Completed            | GP_Value TBD.                                                                             |
| Pipeline Cleaned Up                | GP_Value TBD.                                                                             |
| Automation Rule Added              | GP_Value TBD.                                                                             |
| Roleplay Session Completed         | GP_Value TBD.                                                                             |
| Script Practice Session            | GP_Value TBD.                                                                             |
| Objection Handling Reps Logged     | GP_Value TBD.                                                                             |
| CMA Created (Practice or Live)     | GP_Value TBD.                                                                             |
| Market Stats Review (Weekly)       | GP_Value TBD.                                                                             |
| Offer Strategy Review Completed    | GP_Value TBD.                                                                             |
| Deal Review / Postmortem Completed | GP_Value TBD.                                                                             |
| Negotiation Practice Session       | GP_Value TBD.                                                                             |
| Content Batch Created              | GP_Value TBD.                                                                             |
| Database Segmented / Cleaned       | GP_Value TBD.                                                                             |
| SOP Created or Updated             | GP_Value TBD.                                                                             |
| Weekly Scorecard Review            | GP_Value TBD.                                                                             |
| Coaching Session Attended          | GP_Value TBD.                                                                             |
| Training Module Completed          | GP_Value TBD.                                                                             |
| Gratitude Entry                    | VP_Value TBD.                                                                             |
| Good Night of Sleep                | VP_Value TBD.                                                                             |
| Exercise Session                   | VP_Value TBD.                                                                             |
| Prayer/Meditation Time             | VP_Value TBD.                                                                             |
| Hydration Goal Met                 | VP_Value TBD.                                                                             |
| Whole Food Meal Logged             | VP_Value TBD.                                                                             |
| Steps Goal Met / Walk Completed    | VP_Value TBD.                                                                             |
| Stretching / Mobility Session      | VP_Value TBD.                                                                             |
| Outdoor Time Logged                | VP_Value TBD.                                                                             |
| Screen Curfew Honored              | VP_Value TBD.                                                                             |
| Mindfulness / Breath Reset         | VP_Value TBD.                                                                             |
| Sabbath Block Honored (Rest)       | VP_Value TBD.                                                                             |
| Social Connection (Non-work)       | VP_Value TBD.                                                                             |
| Journal Entry (Non-gratitude)      | VP_Value TBD.                                                                             |