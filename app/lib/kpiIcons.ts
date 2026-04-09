import type { ImageSourcePropType } from 'react-native';

export type KpiIconSource = 'brand_asset' | 'vector_icon' | 'emoji' | 'phosphor';
export type KpiAuthoringIconSource = 'brand_asset' | 'vector_icon' | 'phosphor';
export type KpiType = 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';

export type KpiIconMetadata = {
  name?: string | null;
  slug?: string | null;
  type?: KpiType | string | null;
  icon_source?: KpiIconSource | null;
  icon_name?: string | null;
  icon_emoji?: string | null;
  icon_file?: string | null;
};

type KpiIconResolution =
  | { kind: 'brand_asset'; imageSource: ImageSourcePropType; resolvedSource: 'metadata' | 'icon_file' | 'legacy' }
  | { kind: 'vector_icon'; iconName: string; resolvedSource: 'metadata' | 'legacy' | 'default' }
  | { kind: 'phosphor'; iconName: string; resolvedSource: 'metadata' };

const KPI_TYPE_ICON_TREATMENTS = {
  PC: { background: '#e4f7ea', foreground: '#2f9f56' },
  GP: { background: '#e5efff', foreground: '#2158d5' },
  VP: { background: '#fdf3de', foreground: '#C9A84C' },
  Custom: { background: '#f3e8ff', foreground: '#7a4cc8' },
  default: { background: '#eceff3', foreground: '#48505f' },
} as const;

