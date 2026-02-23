import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Polygon } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';
import { colors, radii } from '../theme/tokens';

type DashboardPayload = {
  projection: {
    pc_90d: number;
    pc_next_365?: number;
    projected_gci_ytd?: number;
    confidence: {
      score: number;
      band: 'green' | 'yellow' | 'red';
      components?: {
        historical_accuracy_score: number;
        pipeline_health_score: number;
        inactivity_score: number;
        total_actual_gci_last_12m?: number;
      };
    };
    bump_context?: {
      gp_tier: number;
      vp_tier: number;
      total_bump_percent: number;
    };
    required_pipeline_anchors: Array<{
      kpi_id?: string;
      anchor_type: string;
      anchor_value: number;
      updated_at: string;
    }>;
  };
  actuals: {
    actual_gci: number;
    actual_gci_last_365?: number;
    actual_gci_ytd?: number;
    deals_closed: number;
  };
  points: {
    gp: number;
    vp: number;
  };
  activity: {
    total_logs: number;
    active_days: number;
  };
  loggable_kpis: Array<{
    id: string;
    name: string;
    type: 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';
    requires_direct_value_input: boolean;
  }>;
  recent_logs?: Array<{
    id: string;
    kpi_id: string;
    kpi_name?: string;
    event_timestamp: string;
    pc_generated: number;
    actual_gci_delta: number;
    points_generated: number;
  }>;
  chart?: {
    past_actual_6m: Array<{ month_start: string; value: number }>;
    future_projected_12m: Array<{ month_start: string; value: number }>;
    confidence_band_by_month?: Array<'green' | 'yellow' | 'red'>;
    boundary_index?: number;
  };
};

type MePayload = {
  user_metadata?: {
    selected_kpis?: string[];
  };
};

type LoadState = 'loading' | 'empty' | 'error' | 'ready';
type Segment = 'PC' | 'GP' | 'VP';
type ViewMode = 'home' | 'log';
type BottomTab = 'home' | 'challenge' | 'newkpi' | 'team' | 'user';
type DrawerFilter = 'All' | 'PC' | 'GP' | 'VP';
type HomePanel = 'Quick' | 'PC' | 'GP' | 'VP';

type PendingDirectLog = {
  kpiId: string;
  name: string;
  type: DashboardPayload['loggable_kpis'][number]['type'];
};

const KPI_TYPE_SORT_ORDER: Record<'PC' | 'GP' | 'VP', number> = {
  PC: 0,
  GP: 1,
  VP: 2,
};

const HOME_PANEL_ORDER: HomePanel[] = ['Quick', 'PC', 'GP', 'VP'];
const HOME_PANEL_LABELS: Record<HomePanel, string> = {
  Quick: 'QUICK LOG',
  PC: 'PROJECTIONS',
  GP: 'GROWTH',
  VP: 'VITALITY',
};
const HOME_PANEL_ICONS: Record<HomePanel, string> = {
  Quick: '⚡',
  PC: '📈',
  GP: '🏙️',
  VP: '🌳',
};
const GAMEPLAY_MODE_ACTIVE_WIDTH = 170;
const GAMEPLAY_MODE_INACTIVE_WIDTH = 52;
const GAMEPLAY_MODE_GAP = 6;
const GAMEPLAY_MODE_LOOP_CYCLES = 3;
const MODE_RAIL_LOOP_CYCLES = 15;
const MODE_RAIL_MIDDLE_CYCLE = Math.floor(MODE_RAIL_LOOP_CYCLES / 2);