const KPI_BRAND_ASSET_SOURCES: Record<string, ImageSourcePropType> = {
  'pc_phone_call_logged_v1.png': require('../assets/figma/kpi_icon_bank/pc_phone_call_logged_v1.png'),
  'pc_sphere_call_v1.png': require('../assets/figma/kpi_icon_bank/pc_sphere_call_v1.png'),
  'pc_fsbo_expired_call_v1.png': require('../assets/figma/kpi_icon_bank/pc_fsbo_expired_call_v1.png'),
  'pc_door_knock_logged_v1.png': require('../assets/figma/kpi_icon_bank/pc_door_knock_logged_v1.png'),
  'pc_appointment_set_buyer_v1.png': require('../assets/figma/kpi_icon_bank/pc_appointment_set_buyer_v1.png'),
  'pc_appointment_set_seller_v1.png': require('../assets/figma/kpi_icon_bank/pc_appointment_set_seller_v1.png'),
  'pc_coffee_lunch_with_sphere_v1.png': require('../assets/figma/kpi_icon_bank/pc_coffee_lunch_with_sphere_v1.png'),
  'pc_conversations_held_v1.png': require('../assets/figma/kpi_icon_bank/pc_conversations_held_v1.png'),
  'pc_listing_taken_v1.png': require('../assets/figma/kpi_icon_bank/pc_listing_taken_v1.png'),
  'pc_buyer_contract_signed_v1.png': require('../assets/figma/kpi_icon_bank/pc_buyer_contract_signed_v1.png'),
  'pc_new_client_logged_v1.png': require('../assets/figma/kpi_icon_bank/pc_new_client_logged_v1.png'),
  'pc_text_dm_conversation_v1.png': require('../assets/figma/kpi_icon_bank/pc_text_dm_conversation_v1.png'),
  'pc_open_house_logged_v1.png': require('../assets/figma/kpi_icon_bank/pc_open_house_logged_v1.png'),
  'pc_seasonal_check_in_call_v1.png': require('../assets/figma/kpi_icon_bank/pc_seasonal_check_in_call_v1.png'),
  'pc_pop_by_delivered_v1.png': require('../assets/figma/kpi_icon_bank/pc_pop_by_delivered_v1.png'),
  'pc_holiday_card_sent_v1.png': require('../assets/figma/kpi_icon_bank/pc_holiday_card_sent_v1.png'),
  'pc_biz_post_v1.png': require('../assets/figma/kpi_icon_bank/pc_biz_post_v1.png'),
  'gp_time_blocks_honored_v1.png': require('../assets/figma/kpi_icon_bank/gp_time_blocks_honored_v1.png'),
  'gp_social_posts_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_social_posts_shared_v1.png'),
  'gp_crm_tag_applied_v1.png': require('../assets/figma/kpi_icon_bank/gp_crm_tag_applied_v1.png'),
  'gp_smart_plan_activated_v1.png': require('../assets/figma/kpi_icon_bank/gp_smart_plan_activated_v1.png'),
  'gp_email_subscribers_added_v1.png': require('../assets/figma/kpi_icon_bank/gp_email_subscribers_added_v1.png'),
  'gp_listing_video_created_v1.png': require('../assets/figma/kpi_icon_bank/gp_listing_video_created_v1.png'),
  'gp_listing_presentation_given_v1.png': require('../assets/figma/kpi_icon_bank/gp_listing_presentation_given_v1.png'),
  'gp_buyer_consult_held_v1.png': require('../assets/figma/kpi_icon_bank/gp_buyer_consult_held_v1.png'),
  'gp_business_book_completed_v1.png': require('../assets/figma/kpi_icon_bank/gp_business_book_completed_v1.png'),
  'gp_pipeline_cleaned_up_v1.png': require('../assets/figma/kpi_icon_bank/gp_pipeline_cleaned_up_v1.png'),
  'gp_automation_rule_added_v1.png': require('../assets/figma/kpi_icon_bank/gp_automation_rule_added_v1.png'),
  'gp_roleplay_session_completed_v1.png': require('../assets/figma/kpi_icon_bank/gp_roleplay_session_completed_v1.png'),
  'gp_script_practice_session_v1.png': require('../assets/figma/kpi_icon_bank/gp_script_practice_session_v1.png'),
  'gp_objection_handling_reps_logged_v1.png': require('../assets/figma/kpi_icon_bank/gp_objection_handling_reps_logged_v1.png'),
  'gp_cma_created_practice_or_live_v1.png': require('../assets/figma/kpi_icon_bank/gp_cma_created_practice_or_live_v1.png'),
  'gp_market_stats_review_weekly_v1.png': require('../assets/figma/kpi_icon_bank/gp_market_stats_review_weekly_v1.png'),
  'gp_offer_strategy_review_completed_v1.png': require('../assets/figma/kpi_icon_bank/gp_offer_strategy_review_completed_v1.png'),
  'gp_deal_review_postmortem_completed_v1.png': require('../assets/figma/kpi_icon_bank/gp_deal_review_postmortem_completed_v1.png'),
  'gp_negotiation_practice_session_v1.png': require('../assets/figma/kpi_icon_bank/gp_negotiation_practice_session_v1.png'),
  'gp_content_batch_created_v1.png': require('../assets/figma/kpi_icon_bank/gp_content_batch_created_v1.png'),
  'gp_database_segmented_cleaned_v1.png': require('../assets/figma/kpi_icon_bank/gp_database_segmented_cleaned_v1.png'),
  'gp_sop_created_or_updated_v1.png': require('../assets/figma/kpi_icon_bank/gp_sop_created_or_updated_v1.png'),
  'gp_weekly_scorecard_review_v1.png': require('../assets/figma/kpi_icon_bank/gp_weekly_scorecard_review_v1.png'),
  'gp_coaching_session_attended_v1.png': require('../assets/figma/kpi_icon_bank/gp_coaching_session_attended_v1.png'),
  'gp_training_module_completed_v1.png': require('../assets/figma/kpi_icon_bank/gp_training_module_completed_v1.png'),
  'gp_instagram_post_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_instagram_post_shared_v1.png'),
  'gp_facebook_post_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_facebook_post_shared_v1.png'),
  'gp_tiktok_post_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_tiktok_post_shared_v1.png'),
  'gp_x_post_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_x_post_shared_v1.png'),
  'gp_linkedin_post_shared_v1.png': require('../assets/figma/kpi_icon_bank/gp_linkedin_post_shared_v1.png'),
  'gp_youtube_short_posted_v1.png': require('../assets/figma/kpi_icon_bank/gp_youtube_short_posted_v1.png'),
  'vp_gratitude_entry_v1.png': require('../assets/figma/kpi_icon_bank/vp_gratitude_entry_v1.png'),
  'vp_good_night_of_sleep_v1.png': require('../assets/figma/kpi_icon_bank/vp_good_night_of_sleep_v1.png'),
  'vp_exercise_session_v1.png': require('../assets/figma/kpi_icon_bank/vp_exercise_session_v1.png'),
  'vp_prayer_meditation_time_v1.png': require('../assets/figma/kpi_icon_bank/vp_prayer_meditation_time_v1.png'),
  'vp_hydration_goal_met_v1.png': require('../assets/figma/kpi_icon_bank/vp_hydration_goal_met_v1.png'),
  'vp_whole_food_meal_logged_v1.png': require('../assets/figma/kpi_icon_bank/vp_whole_food_meal_logged_v1.png'),
  'vp_steps_goal_met_walk_completed_v1.png': require('../assets/figma/kpi_icon_bank/vp_steps_goal_met_walk_completed_v1.png'),
  'vp_stretching_mobility_session_v1.png': require('../assets/figma/kpi_icon_bank/vp_stretching_mobility_session_v1.png'),
  'vp_outdoor_time_logged_v1.png': require('../assets/figma/kpi_icon_bank/vp_outdoor_time_logged_v1.png'),
  'vp_screen_curfew_honored_v1.png': require('../assets/figma/kpi_icon_bank/vp_screen_curfew_honored_v1.png'),
  'vp_mindfulness_breath_reset_v1.png': require('../assets/figma/kpi_icon_bank/vp_mindfulness_breath_reset_v1.png'),
  'vp_sabbath_block_honored_rest_v1.png': require('../assets/figma/kpi_icon_bank/vp_sabbath_block_honored_rest_v1.png'),
  'vp_social_connection_non_work_v1.png': require('../assets/figma/kpi_icon_bank/vp_social_connection_non_work_v1.png'),
  'vp_journal_entry_non_gratitude_v1.png': require('../assets/figma/kpi_icon_bank/vp_journal_entry_non_gratitude_v1.png'),
};