function fmtUsd(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtNum(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function confidenceColor(band: 'green' | 'yellow' | 'red') {
  if (band === 'green') return '#2f9f56';
  if (band === 'yellow') return '#e3a62a';
  return '#d94d4d';
}

function toPointsSpaced(values: number[], step: number, height: number, min: number, max: number, startX = 0) {
  if (values.length < 2) return '';
  return values
    .map((value, idx) => {
      const clamped = Math.max(min, Math.min(max, value));
      const y = height - ((clamped - min) / (max - min || 1)) * height;
      const x = startX + idx * step;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function yForValue(value: number, height: number, min: number, max: number) {
  const clamped = Math.max(min, Math.min(max, value));
  return height - ((clamped - min) / (max - min || 1)) * height;
}

function formatUsdAxis(valueK: number) {
  const dollars = valueK * 1000;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1000) {
    const k = dollars / 1000;
    const label = k >= 100 ? `${Math.round(k)}` : k.toFixed(1).replace(/\.0$/, '');
    return `$${label}k`;
  }
  return `$${Math.round(dollars)}`;
}

function kpiTypeTint(type: DashboardPayload['loggable_kpis'][number]['type']) {
  if (type === 'PC') return '#e4f7ea';
  if (type === 'GP') return '#e5efff';
  if (type === 'VP') return '#fff0e2';
  if (type === 'Custom') return '#f3e8ff';
  return '#eceff3';
}

function kpiTypeAccent(type: DashboardPayload['loggable_kpis'][number]['type']) {
  if (type === 'PC') return '#2f9f56';
  if (type === 'GP') return '#2158d5';
  if (type === 'VP') return '#e38a1f';
  if (type === 'Custom') return '#7a4cc8';
  return '#48505f';
}

const KPI_ICON_ASSETS = {
  phone_call_logged: require('../assets/figma/kpi_icon_bank/pc_phone_call_logged_v1.png'),
  sphere_call: require('../assets/figma/kpi_icon_bank/pc_sphere_call_v1.png'),
  fsbo_expired_call: require('../assets/figma/kpi_icon_bank/pc_fsbo_expired_call_v1.png'),
  door_knock_logged: require('../assets/figma/kpi_icon_bank/pc_door_knock_logged_v1.png'),
  appointment_set_buyer: require('../assets/figma/kpi_icon_bank/pc_appointment_set_buyer_v1.png'),
  appointment_set_seller: require('../assets/figma/kpi_icon_bank/pc_appointment_set_seller_v1.png'),
  coffee_lunch_with_sphere: require('../assets/figma/kpi_icon_bank/pc_coffee_lunch_with_sphere_v1.png'),
  conversations_held: require('../assets/figma/kpi_icon_bank/pc_conversations_held_v1.png'),
  listing_taken: require('../assets/figma/kpi_icon_bank/pc_listing_taken_v1.png'),
  buyer_contract_signed: require('../assets/figma/kpi_icon_bank/pc_buyer_contract_signed_v1.png'),
  new_client_logged: require('../assets/figma/kpi_icon_bank/pc_new_client_logged_v1.png'),
  text_dm_conversation: require('../assets/figma/kpi_icon_bank/pc_text_dm_conversation_v1.png'),
  open_house_logged: require('../assets/figma/kpi_icon_bank/pc_open_house_logged_v1.png'),
  seasonal_check_in_call: require('../assets/figma/kpi_icon_bank/pc_seasonal_check_in_call_v1.png'),
  pop_by_delivered: require('../assets/figma/kpi_icon_bank/pc_pop_by_delivered_v1.png'),
  holiday_card_sent: require('../assets/figma/kpi_icon_bank/pc_holiday_card_sent_v1.png'),
  time_blocks_honored: require('../assets/figma/kpi_icon_bank/gp_time_blocks_honored_v1.png'),
  social_posts_shared: require('../assets/figma/kpi_icon_bank/gp_social_posts_shared_v1.png'),
  crm_tag_applied: require('../assets/figma/kpi_icon_bank/gp_crm_tag_applied_v1.png'),
  smart_plan_activated: require('../assets/figma/kpi_icon_bank/gp_smart_plan_activated_v1.png'),
  email_subscribers_added: require('../assets/figma/kpi_icon_bank/gp_email_subscribers_added_v1.png'),
  listing_video_created: require('../assets/figma/kpi_icon_bank/gp_listing_video_created_v1.png'),
  listing_presentation_given: require('../assets/figma/kpi_icon_bank/gp_listing_presentation_given_v1.png'),
  buyer_consult_held: require('../assets/figma/kpi_icon_bank/gp_buyer_consult_held_v1.png'),
  business_book_completed: require('../assets/figma/kpi_icon_bank/gp_business_book_completed_v1.png'),
  pipeline_cleaned_up: require('../assets/figma/kpi_icon_bank/gp_pipeline_cleaned_up_v1.png'),
  automation_rule_added: require('../assets/figma/kpi_icon_bank/gp_automation_rule_added_v1.png'),
  roleplay_session_completed: require('../assets/figma/kpi_icon_bank/gp_roleplay_session_completed_v1.png'),
  script_practice_session: require('../assets/figma/kpi_icon_bank/gp_script_practice_session_v1.png'),
  objection_handling_reps_logged: require('../assets/figma/kpi_icon_bank/gp_objection_handling_reps_logged_v1.png'),
  cma_created_practice_or_live: require('../assets/figma/kpi_icon_bank/gp_cma_created_practice_or_live_v1.png'),
  market_stats_review_weekly: require('../assets/figma/kpi_icon_bank/gp_market_stats_review_weekly_v1.png'),
  offer_strategy_review_completed: require('../assets/figma/kpi_icon_bank/gp_offer_strategy_review_completed_v1.png'),
  deal_review_postmortem_completed: require('../assets/figma/kpi_icon_bank/gp_deal_review_postmortem_completed_v1.png'),
  negotiation_practice_session: require('../assets/figma/kpi_icon_bank/gp_negotiation_practice_session_v1.png'),
  content_batch_created: require('../assets/figma/kpi_icon_bank/gp_content_batch_created_v1.png'),
  database_segmented_cleaned: require('../assets/figma/kpi_icon_bank/gp_database_segmented_cleaned_v1.png'),
  sop_created_or_updated: require('../assets/figma/kpi_icon_bank/gp_sop_created_or_updated_v1.png'),
  weekly_scorecard_review: require('../assets/figma/kpi_icon_bank/gp_weekly_scorecard_review_v1.png'),
  coaching_session_attended: require('../assets/figma/kpi_icon_bank/gp_coaching_session_attended_v1.png'),
  training_module_completed: require('../assets/figma/kpi_icon_bank/gp_training_module_completed_v1.png'),
  gratitude_entry: require('../assets/figma/kpi_icon_bank/vp_gratitude_entry_v1.png'),
  good_night_of_sleep: require('../assets/figma/kpi_icon_bank/vp_good_night_of_sleep_v1.png'),
  exercise_session: require('../assets/figma/kpi_icon_bank/vp_exercise_session_v1.png'),
  prayer_meditation_time: require('../assets/figma/kpi_icon_bank/vp_prayer_meditation_time_v1.png'),
  hydration_goal_met: require('../assets/figma/kpi_icon_bank/vp_hydration_goal_met_v1.png'),
  whole_food_meal_logged: require('../assets/figma/kpi_icon_bank/vp_whole_food_meal_logged_v1.png'),
  steps_goal_met_walk_completed: require('../assets/figma/kpi_icon_bank/vp_steps_goal_met_walk_completed_v1.png'),
  stretching_mobility_session: require('../assets/figma/kpi_icon_bank/vp_stretching_mobility_session_v1.png'),
  outdoor_time_logged: require('../assets/figma/kpi_icon_bank/vp_outdoor_time_logged_v1.png'),
  screen_curfew_honored: require('../assets/figma/kpi_icon_bank/vp_screen_curfew_honored_v1.png'),
  mindfulness_breath_reset: require('../assets/figma/kpi_icon_bank/vp_mindfulness_breath_reset_v1.png'),
  sabbath_block_honored_rest: require('../assets/figma/kpi_icon_bank/vp_sabbath_block_honored_rest_v1.png'),
  social_connection_non_work: require('../assets/figma/kpi_icon_bank/vp_social_connection_non_work_v1.png'),
  journal_entry_non_gratitude: require('../assets/figma/kpi_icon_bank/vp_journal_entry_non_gratitude_v1.png'),
} as const;

const KPI_ICON_BY_NORMALIZED_NAME = {
  phone_call_logged: KPI_ICON_ASSETS.phone_call_logged,
  sphere_call: KPI_ICON_ASSETS.sphere_call,
  fsbo_expired_call: KPI_ICON_ASSETS.fsbo_expired_call,
  door_knock_logged: KPI_ICON_ASSETS.door_knock_logged,
  appointment_set_buyer: KPI_ICON_ASSETS.appointment_set_buyer,
  appointment_set_seller: KPI_ICON_ASSETS.appointment_set_seller,
  coffee_lunch_with_sphere: KPI_ICON_ASSETS.coffee_lunch_with_sphere,
  conversations_held: KPI_ICON_ASSETS.conversations_held,
  listing_taken: KPI_ICON_ASSETS.listing_taken,
  buyer_contract_signed: KPI_ICON_ASSETS.buyer_contract_signed,
  new_client_logged: KPI_ICON_ASSETS.new_client_logged,
  text_dm_conversation: KPI_ICON_ASSETS.text_dm_conversation,
  open_house_logged: KPI_ICON_ASSETS.open_house_logged,
  seasonal_check_in_call: KPI_ICON_ASSETS.seasonal_check_in_call,
  pop_by_delivered: KPI_ICON_ASSETS.pop_by_delivered,
  holiday_card_sent: KPI_ICON_ASSETS.holiday_card_sent,
  time_blocks_honored: KPI_ICON_ASSETS.time_blocks_honored,
  social_posts_shared: KPI_ICON_ASSETS.social_posts_shared,
  crm_tag_applied: KPI_ICON_ASSETS.crm_tag_applied,
  smart_plan_activated: KPI_ICON_ASSETS.smart_plan_activated,
  email_subscribers_added: KPI_ICON_ASSETS.email_subscribers_added,
  listing_video_created: KPI_ICON_ASSETS.listing_video_created,
  listing_presentation_given: KPI_ICON_ASSETS.listing_presentation_given,
  buyer_consult_held: KPI_ICON_ASSETS.buyer_consult_held,
  business_book_completed: KPI_ICON_ASSETS.business_book_completed,
  pipeline_cleaned_up: KPI_ICON_ASSETS.pipeline_cleaned_up,
  automation_rule_added: KPI_ICON_ASSETS.automation_rule_added,
  roleplay_session_completed: KPI_ICON_ASSETS.roleplay_session_completed,
  script_practice_session: KPI_ICON_ASSETS.script_practice_session,
  objection_handling_reps_logged: KPI_ICON_ASSETS.objection_handling_reps_logged,
  cma_created_practice_or_live: KPI_ICON_ASSETS.cma_created_practice_or_live,
  market_stats_review_weekly: KPI_ICON_ASSETS.market_stats_review_weekly,
  offer_strategy_review_completed: KPI_ICON_ASSETS.offer_strategy_review_completed,
  deal_review_postmortem_completed: KPI_ICON_ASSETS.deal_review_postmortem_completed,
  negotiation_practice_session: KPI_ICON_ASSETS.negotiation_practice_session,
  content_batch_created: KPI_ICON_ASSETS.content_batch_created,
  database_segmented_cleaned: KPI_ICON_ASSETS.database_segmented_cleaned,
  sop_created_or_updated: KPI_ICON_ASSETS.sop_created_or_updated,
  weekly_scorecard_review: KPI_ICON_ASSETS.weekly_scorecard_review,
  coaching_session_attended: KPI_ICON_ASSETS.coaching_session_attended,
  training_module_completed: KPI_ICON_ASSETS.training_module_completed,
  gratitude_entry: KPI_ICON_ASSETS.gratitude_entry,
  good_night_of_sleep: KPI_ICON_ASSETS.good_night_of_sleep,
  exercise_session: KPI_ICON_ASSETS.exercise_session,
  prayer_meditation_time: KPI_ICON_ASSETS.prayer_meditation_time,
  hydration_goal_met: KPI_ICON_ASSETS.hydration_goal_met,
  whole_food_meal_logged: KPI_ICON_ASSETS.whole_food_meal_logged,
  steps_goal_met_walk_completed: KPI_ICON_ASSETS.steps_goal_met_walk_completed,
  stretching_mobility_session: KPI_ICON_ASSETS.stretching_mobility_session,
  outdoor_time_logged: KPI_ICON_ASSETS.outdoor_time_logged,
  screen_curfew_honored: KPI_ICON_ASSETS.screen_curfew_honored,
  mindfulness_breath_reset: KPI_ICON_ASSETS.mindfulness_breath_reset,
  sabbath_block_honored_rest: KPI_ICON_ASSETS.sabbath_block_honored_rest,
  social_connection_non_work: KPI_ICON_ASSETS.social_connection_non_work,
  journal_entry_non_gratitude: KPI_ICON_ASSETS.journal_entry_non_gratitude,
} as const;

const CUSTOM_KPI_ICON_BANK = ['🧩', '⭐', '🎯', '🛠️', '📌', '🌀', '✨', '🧠'] as const;

function normalizeKpiIdentifier(input: string) {
  return (input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function customKpiEmoji(name: string) {
  const idx = hashString(name || 'custom') % CUSTOM_KPI_ICON_BANK.length;
  return CUSTOM_KPI_ICON_BANK[idx];
}

function kpiImageSourceFor(kpi: DashboardPayload['loggable_kpis'][number]) {
  const name = (kpi.name || '').toLowerCase();
  const exact = KPI_ICON_BY_NORMALIZED_NAME[normalizeKpiIdentifier(kpi.name || '') as keyof typeof KPI_ICON_BY_NORMALIZED_NAME];
  if (exact) return exact;

  if (kpi.type === 'PC') {
    if (name.includes('listing') && name.includes('taken')) return KPI_ICON_ASSETS.listing_taken;
    if (name.includes('buyer') && name.includes('contract')) return KPI_ICON_ASSETS.buyer_contract_signed;
    if (name.includes('appointment') && name.includes('buyer')) return KPI_ICON_ASSETS.appointment_set_buyer;
    if (name.includes('appointment') && name.includes('seller')) return KPI_ICON_ASSETS.appointment_set_seller;
    if (name.includes('coffee') || name.includes('lunch')) return KPI_ICON_ASSETS.coffee_lunch_with_sphere;
    if (name.includes('conversation')) return KPI_ICON_ASSETS.conversations_held;
    if (name.includes('door')) return KPI_ICON_ASSETS.door_knock_logged;
    if (name.includes('cold call') || (name.includes('phone') && name.includes('follow'))) return KPI_ICON_ASSETS.fsbo_expired_call;
    if (name.includes('referral') || (name.includes('user') && name.includes('add'))) return KPI_ICON_ASSETS.new_client_logged;
    if (name.includes('sphere')) return KPI_ICON_ASSETS.sphere_call;
    if (name.includes('mail') || name.includes('email') || name.includes('text') || name.includes('dm')) return KPI_ICON_ASSETS.text_dm_conversation;
    if (name.includes('open house')) return KPI_ICON_ASSETS.open_house_logged;
    if (name.includes('phone call')) return KPI_ICON_ASSETS.phone_call_logged;
  }

  if (kpi.type === 'GP') {
    if (name.includes('buyer consult') || (name.includes('chat') && name.includes('check'))) return KPI_ICON_ASSETS.buyer_consult_held;
    if (name.includes('system') || name.includes('process') || name.includes('automation')) return KPI_ICON_ASSETS.automation_rule_added;
    if (name.includes('training') || name.includes('read') || name.includes('book') || name.includes('learn')) return KPI_ICON_ASSETS.business_book_completed;
    if (name.includes('call')) return KPI_ICON_ASSETS.buyer_consult_held;
    if (name.includes('tag') || name.includes('crm')) return KPI_ICON_ASSETS.crm_tag_applied;
    if (name.includes('database')) return KPI_ICON_ASSETS.database_segmented_cleaned;
    if (name.includes('referral') || name.includes('community') || name.includes('network') || name.includes('subscriber')) return KPI_ICON_ASSETS.email_subscribers_added;
    if (name.includes('presentation') || name.includes('listing presentation')) return KPI_ICON_ASSETS.listing_presentation_given;
    if (name.includes('video') || name.includes('content')) return KPI_ICON_ASSETS.listing_video_created;
    if (name.includes('social') || name.includes('post') || name.includes('share') || name.includes('marketing')) return KPI_ICON_ASSETS.social_posts_shared;
    if (name.includes('plan') || name.includes('goal') || name.includes('schedule')) return KPI_ICON_ASSETS.smart_plan_activated;
    if (name.includes('pipeline') && (name.includes('clean') || name.includes('cleanup'))) return KPI_ICON_ASSETS.pipeline_cleaned_up;
    if (name.includes('time block')) return KPI_ICON_ASSETS.time_blocks_honored;
  }

  if (kpi.type === 'VP') {
    if (name.includes('workout') || name.includes('fitness') || name.includes('exercise')) return KPI_ICON_ASSETS.exercise_session;
    if (name.includes('family') || name.includes('gratitude') || name.includes('relationship') || name.includes('heart')) return KPI_ICON_ASSETS.gratitude_entry;
    if (name.includes('home') || name.includes('house')) return KPI_ICON_ASSETS.outdoor_time_logged;
    if (name.includes('sleep') || name.includes('rest') || name.includes('recovery')) return KPI_ICON_ASSETS.good_night_of_sleep;
    if (name.includes('prayer') || name.includes('meditat')) return KPI_ICON_ASSETS.prayer_meditation_time;
    if (name.includes('mind') || name.includes('wellness')) return KPI_ICON_ASSETS.mindfulness_breath_reset;
    if (name.includes('walk') || name.includes('step')) return KPI_ICON_ASSETS.steps_goal_met_walk_completed;
  }

  return null;
}

function kpiEmojiFor(kpi: DashboardPayload['loggable_kpis'][number]) {
  const name = (kpi.name || '').toLowerCase();

  if (kpi.type === 'Custom') return customKpiEmoji(kpi.name || 'custom');
  if (name.includes('cold call') || name.includes('phone') || name.includes('sphere')) return '📞';
  if (name.includes('appointment') || name.includes('meeting')) return '🤝';
  if (name.includes('coffee') || name.includes('lunch')) return '☕';
  if (name.includes('contract')) return '📄';
  if (name.includes('listing')) return '🏠';
  if (name.includes('buyer')) return '🧍';
  if (name.includes('seller')) return '🪧';
  if (name.includes('closing') || name.includes('deal closed') || name.includes('actual gci')) return '🏆';
  if (name.includes('open house')) return '🏡';
  if (name.includes('showing') || name.includes('tour')) return '🚪';
  if (name.includes('mail') || name.includes('email')) return '✉️';
  if (name.includes('social') || name.includes('post') || name.includes('content')) return '📣';
  if (name.includes('referral')) return '🔁';
  if (name.includes('follow')) return '🔄';
  if (name.includes('video')) return '🎥';
  if (name.includes('training') || name.includes('course') || name.includes('learn') || name.includes('coach')) return '📘';
  if (name.includes('challenge')) return '🏁';
  if (name.includes('health') || name.includes('fitness') || name.includes('workout')) return '💪';
  if (name.includes('sleep')) return '😴';
  if (name.includes('mindset') || name.includes('gratitude')) return '✨';
  if (name.includes('family') || name.includes('relationship')) return '❤️';

  if (kpi.type === 'PC') return '🟢';
  if (kpi.type === 'GP') return '🔵';
  if (kpi.type === 'VP') return '🟠';
  return '•';
}

function renderKpiIcon(kpi: DashboardPayload['loggable_kpis'][number]) {
  const imageSource = kpiImageSourceFor(kpi);
  if (imageSource) {
    return (
      <View style={styles.gridIconImageClip}>
        <Image source={imageSource} style={styles.gridIconImage} resizeMode="cover" />
      </View>
    );
  }
  return <Text style={styles.gridIcon}>{kpiEmojiFor(kpi)}</Text>;
}

function sortSelectableKpis(
  kpis: DashboardPayload['loggable_kpis']
): DashboardPayload['loggable_kpis'] {
  return [...kpis].sort((a, b) => {
    const typeDelta = (KPI_TYPE_SORT_ORDER[a.type as 'PC' | 'GP' | 'VP'] ?? 99) - (KPI_TYPE_SORT_ORDER[b.type as 'PC' | 'GP' | 'VP'] ?? 99);
    if (typeDelta !== 0) return typeDelta;
    return a.name.localeCompare(b.name);
  });
}

function normalizeManagedKpiIds(
  ids: string[],
  allSelectable: DashboardPayload['loggable_kpis']
): string[] {
  const byId = new Map(allSelectable.map((kpi) => [kpi.id, kpi]));
  const unique = Array.from(new Set(ids)).filter((id) => byId.has(id));
  const counts: Record<'PC' | 'GP' | 'VP', number> = { PC: 0, GP: 0, VP: 0 };
  const next: string[] = [];
  for (const id of unique) {
    const kpi = byId.get(id);
    if (!kpi) continue;
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      if (counts[kpi.type] >= 6) continue;
      counts[kpi.type] += 1;
      next.push(id);
    }
  }
  return next;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKeyValue: string) {
  const [year, month] = monthKeyValue.split('-').map(Number);
  const dt = new Date(year, (month ?? 1) - 1, 1);
  const mon = dt.toLocaleString(undefined, { month: 'short' });
  const yy = String(year).slice(-2);
  return `${mon} '${yy}`;
}

function monthLabelFromIsoMonthStart(isoValue: string) {
  if (typeof isoValue !== 'string' || isoValue.length < 7) return '';
  const year = Number(isoValue.slice(0, 4));
  const month = Number(isoValue.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';
  return monthLabel(`${year}-${String(month).padStart(2, '0')}`);
}

function formatLogDateHeading(isoDay: string) {
  const dt = new Date(`${isoDay}T12:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return isoDay;
  const formatted = dt.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'long',
  });
  return formatted.replace(',', '.');
}

function formatTodayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isoTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function chartFromPayload(payload: DashboardPayload | null) {
  const pastActualRows = payload?.chart?.past_actual_6m ?? [];
  const futureProjectedRows = payload?.chart?.future_projected_12m ?? [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const axisPastMonthKeys = Array.from({ length: 6 }).map((_, idx) =>
    monthKeyLocal(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + (idx - 5), 1))
  );
  const axisFutureMonthKeys = Array.from({ length: 12 }).map((_, idx) =>
    monthKeyLocal(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + (idx + 1), 1))
  );
  const monthKeys = [...axisPastMonthKeys, ...axisFutureMonthKeys];
  const labels = monthKeys.map((k) => monthLabel(k));

  const pastValueByKey = new Map(
    pastActualRows.map((row) => [String(row.month_start ?? '').slice(0, 7), Math.round(Number(row.value ?? 0) / 1000)])
  );
  const futureValueByKey = new Map(
    futureProjectedRows.map((row) => [String(row.month_start ?? '').slice(0, 7), Math.round(Number(row.value ?? 0) / 1000)])
  );
  const pastActual = axisPastMonthKeys.map((key) => Number(pastValueByKey.get(key) ?? 0));
  const futureProjected = axisFutureMonthKeys.map((key) => Number(futureValueByKey.get(key) ?? 0));

  const rawFutureBands = payload?.chart?.confidence_band_by_month ?? [];
  const futureBandByKey = new Map<string, 'green' | 'yellow' | 'red'>();
  futureProjectedRows.forEach((row, idx) => {
    const key = String(row.month_start ?? '').slice(0, 7);
    const band = rawFutureBands[idx];
    if (key && (band === 'green' || band === 'yellow' || band === 'red')) {
      futureBandByKey.set(key, band);
    }
  });
  const futureBands = axisFutureMonthKeys.map((key) => futureBandByKey.get(key) ?? 'yellow');

  const all = [...pastActual, ...futureProjected].filter((v) => Number.isFinite(v));
  const rawMin = all.length > 0 ? Math.min(...all) : 0;
  const rawMax = all.length > 0 ? Math.max(...all) : 120;
  const rawSpan = Math.max(0, rawMax - rawMin);
  const basePadding = rawSpan > 0 ? Math.max(8, rawSpan * 0.2) : Math.max(10, rawMax * 0.35);
  let min = Math.max(0, rawMin - basePadding);
  let max = rawMax + basePadding;
  if (max - min < 20) {
    const center = (max + min) / 2;
    min = Math.max(0, center - 10);
    max = min + 20;
  }
  if (max <= min) {
    min = 0;
    max = 120;
  }

  const roundDown = (value: number) => Math.floor(value / 5) * 5;
  const roundUp = (value: number) => Math.ceil(value / 5) * 5;
  min = Math.max(0, roundDown(min));
  max = Math.max(min + 5, roundUp(max));

  const step = 52;
  const dataWidth = Math.max(step, (labels.length - 1) * step);
  const chartWidth = Math.max(320, dataWidth + 24);
  const tickStep = (max - min) / 4;
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round(max - tickStep * i));
  const boundaryIndex = Math.max(0, pastActual.length - 1);
  const splitBaseIndex = boundaryIndex;
  const firstFutureIndex = pastActual.length;
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const splitOffsetFractionRaw = (dayOfMonth - 1) / Math.max(1, daysInCurrentMonth);
  const splitOffsetFraction = Math.max(0, Math.min(1, splitOffsetFractionRaw));
  const todayLabel = formatTodayLabel(now);

  return {
    labels,
    pastActual,
    futureProjected,
    futureBands,
    boundaryIndex,
    splitBaseIndex,
    firstFutureIndex,
    splitOffsetFraction,
    todayLabel,
    step,
    chartWidth,
    dataWidth,
    min,
    max,
    yTicks,
  };
}

const dashboardAssets = {
  crown: require('../assets/figma/dashboard/crown.png'),
  confettiLeft: require('../assets/figma/dashboard/confetti_left.png'),
  confettiRight: require('../assets/figma/dashboard/confetti_right.png'),
} as const;

type Props = {
  onOpenProfile?: () => void;
};

export default function KPIDashboardScreen({ onOpenProfile }: Props) {
  const { session } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [segment, setSegment] = useState<Segment>('PC');
  const [homePanel, setHomePanel] = useState<HomePanel>('Quick');
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [addDrawerVisible, setAddDrawerVisible] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>('All');
  const [managedKpiIds, setManagedKpiIds] = useState<string[]>([]);
  const [pendingDirectLog, setPendingDirectLog] = useState<PendingDirectLog | null>(null);
  const [directValue, setDirectValue] = useState('');
  const [refreshingConfidence, setRefreshingConfidence] = useState(false);
  const [showConfidenceTooltip, setShowConfidenceTooltip] = useState(false);
  const confidenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartScrollRef = useRef<ScrollView | null>(null);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [selectedLogDateIso, setSelectedLogDateIso] = useState<string | null>(null);
  const [homeVisualViewportWidth, setHomeVisualViewportWidth] = useState(0);
  const [homeGridViewportWidth, setHomeGridViewportWidth] = useState(0);
  const [hudActiveIndex, setHudActiveIndex] = useState(0);
  const [modeRailViewportWidth, setModeRailViewportWidth] = useState(0);
  const [modeRailActiveCycle, setModeRailActiveCycle] = useState(MODE_RAIL_MIDDLE_CYCLE);
  const homePanelAnim = useRef(new Animated.Value(HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'))).current;
  const modeRailScrollRef = useRef<ScrollView | null>(null);
  const modeRailVirtualIndexRef = useRef(MODE_RAIL_MIDDLE_CYCLE * HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'));
  const homePanelVirtualIndexRef = useRef(HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'));
  const homePanelDirectionRef = useRef<-1 | 0 | 1>(0);

  const gpUnlocked = (payload?.activity.active_days ?? 0) >= 3 || (payload?.activity.total_logs ?? 0) >= 20;
  const vpUnlocked = (payload?.activity.active_days ?? 0) >= 7 || (payload?.activity.total_logs ?? 0) >= 40;

  const saveManagedKpis = useCallback(
    async (nextIds: string[]) => {
      const token = session?.access_token;
      if (!token) return;
      try {
        await fetch(`${API_URL}/me`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ selected_kpis: nextIds }),
        });
      } catch {
        // keep local behavior even if persistence fails
      }
    },
    [session?.access_token]
  );

  const fetchDashboard = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setState('error');
      setError('Missing session token.');
      return;
    }

    try {
      const [dashRes, meRes] = await Promise.all([
        fetch(`${API_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const dashBody = await dashRes.json();
      const meBody = (await meRes.json()) as MePayload;

      if (!dashRes.ok) throw new Error(dashBody.error ?? 'Failed to load dashboard');

      const dashPayload = dashBody as DashboardPayload;
      setPayload(dashPayload);

      if (managedKpiIds.length === 0) {
        const fromProfile = Array.isArray(meBody?.user_metadata?.selected_kpis)
          ? meBody.user_metadata.selected_kpis.filter((id): id is string => typeof id === 'string')
          : [];
        const validIds = new Set(dashPayload.loggable_kpis.map((kpi) => kpi.id));
        const sortedSelectable = sortSelectableKpis(
          dashPayload.loggable_kpis.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP')
        );
        const profileValid = fromProfile.filter((id) => validIds.has(id));
        if (profileValid.length > 0) {
          setManagedKpiIds(normalizeManagedKpiIds(profileValid, sortedSelectable));
        } else {
          const defaults = normalizeManagedKpiIds(sortedSelectable.map((kpi) => kpi.id), sortedSelectable);
          setManagedKpiIds(defaults);
        }
      }

      const hasAnyData =
        Number(dashPayload.projection?.pc_90d ?? 0) > 0 ||
        Number(dashPayload.actuals?.actual_gci ?? 0) > 0 ||
        Number(dashPayload.activity?.total_logs ?? 0) > 0;
      setState(hasAnyData ? 'ready' : 'empty');
      setError(null);
    } catch (e: unknown) {
      setPayload(null);
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [managedKpiIds.length, session?.access_token]);

  React.useEffect(() => {
    if (state === 'loading') void fetchDashboard();
  }, [fetchDashboard, state]);

  React.useEffect(() => {
    if (state !== 'ready') return;
    void refreshConfidenceSnapshot();

    if (confidenceIntervalRef.current) {
      clearInterval(confidenceIntervalRef.current);
    }
    confidenceIntervalRef.current = setInterval(() => {
      void refreshConfidenceSnapshot();
    }, 60000);

    return () => {
      if (confidenceIntervalRef.current) {
        clearInterval(confidenceIntervalRef.current);
        confidenceIntervalRef.current = null;
      }
    };
  }, [state]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const allSelectableKpis = useMemo(
    () =>
      sortSelectableKpis(
        (payload?.loggable_kpis ?? []).filter(
          (kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP'
        )
      ),
    [payload?.loggable_kpis]
  );

  const managedKpis = useMemo(() => {
    const byId = new Map(allSelectableKpis.map((kpi) => [kpi.id, kpi]));
    const ordered = managedKpiIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
    const existingIds = new Set(ordered.map((kpi) => kpi.id));
    const fallback = allSelectableKpis.filter((kpi) => !existingIds.has(kpi.id));
    return [...ordered, ...fallback];
  }, [allSelectableKpis, managedKpiIds]);

  const managedKpiIdSet = useMemo(() => new Set(managedKpiIds), [managedKpiIds]);

  const quickLogKpis = useMemo(
    () => managedKpis.filter((kpi) => kpi.type === segment).slice(0, 6),
    [managedKpis, segment]
  );

  const homeQuickLog = useMemo(
    () => managedKpis.slice(0, 6),
    [managedKpis]
  );

  const homePanelKpis = useMemo(() => {
    if (homePanel === 'Quick') return homeQuickLog;
    return managedKpis.filter((kpi) => kpi.type === homePanel).slice(0, 6);
  }, [homePanel, homeQuickLog, managedKpis]);

  const chartSeries = useMemo(() => chartFromPayload(payload), [payload]);
  const chartSplitX =
    chartSeries.step * (chartSeries.splitBaseIndex + chartSeries.splitOffsetFraction);
  const cardMetrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const futureRows = payload?.chart?.future_projected_12m ?? [];
    const sumProjectedDays = (days: number) => {
      let remaining = Math.max(0, days);
      let total = 0;
      for (const row of futureRows) {
        if (remaining <= 0) break;
        const monthStart = new Date(String(row.month_start ?? ''));
        if (Number.isNaN(monthStart.getTime())) continue;
        const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        const takeDays = Math.min(remaining, monthDays);
        const monthValue = Number(row.value ?? 0);
        total += monthValue * (takeDays / Math.max(1, monthDays));
        remaining -= takeDays;
      }
      return total;
    };
    const projectedFromChart365 = futureRows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
    const projectedThisYearFromChart = futureRows.reduce((sum, row) => {
      const dt = new Date(String(row.month_start ?? ''));
      if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== currentYear) return sum;
      return sum + Number(row.value ?? 0);
    }, 0);

    const actualYtdRaw =
      Number(payload?.actuals.actual_gci_ytd ?? 0) ||
      Number(payload?.actuals.actual_gci ?? 0);
    const actualLast365Raw =
      Number(payload?.actuals.actual_gci_last_365 ?? 0) ||
      Number(payload?.projection.confidence.components?.total_actual_gci_last_12m ?? 0) ||
      Number(payload?.actuals.actual_gci ?? 0);
    const projectedNext365Raw =
      Number(payload?.projection.pc_next_365 ?? 0) ||
      projectedFromChart365 ||
      Number(payload?.projection.pc_90d ?? 0) * 4;
    const projectedNext60Raw = sumProjectedDays(60);
    const projectedNext180Raw = sumProjectedDays(180);
    const projectedYtdRaw =
      Number(payload?.projection.projected_gci_ytd ?? 0) ||
      (actualYtdRaw + projectedThisYearFromChart);
    const progressPctRaw =
      projectedNext365Raw > 0 ? Math.max(0, Math.min(999, (actualYtdRaw / projectedNext365Raw) * 100)) : 0;

    return {
      actualLast365: Number.isFinite(actualLast365Raw) ? actualLast365Raw : 0,
      actualYtd: Number.isFinite(actualYtdRaw) ? actualYtdRaw : 0,
      projectedNext365: Number.isFinite(projectedNext365Raw) ? projectedNext365Raw : 0,
      projectedNext60: Number.isFinite(projectedNext60Raw) ? projectedNext60Raw : 0,
      projectedNext180: Number.isFinite(projectedNext180Raw) ? projectedNext180Raw : 0,
      projectedYtd: Number.isFinite(projectedYtdRaw) ? projectedYtdRaw : 0,
      progressPct: Number.isFinite(progressPctRaw) ? progressPctRaw : 0,
    };
  }, [payload]);

  React.useEffect(() => {
    if (!chartViewportWidth || !chartScrollRef.current || viewMode !== 'home') return;
    const currentX = chartSplitX;
    const targetX = Math.max(0, currentX - chartViewportWidth / 3);
    const maxX = Math.max(0, chartSeries.dataWidth - chartViewportWidth + 24);
    const clampedX = Math.min(maxX, targetX);
    const run = () => chartScrollRef.current?.scrollTo({ x: clampedX, animated: false });
    run();
    const t = setTimeout(run, 80);
    return () => clearTimeout(t);
  }, [chartSeries.dataWidth, chartViewportWidth, viewMode, payload?.chart, chartSplitX]);
  const availableLogDates = useMemo(() => {
    const dates = new Set(
      (payload?.recent_logs ?? [])
        .map((log) => String(log.event_timestamp ?? ''))
        .filter(Boolean)
        .map((iso) => iso.slice(0, 10))
    );
    return [...dates].sort((a, b) => (a < b ? 1 : -1));
  }, [payload?.recent_logs]);

  const navigableLogDates = useMemo(() => {
    const dates = new Set(availableLogDates);
    dates.add(isoTodayLocal());
    return [...dates].sort((a, b) => (a < b ? 1 : -1));
  }, [availableLogDates]);

  React.useEffect(() => {
    const today = isoTodayLocal();
    setSelectedLogDateIso((prev) => {
      if (!prev) return today;
      if (navigableLogDates.includes(prev)) return prev;
      return today;
    });
  }, [navigableLogDates]);

  const selectedLogDate = selectedLogDateIso ?? isoTodayLocal();
  const selectedLogDateIndex = navigableLogDates.indexOf(selectedLogDate);
  const canGoBackwardDate = selectedLogDateIndex >= 0 && selectedLogDateIndex < navigableLogDates.length - 1;
  const canGoForwardDate = selectedLogDateIndex > 0;

  const todaysLogRows = useMemo(() => {
    const kpiNameById = new Map((payload?.loggable_kpis ?? []).map((kpi) => [kpi.id, kpi.name]));
    const counts = new Map<string, number>();
    for (const log of payload?.recent_logs ?? []) {
      if (!String(log.event_timestamp).startsWith(selectedLogDate)) continue;
      const id = String(log.kpi_id ?? '');
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([kpiId, count]) => ({
        kpiId,
        name: kpiNameById.get(kpiId) ?? 'KPI',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [payload?.loggable_kpis, payload?.recent_logs, selectedLogDate]);

  const recentLogEntries = useMemo(() => {
    const rows = [...(payload?.recent_logs ?? [])]
      .sort((a, b) => new Date(String(b.event_timestamp)).getTime() - new Date(String(a.event_timestamp)).getTime())
      .slice(0, 12);
    return rows;
  }, [payload?.recent_logs]);

  React.useEffect(() => {
    const panelCount = HOME_PANEL_ORDER.length;
    const currentVirtual = homePanelVirtualIndexRef.current;
    const baseTarget = panelCount + HOME_PANEL_ORDER.indexOf(homePanel);
    const candidates = [baseTarget - panelCount, baseTarget, baseTarget + panelCount];
    const dir = homePanelDirectionRef.current;
    let nextVirtual: number | null = null;

    if (dir === 1) {
      nextVirtual = candidates.find((v) => v > currentVirtual) ?? null;
    } else if (dir === -1) {
      nextVirtual = [...candidates].reverse().find((v) => v < currentVirtual) ?? null;
    }
    if (nextVirtual == null) {
      nextVirtual = candidates.reduce((best, v) =>
        Math.abs(v - currentVirtual) < Math.abs(best - currentVirtual) ? v : best
      );
    }

    Animated.timing(homePanelAnim, {
      toValue: nextVirtual,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      const normalized = panelCount + (((nextVirtual ?? baseTarget) % panelCount) + panelCount) % panelCount;
      homePanelVirtualIndexRef.current = normalized;
      homePanelAnim.setValue(normalized);
      homePanelDirectionRef.current = 0;
    });
  }, [homePanel, homePanelAnim]);

  React.useEffect(() => {
    if (!modeRailViewportWidth || !modeRailScrollRef.current) return;
    const ACTIVE_W = GAMEPLAY_MODE_ACTIVE_WIDTH;
    const INACTIVE_W = GAMEPLAY_MODE_INACTIVE_WIDTH;
    const GAP = GAMEPLAY_MODE_GAP;
    const sidePad = Math.max(0, modeRailViewportWidth / 2 - ACTIVE_W / 2);
    const panelCount = HOME_PANEL_ORDER.length;
    const baseIdx = HOME_PANEL_ORDER.indexOf(homePanel);
    const currentVirtual = modeRailVirtualIndexRef.current;
    const candidates = Array.from({ length: MODE_RAIL_LOOP_CYCLES }, (_, cycleIdx) => cycleIdx * panelCount + baseIdx);
    const dir = homePanelDirectionRef.current;
    let idx: number | null = null;

    if (dir === 1) {
      idx = candidates.find((v) => v > currentVirtual) ?? null;
    } else if (dir === -1) {
      idx = [...candidates].reverse().find((v) => v < currentVirtual) ?? null;
    }
    if (idx == null) {
      idx = candidates.reduce((best, v) =>
        Math.abs(v - currentVirtual) < Math.abs(best - currentVirtual) ? v : best
      );
    }

    const totalItems = HOME_PANEL_ORDER.length * MODE_RAIL_LOOP_CYCLES;
    let xStart = sidePad;
    for (let i = 0; i < idx; i += 1) xStart += INACTIVE_W + GAP;
    const activeCenter = xStart + ACTIVE_W / 2;
    const contentWidth =
      sidePad * 2 + ACTIVE_W + INACTIVE_W * (totalItems - 1) + GAP * (totalItems - 1);
    const maxScroll = Math.max(0, contentWidth - modeRailViewportWidth);
    const target = Math.min(maxScroll, Math.max(0, activeCenter - modeRailViewportWidth / 2));
    modeRailVirtualIndexRef.current = idx;
    setModeRailActiveCycle(Math.floor(idx / panelCount));
    modeRailScrollRef.current.scrollTo({ x: target, animated: true });
  }, [homePanel, modeRailViewportWidth]);

  const sendLog = async (kpiId: string, direct?: number) => {
    const token = session?.access_token;
    if (!token) {
      Alert.alert('Not authenticated', 'Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/kpi-logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kpi_id: kpiId,
          event_timestamp: new Date().toISOString(),
          logged_value: direct,
          idempotency_key: `${kpiId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to log KPI');
      await fetchDashboard();
      void refreshConfidenceSnapshot();
    } catch (e: unknown) {
      Alert.alert('Log failed', e instanceof Error ? e.message : 'Failed to log KPI');
    } finally {
      setSubmitting(false);
    }
  };

  const onTapQuickLog = async (kpi: DashboardPayload['loggable_kpis'][number]) => {
    if ((kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked)) {
      Alert.alert(
        'Category Locked',
        kpi.type === 'GP'
          ? 'Business Growth unlocks after 3 active days or 20 total KPI logs.'
          : 'Vitality unlocks after 7 active days or 40 total KPI logs.'
      );
      return;
    }

    if (kpi.requires_direct_value_input) {
      setDirectValue('');
      setPendingDirectLog({ kpiId: kpi.id, name: kpi.name, type: kpi.type });
      return;
    }

    await sendLog(kpi.id);
  };

  const submitDirectLog = async () => {
    if (submitting || !pendingDirectLog) return;
    const parsed = Number(directValue.replace(/,/g, '').trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Invalid value', 'Enter a valid amount.');
      return;
    }

    const current = pendingDirectLog;
    const normalizedValue = current.type === 'Actual' ? parsed : Math.round(parsed);
    setPendingDirectLog(null);
    setDirectValue('');
    await sendLog(current.kpiId, normalizedValue);
  };

  const renderChartVisualPanel = () => (
    <View style={styles.chartWrap}>
      <View pointerEvents="none" style={styles.chartBoostOverlay}>
        <View style={[styles.chartBoostChip, styles.chartBoostChipPink, !gpBoostActive && styles.boostInactive]}>
          <Text style={styles.chartBoostChipText}>{gpBoostActive ? 'GP Boost Active' : 'GP Boost Locked'}</Text>
        </View>
        <View style={[styles.chartBoostChip, styles.chartBoostChipGold, !vpBoostActive && styles.boostInactive]}>
          <Text style={styles.chartBoostChipText}>{vpBoostActive ? 'VP Boost Active' : 'VP Boost Locked'}</Text>
        </View>
      </View>
      <View style={styles.chartRow}>
        <View style={styles.yAxisCol}>
          {chartSeries.yTicks.map((tick, idx) => (
            <Text key={`${tick}-${idx}`} style={styles.yAxisLabel}>
              {formatUsdAxis(tick)}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={chartScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setChartViewportWidth(e.nativeEvent.layout.width)}
        >
          <View style={styles.chartScrollable}>
            <Svg width={chartSeries.chartWidth} height="190">
              {[0, 1, 2, 3, 4].map((i) => {
                const y = 12 + i * 42;
                return (
                  <Line
                    key={`h-${i}`}
                    x1="0"
                    y1={String(y)}
                    x2={String(chartSeries.chartWidth)}
                    y2={String(y)}
                    stroke="#edf1f6"
                    strokeWidth="1"
                  />
                );
              })}

              {(() => {
                const boundaryX = chartSeries.step * chartSeries.splitBaseIndex;
                const splitX = chartSeries.step * (chartSeries.splitBaseIndex + chartSeries.splitOffsetFraction);
                const currentValue = chartSeries.pastActual[chartSeries.splitBaseIndex] ?? 0;
                const currentY = yForValue(currentValue, 170, chartSeries.min, chartSeries.max);

                const fillPoints = [
                  ...chartSeries.pastActual.map((value, idx) => {
                    const x = idx * chartSeries.step;
                    const y = yForValue(value, 170, chartSeries.min, chartSeries.max);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }),
                  `${splitX.toFixed(1)},${currentY.toFixed(1)}`,
                  `${splitX.toFixed(1)},170`,
                  '0,170',
                ].join(' ');

                return (
                  <>
                    <Polygon points={fillPoints} fill="rgba(127, 207, 141, 0.22)" stroke="none" />

                    <Polyline
                      points={toPointsSpaced(
                        chartSeries.pastActual,
                        chartSeries.step,
                        170,
                        chartSeries.min,
                        chartSeries.max,
                        0
                      )}
                      fill="none"
                      stroke="#48ad63"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {splitX > boundaryX ? (
                      <Line
                        x1={String(boundaryX)}
                        y1={String(currentY)}
                        x2={String(splitX)}
                        y2={String(currentY)}
                        stroke="#48ad63"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {(() => {
                      const monthTargetXs = chartSeries.futureProjected.map(
                        (_, idx) => chartSeries.step * (chartSeries.firstFutureIndex + idx)
                      );
                      let prevX = splitX;
                      let prevY = currentY;
                      return chartSeries.futureProjected.map((nextValue, idx) => {
                        const nextX = monthTargetXs[idx] ?? prevX;
                        if (nextX <= splitX) return null;
                        const nextY = yForValue(nextValue, 170, chartSeries.min, chartSeries.max);
                        const band =
                          chartSeries.futureBands[idx] ?? payload?.projection.confidence.band ?? 'yellow';
                        const segment = (
                          <Line
                            key={`future-segment-${idx}`}
                            x1={String(prevX)}
                            y1={String(prevY)}
                            x2={String(nextX)}
                            y2={String(nextY)}
                            stroke={confidenceColor(band)}
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        );
                        prevX = nextX;
                        prevY = nextY;
                        return segment;
                      });
                    })()}

                    <Line
                      x1={String(splitX)}
                      y1="0"
                      x2={String(splitX)}
                      y2="170"
                      stroke="#9fb3d9"
                      strokeWidth="1.5"
                    />

                    <Circle
                      cx={String(splitX)}
                      cy={String(currentY)}
                      r="4.5"
                      fill="#fff"
                      stroke="#2f8a4a"
                      strokeWidth="2.5"
                    />
                  </>
                );
              })()}
            </Svg>
            <View style={styles.monthRow}>
              {chartSeries.labels.map((label, idx) => (
                <Text
                  key={`${label}-${idx}`}
                  style={[styles.monthLabel, idx === chartSeries.splitBaseIndex && styles.monthBoundaryLabel]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  const renderHudRail = () => {
    const confidenceBand = payload?.projection.confidence.band ?? 'yellow';
    const confidenceScore = Number(payload?.projection.confidence.score ?? 0);
    const hudCards: Array<{
      key: string;
      label: string;
      value: string;
      accent: string;
      subValue?: string;
    }> = [
      { key: 'actual365', label: 'Actual GCI (365d)', value: fmtUsd(cardMetrics.actualLast365), accent: '#2f9f56' },
      { key: 'proj365', label: 'Projected (365d)', value: fmtUsd(cardMetrics.projectedNext365), accent: '#2158d5' },
      { key: 'proj60', label: 'Projected (60d)', value: fmtUsd(cardMetrics.projectedNext60), accent: '#4c79e6' },
      { key: 'proj180', label: 'Projected (180d)', value: fmtUsd(cardMetrics.projectedNext180), accent: '#6c8ff0' },
      {
        key: 'progress',
        label: 'Progress',
        value: `${Math.round(cardMetrics.progressPct)}%`,
        subValue: fmtUsd(payload?.actuals.actual_gci ?? 0),
        accent: '#2f3442',
      },
      {
        key: 'confidence',
        label: 'Confidence',
        value: `${fmtNum(confidenceScore)}`,
        subValue: confidenceBand === 'green' ? 'Strong' : confidenceBand === 'yellow' ? 'Average' : 'Low',
        accent: confidenceColor(confidenceBand),
      },
    ];

    const HUD_CARD_WIDTH = 154;
    const SNAP = HUD_CARD_WIDTH + 10;

    return (
      <View style={styles.hudRailWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          decelerationRate="fast"
          snapToAlignment="start"
          contentContainerStyle={styles.hudRailContent}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            setHudActiveIndex(Math.max(0, Math.round(x / SNAP)));
          }}
        >
          {hudCards.map((card, idx) => (
            <View
              key={card.key}
              style={[
                styles.hudCard,
                { width: HUD_CARD_WIDTH },
                idx === hudActiveIndex && styles.hudCardActive,
              ]}
            >
              <View style={[styles.hudCardAccent, { backgroundColor: card.accent }]} />
              <Text style={styles.hudCardLabel}>{card.label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hudCardValueScroll}>
                <Text style={styles.hudCardValue}>{card.value}</Text>
              </ScrollView>
              {card.subValue ? <Text style={styles.hudCardSub}>{card.subValue}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderGameplayHeader = () => {
    const modeRailSidePad = Math.max(0, modeRailViewportWidth / 2 - GAMEPLAY_MODE_ACTIVE_WIDTH / 2);
    const modeRailItems = Array.from({ length: MODE_RAIL_LOOP_CYCLES }).flatMap((_, cycleIdx) =>
      HOME_PANEL_ORDER.map((item) => ({ item, cycleIdx }))
    );
    return (
      <View style={styles.gameplayHeader}>
        <View style={styles.gameplayHeaderTopRow}>
          <View style={styles.modeRailShell} onLayout={(e) => setModeRailViewportWidth(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={modeRailScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.modeRailContent, { paddingHorizontal: modeRailSidePad }]}
            >
              {modeRailItems.map(({ item, cycleIdx }) => {
                const isActive = cycleIdx === modeRailActiveCycle && homePanel === item;
                return (
                  <TouchableOpacity
                    key={`${cycleIdx}-${item}`}
                    style={[
                      styles.gameplaySegmentBtn,
                      isActive ? styles.gameplaySegmentBtnActive : styles.gameplaySegmentBtnInactive,
                      isActive ? { width: GAMEPLAY_MODE_ACTIVE_WIDTH } : { width: GAMEPLAY_MODE_INACTIVE_WIDTH },
                      isActive && { backgroundColor: item === 'Quick' ? '#2f3645' : kpiTypeAccent(item as Segment) },
                      !isActive && styles.gameplaySegmentBtnInactiveBg,
                      ((item === 'GP' && !gpUnlocked) || (item === 'VP' && !vpUnlocked)) && styles.segmentBtnLocked,
                    ]}
                    onPress={() => {
                      if (item === 'GP' && !gpUnlocked) {
                        Alert.alert('Business Growth Locked', 'Unlock after 3 active days or 20 KPI logs.');
                        return;
                      }
                      if (item === 'VP' && !vpUnlocked) {
                        Alert.alert('Vitality Locked', 'Unlock after 7 active days or 40 KPI logs.');
                        return;
                      }
                      homePanelDirectionRef.current = 0;
                      setHomePanel(item);
                    }}
                  >
                    {isActive ? (
                      <>
                        <View
                          style={[
                            styles.gameplaySegmentLane,
                            { backgroundColor: item === 'Quick' ? '#ffffff' : 'rgba(255,255,255,0.92)' },
                          ]}
                        />
                        <Text style={[styles.gameplaySegmentText, styles.gameplaySegmentTextActive]}>
                          {HOME_PANEL_LABELS[item]}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.gameplaySegmentIcon}>{HOME_PANEL_ICONS[item]}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <TouchableOpacity style={styles.panelGearBtn} onPress={openAddNewDrawer} accessibilityLabel="Edit log setup">
            <Text style={styles.panelGearText}>⚙︎</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHomeVisualPlaceholder = (kind: 'GP' | 'VP') => (
    <View style={styles.chartWrap}>
      <View style={styles.visualPlaceholder}>
        <Text style={styles.visualPlaceholderEmoji}>{kind === 'GP' ? '🏙️' : '🌳'}</Text>
        <Text style={styles.visualPlaceholderTitle}>
          {kind === 'GP' ? 'Business Growth Visual' : 'Vitality Visual'}
        </Text>
        <Text style={styles.visualPlaceholderSub}>
          {kind === 'GP'
            ? 'City animation placeholder for GP mode (M3 scaffold).'
            : 'Tree animation placeholder for VP mode (M3 scaffold).'}
        </Text>
      </View>
    </View>
  );

  const renderHomeGridPanel = (panel: HomePanel) => {
    const locked = (panel === 'GP' && !gpUnlocked) || (panel === 'VP' && !vpUnlocked);
    const panelKpis =
      panel === 'Quick' ? homeQuickLog : managedKpis.filter((kpi) => kpi.type === panel).slice(0, 6);

    if (locked) {
      return (
        <View style={styles.emptyPanel}>
          <Text style={styles.metaText}>
            {panel === 'GP'
              ? `Business Growth unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 3)}/3 days or ${Math.min(payload?.activity.total_logs ?? 0, 20)}/20 logs`
              : `Vitality unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 7)}/7 days or ${Math.min(payload?.activity.total_logs ?? 0, 40)}/40 logs`}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.gridWrap}>
        {panelKpis.map((kpi) => (
          <TouchableOpacity
            key={kpi.id}
            style={[styles.gridItem, submitting && styles.disabled]}
            onPress={() => void onTapQuickLog(kpi)}
            onLongPress={() =>
              Alert.alert('Remove from Quick Log?', `${kpi.name} will be removed from your quick log set.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeManagedKpi(kpi.id) },
              ])
            }
            delayLongPress={280}
            disabled={submitting}
          >
            <View style={styles.gridCircle}>{renderKpiIcon(kpi)}</View>
            <Text style={styles.gridLabel}>{kpi.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const visualPageWidth = Math.max(homeVisualViewportWidth, 1);
  const gridPageWidth = Math.max(homeGridViewportWidth, 1);
  const visualTranslateX = Animated.multiply(homePanelAnim, -visualPageWidth);
  const gridTranslateX = Animated.multiply(homePanelAnim, -gridPageWidth);
  const homePanelLoopItems = Array.from({ length: GAMEPLAY_MODE_LOOP_CYCLES }).flatMap((_, cycleIdx) =>
    HOME_PANEL_ORDER.map((panel) => ({ panel, cycleIdx }))
  );

  const refreshConfidenceSnapshot = async () => {
    const token = session?.access_token;
    if (!token || refreshingConfidence) return;
    setRefreshingConfidence(true);
    try {
      const response = await fetch(`${API_URL}/api/forecast-confidence/snapshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to refresh confidence');
      const nextScore = Number(body?.confidence?.score ?? 0);
      const nextBand = body?.confidence?.band as 'green' | 'yellow' | 'red' | undefined;
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          projection: {
            ...prev.projection,
            confidence: {
              score: Number.isFinite(nextScore) ? nextScore : prev.projection.confidence.score,
              band: nextBand ?? prev.projection.confidence.band,
            },
          },
        };
      });
    } catch (e: unknown) {
      Alert.alert('Confidence refresh failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRefreshingConfidence(false);
    }
  };

  const deleteLoggedEntry = async (logId: string) => {
    const token = session?.access_token;
    if (!token) {
      Alert.alert('Not authenticated', 'Please sign in again.');
      return;
    }
    const normalizedLogId = String(logId ?? '').trim();
    if (!normalizedLogId) {
      Alert.alert('Delete failed', 'This log entry does not have a valid id.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/kpi-logs/${normalizedLogId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to delete log entry');
      setPayload((prev) => {
        if (!prev) return prev;
        const nextRecent = (prev.recent_logs ?? []).filter((row) => String(row.id ?? '') !== normalizedLogId);
        return {
          ...prev,
          recent_logs: nextRecent,
          activity: {
            ...prev.activity,
            total_logs: Math.max(0, Number(prev.activity?.total_logs ?? 0) - 1),
          },
        };
      });
      await fetchDashboard();
      void refreshConfidenceSnapshot();
    } catch (e: unknown) {
      Alert.alert('Delete failed', e instanceof Error ? e.message : 'Failed to delete log');
    }
  };

  const toggleManagedKpi = (kpiId: string) => {
    setManagedKpiIds((prev) => {
      const kpi = allSelectableKpis.find((row) => row.id === kpiId);
      if (!kpi) return prev;
      const exists = prev.includes(kpiId);
      let next = exists ? prev.filter((id) => id !== kpiId) : [...prev, kpiId];
      next = normalizeManagedKpiIds(next, allSelectableKpis);
      if (!exists && !next.includes(kpiId)) {
        Alert.alert('Category limit reached', `You can only keep up to 6 ${kpi.type} KPIs active.`);
        return prev;
      }
      void saveManagedKpis(next);
      return next;
    });
  };

  const removeManagedKpi = (kpiId: string) => {
    setManagedKpiIds((prev) => {
      if (!prev.includes(kpiId)) return prev;
      const next = prev.filter((id) => id !== kpiId);
      void saveManagedKpis(next);
      return next;
    });
  };

  const toggleFavoriteKpi = (kpiId: string) => {
    setManagedKpiIds((prev) => {
      if (!prev.includes(kpiId)) return prev;
      const favoriteIds = prev.slice(0, 6);
      const isFavorite = favoriteIds.includes(kpiId);
      if (isFavorite) {
        const without = prev.filter((id) => id !== kpiId);
        const favWithout = favoriteIds.filter((id) => id !== kpiId);
        const rest = without.filter((id) => !favWithout.includes(id));
        const replacement = rest[0];
        const nextFav = replacement ? [...favWithout, replacement] : favWithout;
        const next = [...nextFav, ...without.filter((id) => !nextFav.includes(id))];
        void saveManagedKpis(next);
        return next;
      }
      const without = prev.filter((id) => id !== kpiId);
      const next = [kpiId, ...without];
      void saveManagedKpis(next);
      return next;
    });
  };

  const openAddNewDrawer = () => {
    setDrawerFilter('All');
    setAddDrawerVisible(true);
  };

  const shiftHomePanel = (direction: -1 | 1) => {
    homePanelDirectionRef.current = direction;
    setHomePanel((prev) => {
      const currentIdx = HOME_PANEL_ORDER.indexOf(prev);
      const nextIdx = (currentIdx + direction + HOME_PANEL_ORDER.length) % HOME_PANEL_ORDER.length;
      return HOME_PANEL_ORDER[nextIdx] ?? 'Quick';
    });
  };

  const homePanelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dy) < 20,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -24) {
            shiftHomePanel(1);
            return;
          }
          if (gesture.dx >= 24) {
            shiftHomePanel(-1);
          }
        },
      }),
    []
  );

  const onBottomTabPress = (tab: BottomTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setViewMode('home');
      return;
    }
    if (tab === 'newkpi') {
      setViewMode('log');
      return;
    }
    Alert.alert('Coming next', 'This section is planned for later sprint scope.');
  };

  // Boost states remain inactive until dedicated boost metrics/policies are wired.
  const gpBoostActive = false;
  const vpBoostActive = false;

  const drawerCatalogKpis = useMemo(() => {
    const ordered = [...allSelectableKpis].sort((a, b) => {
      const aIndex = managedKpiIds.indexOf(a.id);
      const bIndex = managedKpiIds.indexOf(b.id);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.name.localeCompare(b.name);
    });
    if (drawerFilter === 'All') return ordered;
    return ordered.filter((kpi) => kpi.type === drawerFilter);
  }, [allSelectableKpis, managedKpiIds, drawerFilter]);

  if (state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.metaText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Dashboard load failed'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchDashboard()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {viewMode === 'home' ? (
          <>
            {renderHudRail()}

            <View style={styles.chartCard}>
              <View
                style={styles.homePanelViewport}
                onLayout={(e) => setHomeVisualViewportWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View
                  style={[
                    styles.homePanelTrack,
                    {
                      width: visualPageWidth * homePanelLoopItems.length,
                      transform: [{ translateX: visualTranslateX }],
                    },
                  ]}
                >
                  {homePanelLoopItems.map(({ panel, cycleIdx }) => (
                    <View key={`visual-${cycleIdx}-${panel}`} style={[styles.homePanelPage, { width: visualPageWidth }]}>
                      {panel === 'Quick' || panel === 'PC'
                        ? renderChartVisualPanel()
                        : renderHomeVisualPlaceholder(panel as 'GP' | 'VP')}
                    </View>
                  ))}
                </Animated.View>
              </View>
            </View>

            {renderGameplayHeader()}

            <View
              {...homePanelPanResponder.panHandlers}
              style={styles.homePanelViewport}
              onLayout={(e) => setHomeGridViewportWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View
                style={[
                  styles.homePanelTrack,
                  {
                    width: gridPageWidth * homePanelLoopItems.length,
                    transform: [{ translateX: gridTranslateX }],
                  },
                ]}
              >
                {homePanelLoopItems.map(({ panel, cycleIdx }) => (
                  <View key={`grid-${cycleIdx}-${panel}`} style={[styles.homePanelPage, { width: gridPageWidth }]}>
                    {renderHomeGridPanel(panel)}
                  </View>
                ))}
              </Animated.View>
            </View>

          </>
        ) : (
          <>
            <View style={styles.logTopRow}>
              <Text style={styles.logTitle}>Log Activities</Text>
            </View>

            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.arrowBtn, !canGoBackwardDate && styles.arrowBtnDisabled]}
                disabled={!canGoBackwardDate}
                onPress={() => {
                  if (!canGoBackwardDate) return;
                  const nextIdx = selectedLogDateIndex + 1;
                  const nextDate = navigableLogDates[nextIdx];
                  if (nextDate) setSelectedLogDateIso(nextDate);
                }}
              >
                <Text style={[styles.arrow, !canGoBackwardDate && styles.arrowDisabled]}>←</Text>
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatLogDateHeading(selectedLogDate)}</Text>
              <TouchableOpacity
                style={[styles.arrowBtn, !canGoForwardDate && styles.arrowBtnDisabled]}
                disabled={!canGoForwardDate}
                onPress={() => {
                  if (!canGoForwardDate) return;
                  const nextIdx = selectedLogDateIndex - 1;
                  const nextDate = navigableLogDates[nextIdx];
                  if (nextDate) setSelectedLogDateIso(nextDate);
                }}
              >
                <Text style={[styles.arrow, !canGoForwardDate && styles.arrowDisabled]}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.todayLogsCard}>
              <Text style={styles.todayLogsHeading}>TODAYS LOGS</Text>
              {todaysLogRows.length === 0 ? (
                <Text style={styles.todayLogsEmpty}>No logs yet today.</Text>
              ) : (
                todaysLogRows.map((row) => (
                  <View key={row.kpiId} style={styles.todayLogsRow}>
                    <Text style={styles.todayLogsName}>{row.name}</Text>
                    <Text style={styles.todayLogsCount}>{String(row.count).padStart(2, '0')}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.logsHeroCard}>
              <Image source={dashboardAssets.crown} style={styles.crownImage} resizeMode="contain" />
              <View style={styles.celebrationRow}>
                <Image source={dashboardAssets.confettiLeft} style={styles.confettiImage} resizeMode="contain" />
                <Image source={dashboardAssets.confettiRight} style={styles.confettiImage} resizeMode="contain" />
              </View>
              <Text style={styles.logsCount}>{fmtNum(payload?.activity.total_logs ?? 0)}</Text>
              <Text style={styles.logsSub}>Todays Logs</Text>
              <Text style={styles.hiWork}>Hi, Sarah Roy, Great work</Text>
              <View style={styles.greenBanner}>
                <Text style={styles.greenBannerText}>
                  🎉 You have made a total of {fmtNum(payload?.activity.total_logs ?? 0)} logs so far today.
                </Text>
              </View>
            </View>

            <View style={styles.quickLogHeader}>
              <Text style={styles.sectionTitle}>ADD NEW ACTIVITY</Text>
              <TouchableOpacity style={styles.addNewBtn} onPress={openAddNewDrawer}>
                <Text style={styles.addNewBtnText}>⊕ Add New</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.segmentRow}>
              {(['PC', 'GP', 'VP'] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.segmentBtn,
                    segment === item && styles.segmentBtnActive,
                    segment === item && { backgroundColor: kpiTypeAccent(item) },
                    ((item === 'GP' && !gpUnlocked) || (item === 'VP' && !vpUnlocked)) && styles.segmentBtnLocked,
                  ]}
                  onPress={() => {
                    if (item === 'GP' && !gpUnlocked) {
                      Alert.alert('Business Growth Locked', 'Unlock after 3 active days or 20 KPI logs.');
                      return;
                    }
                    if (item === 'VP' && !vpUnlocked) {
                      Alert.alert('Vitality Locked', 'Unlock after 7 active days or 40 KPI logs.');
                      return;
                    }
                    setSegment(item);
                  }}
                >
                  <Text style={[styles.segmentText, segment === item && styles.segmentTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(segment === 'GP' && !gpUnlocked) || (segment === 'VP' && !vpUnlocked) ? (
              <View style={styles.emptyPanel}>
                <Text style={styles.metaText}>
                  {segment === 'GP'
                    ? `Business Growth unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 3)}/3 days or ${Math.min(payload?.activity.total_logs ?? 0, 20)}/20 logs`
                    : `Vitality unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 7)}/7 days or ${Math.min(payload?.activity.total_logs ?? 0, 40)}/40 logs`}
                </Text>
              </View>
            ) : (
              <View style={styles.gridWrap}>
                {quickLogKpis.map((kpi, idx) => (
                  <TouchableOpacity
                    key={kpi.id}
                    style={[styles.gridItem, submitting && styles.disabled]}
                    onPress={() => void onTapQuickLog(kpi)}
                    onLongPress={() =>
                      Alert.alert('Remove from Quick Log?', `${kpi.name} will be removed from your quick log set.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeManagedKpi(kpi.id) },
                      ])
                    }
                    delayLongPress={280}
                    disabled={submitting}
                  >
                    <View style={styles.gridCircle}>
                      {renderKpiIcon(kpi)}
                    </View>
                    <Text style={styles.gridLabel}>{kpi.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.recentEntriesCard}>
              <Text style={styles.todayLogsHeading}>RECENT ENTRIES</Text>
              {recentLogEntries.length === 0 ? (
                <Text style={styles.todayLogsEmpty}>No recent entries.</Text>
              ) : (
                recentLogEntries.map((log) => (
                  <View key={log.id} style={styles.recentEntryRow}>
                    <View style={styles.recentEntryMeta}>
                      <Text style={styles.recentEntryName}>{log.kpi_name || 'KPI'}</Text>
                      <Text style={styles.recentEntryTime}>
                        {new Date(log.event_timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.recentEntryDeleteBtn}
                      onPress={() =>
                        Alert.alert('Remove log entry?', 'This action cannot be undone.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => void deleteLoggedEntry(log.id) },
                        ])
                      }
                    >
                      <Text style={styles.recentEntryDeleteText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {([
          { key: 'home', icon: '⌂', label: 'Home' },
          { key: 'challenge', icon: '⍟', label: 'Challenge' },
          { key: 'newkpi', icon: '⊕', label: 'Log' },
          { key: 'team', icon: '◫', label: 'Team' },
          { key: 'user', icon: '◉', label: 'User' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.bottomItem}
            onPress={() => onBottomTabPress(tab.key)}
          >
            <Text style={[styles.bottomIcon, activeTab === tab.key && styles.bottomActive]}>{tab.icon}</Text>
            <Text style={[styles.bottomLabel, activeTab === tab.key && styles.bottomActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={addDrawerVisible} transparent animationType="fade" onRequestClose={() => setAddDrawerVisible(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerCard}>
            <Text style={styles.drawerTitle}>Quick Log Settings</Text>
            <Text style={styles.drawerUnlockedHint}>Toggle On/Off and mark up to 6 favorites.</Text>
            <View style={styles.drawerFilterRow}>
              {(['All', 'PC', 'GP', 'VP'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.drawerFilterChip, drawerFilter === filter && styles.drawerFilterChipActive]}
                  onPress={() => setDrawerFilter(filter)}
                >
                  <Text style={[styles.drawerFilterChipText, drawerFilter === filter && styles.drawerFilterChipTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={styles.drawerGridScroll} contentContainerStyle={styles.drawerGrid}>
              {drawerCatalogKpis.map((kpi, idx) => {
                const locked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
                const selected = managedKpiIdSet.has(kpi.id);
                const isFavorite = managedKpiIds.slice(0, 6).includes(kpi.id);
                return (
                <TouchableOpacity
                  key={kpi.id}
                  style={[styles.drawerItem, locked && styles.disabled]}
                  onPress={() => {
                    if (locked) {
                      Alert.alert(
                        'Category Locked',
                        kpi.type === 'GP'
                          ? 'Business Growth unlocks after 3 active days or 20 total KPI logs.'
                          : 'Vitality unlocks after 7 active days or 40 total KPI logs.'
                      );
                      return;
                    }
                    toggleManagedKpi(kpi.id);
                  }}
                >
                  <View style={[styles.drawerCircle, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                    {renderKpiIcon(kpi)}
                  </View>
                  <Text style={styles.drawerLabel}>{kpi.name}</Text>
                  <View style={styles.drawerActionRow}>
                    <View style={[styles.drawerActionPill, selected ? styles.drawerActionRemove : styles.drawerActionAdd]}>
                      <Text style={styles.drawerActionText}>{selected ? 'On' : 'Off'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.drawerActionPill, isFavorite ? styles.drawerActionFavorite : styles.drawerActionAdd]}
                      disabled={!selected}
                      onPress={() => {
                        if (!selected) return;
                        toggleFavoriteKpi(kpi.id);
                      }}
                    >
                      <Text style={styles.drawerActionText}>{isFavorite ? 'Fav' : '☆'}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.drawerClose} onPress={() => setAddDrawerVisible(false)}>
              <Text style={styles.drawerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingDirectLog !== null} transparent animationType="slide" onRequestClose={() => setPendingDirectLog(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter value</Text>
            <Text style={styles.modalSubtitle}>{pendingDirectLog?.name}</Text>
            <Text style={styles.modalHint}>{pendingDirectLog?.type === 'Actual' ? 'Amount (USD)' : 'Count'}</Text>
            <TextInput
              style={styles.modalInput}
              value={directValue}
              onChangeText={setDirectValue}
              keyboardType={pendingDirectLog?.type === 'Actual' ? 'decimal-pad' : 'number-pad'}
              placeholder={pendingDirectLog?.type === 'Actual' ? '0.00' : '0'}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPendingDirectLog(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => void submitDirectLog()}>
                <Text style={styles.modalConfirmText}>Log Value</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 116,
    gap: 12,
    backgroundColor: '#f6f7f9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hello: {
    fontSize: 29,
    color: '#2d3545',
    fontWeight: '700',
  },
  welcomeBack: {
    marginTop: 2,
    color: '#7e8695',
    fontSize: 13,
  },
  hudRailWrap: {
    marginTop: 2,
  },
  hudRailContent: {
    paddingRight: 6,
    gap: 10,
  },
  hudCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ebf1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 76,
    justifyContent: 'space-between',
    shadowColor: '#23304a',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  hudCardActive: {
    borderColor: '#d8e3f8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    transform: [{ scale: 1.015 }],
  },
  hudCardAccent: {
    width: 24,
    height: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  hudCardLabel: {
    color: '#7a8392',
    fontSize: 11,
    fontWeight: '600',
  },
  hudCardValueScroll: {
    maxHeight: 28,
    marginTop: 2,
  },
  hudCardValue: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  hudCardSub: {
    color: '#6f7a8a',
    fontSize: 11,
    marginTop: 2,
  },
  searchBox: {
    backgroundColor: '#ecf0f4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchText: {
    color: '#9aa2b0',
    fontSize: 13,
  },
  predictionBanner: {
    backgroundColor: '#dff6df',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  predictionTitle: {
    color: '#2d6e3f',
    fontWeight: '700',
    fontSize: 13,
  },
  predictionBody: {
    color: '#4b5a50',
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ebf1',
    padding: 12,
    gap: 8,
  },
  statValueScroll: {
    maxHeight: 38,
  },
  statValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: '#2f3442',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7e8796',
  },
  statDivider: {
    borderTopWidth: 1,
    borderTopColor: '#edf1f5',
    marginTop: 2,
    paddingTop: 6,
  },
  statSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statSubLabel: {
    fontSize: 12,
    color: '#7e8796',
    fontWeight: '600',
  },
  statSubValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2f3442',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5eaf2',
    padding: 8,
    gap: 6,
  },
  gameplayHeader: {
    gap: 2,
    marginBottom: 0,
  },
  gameplayHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeRailShell: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#e6e9ee',
    padding: 4,
    overflow: 'hidden',
  },
  modeRailContent: {
    gap: 6,
    alignItems: 'center',
  },
  segmentRowCompact: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#e6e9ee',
    padding: 4,
    gap: 4,
  },
  gameplaySegmentBtn: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  gameplaySegmentBtnActive: {
    shadowColor: '#1f2b44',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  gameplaySegmentBtnInactive: {
    width: 52,
  },
  gameplaySegmentBtnInactiveBg: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  gameplaySegmentLane: {
    position: 'absolute',
    bottom: 4,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 999,
    opacity: 0.95,
  },
  gameplaySegmentText: {
    color: '#48505f',
    fontWeight: '700',
    fontSize: 9.5,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 3,
  },
  gameplaySegmentTextActive: {
    color: '#fff',
    fontSize: 13.5,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  gameplaySegmentIcon: {
    fontSize: 19,
    lineHeight: 20,
  },
  panelGearBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7dde8',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelGearText: {
    color: '#384154',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  gameplayPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameplayConfidencePill: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dfe8f6',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gameplayConfidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  gameplayConfidenceText: {
    color: '#354055',
    fontSize: 11,
    fontWeight: '700',
  },
  gameplayDetailsBlock: {
    gap: 8,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 15,
    color: '#2f3442',
    fontWeight: '600',
  },
  confidenceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBandPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceBandText: {
    color: '#5f4c2c',
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceValue: {
    fontSize: 34,
    color: '#333949',
    fontWeight: '700',
  },
  warnBanner: {
    backgroundColor: '#fbf0d6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warnText: {
    color: '#5f4c2c',
    fontSize: 12,
  },
  chartWrap: {
    position: 'relative',
    paddingTop: 2,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  },
  chartBoostOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    gap: 6,
    alignItems: 'flex-end',
  },
  chartBoostChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  chartBoostChipPink: {
    backgroundColor: 'rgba(255, 217, 232, 0.92)',
    borderColor: '#ffd1e3',
  },
  chartBoostChipGold: {
    backgroundColor: 'rgba(255, 233, 188, 0.92)',
    borderColor: '#ffe1a1',
  },
  chartBoostChipText: {
    fontSize: 10,
    color: '#664a2f',
    fontWeight: '700',
  },
  homePanelViewport: {
    overflow: 'hidden',
  },
  homePanelTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  homePanelPage: {
    flexShrink: 0,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },
  yAxisCol: {
    width: 36,
    height: 190,
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  yAxisLabel: {
    color: '#8791a2',
    fontSize: 10,
    textAlign: 'right',
  },
  chartMeta: {
    fontSize: 12,
    color: '#6d7584',
    marginBottom: 6,
  },
  visualPlaceholder: {
    minHeight: 210,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edf1f5',
    backgroundColor: '#fbfcfe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  visualPlaceholderEmoji: {
    fontSize: 40,
  },
  visualPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2f3442',
  },
  visualPlaceholderSub: {
    fontSize: 12,
    color: '#6d7584',
    textAlign: 'center',
    lineHeight: 17,
  },
  chartScrollable: {
    paddingBottom: 0,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginTop: 0,
    paddingLeft: 4,
    paddingRight: 4,
  },
  monthLabel: {
    width: 52,
    color: '#8a93a3',
    fontSize: 11,
    textAlign: 'center',
  },
  monthBoundaryLabel: {
    color: '#2f3442',
    fontWeight: '700',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    width: '48%',
    color: '#7f8795',
    fontSize: 12,
  },
  confidenceTooltipCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3ecff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  confidenceTooltipText: {
    color: '#556173',
    fontSize: 12,
    lineHeight: 17,
  },
  boostRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  boostPillPink: {
    backgroundColor: '#ffd9e8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  boostPillGold: {
    backgroundColor: '#ffe9bc',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  boostInactive: {
    opacity: 0.55,
  },
  boostText: {
    fontSize: 12,
    color: '#664a2f',
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  progressTitle: {
    fontSize: 24,
    color: '#2d3442',
    fontWeight: '700',
  },
  progressSub: {
    marginTop: 2,
    fontSize: 13,
    color: '#7a8392',
  },
  progressAmount: {
    fontSize: 34,
    color: '#2c3240',
    fontWeight: '700',
  },
  quickLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#3a4050',
    fontSize: 14,
    fontWeight: '700',
  },
  addNewBtn: {
    borderRadius: 999,
    backgroundColor: '#2f3645',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addNewBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBubble: {
    width: 70,
    minHeight: 98,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 4,
  },
  quickBubbleIcon: {
    fontSize: 16,
  },
  quickBubbleText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#3c4352',
    textAlign: 'center',
  },
  confidenceRefreshBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d8e0ea',
    backgroundColor: '#fff',
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceRefreshText: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '700',
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logTitle: {
    fontSize: 20,
    color: '#2f3442',
    fontWeight: '700',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#dce8ff',
    borderWidth: 1,
    borderColor: '#c0d4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#1f5fe2',
    fontSize: 12,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff2f7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  arrow: {
    fontSize: 18,
    color: '#2f3442',
  },
  arrowDisabled: {
    color: '#a8b0bf',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: {
    backgroundColor: '#f3f5f9',
  },
  dateText: {
    color: '#333948',
    fontSize: 14,
    fontWeight: '600',
  },
  todayLogsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  todayLogsHeading: {
    color: '#5f6676',
    fontSize: 11,
    fontWeight: '700',
  },
  todayLogsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    paddingBottom: 6,
  },
  todayLogsName: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '600',
  },
  todayLogsCount: {
    color: '#2f3442',
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 38,
  },
  todayLogsEmpty: {
    color: '#8a93a3',
    fontSize: 13,
  },
  recentEntriesCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  recentEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f6',
    paddingBottom: 6,
  },
  recentEntryMeta: {
    flex: 1,
    paddingRight: 10,
  },
  recentEntryName: {
    color: '#2f3442',
    fontSize: 14,
    fontWeight: '700',
  },
  recentEntryTime: {
    color: '#8a93a3',
    fontSize: 11,
    marginTop: 2,
  },
  recentEntryDeleteBtn: {
    backgroundColor: '#fde3e3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recentEntryDeleteText: {
    color: '#8c3333',
    fontSize: 11,
    fontWeight: '700',
  },
  logsHeroCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    padding: 12,
    alignItems: 'center',
  },
  crownImage: {
    width: 58,
    height: 58,
    marginBottom: 4,
  },
  celebrationRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -2,
    marginTop: -4,
    paddingHorizontal: 8,
  },
  confettiImage: {
    width: 82,
    height: 80,
  },
  logsCount: {
    fontSize: 72,
    color: '#2f3442',
    fontWeight: '700',
    lineHeight: 74,
    marginTop: -8,
  },
  logsSub: {
    marginTop: -2,
    color: '#545d6e',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  hiWork: {
    marginTop: 10,
    fontSize: 16,
    color: '#2f3442',
    fontWeight: '700',
  },
  greenBanner: {
    marginTop: 10,
    backgroundColor: '#dcf4de',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  greenBannerText: {
    color: '#44644b',
    fontSize: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#e6e9ee',
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#2059db',
  },
  segmentBtnLocked: {
    opacity: 0.6,
  },
  segmentText: {
    color: '#48505f',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
    paddingBottom: 0,
  },
  gridItem: {
    width: '31%',
    alignItems: 'center',
    gap: 2,
  },
  gridCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  gridIcon: {
    fontSize: 38,
  },
  gridIconImage: {
    width: 86,
    height: 86,
  },
  gridIconImageClip: {
    width: 86,
    height: 86,
    borderRadius: 43,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    color: '#4a5261',
    fontSize: 11,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: -2,
  },
  emptyPanel: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6ebf1',
    padding: 12,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e6ebf1',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 16,
  },
  bottomItem: {
    alignItems: 'center',
    gap: 2,
  },
  bottomIcon: {
    color: '#a0a8b7',
    fontSize: 16,
  },
  bottomLabel: {
    color: '#a0a8b7',
    fontSize: 11,
  },
  bottomActive: {
    color: '#1f5fe2',
    fontWeight: '700',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 36, 44, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  drawerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 16,
  },
  drawerTitle: {
    fontSize: 24,
    color: '#3e4555',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  drawerUnlockedHint: {
    marginTop: -4,
    marginBottom: 10,
    textAlign: 'center',
    color: '#6c7688',
    fontSize: 12,
    fontWeight: '600',
  },
  drawerFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  drawerFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#eef2f8',
  },
  drawerFilterChipActive: {
    backgroundColor: '#1f5fe2',
  },
  drawerFilterChipText: {
    fontSize: 12,
    color: '#5b6574',
    fontWeight: '600',
  },
  drawerFilterChipTextActive: {
    color: '#fff',
  },
  drawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  drawerGridScroll: {
    maxHeight: 420,
  },
  drawerItem: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
  },
  drawerCircle: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerLabel: {
    color: '#4b5262',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  drawerMeta: {
    fontSize: 10,
    color: '#7d8797',
  },
  drawerActionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  drawerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerActionAdd: {
    backgroundColor: '#dfeafb',
  },
  drawerActionRemove: {
    backgroundColor: '#fde3e3',
  },
  drawerActionFavorite: {
    backgroundColor: '#ffe9bc',
  },
  drawerActionText: {
    fontSize: 10,
    color: '#2f3a4b',
    fontWeight: '700',
  },
  drawerClose: {
    marginTop: 16,
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: '#2f3645',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  drawerCloseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d8e0ea',
    borderRadius: radii.md,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancel: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#d8e0ea',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});