const VECTOR_ICON_OPTIONS = [
  { name: 'phone-outline', label: 'Phone' },
  { name: 'calendar-check-outline', label: 'Calendar' },
  { name: 'account-plus-outline', label: 'New Client' },
  { name: 'home-outline', label: 'Home' },
  { name: 'message-text-outline', label: 'Message' },
  { name: 'handshake-outline', label: 'Handshake' },
  { name: 'bullseye-arrow', label: 'Target' },
  { name: 'trophy-outline', label: 'Trophy' },
  { name: 'chart-line', label: 'Growth' },
  { name: 'cash-multiple', label: 'Revenue' },
  { name: 'email-outline', label: 'Email' },
  { name: 'camera-outline', label: 'Content' },
  { name: 'clock-check-outline', label: 'Time Block' },
  { name: 'clipboard-check-outline', label: 'Checklist' },
  { name: 'robot-outline', label: 'Automation' },
  { name: 'book-open-variant', label: 'Learning' },
  { name: 'account-group-outline', label: 'Team' },
  { name: 'lightning-bolt-outline', label: 'Energy' },
  { name: 'heart-pulse', label: 'Vitality' },
  { name: 'run-fast', label: 'Movement' },
  { name: 'weather-sunny', label: 'Outdoor' },
  { name: 'meditation', label: 'Mindfulness' },
  { name: 'star-outline', label: 'Star' },
  { name: 'sparkles', label: 'Sparkles' },
] as const;

const BRAND_ASSET_OPTIONS = Object.keys(KPI_BRAND_ASSET_SOURCES)
  .sort((a, b) => a.localeCompare(b))
  .map((fileName) => ({
    key: fileName,
    label: formatBrandAssetLabel(fileName),
  }));

const brandAssetByNormalizedKey = new Map<string, ImageSourcePropType>();
const brandAssetKeyBySlug = new Map<string, string>();

for (const fileName of Object.keys(KPI_BRAND_ASSET_SOURCES)) {
  brandAssetByNormalizedKey.set(fileName.toLowerCase(), KPI_BRAND_ASSET_SOURCES[fileName]);
  brandAssetByNormalizedKey.set(fileName.replace(/\.png$/i, '').toLowerCase(), KPI_BRAND_ASSET_SOURCES[fileName]);
  const slug = canonicalSlugFromBrandAsset(fileName);
  if (slug) brandAssetKeyBySlug.set(slug, fileName);
}

export function normalizeKpiIdentifier(input: string) {
  return (input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function getKpiBrandAssetOptions() {
  return BRAND_ASSET_OPTIONS;
}

export function getKpiVectorIconOptions() {
  return VECTOR_ICON_OPTIONS;
}

export function getKpiTypeIconTreatment(type: KpiType | string | null | undefined) {
  if (type === 'PC') return KPI_TYPE_ICON_TREATMENTS.PC;
  if (type === 'GP') return KPI_TYPE_ICON_TREATMENTS.GP;
  if (type === 'VP') return KPI_TYPE_ICON_TREATMENTS.VP;
  if (type === 'Custom') return KPI_TYPE_ICON_TREATMENTS.Custom;
  return KPI_TYPE_ICON_TREATMENTS.default;
}

export function defaultKpiIconDraft(source: KpiAuthoringIconSource) {
  if (source === 'brand_asset') {
    return {
      icon_source: 'brand_asset' as const,
      icon_name: BRAND_ASSET_OPTIONS[0]?.key ?? null,
      icon_emoji: null,
      icon_file: BRAND_ASSET_OPTIONS[0]?.key ?? null,
    };
  }
  if (source === 'vector_icon') {
    return {
      icon_source: 'vector_icon' as const,
      icon_name: VECTOR_ICON_OPTIONS[0]?.name ?? null,
      icon_emoji: null,
      icon_file: null,
    };
  }
  return {
    icon_source: 'brand_asset' as const,
    icon_name: BRAND_ASSET_OPTIONS[0]?.key ?? null,
    icon_emoji: null,
    icon_file: BRAND_ASSET_OPTIONS[0]?.key ?? null,
  };
}

export function resolveKpiIcon(metadata: KpiIconMetadata): KpiIconResolution {
  const iconSource = metadata.icon_source ?? null;
  const iconName = typeof metadata.icon_name === 'string' ? metadata.icon_name.trim() : '';
  const iconEmoji = typeof metadata.icon_emoji === 'string' ? metadata.icon_emoji.trim() : '';
  const iconFile = typeof metadata.icon_file === 'string' ? metadata.icon_file.trim() : '';

  if (iconSource === 'phosphor' && iconName) {
    return { kind: 'phosphor', iconName, resolvedSource: 'metadata' };
  }
  if (iconSource === 'vector_icon' && iconName) {
    return { kind: 'vector_icon', iconName, resolvedSource: 'metadata' };
  }
  if (iconSource === 'brand_asset') {
    const brandAsset = resolveBrandAsset(iconName || iconFile);
    if (brandAsset) return { kind: 'brand_asset', imageSource: brandAsset, resolvedSource: 'metadata' };
  }
  if (iconFile) {
    const brandAsset = resolveBrandAsset(iconFile);
    if (brandAsset) return { kind: 'brand_asset', imageSource: brandAsset, resolvedSource: 'icon_file' };
  }

  const legacyAsset = resolveLegacyBrandAsset(metadata);
  if (legacyAsset) {
    return { kind: 'brand_asset', imageSource: legacyAsset, resolvedSource: 'legacy' };
  }

  const legacyVectorIcon = resolveLegacyVectorIcon(metadata, iconEmoji);
  if (legacyVectorIcon) {
    return {
      kind: 'vector_icon',
      iconName: legacyVectorIcon,
      resolvedSource: iconSource === 'emoji' || iconEmoji ? 'legacy' : 'default',
    };
  }

  return { kind: 'vector_icon', iconName: defaultVectorIconForType(metadata.type), resolvedSource: 'default' };
}

function resolveBrandAsset(rawName: string | null | undefined) {
  const normalized = String(rawName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return brandAssetByNormalizedKey.get(normalized) ?? null;
}

function resolveLegacyBrandAsset(metadata: KpiIconMetadata) {
  const slug = normalizeKpiIdentifier(String(metadata.slug || metadata.name || ''));
  const exactBrandAssetKey = brandAssetKeyBySlug.get(slug);
  if (exactBrandAssetKey) return KPI_BRAND_ASSET_SOURCES[exactBrandAssetKey] ?? null;

  const name = String(metadata.name ?? '').toLowerCase();
  const type = String(metadata.type ?? '');

  if (type === 'PC') {
    if (name.includes('listing') && name.includes('taken')) return resolveBrandAsset('pc_listing_taken_v1.png');
    if (name.includes('buyer') && name.includes('contract')) return resolveBrandAsset('pc_buyer_contract_signed_v1.png');
    if (name.includes('appointment') && name.includes('buyer')) return resolveBrandAsset('pc_appointment_set_buyer_v1.png');
    if (name.includes('appointment') && name.includes('seller')) return resolveBrandAsset('pc_appointment_set_seller_v1.png');
    if (name.includes('coffee') || name.includes('lunch')) return resolveBrandAsset('pc_coffee_lunch_with_sphere_v1.png');
    if (name.includes('conversation')) return resolveBrandAsset('pc_conversations_held_v1.png');
    if (name.includes('door')) return resolveBrandAsset('pc_door_knock_logged_v1.png');
    if (name.includes('cold call') || (name.includes('phone') && name.includes('follow'))) return resolveBrandAsset('pc_fsbo_expired_call_v1.png');
    if (name.includes('referral') || (name.includes('user') && name.includes('add'))) return resolveBrandAsset('pc_new_client_logged_v1.png');
    if (name.includes('sphere')) return resolveBrandAsset('pc_sphere_call_v1.png');
    if (name.includes('mail') || name.includes('email') || name.includes('text') || name.includes('dm')) return resolveBrandAsset('pc_text_dm_conversation_v1.png');
    if (name.includes('open house')) return resolveBrandAsset('pc_open_house_logged_v1.png');
    if (name.includes('phone call')) return resolveBrandAsset('pc_phone_call_logged_v1.png');
  }

  if (type === 'GP') {
    if (name.includes('buyer consult') || (name.includes('chat') && name.includes('check'))) return resolveBrandAsset('gp_buyer_consult_held_v1.png');
    if (name.includes('system') || name.includes('process') || name.includes('automation')) return resolveBrandAsset('gp_automation_rule_added_v1.png');
    if (name.includes('training') || name.includes('read') || name.includes('book') || name.includes('learn')) return resolveBrandAsset('gp_business_book_completed_v1.png');
    if (name.includes('call')) return resolveBrandAsset('gp_buyer_consult_held_v1.png');
    if (name.includes('tag') || name.includes('crm')) return resolveBrandAsset('gp_crm_tag_applied_v1.png');
    if (name.includes('database')) return resolveBrandAsset('gp_database_segmented_cleaned_v1.png');
    if (name.includes('referral') || name.includes('community') || name.includes('network') || name.includes('subscriber')) return resolveBrandAsset('gp_email_subscribers_added_v1.png');
    if (name.includes('presentation') || name.includes('listing presentation')) return resolveBrandAsset('gp_listing_presentation_given_v1.png');
    if (name.includes('video') || name.includes('content')) return resolveBrandAsset('gp_listing_video_created_v1.png');
    if (name.includes('social') || name.includes('post') || name.includes('share') || name.includes('marketing')) return resolveBrandAsset('gp_social_posts_shared_v1.png');
    if (name.includes('plan') || name.includes('goal') || name.includes('schedule')) return resolveBrandAsset('gp_smart_plan_activated_v1.png');
    if (name.includes('pipeline') && (name.includes('clean') || name.includes('cleanup'))) return resolveBrandAsset('gp_pipeline_cleaned_up_v1.png');
    if (name.includes('time block')) return resolveBrandAsset('gp_time_blocks_honored_v1.png');
  }

  if (type === 'VP') {
    if (name.includes('workout') || name.includes('fitness') || name.includes('exercise')) return resolveBrandAsset('vp_exercise_session_v1.png');
    if (name.includes('family') || name.includes('gratitude') || name.includes('relationship') || name.includes('heart')) return resolveBrandAsset('vp_gratitude_entry_v1.png');
    if (name.includes('home') || name.includes('house')) return resolveBrandAsset('vp_outdoor_time_logged_v1.png');
    if (name.includes('sleep') || name.includes('rest') || name.includes('recovery')) return resolveBrandAsset('vp_good_night_of_sleep_v1.png');
    if (name.includes('prayer') || name.includes('meditat')) return resolveBrandAsset('vp_prayer_meditation_time_v1.png');
    if (name.includes('mind') || name.includes('wellness')) return resolveBrandAsset('vp_mindfulness_breath_reset_v1.png');
    if (name.includes('walk') || name.includes('step')) return resolveBrandAsset('vp_steps_goal_met_walk_completed_v1.png');
  }

  return null;
}

function resolveLegacyVectorIcon(metadata: KpiIconMetadata, legacyEmoji?: string) {
  const name = String(metadata.name ?? '').toLowerCase();
  const type = String(metadata.type ?? '');

  if (name.includes('cold call') || name.includes('phone') || name.includes('sphere')) return 'phone-outline';
  if (name.includes('appointment') || name.includes('meeting')) return 'calendar-check-outline';
  if (name.includes('coffee') || name.includes('lunch')) return 'coffee-outline';
  if (name.includes('contract')) return 'file-document-outline';
  if (name.includes('listing')) return 'home-outline';
  if (name.includes('buyer')) return 'account-outline';
  if (name.includes('seller')) return 'account-tie-outline';
  if (name.includes('closing') || name.includes('deal closed') || name.includes('actual gci')) return 'trophy-outline';
  if (name.includes('open house')) return 'home-city-outline';
  if (name.includes('showing') || name.includes('tour')) return 'door-open';
  if (name.includes('mail') || name.includes('email')) return 'email-outline';
  if (name.includes('social') || name.includes('post') || name.includes('content')) return 'bullhorn-outline';
  if (name.includes('referral')) return 'account-switch-outline';
  if (name.includes('follow')) return 'refresh';
  if (name.includes('video')) return 'camera-outline';
  if (name.includes('training') || name.includes('course') || name.includes('learn') || name.includes('coach')) {
    return 'book-open-variant';
  }
  if (name.includes('challenge')) return 'flag-checkered';
  if (name.includes('health') || name.includes('fitness') || name.includes('workout')) return 'run-fast';
  if (name.includes('sleep')) return 'sleep';
  if (name.includes('mindset') || name.includes('gratitude')) return 'sparkles';
  if (name.includes('family') || name.includes('relationship')) return 'heart-outline';

  if (legacyEmoji) {
    const emojiFallback = vectorIconForLegacyEmoji(legacyEmoji);
    if (emojiFallback) return emojiFallback;
  }

  return defaultVectorIconForType(type);
}

function canonicalSlugFromBrandAsset(fileName: string) {
  return fileName
    .replace(/^(pc|gp|vp)_/i, '')
    .replace(/_v\d+\.png$/i, '')
    .trim()
    .toLowerCase();
}

function formatBrandAssetLabel(fileName: string) {
  const withoutExt = fileName.replace(/\.png$/i, '');
  const withoutPrefix = withoutExt.replace(/^(pc|gp|vp)_/i, '');
  const withoutVersion = withoutPrefix.replace(/_v\d+$/i, '');
  return withoutVersion
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function vectorIconForLegacyEmoji(emoji: string) {
  if (emoji.includes('📞')) return 'phone-outline';
  if (emoji.includes('📅')) return 'calendar-check-outline';
  if (emoji.includes('👥')) return 'account-group-outline';
  if (emoji.includes('🏠')) return 'home-outline';
  if (emoji.includes('💬')) return 'message-text-outline';
  if (emoji.includes('📈')) return 'chart-line';
  if (emoji.includes('🏆')) return 'trophy-outline';
  if (emoji.includes('📚')) return 'book-open-variant';
  if (emoji.includes('💡')) return 'lightbulb-outline';
  if (emoji.includes('🔥')) return 'lightning-bolt-outline';
  if (emoji.includes('✨')) return 'sparkles';
  if (emoji.includes('🚀')) return 'rocket-launch-outline';
  if (emoji.includes('🧠')) return 'brain';
  if (emoji.includes('❤️')) return 'heart-outline';
  if (emoji.includes('💪')) return 'run-fast';
  if (emoji.includes('🌿')) return 'sprout-outline';
  if (emoji.includes('☀️')) return 'weather-sunny';
  if (emoji.includes('🧘')) return 'meditation';
  if (emoji.includes('🎥')) return 'camera-outline';
  if (emoji.includes('✉️')) return 'email-outline';
  if (emoji.includes('🤝')) return 'handshake-outline';
  if (emoji.includes('📌')) return 'map-marker-outline';
  if (emoji.includes('🔁')) return 'refresh';
  if (emoji.includes('🛠️')) return 'tools';
  if (emoji.includes('✅')) return 'check-circle-outline';
  if (emoji.includes('📝')) return 'note-text-outline';
  if (emoji.includes('📣')) return 'bullhorn-outline';
  if (emoji.includes('⭐')) return 'star-outline';
  if (emoji.includes('🎯')) return 'bullseye-arrow';
  if (emoji.includes('🧩')) return 'puzzle-outline';
  return null;
}

function defaultVectorIconForType(type: KpiType | string | null | undefined) {
  if (type === 'PC') return 'calendar-check-outline';
  if (type === 'GP') return 'chart-line';
  if (type === 'VP') return 'heart-pulse';
  if (type === 'Custom') return 'puzzle-outline';
  return 'chart-box-outline';
}
