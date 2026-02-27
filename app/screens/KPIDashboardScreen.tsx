import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Polygon } from 'react-native-svg';
import LottieSlot from '../components/LottieSlot';
import PillGrowthBg from '../assets/figma/kpi_icon_bank/pill_growth_bg_v1.svg';
import PillProjectionsBg from '../assets/figma/kpi_icon_bank/pill_projections_bg_v1.svg';
import PillQuicklogBg from '../assets/figma/kpi_icon_bank/pill_quicklog_bg_v1.svg';
import PillVitalityBg from '../assets/figma/kpi_icon_bank/pill_vitality_bg_orange_v2.svg';
import TabChallengesIcon from '../assets/figma/kpi_icon_bank/tab_challenges_themeable_v1.svg';
import TabCoachIcon from '../assets/figma/kpi_icon_bank/tab_coach_themeable_v2.svg';
import TabDashboardIcon from '../assets/figma/kpi_icon_bank/tab_dashboard_themeable_v1.svg';
import TabLogsIcon from '../assets/figma/kpi_icon_bank/tab_logs_themeable_v1.svg';
import TabTeamIcon from '../assets/figma/kpi_icon_bank/tab_team_themeable_v1.svg';
import { useAuth } from '../contexts/AuthContext';
import {
  getFeedbackConfig,
  registerFeedbackCueSource,
  playFeedbackCueAsync,
  playKpiTypeCueAsync,
  preloadFeedbackCuesAsync,
  primeFeedbackAudioAsync,
  setFeedbackConfig,
  triggerHapticAsync,
} from '../lib/feedback';
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
    slug?: string;
    type: 'PC' | 'GP' | 'VP' | 'Actual' | 'Pipeline_Anchor' | 'Custom';
    requires_direct_value_input: boolean;
    pc_weight?: number;
    ttc_definition?: string;
    delay_days?: number;
    hold_days?: number;
    decay_days?: number;
    gp_value?: number | null;
    vp_value?: number | null;
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
    favorite_kpis?: string[];
  };
};

type LoadState = 'loading' | 'empty' | 'error' | 'ready';
type Segment = 'PC' | 'GP' | 'VP';
type ViewMode = 'home' | 'log';
type BottomTab = 'home' | 'challenge' | 'logs' | 'team' | 'comms';
type LogsReportsSubview = 'logs' | 'reports';
type CommsHubPrimaryTab = 'all' | 'channels' | 'dms' | 'broadcast';
type CommsHubScopeFilter = 'all' | 'team' | 'cohort' | 'segment' | 'global';
type DrawerFilter = 'Quick' | 'PC' | 'GP' | 'VP';
type HomePanel = 'Quick' | 'PC' | 'GP' | 'VP';
type ChallengeMemberListTab = 'all' | 'completed';
type KpiTileContextBadge = 'CH' | 'TM' | 'TC' | 'REQ';
type KpiTileContextMeta = {
  badges: KpiTileContextBadge[];
  isRequired?: boolean;
  isLagging?: boolean;
};
type HomePanelTile = {
  kpi: DashboardPayload['loggable_kpis'][number];
  context: KpiTileContextMeta;
};
type PipelineAnchorNagState =
  | { severity: 'ok' }
  | { severity: 'warning' | 'stale'; missingCount: number; staleDays: number; lowConfidence: boolean };
type PipelineCheckinReason = 'deal_closed' | 'deal_lost' | 'correction';
type PipelineCheckinFieldKey = 'listings' | 'buyers';
type PipelineCheckinAnchorTargets = {
  listings: DashboardPayload['loggable_kpis'][number] | null;
  buyers: DashboardPayload['loggable_kpis'][number] | null;
};
type ChallengeKpiGroups = {
  PC: DashboardPayload['loggable_kpis'];
  GP: DashboardPayload['loggable_kpis'];
  VP: DashboardPayload['loggable_kpis'];
};
type TeamKpiGroups = {
  PC: DashboardPayload['loggable_kpis'];
  GP: DashboardPayload['loggable_kpis'];
  VP: DashboardPayload['loggable_kpis'];
};
type TeamLeaderKpiTypeFilter = 'all' | 'PC' | 'GP' | 'VP';
type TeamLeaderKpiStatusFilter = 'all' | 'on_track' | 'watch' | 'at_risk';
type TeamLeaderConcernFilter = 'all' | 'flagged' | 'critical';
type ChallengeApiLeaderboardRow = {
  user_id: string;
  activity_count: number;
  progress_percent: number;
};
type ChallengeApiRow = {
  id: string;
  name: string;
  description?: string | null;
  mode?: string | null;
  team_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  late_join_includes_history?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  sponsored_challenge_id?: string | null;
  sponsor_id?: string | null;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  my_participation?: {
    challenge_id?: string | null;
    user_id?: string | null;
    joined_at?: string | null;
    effective_start_at?: string | null;
    progress_percent?: number | null;
  } | null;
  leaderboard_top?: ChallengeApiLeaderboardRow[] | null;
};
type ChallengeListFilter = 'all' | 'sponsored' | 'team';
type ChallengeListApiResponse = {
  challenges?: ChallengeApiRow[];
};
type ChallengeJoinApiResponse = {
  participant?: {
    id?: string;
    challenge_id?: string;
    user_id?: string;
    progress_percent?: number | null;
  };
  leaderboard_top?: ChallengeApiLeaderboardRow[];
  error?: string;
};
type ChallengeLeaveApiResponse = {
  left?: boolean;
  challenge_id?: string;
  user_id?: string;
  error?: string;
};
type ChallengeFlowLeaderboardEntry = {
  rank: number;
  name: string;
  pct: number;
  value: number;
  userId?: string;
};
type ChallengeFlowItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  progressPct: number;
  timeframe: string;
  daysLabel: string;
  participants: number;
  sponsor: boolean;
  bucket: 'active' | 'upcoming' | 'completed';
  joined: boolean;
  challengeModeLabel: string;
  targetValueLabel: string;
  startAtIso?: string | null;
  endAtIso?: string | null;
  raw?: ChallengeApiRow | null;
  leaderboardPreview: ChallengeFlowLeaderboardEntry[];
};
type TeamFlowScreen =
  | 'dashboard'
  | 'invite_member'
  | 'pending_invitations'
  | 'kpi_settings'
  | 'pipeline'
  | 'team_challenges';
type CoachingShellScreen =
  | 'inbox'
  | 'inbox_channels'
  | 'channel_thread'
  | 'coach_broadcast_compose'
  | 'coaching_journeys'
  | 'coaching_journey_detail'
  | 'coaching_lesson_detail';
type CoachingChannelScope = 'team' | 'challenge' | 'sponsor' | 'cohort' | 'community';
type CoachingShellEntrySource =
  | 'home'
  | 'challenge_details'
  | 'team_leader_dashboard'
  | 'team_member_dashboard'
  | 'user_tab'
  | 'unknown';
type CoachingShellContext = {
  source: CoachingShellEntrySource;
  preferredChannelScope: CoachingChannelScope | null;
  preferredChannelLabel: string | null;
  threadTitle: string | null;
  threadSub: string | null;
  broadcastAudienceLabel: string | null;
  broadcastRoleAllowed: boolean;
  selectedJourneyId: string | null;
  selectedJourneyTitle: string | null;
  selectedLessonId: string | null;
  selectedLessonTitle: string | null;
};
type RuntimePackageDisplayRequirements = {
  disclaimer?: string | null;
  sponsor_attribution?: string | null;
  paywall_cta_required?: boolean | null;
  sponsor_disclaimer_required?: boolean | null;
  sponsor_attribution_required?: boolean | null;
};
type RuntimePackagingReadModel = {
  package_type?: string | null;
  visibility_state?: string | null;
  entitlement_result?: string | null;
  linked_context_refs?: {
    team_id?: string | null;
    challenge_id?: string | null;
    sponsored_challenge_id?: string | null;
    sponsor_id?: string | null;
    channel_id?: string | null;
    journey_id?: string | null;
  } | null;
  display_requirements?: RuntimePackageDisplayRequirements | null;
  read_model_status?: string | null;
  notes?: string[] | null;
};
type RuntimeNotificationReadState = 'read' | 'unread' | 'unknown' | string;
type RuntimeNotificationSeverity = 'info' | 'warning' | 'success' | 'error' | string;
type RuntimeNotificationDeliveryChannel = 'in_app' | 'badge' | 'banner' | 'push' | string;
type RuntimeNotificationRouteTarget = {
  screen?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  journey_id?: string | null;
  journey_title?: string | null;
  lesson_id?: string | null;
  lesson_title?: string | null;
  challenge_id?: string | null;
  challenge_title?: string | null;
  preferred_channel_scope?: string | null;
  preferred_channel_label?: string | null;
} | null;
type RuntimeNotificationItem = {
  id: string;
  notification_class: string;
  title: string;
  body?: string | null;
  badge_label?: string | null;
  read_state?: RuntimeNotificationReadState | null;
  severity?: RuntimeNotificationSeverity | null;
  delivery_channels?: RuntimeNotificationDeliveryChannel[] | null;
  route_target?: RuntimeNotificationRouteTarget;
  source_family?: string | null;
  created_at?: string | null;
};
type RuntimeNotificationSummaryReadModel = {
  total_count?: number | null;
  unread_count?: number | null;
  banner_count?: number | null;
  badge_count?: number | null;
  badge_label?: string | null;
  read_model_status?: string | null;
  notes?: string[] | null;
};
type RuntimeSurfaceState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'permission_denied'
  | 'partial_read_model'
  | 'ready';
type RuntimeSurfaceStateModel = {
  state: RuntimeSurfaceState;
  title: string;
  detail: string;
  transitionHint: string;
};
type RuntimePackageVisibilityOutcome = {
  package_type?: string | null;
  package_id?: string | null;
  visibility_state?: string | null;
  target_match?: boolean | null;
  entitlement_result?: string | null;
  linked_context_refs?: Record<string, unknown> | null;
  display_requirements?: RuntimePackageDisplayRequirements | null;
  read_model_status?: string | null;
  notes?: string[] | null;
};
type CoachingPackageGateTone = 'available' | 'gated' | 'blocked' | 'fallback';
type CoachingPackageGatePresentation = {
  tone: CoachingPackageGateTone;
  title: string;
  summary: string;
  detail?: string | null;
  policyNote?: string | null;
};
type AIAssistHostSurface =
  | 'challenge_coaching_module'
  | 'team_member_coaching_module'
  | 'team_leader_coaching_module'
  | 'channel_thread'
  | 'coach_broadcast_compose'
  | 'coaching_journeys'
  | 'coaching_journey_detail'
  | 'coaching_lesson_detail';
type AIAssistShellContext = {
  host: AIAssistHostSurface;
  title: string;
  sub: string;
  targetLabel: string;
  approvedInsertOnly: boolean;
};
type AIAssistRequestIntent = 'draft_reply' | 'draft_broadcast' | 'reflection_prompt' | 'rewrite' | 'draft_support_note';
type AiSuggestionQueueReadModel = {
  source_surface?: string | null;
  request_intent?: string | null;
  target_scope_summary?: string | null;
  required_approval_tier?: string | null;
  read_model_status?: string | null;
  notes?: string[] | null;
  approval_queue?: {
    queue_status?: string | null;
    approval_authority_model?: string | null;
    escalation_required?: boolean | null;
  } | null;
  audit_summary?: {
    created_at?: string | null;
    updated_at?: string | null;
    review_decision?: string | null;
  } | null;
};
type AiSuggestionApiRow = {
  id: string;
  user_id?: string | null;
  scope?: string | null;
  proposed_message?: string | null;
  status?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  ai_queue_read_model?: AiSuggestionQueueReadModel | null;
};
type AiSuggestionQueueSummary = {
  total?: number;
  by_status?: {
    pending?: number;
    approved?: number;
    rejected?: number;
  } | null;
  approval_authority_model?: string | null;
  read_model_status?: string | null;
  notes?: string[] | null;
};
type AiSuggestionCreateResponse = {
  suggestion?: AiSuggestionApiRow;
  error?: string;
};
type AiSuggestionsListResponse = {
  suggestions?: AiSuggestionApiRow[];
  queue_summary?: AiSuggestionQueueSummary | null;
  error?: string;
};
type CoachingJourneyListItem = {
  id: string;
  title: string;
  description?: string | null;
  team_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  milestones_count?: number;
  lessons_total?: number;
  lessons_completed?: number;
  completion_percent?: number;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
};
type CoachingJourneyListResponse = {
  journeys?: CoachingJourneyListItem[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
type CoachingJourneyDetailLesson = {
  id: string;
  title: string;
  body?: string | null;
  sort_order?: number;
  progress_status?: 'not_started' | 'in_progress' | 'completed' | string;
  completed_at?: string | null;
};
type CoachingJourneyDetailMilestone = {
  id: string;
  journey_id?: string;
  title: string;
  sort_order?: number;
  lessons?: CoachingJourneyDetailLesson[];
};
type CoachingJourneyDetailResponse = {
  journey?: CoachingJourneyListItem;
  milestones?: CoachingJourneyDetailMilestone[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  error?: string;
};
type CoachingProgressSummaryResponse = {
  total_progress_rows?: number;
  status_counts?: {
    not_started?: number;
    in_progress?: number;
    completed?: number;
  };
  completion_percent?: number;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
type CoachingLessonProgressWriteResponse = {
  progress?: {
    lesson_id?: string;
    user_id?: string;
    status?: 'not_started' | 'in_progress' | 'completed' | string;
    completed_at?: string | null;
    updated_at?: string | null;
  };
  error?: string;
};
type ChannelApiRow = {
  id: string;
  type: 'team' | 'challenge' | 'sponsor' | 'cohort' | 'direct' | string;
  name: string;
  team_id?: string | null;
  context_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  my_role?: string | null;
  unread_count?: number;
  last_seen_at?: string | null;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
};
type ChannelsListResponse = {
  channels?: ChannelApiRow[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
type ChannelMessageRow = {
  id: string;
  channel_id: string;
  sender_user_id?: string | null;
  body: string;
  message_type?: 'message' | 'broadcast' | string;
  created_at?: string | null;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
};
type ChannelMessagesResponse = {
  channel?: ChannelApiRow | null;
  messages?: ChannelMessageRow[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
type ChannelMessageWriteResponse = {
  message?: ChannelMessageRow;
  error?: string;
};
type ChannelBroadcastWriteResponse = {
  broadcast?: ChannelMessageRow;
  error?: string;
};

type PendingDirectLog = {
  kpiId: string;
  name: string;
  type: DashboardPayload['loggable_kpis'][number]['type'];
};

type ActiveFlightFx = {
  key: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  arcLift: number;
  anim: Animated.Value;
};

type MeasuredBox = { x: number; y: number; width: number; height: number };

type SendLogOptions = {
  kpiType?: DashboardPayload['loggable_kpis'][number]['type'];
  skipSuccessBadge?: boolean;
  skipProjectionFlight?: boolean;
  eventTimestampIso?: string;
};

type QueuedLogTask = {
  kpiId: string;
  direct?: number;
  options?: SendLogOptions;
};

const KPI_TYPE_SORT_ORDER: Record<'PC' | 'GP' | 'VP', number> = {
  PC: 0,
  GP: 1,
  VP: 2,
};
const PC_PRIORITY_SLUG_ORDER = [
  'listing_taken',
  'buyer_contract_signed',
  'new_client_logged',
  'appointment_set_buyer',
  'appointment_set_seller',
  'biz_post',
] as const;
const GP_BOTTOM_SLUG_GROUP = [
  'instagram_post_shared',
  'facebook_post_shared',
  'tiktok_post_shared',
  'x_post_shared',
  'linkedin_post_shared',
  'youtube_short_posted',
] as const;
const PC_PRIORITY_SLUG_INDEX: Record<string, number> = Object.fromEntries(
  PC_PRIORITY_SLUG_ORDER.map((slug, idx) => [slug, idx])
);
const GP_BOTTOM_SLUG_INDEX: Record<string, number> = Object.fromEntries(
  GP_BOTTOM_SLUG_GROUP.map((slug, idx) => [slug, idx])
);

const HOME_PANEL_ORDER: HomePanel[] = ['Quick', 'PC', 'GP', 'VP'];
const HOME_PANEL_LABELS: Record<HomePanel, string> = {
  Quick: 'PRIORITY',
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
const GAMEPLAY_MODE_ACTIVE_WIDTH = 238;
const GAMEPLAY_MODE_INACTIVE_WIDTH = 52;
const GAMEPLAY_MODE_GAP = 6;
const GAMEPLAY_MODE_LOOP_CYCLES = 3;
const MODE_RAIL_LOOP_CYCLES = 15;
const MODE_RAIL_MIDDLE_CYCLE = Math.floor(MODE_RAIL_LOOP_CYCLES / 2);
const PROJECTED_CARD_WINDOWS = [30, 60, 90, 180, 360] as const;
const ACTUAL_CARD_VIEWS = ['actual365', 'progressYtd'] as const;
const GP_LOTTIE_SOURCE: object | number | null = null;
const VP_LOTTIE_SOURCE: object | number | null = null;
const PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS = new Set<string>();
const PIPELINE_CHECKIN_DISMISS_KEY_PREFIX = 'compass.pipeline_checkin.dismissed_day';
const PIPELINE_LOST_ENCOURAGEMENT_MESSAGES = [
  'Every pipeline dip is temporary. Refill the top and keep moving.',
  'Lost deals happen. Your consistency restores momentum.',
  'Reset the count, keep the reps high, and the next win comes faster.',
] as const;

function fmtUsd(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtNum(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtShortMonthDayYear(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtShortMonthDay(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function fmtMonthDayTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeChannelTypeToScope(type?: string | null): CoachingChannelScope | null {
  const t = String(type ?? '').toLowerCase();
  if (t === 'team') return 'team';
  if (t === 'challenge') return 'challenge';
  if (t === 'sponsor') return 'sponsor';
  if (t === 'cohort') return 'cohort';
  if (t === 'direct') return 'community';
  return null;
}

function normalizePackagingReadModelToVisibilityOutcome(
  readModel?: RuntimePackagingReadModel | null
): RuntimePackageVisibilityOutcome | null {
  if (!readModel) return null;
  const hasAnySignal =
    readModel.package_type != null ||
    readModel.visibility_state != null ||
    readModel.entitlement_result != null ||
    readModel.read_model_status != null ||
    readModel.linked_context_refs != null ||
    readModel.display_requirements != null;
  if (!hasAnySignal) return null;
  const refs = readModel.linked_context_refs ?? null;
  const dr = readModel.display_requirements ?? null;
  const inferredSponsorAttr =
    dr?.sponsor_attribution_required || refs?.sponsor_id || refs?.sponsored_challenge_id ? 'Sponsor-linked coaching' : null;
  const inferredDisclaimer = dr?.sponsor_disclaimer_required
    ? 'Sponsor disclaimer is required for this package-linked coaching surface.'
    : null;
  return {
    package_type: readModel.package_type ?? null,
    visibility_state: readModel.visibility_state ?? null,
    entitlement_result: readModel.entitlement_result ?? null,
    target_match: null,
    linked_context_refs: (refs as Record<string, unknown> | null) ?? null,
    display_requirements: {
      sponsor_disclaimer_required: dr?.sponsor_disclaimer_required ?? null,
      sponsor_attribution_required: dr?.sponsor_attribution_required ?? null,
      paywall_cta_required: dr?.paywall_cta_required ?? null,
      sponsor_attribution: inferredSponsorAttr,
      disclaimer: inferredDisclaimer,
    },
    read_model_status: readModel.read_model_status ?? null,
    notes: Array.isArray(readModel.notes) ? readModel.notes.filter((v): v is string => typeof v === 'string') : null,
  };
}

function pickRuntimePackageVisibility(
  ...candidates: Array<RuntimePackageVisibilityOutcome | null | undefined>
): RuntimePackageVisibilityOutcome | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hasAnySignal =
      candidate.package_type != null ||
      candidate.package_id != null ||
      candidate.visibility_state != null ||
      candidate.entitlement_result != null ||
      candidate.target_match != null ||
      candidate.display_requirements != null ||
      candidate.read_model_status != null;
    if (hasAnySignal) return candidate;
  }
  return null;
}

function deriveCoachingPackageGatePresentation(
  surfaceLabel: string,
  outcome?: RuntimePackageVisibilityOutcome | null
): CoachingPackageGatePresentation {
  const packageType = String(outcome?.package_type ?? '').toLowerCase();
  const visibilityState = String(outcome?.visibility_state ?? '').toLowerCase();
  const entitlementResult = String(outcome?.entitlement_result ?? '').toLowerCase();
  const targetMatch = outcome?.target_match;
  const displayReq = outcome?.display_requirements ?? null;
  const sponsorAttr = displayReq?.sponsor_attribution?.trim() || null;
  const explicitDisclaimer = displayReq?.disclaimer?.trim() || null;
  const paywallRequired = Boolean(displayReq?.paywall_cta_required);
  const sponsorDisclaimerRequired = Boolean(displayReq?.sponsor_disclaimer_required);
  const sponsorAttributionRequired = Boolean(displayReq?.sponsor_attribution_required);
  const readModelStatus = String(outcome?.read_model_status ?? '').toLowerCase();
  const notes = Array.isArray(outcome?.notes) ? outcome?.notes.filter((v): v is string => typeof v === 'string') : [];

  const boundaryNote =
    packageType === 'sponsored_challenge_coaching_campaign'
      ? 'Sponsored coaching messaging/content is package-driven; challenge participation/results stay challenge-owned.'
      : packageType === 'paid_coaching_product'
        ? 'Paid coaching access is server-enforced; runtime UI only reflects entitlement outcomes.'
        : packageType === 'team_coaching_program'
          ? 'Team coaching package visibility is server-provided when available.'
          : null;

  if (!outcome || (!visibilityState && !entitlementResult && targetMatch == null)) {
    return {
      tone: 'fallback',
      title: 'Package Visibility Pending',
      summary: `${surfaceLabel} is using a safe fallback state because runtime package visibility/entitlement outcomes are not present on this payload.`,
      detail: 'CTAs remain visible as shell/access attempts; server-side routes remain the source of truth for permission and entitlement enforcement.',
      policyNote: boundaryNote ?? 'UI does not infer billing, sponsor approvals, or targeting policy from partial context.',
    };
  }

  const blockedByEntitlement =
    entitlementResult === 'blocked_not_entitled' ||
    entitlementResult === 'blocked_not_in_audience' ||
    entitlementResult === 'blocked_schedule' ||
    entitlementResult === 'blocked_policy';
  const blockedByVisibility =
    visibilityState.includes('blocked') ||
    visibilityState.includes('hidden') ||
    visibilityState.includes('retired') ||
    visibilityState.includes('paused');
  const allowedByEntitlement =
    entitlementResult === 'allowed' ||
    entitlementResult === 'allowed_channel_member' ||
    entitlementResult === 'allowed_tier_gated';
  const notEvaluated = entitlementResult === 'not_evaluated' || entitlementResult === 'unknown';
  const available = allowedByEntitlement && targetMatch !== false && !blockedByVisibility;

  if (available) {
    return {
      tone: 'available',
      title: 'Package Available',
      summary: `${surfaceLabel} is visible under the current runtime package/entitlement outcome.`,
      detail:
        [
          sponsorAttr ? `Sponsor: ${sponsorAttr}` : null,
          sponsorAttributionRequired ? 'Sponsor attribution required.' : null,
          sponsorDisclaimerRequired ? 'Sponsor disclaimer required.' : null,
          explicitDisclaimer,
          paywallRequired ? 'Paywall CTA may be required on linked access paths.' : null,
          readModelStatus ? `read-model: ${readModelStatus}` : null,
        ]
          .filter(Boolean)
          .join(' ') || boundaryNote || null,
      policyNote: 'UI is reflecting server-provided visibility/entitlement outcomes only.',
    };
  }

  if (blockedByEntitlement || blockedByVisibility || targetMatch === false) {
    const reason =
      entitlementResult === 'blocked_not_entitled'
        ? 'Not entitled'
        : entitlementResult === 'blocked_not_in_audience'
          ? 'Not in target audience'
          : entitlementResult === 'blocked_schedule'
            ? 'Not currently scheduled'
            : entitlementResult === 'blocked_policy'
              ? 'Blocked by policy'
              : targetMatch === false
                ? 'Targeting mismatch'
                : visibilityState
                  ? `Visibility state: ${visibilityState}`
                  : 'Access unavailable';
    const tone: CoachingPackageGateTone =
      entitlementResult === 'blocked_policy' || visibilityState.includes('blocked') ? 'blocked' : 'gated';
    return {
      tone,
      title: tone === 'blocked' ? 'Package Blocked' : 'Package Gated',
      summary: `${surfaceLabel} is not available for this context right now.`,
      detail: [reason, sponsorAttr ? `Sponsor: ${sponsorAttr}` : null, explicitDisclaimer].filter(Boolean).join(' • '),
      policyNote: boundaryNote ?? 'UI is displaying server outcomes and not computing local package policy.',
    };
  }

  if (notEvaluated) {
    return {
      tone: 'fallback',
      title: 'Package Outcome Not Evaluated',
      summary: `${surfaceLabel} received a server package read-model, but entitlement remains ${entitlementResult || 'unknown'} for this endpoint family.`,
      detail:
        [
          readModelStatus ? `read-model: ${readModelStatus}` : null,
          sponsorAttributionRequired ? 'Sponsor attribution required.' : null,
          sponsorDisclaimerRequired ? 'Sponsor disclaimer required.' : null,
          paywallRequired ? 'Paywall CTA may be required on linked access paths.' : null,
          ...notes.slice(0, 2),
        ]
          .filter(Boolean)
          .join(' • ') || null,
      policyNote:
        boundaryNote ??
        'UI keeps fallback CTA behavior until this endpoint family returns a decisive entitlement outcome.',
    };
  }

  return {
    tone: 'fallback',
    title: 'Package Visibility Unclear',
    summary: `${surfaceLabel} received partial packaging metadata without a reusable entitlement outcome.`,
    detail: explicitDisclaimer ?? null,
    policyNote: boundaryNote ?? 'UI fallback keeps CTAs non-authoritative and defers access enforcement to the server.',
  };
}

function normalizeRuntimeNotificationSummary(input?: unknown): RuntimeNotificationSummaryReadModel | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const readModelStatus = typeof row.read_model_status === 'string' ? row.read_model_status : null;
  const notes = Array.isArray(row.notes) ? row.notes.filter((v): v is string => typeof v === 'string') : null;
  const totalCount = Number(row.total_count ?? row.total ?? row.count ?? 0);
  const unreadCount = Number(row.unread_count ?? row.unread ?? 0);
  const bannerCount = Number(row.banner_count ?? row.banner ?? 0);
  const badgeCount = Number(row.badge_count ?? row.badge ?? unreadCount);
  const badgeLabel =
    typeof row.badge_label === 'string'
      ? row.badge_label
      : badgeCount > 0
        ? `${Math.max(0, Math.round(badgeCount))}`
        : null;
  const hasSignal =
    Number.isFinite(totalCount) ||
    Number.isFinite(unreadCount) ||
    Number.isFinite(bannerCount) ||
    Number.isFinite(badgeCount) ||
    Boolean(readModelStatus) ||
    Boolean(notes?.length);
  if (!hasSignal) return null;
  return {
    total_count: Number.isFinite(totalCount) ? Math.max(0, Math.round(totalCount)) : null,
    unread_count: Number.isFinite(unreadCount) ? Math.max(0, Math.round(unreadCount)) : null,
    banner_count: Number.isFinite(bannerCount) ? Math.max(0, Math.round(bannerCount)) : null,
    badge_count: Number.isFinite(badgeCount) ? Math.max(0, Math.round(badgeCount)) : null,
    badge_label: badgeLabel,
    read_model_status: readModelStatus,
    notes,
  };
}

function normalizeRuntimeNotificationItems(input?: unknown, sourceFamily?: string): RuntimeNotificationItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, idx): RuntimeNotificationItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const notificationClass = String(
        row.notification_class ?? row.class ?? row.kind ?? row.type ?? 'notification'
      ).trim();
      const title = String(row.title ?? row.label ?? row.headline ?? '').trim();
      const bodyCandidate = row.body ?? row.summary ?? row.sub ?? row.description ?? null;
      const body = typeof bodyCandidate === 'string' ? bodyCandidate.trim() || null : null;
      const badgeLabelCandidate = row.badge_label ?? row.badge ?? row.chip_label ?? null;
      const badgeLabel = typeof badgeLabelCandidate === 'string' ? badgeLabelCandidate.trim() || null : null;
      const readStateCandidate = row.read_state ?? row.read ?? row.state ?? null;
      const readState =
        typeof readStateCandidate === 'string' && readStateCandidate.trim()
          ? (readStateCandidate.trim() as RuntimeNotificationReadState)
          : null;
      const severityCandidate = row.severity ?? row.tone ?? null;
      const severity =
        typeof severityCandidate === 'string' && severityCandidate.trim()
          ? (severityCandidate.trim() as RuntimeNotificationSeverity)
          : null;
      const deliveryRaw =
        Array.isArray(row.delivery_channels)
          ? row.delivery_channels
          : row.delivery_channel != null
            ? [row.delivery_channel]
            : Array.isArray(row.channels)
              ? row.channels
              : [];
      const deliveryChannels = deliveryRaw
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean) as RuntimeNotificationDeliveryChannel[];
      const routeRaw = (row.route_target && typeof row.route_target === 'object'
        ? row.route_target
        : null) as Record<string, unknown> | null;
      const routeTarget: RuntimeNotificationRouteTarget = {
        screen: typeof (routeRaw?.screen ?? row.screen) === 'string' ? String(routeRaw?.screen ?? row.screen) : null,
        channel_id:
          typeof (routeRaw?.channel_id ?? row.channel_id) === 'string'
            ? String(routeRaw?.channel_id ?? row.channel_id)
            : null,
        channel_name:
          typeof (routeRaw?.channel_name ?? row.channel_name) === 'string'
            ? String(routeRaw?.channel_name ?? row.channel_name)
            : null,
        journey_id:
          typeof (routeRaw?.journey_id ?? row.journey_id) === 'string'
            ? String(routeRaw?.journey_id ?? row.journey_id)
            : null,
        journey_title:
          typeof (routeRaw?.journey_title ?? row.journey_title) === 'string'
            ? String(routeRaw?.journey_title ?? row.journey_title)
            : null,
        lesson_id:
          typeof (routeRaw?.lesson_id ?? row.lesson_id) === 'string'
            ? String(routeRaw?.lesson_id ?? row.lesson_id)
            : null,
        lesson_title:
          typeof (routeRaw?.lesson_title ?? row.lesson_title) === 'string'
            ? String(routeRaw?.lesson_title ?? row.lesson_title)
            : null,
        challenge_id:
          typeof (routeRaw?.challenge_id ?? row.challenge_id) === 'string'
            ? String(routeRaw?.challenge_id ?? row.challenge_id)
            : null,
        challenge_title:
          typeof (routeRaw?.challenge_title ?? row.challenge_title) === 'string'
            ? String(routeRaw?.challenge_title ?? row.challenge_title)
            : null,
        preferred_channel_scope:
          typeof (routeRaw?.preferred_channel_scope ?? row.preferred_channel_scope) === 'string'
            ? String(routeRaw?.preferred_channel_scope ?? row.preferred_channel_scope)
            : null,
        preferred_channel_label:
          typeof (routeRaw?.preferred_channel_label ?? row.preferred_channel_label) === 'string'
            ? String(routeRaw?.preferred_channel_label ?? row.preferred_channel_label)
            : null,
      };
      const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
      const id = String(row.id ?? `${sourceFamily ?? 'notification'}-${notificationClass}-${idx}`).trim();
      if (!notificationClass || !title) return null;
      return {
        id,
        notification_class: notificationClass,
        title,
        body,
        badge_label: badgeLabel,
        read_state: readState,
        severity,
        delivery_channels: deliveryChannels.length > 0 ? deliveryChannels : null,
        route_target: routeTarget,
        source_family: sourceFamily ?? (typeof row.source_family === 'string' ? row.source_family : null),
        created_at: createdAt,
      };
    })
    .filter((item): item is RuntimeNotificationItem => Boolean(item));
}

function summarizeNotificationRows(
  rows: RuntimeNotificationItem[],
  fallback?: { sourceLabel?: string; readModelStatus?: string | null }
): RuntimeNotificationSummaryReadModel | null {
  if (!rows.length && !fallback?.readModelStatus) return null;
  const unreadCount = rows.filter((row) => String(row.read_state ?? 'unknown').toLowerCase() !== 'read').length;
  const badgeCount = rows.filter((row) => (row.delivery_channels ?? []).some((ch) => ch === 'badge')).length || unreadCount;
  const bannerCount = rows.filter((row) => (row.delivery_channels ?? []).some((ch) => ch === 'banner')).length;
  return {
    total_count: rows.length,
    unread_count: unreadCount,
    banner_count: bannerCount,
    badge_count: badgeCount,
    badge_label: badgeCount > 0 ? String(badgeCount) : null,
    read_model_status: fallback?.readModelStatus ?? null,
    notes: fallback?.sourceLabel ? [`source:${fallback.sourceLabel}`] : null,
  };
}

function isPartialReadModelStatus(status?: string | null) {
  const normalized = String(status ?? '').toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('partial') ||
    normalized.includes('inferred') ||
    normalized.includes('unknown') ||
    normalized.includes('not_evaluated')
  );
}

function deriveRuntimeSurfaceStateModel(params: {
  surfaceLabel: string;
  loading?: boolean;
  errorText?: string | null;
  hasRows?: boolean;
  gateTone?: CoachingPackageGateTone | null;
  readModelStatus?: string | null;
}): RuntimeSurfaceStateModel {
  const loading = Boolean(params.loading);
  const errorText = String(params.errorText ?? '').trim();
  const hasRows = Boolean(params.hasRows);
  const gateTone = params.gateTone ?? null;
  const readModelStatus = params.readModelStatus ?? null;
  const lowerError = errorText.toLowerCase();
  const permissionDenied =
    gateTone === 'blocked' ||
    gateTone === 'gated' ||
    lowerError.includes('403') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('permission') ||
    lowerError.includes('not allowed') ||
    lowerError.includes('policy');
  if (loading) {
    return {
      state: 'loading',
      title: `${params.surfaceLabel}: Loading`,
      detail: 'Loading context.',
      transitionHint: 'Updates when data returns.',
    };
  }
  if (permissionDenied) {
    return {
      state: 'permission_denied',
      title: `${params.surfaceLabel}: Permission denied`,
      detail: 'Limited by current role/package.',
      transitionHint: 'Updates when access changes.',
    };
  }
  if (errorText) {
    return {
      state: 'error',
      title: `${params.surfaceLabel}: Load error`,
      detail: errorText,
      transitionHint: 'Retry to refresh.',
    };
  }
  if (isPartialReadModelStatus(readModelStatus)) {
    return {
      state: 'partial_read_model',
      title: `${params.surfaceLabel}: Partial read-model`,
      detail: 'Some data is limited.',
      transitionHint: 'Updates when full data is available.',
    };
  }
  if (!hasRows) {
    return {
      state: 'empty',
      title: `${params.surfaceLabel}: Empty`,
      detail: 'Nothing to show yet.',
      transitionHint: 'Updates when items appear.',
    };
  }
  return {
    state: 'ready',
    title: `${params.surfaceLabel}: Ready`,
    detail: 'Data is ready.',
    transitionHint: 'Auto-updates with changes.',
  };
}

function challengeBucketFromDates(input: { startAt?: string | null; endAt?: string | null; nowMs?: number }) {
  const nowMs = input.nowMs ?? Date.now();
  const startMs = input.startAt ? new Date(String(input.startAt)).getTime() : NaN;
  const endMs = input.endAt ? new Date(String(input.endAt)).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs < nowMs) return 'completed' as const;
  if (Number.isFinite(startMs) && startMs > nowMs) return 'upcoming' as const;
  return 'active' as const;
}

function challengeStatusLabelFromBucket(bucket: 'active' | 'upcoming' | 'completed', joined: boolean) {
  if (bucket === 'completed') return 'Completed';
  if (bucket === 'upcoming') return joined ? 'Joined' : 'Upcoming';
  return joined ? 'Joined' : 'Active';
}

function challengeDaysLabelFromDates(bucket: 'active' | 'upcoming' | 'completed', startAt?: string | null, endAt?: string | null) {
  const now = Date.now();
  const startMs = startAt ? new Date(String(startAt)).getTime() : NaN;
  const endMs = endAt ? new Date(String(endAt)).getTime() : NaN;
  if (bucket === 'completed') return 'Completed';
  if (bucket === 'upcoming' && Number.isFinite(startMs)) {
    const days = Math.max(0, Math.ceil((startMs - now) / (24 * 60 * 60 * 1000)));
    return days <= 0 ? 'Starts today' : `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (bucket === 'active' && Number.isFinite(endMs)) {
    const days = Math.max(0, Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)));
    return `${days} day${days === 1 ? '' : 's'} left`;
  }
  return '';
}

function challengeTimeframeLabel(startAt?: string | null, endAt?: string | null) {
  const start = fmtShortMonthDay(startAt);
  const end = fmtShortMonthDayYear(endAt);
  if (start && end) return `${start} - ${end}`;
  return start || end || 'Dates TBD';
}

function challengeModeLabelFromApi(row: ChallengeApiRow) {
  const mode = String(row.mode ?? '').toLowerCase();
  if (mode === 'team') return 'Team';
  if (mode === 'solo') return 'Single Agent';
  if (row.team_id) return 'Team';
  return 'Single Agent';
}

function leaderboardFallbackName(userId?: string, rank?: number) {
  if (userId && userId.length >= 6) return `Member ${String(userId).slice(0, 4)}`;
  return `Member ${rank ?? ''}`.trim();
}

function mapChallengeLeaderboardPreview(
  leaderboardTop: ChallengeApiRow['leaderboard_top'] | undefined | null
): ChallengeFlowLeaderboardEntry[] {
  const rows = Array.isArray(leaderboardTop) ? leaderboardTop : [];
  return rows.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id ?? ''),
    // TODO(M4 challenge payload): use display names from challenge list/detail payload once backend includes profile summary.
    name: leaderboardFallbackName(String(row.user_id ?? ''), index + 1),
    pct: Math.max(0, Math.round(Number(row.progress_percent ?? 0))),
    value: Math.max(0, Math.round(Number(row.activity_count ?? 0))),
  }));
}

function defaultChallengeFlowItems(): ChallengeFlowItem[] {
  return [
    {
      id: 'challenge-30-day-listing',
      title: '30 Day Listing Challenge',
      subtitle: 'Track listing-focused production actions this month',
      status: 'Active',
      progressPct: 60,
      timeframe: 'Nov 1 - Nov 30, 2025',
      daysLabel: '24 days left',
      participants: 12,
      sponsor: false,
      bucket: 'active',
      joined: true,
      challengeModeLabel: 'Single Agent',
      targetValueLabel: '5 per month',
      raw: null,
      leaderboardPreview: [
        { rank: 1, name: 'Amy Jackson', pct: 33, value: 24 },
        { rank: 2, name: 'Sarah Johnson', pct: 18, value: 13 },
        { rank: 3, name: 'Scott Johnson', pct: 7, value: 5 },
      ],
    },
    {
      id: 'challenge-conversation-sprint',
      title: 'Conversation Sprint',
      subtitle: 'Momentum challenge for outreach and follow-up consistency',
      status: 'Upcoming',
      progressPct: 0,
      timeframe: 'Dec 1 - Dec 14, 2025',
      daysLabel: 'Starts in 4 days',
      participants: 8,
      sponsor: false,
      bucket: 'upcoming',
      joined: false,
      challengeModeLabel: 'Single Agent',
      targetValueLabel: 'TBD',
      raw: null,
      leaderboardPreview: [],
    },
    {
      id: 'challenge-open-house-run',
      title: 'Open House Run',
      subtitle: 'Weekend event execution challenge with team leaderboard',
      status: 'Completed',
      progressPct: 100,
      timeframe: 'Oct 1 - Oct 31, 2025',
      daysLabel: 'Completed',
      participants: 15,
      sponsor: true,
      bucket: 'completed',
      joined: true,
      challengeModeLabel: 'Team',
      targetValueLabel: 'TBD',
      raw: null,
      leaderboardPreview: [],
    },
  ];
}

function mapChallengesToFlowItems(rows: ChallengeApiRow[] | null | undefined): ChallengeFlowItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return defaultChallengeFlowItems();
  return rows.map((row) => {
    const joined = !!row.my_participation;
    const bucket = challengeBucketFromDates({ startAt: row.start_at, endAt: row.end_at });
    const leaderboardPreview = mapChallengeLeaderboardPreview(row.leaderboard_top);
    const participants = Array.isArray(row.leaderboard_top) && row.leaderboard_top.length > 0
      ? row.leaderboard_top.length
      : joined
        ? 1
        : 0;
    // TODO(M4 challenge payload gap): API list payload does not expose target value metadata for details rows; keep placeholder label.
    const targetValueLabel = 'TBD';
    const subtitle =
      String(row.description ?? '').trim() ||
      'Challenge details and progress summary.';
    return {
      id: String(row.id),
      title: String(row.name ?? 'Challenge'),
      subtitle,
      status: challengeStatusLabelFromBucket(bucket, joined),
      progressPct: Math.max(0, Math.round(Number(row.my_participation?.progress_percent ?? 0))),
      timeframe: challengeTimeframeLabel(row.start_at, row.end_at),
      daysLabel: challengeDaysLabelFromDates(bucket, row.start_at, row.end_at),
      participants,
      sponsor: Boolean(row.sponsored_challenge_id ?? row.sponsor_id),
      bucket,
      joined,
      challengeModeLabel: challengeModeLabelFromApi(row),
      targetValueLabel,
      startAtIso: row.start_at ?? null,
      endAtIso: row.end_at ?? null,
      raw: row,
      leaderboardPreview,
    };
  });
}

function challengeListFilterMatches(item: ChallengeFlowItem, filter: ChallengeListFilter) {
  if (filter === 'all') return true;
  if (filter === 'sponsored') return item.sponsor;
  return item.challengeModeLabel === 'Team' || Boolean(item.raw?.team_id);
}

function isApiBackedChallenge(item?: ChallengeFlowItem | null) {
  return Boolean(item?.raw?.id);
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
  biz_post: require('../assets/figma/kpi_icon_bank/pc_biz_post_v1.png'),
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
  instagram_post_shared: require('../assets/figma/kpi_icon_bank/gp_instagram_post_shared_v1.png'),
  facebook_post_shared: require('../assets/figma/kpi_icon_bank/gp_facebook_post_shared_v1.png'),
  tiktok_post_shared: require('../assets/figma/kpi_icon_bank/gp_tiktok_post_shared_v1.png'),
  x_post_shared: require('../assets/figma/kpi_icon_bank/gp_x_post_shared_v1.png'),
  linkedin_post_shared: require('../assets/figma/kpi_icon_bank/gp_linkedin_post_shared_v1.png'),
  youtube_short_posted: require('../assets/figma/kpi_icon_bank/gp_youtube_short_posted_v1.png'),
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
  biz_post: KPI_ICON_ASSETS.biz_post,
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
  instagram_post_shared: KPI_ICON_ASSETS.instagram_post_shared,
  facebook_post_shared: KPI_ICON_ASSETS.facebook_post_shared,
  tiktok_post_shared: KPI_ICON_ASSETS.tiktok_post_shared,
  x_post_shared: KPI_ICON_ASSETS.x_post_shared,
  linkedin_post_shared: KPI_ICON_ASSETS.linkedin_post_shared,
  youtube_short_posted: KPI_ICON_ASSETS.youtube_short_posted,
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

function kpiSortSlug(kpi: DashboardPayload['loggable_kpis'][number]) {
  return normalizeKpiIdentifier(String(kpi.slug || kpi.name || ''));
}

function compareKpisForSelectionOrder(
  a: DashboardPayload['loggable_kpis'][number],
  b: DashboardPayload['loggable_kpis'][number]
) {
  const typeDelta =
    (KPI_TYPE_SORT_ORDER[a.type as 'PC' | 'GP' | 'VP'] ?? 99) -
    (KPI_TYPE_SORT_ORDER[b.type as 'PC' | 'GP' | 'VP'] ?? 99);
  if (typeDelta !== 0) return typeDelta;

  const aSlug = kpiSortSlug(a);
  const bSlug = kpiSortSlug(b);

  if (a.type === 'PC' && b.type === 'PC') {
    const aIdx = PC_PRIORITY_SLUG_INDEX[aSlug];
    const bIdx = PC_PRIORITY_SLUG_INDEX[bSlug];
    const aPinned = aIdx !== undefined;
    const bPinned = bIdx !== undefined;
    if (aPinned && bPinned) return aIdx - bIdx;
    if (aPinned) return -1;
    if (bPinned) return 1;
  }

  if (a.type === 'GP' && b.type === 'GP') {
    const aIdx = GP_BOTTOM_SLUG_INDEX[aSlug];
    const bIdx = GP_BOTTOM_SLUG_INDEX[bSlug];
    const aPinned = aIdx !== undefined;
    const bPinned = bIdx !== undefined;
    if (aPinned && bPinned) return aIdx - bIdx;
    if (aPinned) return 1;
    if (bPinned) return -1;
  }

  return a.name.localeCompare(b.name);
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
  return [...kpis].sort(compareKpisForSelectionOrder);
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

function dedupeKpisById(kpis: DashboardPayload['loggable_kpis']): DashboardPayload['loggable_kpis'] {
  const seen = new Set<string>();
  const deduped: DashboardPayload['loggable_kpis'] = [];
  for (const kpi of kpis) {
    const id = String(kpi.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(kpi);
  }
  return deduped;
}

function derivePlaceholderOverlayBadgesForHomeTile(
  _kpi: DashboardPayload['loggable_kpis'][number],
  tileIndex: number
): KpiTileContextBadge[] {
  // DEV/DEMO seam (M3-G1): make context badges visibly render on Home before challenge/team payload wiring.
  // TODO(M3-G4/M3-G5): replace with real challenge/team memberships when payload includes them.
  if (tileIndex === 0) return ['CH'];
  if (tileIndex === 1) return ['TM'];
  if (tileIndex === 2) return ['TC'];
  return [];
}

function deriveKpiTileContextMeta(
  kpi: DashboardPayload['loggable_kpis'][number],
  payload: DashboardPayload | null,
  tileIndex: number
): KpiTileContextMeta {
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((anchor) => String(anchor.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const isRequired = requiredAnchorIds.has(String(kpi.id ?? '').trim());
  const badges = new Set<KpiTileContextBadge>();
  if (isRequired) badges.add('REQ');
  for (const badge of derivePlaceholderOverlayBadgesForHomeTile(kpi, tileIndex)) badges.add(badge);
  return {
    badges: [...badges],
    isRequired,
    isLagging: false,
  };
}

function buildHomePanelTiles(
  kpis: DashboardPayload['loggable_kpis'],
  payload: DashboardPayload | null
): HomePanelTile[] {
  return dedupeKpisById(kpis).map((kpi, tileIndex) => ({
    kpi,
    context: deriveKpiTileContextMeta(kpi, payload, tileIndex),
  }));
}

function rankHomePriorityKpisV1(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  managedKpiIdSet: Set<string>;
  payload: DashboardPayload | null;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
}) {
  const { managedKpis, favoriteKpiIds, managedKpiIdSet, payload, gpUnlocked, vpUnlocked } = params;
  const favoriteRankById = new Map(favoriteKpiIds.map((id, index) => [id, index]));
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((anchor) => String(anchor.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const lastLogMsByKpiId = new Map<string, number>();
  for (const row of payload?.recent_logs ?? []) {
    const id = String(row.kpi_id ?? '').trim();
    if (!id) continue;
    const ts = new Date(String(row.event_timestamp ?? '')).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = lastLogMsByKpiId.get(id);
    if (prev == null || ts > prev) lastLogMsByKpiId.set(id, ts);
  }
  const nowMs = Date.now();
  const baseIndexById = new Map(managedKpis.map((kpi, index) => [kpi.id, index]));

  return dedupeKpisById(managedKpis)
    .map((kpi) => {
      let score = 0;
      const id = String(kpi.id ?? '').trim();
      const favoriteRank = favoriteRankById.get(id);
      const lastLogMs = lastLogMsByKpiId.get(id);
      const isLocked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
      const isRequiredAnchor = requiredAnchorIds.has(id);

      // TODO(M3-G7): insert challenge/team/team-challenge lagging + required inputs ahead of these heuristics.
      if (isRequiredAnchor) score += 9000;
      if (managedKpiIdSet.has(id)) score += 900;
      if (favoriteRank != null) score += 800 - favoriteRank * 20;
      if (lastLogMs == null) {
        score += 2400; // Never/recently unseen in local recent_logs -> surface it.
      } else {
        const staleDays = Math.max(0, Math.floor((nowMs - lastLogMs) / 86400000));
        score += Math.min(staleDays, 30) * 80;
      }

      // Lightweight deterministic type/value heuristics using existing payload fields.
      if (kpi.type === 'PC') score += Math.round(Number(kpi.pc_weight ?? 0) * 220);
      if (kpi.type === 'GP') score += Math.round(Number(kpi.gp_value ?? 0) * 14);
      if (kpi.type === 'VP') score += Math.round(Number(kpi.vp_value ?? 0) * 14);
      if (kpi.requires_direct_value_input) score -= 120;

      // Keep locked categories de-prioritized in Priority while preserving fallback eligibility.
      if (isLocked) score -= 7000;

      return { kpi, score, baseIndex: baseIndexById.get(kpi.id) ?? Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.baseIndex - b.baseIndex;
    })
    .map((row) => row.kpi);
}

function derivePipelineAnchorNagState(payload: DashboardPayload | null): PipelineAnchorNagState {
  const forceDemo = false; // DEV toggle for visual verification only; keep false in committed code.
  if (forceDemo) {
    return { severity: 'warning', missingCount: 1, staleDays: 999, lowConfidence: true };
  }
  const anchors = payload?.projection.required_pipeline_anchors ?? [];
  if (anchors.length === 0) {
    return { severity: 'warning', missingCount: 1, staleDays: 999, lowConfidence: false };
  }

  // M3-G3 v1 threshold: anchors older than 7 days are treated as stale (simple, deterministic, tunable later).
  const STALE_DAYS_THRESHOLD = 7;
  const nowMs = Date.now();
  let latestRequiredAnchorMs = 0;
  let validAnchorCount = 0;
  for (const anchor of anchors) {
    const ts = new Date(String(anchor.updated_at ?? '')).getTime();
    if (!Number.isFinite(ts)) continue;
    validAnchorCount += 1;
    if (ts > latestRequiredAnchorMs) latestRequiredAnchorMs = ts;
  }

  const missingCount = validAnchorCount === 0 ? 1 : 0;
  const staleDays =
    latestRequiredAnchorMs > 0 ? Math.max(0, Math.floor((nowMs - latestRequiredAnchorMs) / 86400000)) : 999;
  const lowConfidence = (payload?.projection.confidence.band ?? 'yellow') === 'red';

  if (missingCount > 0) {
    return { severity: 'warning', missingCount, staleDays, lowConfidence };
  }
  if (staleDays > STALE_DAYS_THRESHOLD) {
    return { severity: 'stale', missingCount, staleDays, lowConfidence };
  }
  return { severity: 'ok' };
}

function deriveChallengeSurfaceKpis(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  payload: DashboardPayload | null;
}): DashboardPayload['loggable_kpis'] {
  const { managedKpis, favoriteKpiIds, payload } = params;
  // TODO(M3-G4+): replace with real challenge membership/progress payload filtering when available.
  // v1 placeholder seam: prioritize favorited + recently active KPIs, then fill from managed KPI set.
  const byId = new Map(managedKpis.map((kpi) => [kpi.id, kpi]));
  const favorites = favoriteKpiIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const recentIds = Array.from(
    new Set(
      (payload?.recent_logs ?? [])
        .slice()
        .reverse()
        .map((row) => String(row.kpi_id ?? '').trim())
        .filter(Boolean)
    )
  );
  const recent = recentIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const merged = dedupeKpisById([...favorites, ...recent, ...managedKpis]);
  return merged.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
}

function groupChallengeKpisByType(kpis: DashboardPayload['loggable_kpis']): ChallengeKpiGroups {
  const grouped: ChallengeKpiGroups = { PC: [], GP: [], VP: [] };
  for (const kpi of dedupeKpisById(kpis)) {
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      grouped[kpi.type].push(kpi);
    }
  }
  return grouped;
}

function deriveTeamSurfaceKpis(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  payload: DashboardPayload | null;
}): DashboardPayload['loggable_kpis'] {
  const { managedKpis, favoriteKpiIds, payload } = params;
  // TODO(M3-G5+): replace with real team/team-challenge relevance filtering when team payload/context is available.
  // v1 placeholder seam: bias toward recently active + favorites + required pipeline-related visibility, then fill from managed KPIs.
  const byId = new Map(managedKpis.map((kpi) => [kpi.id, kpi]));
  const favorites = favoriteKpiIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const recentIds = Array.from(
    new Set(
      (payload?.recent_logs ?? [])
        .slice()
        .reverse()
        .map((row) => String(row.kpi_id ?? '').trim())
        .filter(Boolean)
    )
  );
  const recent = recentIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((row) => String(row.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const required = managedKpis.filter((kpi) => requiredAnchorIds.has(String(kpi.id ?? '')));
  const merged = dedupeKpisById([...required, ...recent, ...favorites, ...managedKpis]);
  return merged.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
}

function groupTeamKpisByType(kpis: DashboardPayload['loggable_kpis']): TeamKpiGroups {
  const grouped: TeamKpiGroups = { PC: [], GP: [], VP: [] };
  for (const kpi of dedupeKpisById(kpis)) {
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      grouped[kpi.type].push(kpi);
    }
  }
  return grouped;
}

function findPipelineCheckinAnchors(payload: DashboardPayload | null): PipelineCheckinAnchorTargets {
  const anchors = (payload?.loggable_kpis ?? []).filter((kpi) => kpi.type === 'Pipeline_Anchor');
  const listings = anchors.find((kpi) => String(kpi.name ?? '').toLowerCase().includes('listing')) ?? null;
  const buyers = anchors.find((kpi) => String(kpi.name ?? '').toLowerCase().includes('buyer')) ?? null;
  return { listings, buyers };
}

function readPipelineAnchorCountsFromPayload(payload: DashboardPayload | null) {
  const rows = payload?.projection.required_pipeline_anchors ?? [];
  const readCount = (needle: string) => {
    const row = rows.find((item) => String(item.anchor_type ?? '').toLowerCase().includes(needle));
    return Math.max(0, Math.round(Number(row?.anchor_value ?? 0) || 0));
  };
  return {
    listings: readCount('listing'),
    buyers: readCount('buyer'),
  };
}

function findActualGciLogKpi(payload: DashboardPayload | null) {
  const actualKpis = (payload?.loggable_kpis ?? []).filter((kpi) => kpi.type === 'Actual');
  const byName = actualKpis.find((kpi) => {
    const name = String(kpi.name ?? '').toLowerCase();
    return name.includes('gci') || name.includes('close') || name.includes('deal');
  });
  return byName ?? actualKpis[0] ?? null;
}

function renderContextBadgeLabel(badge: KpiTileContextBadge) {
  if (badge === 'CH') return '🏆';
  if (badge === 'TM') return '👥';
  if (badge === 'TC') return '👥🏆';
  return 'REQ';
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
  if ((month ?? 0) === 1) {
    const yy = String(year).slice(-2);
    return `${mon} '${yy}`;
  }
  return mon;
}

function monthLabelFromIsoMonthStart(isoValue: string) {
  if (typeof isoValue !== 'string' || isoValue.length < 7) return '';
  const year = Number(isoValue.slice(0, 4));
  const month = Number(isoValue.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';
  return monthLabel(`${year}-${String(month).padStart(2, '0')}`);
}

function aiAssistIntentForHost(host: AIAssistHostSurface): AIAssistRequestIntent {
  if (host === 'channel_thread') return 'draft_reply';
  if (host === 'coach_broadcast_compose') return 'draft_broadcast';
  if (host === 'coaching_lesson_detail') return 'reflection_prompt';
  return 'draft_support_note';
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

function shiftIsoLocalDate(isoDay: string, deltaDays: number) {
  const [year, month, day] = String(isoDay || '').split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoTodayLocal();
  const dt = new Date(year, Math.max(0, month - 1), day);
  dt.setDate(dt.getDate() + deltaDays);
  const nextYear = dt.getFullYear();
  const nextMonth = String(dt.getMonth() + 1).padStart(2, '0');
  const nextDay = String(dt.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function eventTimestampIsoForSelectedDay(isoDay: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : isoTodayLocal();
  // Use noon UTC so the stored ISO date prefix remains the selected day across time zones.
  return `${normalized}T12:00:00.000Z`;
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

const feedbackAudioAssets = {
  swipe: require('../assets/audio/sfx/swipe_shorter.m4a'),
  logTap: require('../assets/audio/sfx/coin_success.m4a'),
  growthTap: require('../assets/audio/sfx/drill_growth_kpi_sound.m4a'),
  vitalityTap: require('../assets/audio/sfx/Vitatlity2.m4a'),
  logSuccess: require('../assets/audio/sfx/ui_coin_success.mp3'),
  locked: require('../assets/audio/sfx/ui_locked.mp3'),
  logError: require('../assets/audio/sfx/ui_error.mp3'),
} as const;

const bottomTabIconSvgByKey = {
  home: TabDashboardIcon,
  challenge: TabChallengesIcon,
  logs: TabLogsIcon,
  team: TabTeamIcon,
  comms: TabCoachIcon,
} as const;

const homePanelPillSvgBg = {
  Quick: PillQuicklogBg,
  PC: PillProjectionsBg,
  GP: PillGrowthBg,
  VP: PillVitalityBg,
} as const;

const bottomTabIconStyleByKey: Record<BottomTab, any> = {
  home: null,
  challenge: null,
  logs: null,
  team: { transform: [{ translateY: -6 }] },
  comms: { transform: [{ translateY: -3 }] },
};

const bottomTabOrder: BottomTab[] = ['challenge', 'logs', 'home', 'team', 'comms'];
const bottomTabAccessibilityLabel: Record<BottomTab, string> = {
  challenge: 'Challenges',
  logs: 'Logs and reports',
  home: 'LOG',
  team: 'Team',
  comms: 'Comms',
};

type Props = {
  onOpenProfile?: () => void;
};

export default function KPIDashboardScreen({ onOpenProfile }: Props) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [state, setState] = useState<LoadState>('loading');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingKpiId, setSubmittingKpiId] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>('PC');
  const [homePanel, setHomePanel] = useState<HomePanel>('Quick');
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [logsReportsSubview, setLogsReportsSubview] = useState<LogsReportsSubview>('logs');
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [challengeFlowScreen, setChallengeFlowScreen] = useState<'list' | 'details' | 'leaderboard'>('list');
  const [challengeListFilter, setChallengeListFilter] = useState<ChallengeListFilter>('all');
  const [challengeMemberListTab, setChallengeMemberListTab] = useState<ChallengeMemberListTab>('all');
  const [challengeSelectedId, setChallengeSelectedId] = useState<string>('challenge-30-day-listing');
  const [challengeApiRows, setChallengeApiRows] = useState<ChallengeApiRow[] | null>(null);
  const [challengeApiFetchError, setChallengeApiFetchError] = useState<string | null>(null);
  const [challengeJoinSubmittingId, setChallengeJoinSubmittingId] = useState<string | null>(null);
  const [challengeLeaveSubmittingId, setChallengeLeaveSubmittingId] = useState<string | null>(null);
  const [challengeJoinError, setChallengeJoinError] = useState<string | null>(null);
  const [challengeLeaveError, setChallengeLeaveError] = useState<string | null>(null);
  const [challengeMemberCreateModalVisible, setChallengeMemberCreateModalVisible] = useState(false);
  const [challengeMemberCreateMode, setChallengeMemberCreateMode] = useState<'public' | 'team'>('team');
  const [teamFlowScreen, setTeamFlowScreen] = useState<TeamFlowScreen>('dashboard');
  const [teamLeaderMemberFilter, setTeamLeaderMemberFilter] = useState<string>('all');
  const [teamLeaderKpiTypeFilter, setTeamLeaderKpiTypeFilter] = useState<TeamLeaderKpiTypeFilter>('all');
  const [teamLeaderKpiStatusFilter, setTeamLeaderKpiStatusFilter] = useState<TeamLeaderKpiStatusFilter>('all');
  const [teamLeaderConcernFilter, setTeamLeaderConcernFilter] = useState<TeamLeaderConcernFilter>('all');
  const [teamLeaderExpandedMemberId, setTeamLeaderExpandedMemberId] = useState<string | null>(null);
  const [teamFocusKpiEditorOpen, setTeamFocusKpiEditorOpen] = useState(false);
  const [teamFocusSelectedKpiIds, setTeamFocusSelectedKpiIds] = useState<string[]>([]);
  const [coachingShellScreen, setCoachingShellScreen] = useState<CoachingShellScreen>('inbox');
  const [commsHubPrimaryTab, setCommsHubPrimaryTab] = useState<CommsHubPrimaryTab>('all');
  const [commsHubScopeFilter, setCommsHubScopeFilter] = useState<CommsHubScopeFilter>('all');
  const [commsHubSearchQuery, setCommsHubSearchQuery] = useState('');
  const [coachingShellContext, setCoachingShellContext] = useState<CoachingShellContext>({
    source: 'unknown',
    preferredChannelScope: null,
    preferredChannelLabel: null,
    threadTitle: null,
    threadSub: null,
    broadcastAudienceLabel: null,
    broadcastRoleAllowed: false,
    selectedJourneyId: null,
    selectedJourneyTitle: null,
    selectedLessonId: null,
    selectedLessonTitle: null,
  });
  const [coachingJourneys, setCoachingJourneys] = useState<CoachingJourneyListItem[] | null>(null);
  const [coachingJourneysPackageVisibility, setCoachingJourneysPackageVisibility] =
    useState<RuntimePackageVisibilityOutcome | null>(null);
  const [coachingJourneysNotificationItems, setCoachingJourneysNotificationItems] = useState<RuntimeNotificationItem[]>([]);
  const [coachingJourneysNotificationSummary, setCoachingJourneysNotificationSummary] =
    useState<RuntimeNotificationSummaryReadModel | null>(null);
  const [coachingJourneysLoading, setCoachingJourneysLoading] = useState(false);
  const [coachingJourneysError, setCoachingJourneysError] = useState<string | null>(null);
  const [coachingProgressSummary, setCoachingProgressSummary] = useState<CoachingProgressSummaryResponse | null>(null);
  const [coachingProgressNotificationItems, setCoachingProgressNotificationItems] = useState<RuntimeNotificationItem[]>([]);
  const [coachingProgressNotificationSummary, setCoachingProgressNotificationSummary] =
    useState<RuntimeNotificationSummaryReadModel | null>(null);
  const [coachingProgressLoading, setCoachingProgressLoading] = useState(false);
  const [coachingProgressError, setCoachingProgressError] = useState<string | null>(null);
  const [coachingJourneyDetail, setCoachingJourneyDetail] = useState<CoachingJourneyDetailResponse | null>(null);
  const [coachingJourneyDetailLoading, setCoachingJourneyDetailLoading] = useState(false);
  const [coachingJourneyDetailError, setCoachingJourneyDetailError] = useState<string | null>(null);
  const [coachingLessonProgressSubmittingId, setCoachingLessonProgressSubmittingId] = useState<string | null>(null);
  const [coachingLessonProgressError, setCoachingLessonProgressError] = useState<string | null>(null);
  const [channelsApiRows, setChannelsApiRows] = useState<ChannelApiRow[] | null>(null);
  const [channelsPackageVisibility, setChannelsPackageVisibility] = useState<RuntimePackageVisibilityOutcome | null>(null);
  const [channelsNotificationItems, setChannelsNotificationItems] = useState<RuntimeNotificationItem[]>([]);
  const [channelsNotificationSummary, setChannelsNotificationSummary] = useState<RuntimeNotificationSummaryReadModel | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null);
  const [channelMessages, setChannelMessages] = useState<ChannelMessageRow[] | null>(null);
  const [channelThreadPackageVisibility, setChannelThreadPackageVisibility] =
    useState<RuntimePackageVisibilityOutcome | null>(null);
  const [channelThreadNotificationItems, setChannelThreadNotificationItems] = useState<RuntimeNotificationItem[]>([]);
  const [channelThreadNotificationSummary, setChannelThreadNotificationSummary] =
    useState<RuntimeNotificationSummaryReadModel | null>(null);
  const [channelMessagesLoading, setChannelMessagesLoading] = useState(false);
  const [channelMessagesError, setChannelMessagesError] = useState<string | null>(null);
  const [channelMessageDraft, setChannelMessageDraft] = useState('');
  const [channelMessageSubmitting, setChannelMessageSubmitting] = useState(false);
  const [channelMessageSubmitError, setChannelMessageSubmitError] = useState<string | null>(null);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [broadcastTargetScope, setBroadcastTargetScope] = useState<'team' | 'cohort' | 'channel'>('team');
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccessNote, setBroadcastSuccessNote] = useState<string | null>(null);
  const [aiAssistVisible, setAiAssistVisible] = useState(false);
  const [aiAssistContext, setAiAssistContext] = useState<AIAssistShellContext | null>(null);
  const [aiAssistPrompt, setAiAssistPrompt] = useState('');
  const [aiAssistDraftText, setAiAssistDraftText] = useState('');
  const [aiAssistGenerating, setAiAssistGenerating] = useState(false);
  const [aiAssistNotice, setAiAssistNotice] = useState<string | null>(null);
  const [aiSuggestionQueueSubmitting, setAiSuggestionQueueSubmitting] = useState(false);
  const [aiSuggestionQueueError, setAiSuggestionQueueError] = useState<string | null>(null);
  const [aiSuggestionQueueSuccess, setAiSuggestionQueueSuccess] = useState<string | null>(null);
  const [aiSuggestionRows, setAiSuggestionRows] = useState<AiSuggestionApiRow[] | null>(null);
  const [aiSuggestionQueueSummary, setAiSuggestionQueueSummary] = useState<AiSuggestionQueueSummary | null>(null);
  const [aiSuggestionListLoading, setAiSuggestionListLoading] = useState(false);
  const [aiSuggestionListError, setAiSuggestionListError] = useState<string | null>(null);
  const [addDrawerVisible, setAddDrawerVisible] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>('Quick');
  const [managedKpiIds, setManagedKpiIds] = useState<string[]>([]);
  const [favoriteKpiIds, setFavoriteKpiIds] = useState<string[]>([]);
  const [pendingDirectLog, setPendingDirectLog] = useState<PendingDirectLog | null>(null);
  const [directValue, setDirectValue] = useState('');
  const [refreshingConfidence, setRefreshingConfidence] = useState(false);
  const [showConfidenceTooltip, setShowConfidenceTooltip] = useState(false);
  const confidenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartScrollRef = useRef<ScrollView | null>(null);
  const screenRootRef = useRef<View | null>(null);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [selectedLogDateIso, setSelectedLogDateIso] = useState<string | null>(null);
  const [homeVisualViewportWidth, setHomeVisualViewportWidth] = useState(0);
  const [homeGridViewportWidth, setHomeGridViewportWidth] = useState(0);
  const [hudActiveIndex, setHudActiveIndex] = useState(0);
  const [projectedCardWindowDays, setProjectedCardWindowDays] = useState<(typeof PROJECTED_CARD_WINDOWS)[number]>(90);
  const [actualHudCardView, setActualHudCardView] = useState<(typeof ACTUAL_CARD_VIEWS)[number]>('actual365');
  const [modeRailViewportWidth, setModeRailViewportWidth] = useState(0);
  const [modeRailActiveCycle, setModeRailActiveCycle] = useState(MODE_RAIL_MIDDLE_CYCLE);
  const [modeRailScrollEnabled, setModeRailScrollEnabled] = useState(true);
  const [confirmedKpiTileIds, setConfirmedKpiTileIds] = useState<Record<string, true>>({});
  const [feedbackMuted, setFeedbackMuted] = useState(!getFeedbackConfig().audioEnabled);
  const [feedbackVolume, setFeedbackVolume] = useState(getFeedbackConfig().volume);
  const homePanelAnim = useRef(new Animated.Value(HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'))).current;
  const modeRailScrollRef = useRef<ScrollView | null>(null);
  const modeRailDragStartXRef = useRef<number | null>(null);
  const modeRailDragLastXRef = useRef(0);
  const modeRailDragCommittedRef = useRef(false);
  const modeRailFreezeXRef = useRef<number | null>(null);
  const modeRailHasMomentumRef = useRef(false);
  const modeRailPanelDragStartVirtualRef = useRef<number | null>(null);
  const modeRailVirtualIndexRef = useRef(MODE_RAIL_MIDDLE_CYCLE * HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'));
  const homePanelVirtualIndexRef = useRef(HOME_PANEL_ORDER.length + HOME_PANEL_ORDER.indexOf('Quick'));
  const homePanelDirectionRef = useRef<-1 | 0 | 1>(0);
  const kpiTileScaleByIdRef = useRef<Record<string, Animated.Value>>({});
  const kpiTileConfirmTimeoutByIdRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const kpiTileSuccessAnimByIdRef = useRef<Record<string, Animated.Value>>({});
  const kpiTileCircleRefById = useRef<Record<string, View | null>>({});
  const chartReactionAnim = useRef(new Animated.Value(0)).current;
  const chartImpactLineAnim = useRef(new Animated.Value(0)).current;
  const boostPulseAnim = useRef(new Animated.Value(0)).current;
  const modeLanePulseAnim = useRef(new Animated.Value(0)).current;
  const chartScrollXRef = useRef(0);
  const chartPinnedScrollXRef = useRef<number | null>(null);
  const preservePinnedChartScrollRef = useRef(false);
  const chartScrollableRef = useRef<View | null>(null);
  const flightRootBoxCacheRef = useRef<MeasuredBox | null>(null);
  const flightChartViewportBoxCacheRef = useRef<MeasuredBox | null>(null);
  const flightChartContentBoxCacheRef = useRef<MeasuredBox | null>(null);
  const flightMeasureCachePanelRef = useRef<HomePanel | null>(null);
  const [activeFlightFx, setActiveFlightFx] = useState<ActiveFlightFx[]>([]);
  const logQueueRef = useRef<QueuedLogTask[]>([]);
  const logQueueRunningRef = useRef(false);
  const homeTapHapticLastAtRef = useRef(0);
  const homeTapHapticBurstRef = useRef(0);
  const homeAutoFireStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeAutoFireIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const homeAutoFireKpiIdRef = useRef<string | null>(null);
  const projectedHudValueAnim = useRef(new Animated.Value(0)).current;
  const projectedHudInitializedRef = useRef(false);
  const projectedHudTargetRef = useRef(0);
  const projectedHudSpinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectedHudSpinFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectedHudSpinningRef = useRef(false);
  const projectedHudSpinTickRef = useRef(0);
  const projectedHudSpinStartedAtRef = useRef(0);
  const projectedHudValuePopAnim = useRef(new Animated.Value(0)).current;
  const projectedHudAccentFlashAnim = useRef(new Animated.Value(0)).current;
  const projectedHudSlotTranslateY = useRef(new Animated.Value(0)).current;
  const projectedHudSlotStepBusyRef = useRef(false);
  const projectedHudSlotCurrentTextRef = useRef('$0');
  const projectedHudSlotNextTextRef = useRef('$0');
  const [projectedHudDisplayValue, setProjectedHudDisplayValue] = useState(0);
  const [projectedHudSlotCurrentText, setProjectedHudSlotCurrentText] = useState('$0');
  const [projectedHudSlotNextText, setProjectedHudSlotNextText] = useState('$0');
  const chartImpactBurstValueAnim = useRef(new Animated.Value(0)).current;
  const chartImpactBurstOpacityAnim = useRef(new Animated.Value(0)).current;
  const chartImpactBurstScaleAnim = useRef(new Animated.Value(0.94)).current;
  const chartImpactBurstHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartImpactBurstTargetRef = useRef(0);
  const chartImpactBurstDisplayRef = useRef(0);
  const chartImpactBurstVisibleRef = useRef(false);
  const [chartImpactBurstDisplay, setChartImpactBurstDisplay] = useState(0);
  const [chartImpactLineX, setChartImpactLineX] = useState<number | null>(null);
  const [chartImpactLineValue, setChartImpactLineValue] = useState(0);
  const chartImpactMonthPulseAnim = useRef(new Animated.Value(0)).current;
  const [chartImpactMonthIndex, setChartImpactMonthIndex] = useState<number | null>(null);
  const [pipelineCheckinVisible, setPipelineCheckinVisible] = useState(false);
  const [pipelineCheckinListings, setPipelineCheckinListings] = useState(0);
  const [pipelineCheckinBuyers, setPipelineCheckinBuyers] = useState(0);
  const [pipelineCheckinSubmitting, setPipelineCheckinSubmitting] = useState(false);
  const [pipelineCheckinReasonPromptVisible, setPipelineCheckinReasonPromptVisible] = useState(false);
  const [pipelineCheckinDecreaseFields, setPipelineCheckinDecreaseFields] = useState<PipelineCheckinFieldKey[]>([]);
  const [pipelineCheckinReason, setPipelineCheckinReason] = useState<PipelineCheckinReason | null>(null);
  const [pipelineCloseDateInput, setPipelineCloseDateInput] = useState('');
  const [pipelineCloseGciInput, setPipelineCloseGciInput] = useState('');
  const [pipelineLostEncouragement, setPipelineLostEncouragement] = useState('');
  const [pipelineCheckinDismissedDay, setPipelineCheckinDismissedDay] = useState<string | null>(null);
  const [pipelineCheckinDismissalLoaded, setPipelineCheckinDismissalLoaded] = useState(false);
  const bottomNavPadBottom = 0;
  const bottomNavPadTop = 0;
  const contentBottomPad = 118 + Math.max(10, insets.bottom);
  const bottomTabTheme = isDarkMode
    ? {
        activeFg: '#CFE0FF',
        inactiveFg: '#7FA4E6',
        activeBg: 'rgba(78, 116, 191, 0.28)',
      }
    : {
        activeFg: '#2E5FBF',
        inactiveFg: '#6F95DB',
        activeBg: 'rgba(226, 236, 255, 0.98)',
      };

  const gpUnlocked = (payload?.activity.active_days ?? 0) >= 3 || (payload?.activity.total_logs ?? 0) >= 20;
  const vpUnlocked = (payload?.activity.active_days ?? 0) >= 7 || (payload?.activity.total_logs ?? 0) >= 40;

  const saveKpiPreferences = useCallback(
    async (nextSelectedIds: string[], nextFavoriteIds: string[]) => {
      const token = session?.access_token;
      if (!token) return;
      try {
        await fetch(`${API_URL}/me`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            selected_kpis: nextSelectedIds,
            favorite_kpis: nextFavoriteIds,
          }),
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
      const [dashRes, meRes, challengesRes] = await Promise.all([
        fetch(`${API_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/challenges`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      const dashBody = await dashRes.json();
      const meBody = (await meRes.json()) as MePayload;

      if (!dashRes.ok) throw new Error(dashBody.error ?? 'Failed to load dashboard');

      const dashPayload = dashBody as DashboardPayload;
      setPayload(dashPayload);
      if (challengesRes) {
        try {
          const challengesBody = (await challengesRes.json()) as ChallengeListApiResponse & { error?: string };
          if (challengesRes.ok) {
            const rows = Array.isArray(challengesBody?.challenges) ? challengesBody.challenges : [];
            setChallengeApiRows(rows);
            setChallengeApiFetchError(null);
          } else {
            setChallengeApiRows(null);
            setChallengeApiFetchError(challengesBody?.error ?? 'Failed to load challenges');
          }
        } catch {
          setChallengeApiRows(null);
          setChallengeApiFetchError('Failed to parse challenges response');
        }
      } else {
        setChallengeApiRows(null);
        setChallengeApiFetchError('Challenge list request failed');
      }

      if (managedKpiIds.length === 0) {
        const fromProfile = Array.isArray(meBody?.user_metadata?.selected_kpis)
          ? meBody.user_metadata.selected_kpis.filter((id): id is string => typeof id === 'string')
          : [];
        const favoriteFromProfile = Array.isArray(meBody?.user_metadata?.favorite_kpis)
          ? meBody.user_metadata.favorite_kpis.filter((id): id is string => typeof id === 'string')
          : [];
        const validIds = new Set(dashPayload.loggable_kpis.map((kpi) => kpi.id));
        const sortedSelectable = sortSelectableKpis(
          dashPayload.loggable_kpis.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP')
        );
        const profileValid = fromProfile.filter((id) => validIds.has(id));
        if (profileValid.length > 0) {
          const normalizedSelected = normalizeManagedKpiIds(profileValid, sortedSelectable);
          setManagedKpiIds(normalizedSelected);
          setFavoriteKpiIds(
            favoriteFromProfile.filter((id) => normalizedSelected.includes(id)).slice(0, 6)
          );
        } else {
          const defaults = normalizeManagedKpiIds(sortedSelectable.map((kpi) => kpi.id), sortedSelectable);
          setManagedKpiIds(defaults);
          setFavoriteKpiIds(defaults.slice(0, 6));
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
      setChallengeApiRows(null);
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [managedKpiIds.length, session?.access_token]);

  React.useEffect(() => {
    if (state === 'loading') void fetchDashboard();
  }, [fetchDashboard, state]);

  React.useEffect(() => {
    setChallengeJoinError(null);
  }, [challengeFlowScreen, challengeSelectedId]);

  React.useEffect(() => {
    registerFeedbackCueSource('swipe', feedbackAudioAssets.swipe);
    registerFeedbackCueSource('logTap', feedbackAudioAssets.logTap);
    registerFeedbackCueSource('growthTap', feedbackAudioAssets.growthTap);
    registerFeedbackCueSource('vitalityTap', feedbackAudioAssets.vitalityTap);
    registerFeedbackCueSource('logSuccess', feedbackAudioAssets.logSuccess);
    registerFeedbackCueSource('locked', feedbackAudioAssets.locked);
    registerFeedbackCueSource('logError', feedbackAudioAssets.logError);
    void primeFeedbackAudioAsync();
    void preloadFeedbackCuesAsync();
    return () => {
      registerFeedbackCueSource('swipe', null);
      registerFeedbackCueSource('logTap', null);
      registerFeedbackCueSource('growthTap', null);
      registerFeedbackCueSource('vitalityTap', null);
      registerFeedbackCueSource('logSuccess', null);
      registerFeedbackCueSource('locked', null);
      registerFeedbackCueSource('logError', null);
    };
  }, []);

  React.useEffect(() => {
    const boostLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(boostPulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(boostPulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    const laneLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(modeLanePulseAnim, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(modeLanePulseAnim, { toValue: 0, duration: 720, useNativeDriver: true }),
      ])
    );
    boostLoop.start();
    laneLoop.start();
    return () => {
      boostLoop.stop();
      laneLoop.stop();
    };
  }, [boostPulseAnim, modeLanePulseAnim]);

  React.useEffect(() => {
    const sub = chartImpactLineAnim.addListener(({ value }) => {
      setChartImpactLineValue(value);
    });
    return () => {
      chartImpactLineAnim.removeListener(sub);
    };
  }, [chartImpactLineAnim]);

  React.useEffect(() => {
    const sub = projectedHudValueAnim.addListener(({ value }) => {
      setProjectedHudDisplayValue(Math.max(0, Math.round(value)));
    });
    return () => {
      projectedHudValueAnim.removeListener(sub);
    };
  }, [projectedHudValueAnim]);

  const animateProjectedHudValuePop = useCallback(() => {
    projectedHudValuePopAnim.stopAnimation();
    projectedHudAccentFlashAnim.stopAnimation();
    projectedHudValuePopAnim.setValue(0);
    projectedHudAccentFlashAnim.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(projectedHudValuePopAnim, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(projectedHudValuePopAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(projectedHudAccentFlashAnim, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(projectedHudAccentFlashAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [projectedHudAccentFlashAnim, projectedHudValuePopAnim]);

  React.useEffect(() => {
    const sub = chartImpactBurstValueAnim.addListener(({ value }) => {
      const rounded = Math.max(0, Math.round(value));
      chartImpactBurstDisplayRef.current = rounded;
      setChartImpactBurstDisplay(rounded);
    });
    return () => {
      chartImpactBurstValueAnim.removeListener(sub);
    };
  }, [chartImpactBurstValueAnim]);

  React.useEffect(
    () => () => {
      Object.values(kpiTileConfirmTimeoutByIdRef.current).forEach(clearTimeout);
      if (chartImpactBurstHideTimeoutRef.current) clearTimeout(chartImpactBurstHideTimeoutRef.current);
      if (projectedHudSpinIntervalRef.current) clearInterval(projectedHudSpinIntervalRef.current);
      if (projectedHudSpinFallbackTimeoutRef.current) clearTimeout(projectedHudSpinFallbackTimeoutRef.current);
    },
    []
  );

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

  React.useEffect(() => {
    if (viewMode === 'home') return;
    preservePinnedChartScrollRef.current = false;
    chartPinnedScrollXRef.current = null;
  }, [viewMode]);

  React.useEffect(() => {
    // Panel switches should reopen the shared chart at the canonical "today" anchor,
    // not preserve a prior animation pin from another panel.
    preservePinnedChartScrollRef.current = false;
    chartPinnedScrollXRef.current = null;
  }, [homePanel]);

  React.useEffect(() => {
    const chartVisibleOnPanel = homePanel === 'Quick' || homePanel === 'PC';
    if (chartVisibleOnPanel) return;
    // GP/VP visual panels do not mount the live chart target refs; clear flight caches so
    // optimistic PC projectile FX cannot reuse stale chart boxes/scroll offsets from a prior panel.
    flightChartViewportBoxCacheRef.current = null;
    flightChartContentBoxCacheRef.current = null;
    flightMeasureCachePanelRef.current = null;
  }, [homePanel]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const joinChallenge = useCallback(
    async (challengeId: string) => {
      const token = session?.access_token;
      if (!token) {
        setChallengeJoinError('Missing session token.');
        return;
      }
      setChallengeJoinSubmittingId(challengeId);
      setChallengeJoinError(null);
      setChallengeLeaveError(null);
      try {
        const response = await fetch(`${API_URL}/challenge-participants`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ challenge_id: challengeId }),
        });
        const body = (await response.json()) as ChallengeJoinApiResponse;
        if (!response.ok) {
          throw new Error(body?.error ?? 'Failed to join challenge');
        }
        await fetchDashboard();
      } catch (e: unknown) {
        setChallengeJoinError(e instanceof Error ? e.message : 'Failed to join challenge');
      } finally {
        setChallengeJoinSubmittingId((prev) => (prev === challengeId ? null : prev));
      }
    },
    [fetchDashboard, session?.access_token]
  );

  const leaveChallenge = useCallback(
    async (challengeId: string) => {
      const token = session?.access_token;
      if (!token) {
        setChallengeLeaveError('Missing session token.');
        return;
      }
      setChallengeLeaveSubmittingId(challengeId);
      setChallengeLeaveError(null);
      setChallengeJoinError(null);
      try {
        const response = await fetch(`${API_URL}/challenge-participants/${encodeURIComponent(challengeId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = (await response.json()) as ChallengeLeaveApiResponse;
        if (!response.ok) {
          throw new Error(body?.error ?? 'Failed to leave challenge');
        }
        await fetchDashboard();
      } catch (e: unknown) {
        setChallengeLeaveError(e instanceof Error ? e.message : 'Failed to leave challenge');
      } finally {
        setChallengeLeaveSubmittingId((prev) => (prev === challengeId ? null : prev));
      }
    },
    [fetchDashboard, session?.access_token]
  );

  const getKpiTileScale = useCallback((kpiId: string) => {
    if (!kpiTileScaleByIdRef.current[kpiId]) {
      kpiTileScaleByIdRef.current[kpiId] = new Animated.Value(1);
    }
    return kpiTileScaleByIdRef.current[kpiId];
  }, []);

  const animateKpiTilePress = useCallback(
    (kpiId: string, pressed: boolean) => {
      Animated.spring(getKpiTileScale(kpiId), {
        toValue: pressed ? 0.95 : 1,
        friction: 7,
        tension: 220,
        useNativeDriver: true,
      }).start();
    },
    [getKpiTileScale]
  );

  const flashKpiTileConfirm = useCallback((kpiId: string) => {
    setConfirmedKpiTileIds((prev) => ({ ...prev, [kpiId]: true }));
    const existing = kpiTileConfirmTimeoutByIdRef.current[kpiId];
    if (existing) clearTimeout(existing);
    kpiTileConfirmTimeoutByIdRef.current[kpiId] = setTimeout(() => {
      setConfirmedKpiTileIds((prev) => {
        const next = { ...prev };
        delete next[kpiId];
        return next;
      });
      delete kpiTileConfirmTimeoutByIdRef.current[kpiId];
    }, 220);
  }, []);

  const getKpiTileSuccessAnim = useCallback((kpiId: string) => {
    if (!kpiTileSuccessAnimByIdRef.current[kpiId]) {
      kpiTileSuccessAnimByIdRef.current[kpiId] = new Animated.Value(0);
    }
    return kpiTileSuccessAnimByIdRef.current[kpiId];
  }, []);

  const animateKpiTileSuccess = useCallback(
    (kpiId: string) => {
      const anim = getKpiTileSuccessAnim(kpiId);
      anim.stopAnimation();
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [getKpiTileSuccessAnim]
  );

  const animateChartReaction = useCallback(() => {
    chartReactionAnim.stopAnimation();
    chartReactionAnim.setValue(0);
    Animated.sequence([
      Animated.timing(chartReactionAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(chartReactionAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [chartReactionAnim]);

  const animateChartImpactLine = useCallback((x: number) => {
    setChartImpactLineX(x);
    chartImpactLineAnim.stopAnimation();
    chartImpactLineAnim.setValue(0);
    setChartImpactLineValue(0);
    return new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(chartImpactLineAnim, {
          toValue: 0.92,
          duration: 6,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(chartImpactLineAnim, {
          toValue: 0.58,
          duration: 48,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(chartImpactLineAnim, {
          toValue: 0,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => {
        setChartImpactLineX((prev) => (prev === x ? null : prev));
        setChartImpactLineValue(0);
        resolve();
      });
    });
  }, [chartImpactLineAnim]);

  const animateChartImpactMonthPulse = useCallback((monthIndex: number) => {
    setChartImpactMonthIndex(monthIndex);
    chartImpactMonthPulseAnim.stopAnimation();
    chartImpactMonthPulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(chartImpactMonthPulseAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(220),
      Animated.timing(chartImpactMonthPulseAnim, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setChartImpactMonthIndex((prev) => (prev === monthIndex ? null : prev));
    });
  }, [chartImpactMonthPulseAnim]);

  const measureInWindowAsync = useCallback(
    (node: { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null) =>
      new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
        if (!node?.measureInWindow) {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          resolve({ x, y, width, height });
        });
      }),
    []
  );

  const refreshFlightMeasureCache = useCallback(async () => {
    const rootNode = screenRootRef.current;
    const chartViewportNode = chartScrollRef.current;
    const chartContentNode = chartScrollableRef.current;
    const [rootBox, chartViewportBox, chartContentBox] = await Promise.all([
      measureInWindowAsync(rootNode),
      measureInWindowAsync(chartViewportNode as unknown as View | null),
      measureInWindowAsync(chartContentNode),
    ]);
    if (rootBox) flightRootBoxCacheRef.current = rootBox;
    if (chartViewportBox) flightChartViewportBoxCacheRef.current = chartViewportBox;
    if (chartContentBox) flightChartContentBoxCacheRef.current = chartContentBox;
    flightMeasureCachePanelRef.current = homePanel;
  }, [homePanel, measureInWindowAsync]);

  React.useEffect(() => {
    if (viewMode !== 'home' || chartViewportWidth <= 0) return;
    const raf = requestAnimationFrame(() => {
      void refreshFlightMeasureCache();
    });
    const t = setTimeout(() => {
      void refreshFlightMeasureCache();
    }, 120);
    const t2 = setTimeout(() => {
      void refreshFlightMeasureCache();
    }, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [chartViewportWidth, homePanel, refreshFlightMeasureCache, viewMode]);

  const getProjectionImpactPointForDate = useCallback((payoffStartIso: string) => {
    const series = chartFromPayload(payload);
    const rows = payload?.chart?.future_projected_12m ?? [];
    if (!rows.length) return null;
    const targetDate = new Date(payoffStartIso);
    if (Number.isNaN(targetDate.getTime())) return null;

    const splitX = series.step * (series.splitBaseIndex + series.splitOffsetFraction);
    const currentValue = series.pastActual[series.splitBaseIndex] ?? 0;
    const currentY = yForValue(currentValue, 170, series.min, series.max);
    const nowMs = Date.now();
    const targetMs = targetDate.getTime();

    const monthXs = series.futureProjected.map(
      (_, idx) => series.step * (series.firstFutureIndex + idx)
    );
    const monthDates = rows.map((row) => new Date(String(row.month_start ?? '')).getTime());

    if (targetMs <= monthDates[0]) {
      const denom = Math.max(1, monthDates[0] - nowMs);
      const t = Math.max(0, Math.min(1, (targetMs - nowMs) / denom));
      const endX = monthXs[0] ?? splitX;
      const endY = yForValue(series.futureProjected[0] ?? currentValue, 170, series.min, series.max);
      return {
        x: splitX + (endX - splitX) * t,
        y: currentY + (endY - currentY) * t,
        chartWidth: series.chartWidth,
      };
    }

    for (let i = 0; i < monthDates.length - 1; i += 1) {
      const a = monthDates[i];
      const b = monthDates[i + 1];
      if (!(targetMs >= a && targetMs < b)) continue;
      const t = Math.max(0, Math.min(1, (targetMs - a) / Math.max(1, b - a)));
      const x1 = monthXs[i] ?? splitX;
      const x2 = monthXs[i + 1] ?? x1;
      const y1 = yForValue(series.futureProjected[i] ?? currentValue, 170, series.min, series.max);
      const y2 = yForValue(series.futureProjected[i + 1] ?? series.futureProjected[i] ?? currentValue, 170, series.min, series.max);
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, chartWidth: series.chartWidth };
    }

    const lastIdx = Math.max(0, monthXs.length - 1);
    return {
      x: monthXs[lastIdx] ?? splitX,
      y: yForValue(series.futureProjected[lastIdx] ?? currentValue, 170, series.min, series.max),
      chartWidth: series.chartWidth,
    };
  }, [payload]);

  const launchProjectionFlightFx = useCallback(async (
    kpiId: string,
    payoffStartIso: string,
    options?: { centerOnImpact?: boolean; sourcePagePoint?: { x: number; y: number } | null }
  ) => {
    if (viewMode !== 'home') return;
    const chartVisibleOnPanel = homePanel === 'Quick' || homePanel === 'PC';
    if (!chartVisibleOnPanel) return;
    const rawImpact = getProjectionImpactPointForDate(payoffStartIso);
    if (!rawImpact) return;
    let impact = rawImpact;
    const shouldCenterOnImpact = options?.centerOnImpact !== false;
    let didRecenterChart = false;
    if (!shouldCenterOnImpact && chartViewportWidth > 0) {
      const visibleMinX = chartScrollXRef.current + 6;
      const visibleMaxX = chartScrollXRef.current + Math.max(12, chartViewportWidth - 10);
      const clampedImpactX = Math.max(visibleMinX, Math.min(visibleMaxX, impact.x));
      if (clampedImpactX !== impact.x) {
        impact = { ...impact, x: clampedImpactX };
      }
    }
    if (shouldCenterOnImpact && chartScrollRef.current && chartViewportWidth > 0) {
      const maxScroll = Math.max(0, impact.chartWidth - chartViewportWidth);
      const targetScrollX = Math.min(maxScroll, Math.max(0, impact.x - chartViewportWidth / 2));
      chartPinnedScrollXRef.current = targetScrollX;
      preservePinnedChartScrollRef.current = true;
      chartScrollRef.current.scrollTo({ x: targetScrollX, animated: false });
      chartScrollXRef.current = targetScrollX;
      didRecenterChart = true;
    }
    const sourceNode = options?.sourcePagePoint ? null : kpiTileCircleRefById.current[kpiId];
    const chartViewportNode = chartScrollRef.current;
    const chartContentNode = chartScrollableRef.current;
    const rootNode = screenRootRef.current;
    const canUseCachedBoxes =
      !didRecenterChart &&
      options?.sourcePagePoint != null &&
      flightMeasureCachePanelRef.current === homePanel &&
      flightRootBoxCacheRef.current != null &&
      (flightChartContentBoxCacheRef.current != null || flightChartViewportBoxCacheRef.current != null);
    let sourceBox: MeasuredBox | null = null;
    let chartViewportBox = canUseCachedBoxes ? flightChartViewportBoxCacheRef.current : null;
    let chartContentBox = canUseCachedBoxes ? flightChartContentBoxCacheRef.current : null;
    let rootBox = canUseCachedBoxes ? flightRootBoxCacheRef.current : null;
    if (!canUseCachedBoxes) {
      [sourceBox, chartViewportBox, chartContentBox] = await Promise.all([
        measureInWindowAsync(sourceNode),
        measureInWindowAsync(chartViewportNode as unknown as View | null),
        measureInWindowAsync(chartContentNode),
      ]);
      rootBox = await measureInWindowAsync(rootNode);
      if (rootBox) flightRootBoxCacheRef.current = rootBox;
      if (chartViewportBox) flightChartViewportBoxCacheRef.current = chartViewportBox;
      if (chartContentBox) flightChartContentBoxCacheRef.current = chartContentBox;
    }
    if (!rootBox || (!chartViewportBox && !chartContentBox)) return;

    const projectileHalf = 14;
    const startX = options?.sourcePagePoint
      ? options.sourcePagePoint.x - rootBox.x - projectileHalf
      : (sourceBox ? sourceBox.x - rootBox.x + sourceBox.width / 2 - projectileHalf : null);
    const startY = options?.sourcePagePoint
      ? options.sourcePagePoint.y - rootBox.y - projectileHalf
      : (sourceBox ? sourceBox.y - rootBox.y + sourceBox.height / 2 - projectileHalf : null);
    if (startX == null || startY == null) return;
    const viewportBoxForTarget = options?.sourcePagePoint != null ? chartViewportBox : null;
    const useViewportTargetMath = viewportBoxForTarget != null;
    const rawEndX =
      useViewportTargetMath
        ? viewportBoxForTarget.x - rootBox.x + impact.x - chartScrollXRef.current - projectileHalf
        : chartContentBox != null
          ? chartContentBox.x - rootBox.x + impact.x - projectileHalf
          : (chartViewportBox?.x ?? rootBox.x) - rootBox.x + impact.x - chartScrollXRef.current - projectileHalf;
    const rawEndY =
      (chartContentBox?.y ?? chartViewportBox?.y ?? rootBox.y) - rootBox.y + 12 + impact.y - projectileHalf;
    const endX = Math.max(-8, Math.min(rootBox.width + 8, rawEndX));
    const endY = Math.max(-8, Math.min(rootBox.height + 8, rawEndY));
    const flightAnim = new Animated.Value(0);
    const flightKey = Date.now() + Math.floor(Math.random() * 1000);
    setActiveFlightFx((prev) => {
      const next: ActiveFlightFx[] = [
        ...prev,
        {
          key: flightKey,
          startX,
          startY,
          deltaX: endX - startX,
          deltaY: endY - startY,
          arcLift: Math.max(42, Math.min(86, Math.abs(endX - startX) * 0.14)),
          anim: flightAnim,
        },
      ];
      return next.length > 10 ? next.slice(next.length - 10) : next;
    });
    const thisFlight = {
      key: flightKey,
      startX,
      startY,
      deltaX: endX - startX,
      deltaY: endY - startY,
      arcLift: Math.max(42, Math.min(86, Math.abs(endX - startX) * 0.14)),
      anim: flightAnim,
    } satisfies ActiveFlightFx;
    flightAnim.setValue(0);
    const FLIGHT_DURATION_MS = 340;
    const IMPACT_PROGRESS_TRIGGER = 0;
    const impactSeries = chartFromPayload(payload);
    const impactMonthIndex = Math.max(0, Math.min(impactSeries.labels.length - 1, Math.round(impact.x / impactSeries.step)));
    let impactStarted = false;
    let impactPromise: Promise<void> | null = null;
    const maybeStartImpact = () => {
      if (impactStarted) return;
      impactStarted = true;
      animateChartImpactMonthPulse(impactMonthIndex);
      impactPromise = animateChartImpactLine(impact.x);
    };
    const flightSub = flightAnim.addListener(({ value }) => {
      if (value >= IMPACT_PROGRESS_TRIGGER) {
        maybeStartImpact();
      }
    });

    await new Promise<void>((resolve) => {
      maybeStartImpact();
      Animated.timing(flightAnim, {
        toValue: 1,
        duration: FLIGHT_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setActiveFlightFx((prev) => prev.filter((fx) => fx.key !== thisFlight.key));
        resolve();
      });
    });
    flightAnim.removeListener(flightSub);
    if (!impactStarted) maybeStartImpact();
    if (impactPromise) {
      await impactPromise;
    }
  }, [animateChartImpactLine, animateChartImpactMonthPulse, chartViewportWidth, getProjectionImpactPointForDate, homePanel, measureInWindowAsync, payload, viewMode]);

  const toggleFeedbackMuted = useCallback(() => {
    setFeedbackMuted((prev) => {
      const next = !prev;
      setFeedbackConfig({ audioEnabled: !next });
      return next;
    });
  }, []);

  const cycleFeedbackVolume = useCallback(() => {
    const levels = [0.35, 0.6, 0.85] as const;
    const idx = levels.findIndex((level) => Math.abs(level - feedbackVolume) < 0.02);
    const next = levels[(idx + 1 + levels.length) % levels.length];
    setFeedbackVolume(next);
    setFeedbackConfig({ volume: next });
  }, [feedbackVolume]);

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
    () => {
      return rankHomePriorityKpisV1({
        managedKpis,
        favoriteKpiIds,
        managedKpiIdSet,
        payload: payload ?? null,
        gpUnlocked,
        vpUnlocked,
      }).slice(0, 6);
    },
    [favoriteKpiIds, gpUnlocked, managedKpiIdSet, managedKpis, payload, vpUnlocked]
  );

  const homePanelTiles = useMemo(() => {
    const panelKpis =
      homePanel === 'Quick' ? homeQuickLog : managedKpis.filter((kpi) => kpi.type === homePanel).slice(0, 6);
    return buildHomePanelTiles(panelKpis, payload ?? null);
  }, [homePanel, homeQuickLog, managedKpis, payload]);
  const pipelineAnchorNag = useMemo(() => derivePipelineAnchorNagState(payload ?? null), [payload]);
  const pipelineCheckinAnchors = useMemo(() => findPipelineCheckinAnchors(payload ?? null), [payload]);
  const pipelineAnchorCounts = useMemo(() => readPipelineAnchorCountsFromPayload(payload ?? null), [payload]);
  const actualGciLogKpi = useMemo(() => findActualGciLogKpi(payload ?? null), [payload]);
  const todayLocalIso = useMemo(() => isoTodayLocal(), []);
  const pipelineCheckinDismissStorageKey = useMemo(() => {
    const userId = String(session?.user?.id ?? '').trim();
    return userId ? `${PIPELINE_CHECKIN_DISMISS_KEY_PREFIX}:${userId}` : null;
  }, [session?.user?.id]);
  const challengeSurfaceKpis = useMemo(
    () => deriveChallengeSurfaceKpis({ managedKpis, favoriteKpiIds, payload: payload ?? null }),
    [favoriteKpiIds, managedKpis, payload]
  );
  const challengeKpiGroups = useMemo(() => groupChallengeKpisByType(challengeSurfaceKpis), [challengeSurfaceKpis]);
  const challengeTileCount =
    challengeKpiGroups.PC.length + challengeKpiGroups.GP.length + challengeKpiGroups.VP.length;
  const teamSurfaceKpis = useMemo(
    () => deriveTeamSurfaceKpis({ managedKpis, favoriteKpiIds, payload: payload ?? null }),
    [favoriteKpiIds, managedKpis, payload]
  );
  const teamKpiGroups = useMemo(() => groupTeamKpisByType(teamSurfaceKpis), [teamSurfaceKpis]);
  const teamTileCount = teamKpiGroups.PC.length + teamKpiGroups.GP.length + teamKpiGroups.VP.length;
  useEffect(() => {
    const availableIds = new Set(teamSurfaceKpis.map((kpi) => String(kpi.id)));
    setTeamFocusSelectedKpiIds((prev) => {
      const stillValid = prev.filter((id) => availableIds.has(id));
      if (stillValid.length > 0) return stillValid;
      return teamSurfaceKpis.slice(0, 4).map((kpi) => String(kpi.id));
    });
  }, [teamSurfaceKpis]);

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
    const projectedNext30Raw = sumProjectedDays(30);
    const projectedNext60Raw = sumProjectedDays(60);
    const projectedNext90Raw = sumProjectedDays(90);
    const projectedNext180Raw = sumProjectedDays(180);
    const projectedNext360Raw = sumProjectedDays(360);
    const projectedYtdRaw =
      Number(payload?.projection.projected_gci_ytd ?? 0) ||
      (actualYtdRaw + projectedThisYearFromChart);
    const progressPctRaw =
      projectedNext365Raw > 0 ? Math.max(0, Math.min(999, (actualYtdRaw / projectedNext365Raw) * 100)) : 0;

    return {
      actualLast365: Number.isFinite(actualLast365Raw) ? actualLast365Raw : 0,
      actualYtd: Number.isFinite(actualYtdRaw) ? actualYtdRaw : 0,
      projectedNext30: Number.isFinite(projectedNext30Raw) ? projectedNext30Raw : 0,
      projectedNext365: Number.isFinite(projectedNext365Raw) ? projectedNext365Raw : 0,
      projectedNext60: Number.isFinite(projectedNext60Raw) ? projectedNext60Raw : 0,
      projectedNext90: Number.isFinite(projectedNext90Raw) ? projectedNext90Raw : 0,
      projectedNext180: Number.isFinite(projectedNext180Raw) ? projectedNext180Raw : 0,
      projectedNext360: Number.isFinite(projectedNext360Raw) ? projectedNext360Raw : 0,
      projectedYtd: Number.isFinite(projectedYtdRaw) ? projectedYtdRaw : 0,
      progressPct: Number.isFinite(progressPctRaw) ? progressPctRaw : 0,
    };
  }, [payload]);

  React.useEffect(() => {
    const projectedCardValueByWindow: Record<(typeof PROJECTED_CARD_WINDOWS)[number], number> = {
      30: cardMetrics.projectedNext30,
      60: cardMetrics.projectedNext60,
      90: cardMetrics.projectedNext90,
      180: cardMetrics.projectedNext180,
      360: cardMetrics.projectedNext360,
    };
    const target = Math.max(0, Math.round(projectedCardValueByWindow[projectedCardWindowDays] ?? 0));

    if (!projectedHudInitializedRef.current) {
      projectedHudInitializedRef.current = true;
      projectedHudTargetRef.current = target;
      projectedHudValueAnim.setValue(target);
      setProjectedHudDisplayValue(target);
      return;
    }

    const start = projectedHudTargetRef.current;
    if (target === start) return;
    projectedHudTargetRef.current = target;
    animateProjectedHudValuePop();
    if (projectedHudSpinningRef.current) {
      // Keep spinning during rapid-fire / network refresh; just update the target to settle to later.
      return;
    }

    projectedHudValueAnim.stopAnimation();

    const span = Math.max(500, Math.abs(target - start));
    const dir = target >= start ? 1 : -1;
    const spin1 = Math.max(0, start + dir * Math.round(span * 0.8));
    const spin2 = Math.max(0, start + dir * Math.round(span * 1.55));
    const spin3 = Math.max(0, target + dir * Math.round(Math.max(700, span * 0.4)));

    projectedHudValueAnim.setValue(start);
    Animated.sequence([
      Animated.timing(projectedHudValueAnim, {
        toValue: spin1,
        duration: 65,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(projectedHudValueAnim, {
        toValue: spin2,
        duration: 65,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(projectedHudValueAnim, {
        toValue: spin3,
        duration: 85,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(projectedHudValueAnim, {
        toValue: target,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    cardMetrics.projectedNext30,
    cardMetrics.projectedNext60,
    cardMetrics.projectedNext90,
    cardMetrics.projectedNext180,
    cardMetrics.projectedNext360,
    projectedCardWindowDays,
    animateProjectedHudValuePop,
    projectedHudValueAnim,
  ]);

  React.useEffect(() => {
    if (!chartViewportWidth || !chartScrollRef.current || viewMode !== 'home') return;
    const maxX = Math.max(0, chartSeries.dataWidth - chartViewportWidth + 24);
    if (preservePinnedChartScrollRef.current && chartPinnedScrollXRef.current != null) {
      const pinned = Math.min(maxX, Math.max(0, chartPinnedScrollXRef.current));
      chartPinnedScrollXRef.current = pinned;
      const runPinned = () => {
        chartScrollXRef.current = pinned;
        chartScrollRef.current?.scrollTo({ x: pinned, animated: false });
      };
      runPinned();
      const tPinned = setTimeout(runPinned, 80);
      const tPinned2 = setTimeout(runPinned, 180);
      return () => {
        clearTimeout(tPinned);
        clearTimeout(tPinned2);
      };
    }
    const currentX = chartSplitX;
    const leftPeekInset = 14;
    const targetX = Math.max(0, currentX - leftPeekInset);
    const clampedX = Math.min(maxX, targetX);
    const run = () => chartScrollRef.current?.scrollTo({ x: clampedX, animated: false });
    run();
    const t = setTimeout(run, 80);
    return () => clearTimeout(t);
  }, [chartSeries.dataWidth, chartViewportWidth, viewMode, payload?.chart, chartSplitX, homePanel]);
  React.useEffect(() => {
    const today = isoTodayLocal();
    setSelectedLogDateIso((prev) => {
      if (!prev) return today;
      return prev;
    });
  }, []);

  const selectedLogDate = selectedLogDateIso ?? isoTodayLocal();
  const canGoBackwardDate = true;
  const canGoForwardDate = selectedLogDate < isoTodayLocal();

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
      duration: 180,
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

  const sendLog = async (
    kpiId: string,
    direct?: number,
    options?: SendLogOptions
  ) => {
    const token = session?.access_token;
    if (!token) {
      Alert.alert('Not authenticated', 'Please sign in again.');
      return false;
    }

    setSubmitting(true);
    setSubmittingKpiId(kpiId);
    try {
      const response = await fetch(`${API_URL}/kpi-logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kpi_id: kpiId,
          event_timestamp: options?.eventTimestampIso ?? eventTimestampIsoForSelectedDay(selectedLogDate),
          logged_value: direct,
          idempotency_key: `${kpiId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to log KPI');
      // M3b tuning: keep only the immediate onPressIn tap SFX for now; success remains visual/haptic.
      if (!options?.skipSuccessBadge) {
        animateKpiTileSuccess(kpiId);
      }
      animateChartReaction();
      const payoffStartDate = String((body as { log?: { payoff_start_date?: unknown } })?.log?.payoff_start_date ?? '');
      if (!options?.skipProjectionFlight && (options?.kpiType ?? 'PC') === 'PC' && payoffStartDate) {
        await launchProjectionFlightFx(kpiId, payoffStartDate);
      }
      await fetchDashboard();
      if ((options?.kpiType ?? 'PC') === 'PC') {
        const elapsed = Date.now() - projectedHudSpinStartedAtRef.current;
        const minSpinMs = 3000;
        const settleDelay = Math.max(40, minSpinMs - elapsed);
        setTimeout(() => {
          stopProjectedHudSlotSpin({ settleToCurrentTarget: true });
        }, settleDelay);
      }
      void refreshConfidenceSnapshot();
      return true;
    } catch (e: unknown) {
      void triggerHapticAsync('error');
      void playFeedbackCueAsync('logError');
      Alert.alert('Log failed', e instanceof Error ? e.message : 'Failed to log KPI');
      return false;
    } finally {
      setSubmitting(false);
      setSubmittingKpiId(null);
    }
  };

  const processQueuedLogs = useCallback(async () => {
    if (logQueueRunningRef.current) return;
    logQueueRunningRef.current = true;
    try {
      while (logQueueRef.current.length > 0) {
        const nextTask = logQueueRef.current.shift();
        if (!nextTask) continue;
        await sendLog(nextTask.kpiId, nextTask.direct, nextTask.options);
      }
    } finally {
      logQueueRunningRef.current = false;
      if (logQueueRef.current.length > 0) {
        void processQueuedLogs();
      }
    }
  }, [sendLog]);

  const enqueueLogTask = useCallback(
    (task: QueuedLogTask) => {
      logQueueRef.current.push(task);
      void processQueuedLogs();
    },
    [processQueuedLogs]
  );

  const triggerHomeRapidTapHaptic = useCallback(() => {
    const now = Date.now();
    const delta = now - homeTapHapticLastAtRef.current;
    if (delta > 220) {
      homeTapHapticBurstRef.current = 0;
    } else {
      homeTapHapticBurstRef.current += 1;
    }
    homeTapHapticLastAtRef.current = now;

    if (homeTapHapticBurstRef.current >= 3 && delta < 90) return;
    if (homeTapHapticBurstRef.current >= 6 && delta < 130 && homeTapHapticBurstRef.current % 2 === 0) return;
    void triggerHapticAsync('tap');
  }, []);

  function stopProjectedHudSlotSpin(options?: { settleToCurrentTarget?: boolean }) {
    if (projectedHudSpinIntervalRef.current) {
      clearInterval(projectedHudSpinIntervalRef.current);
      projectedHudSpinIntervalRef.current = null;
    }
    if (projectedHudSpinFallbackTimeoutRef.current) {
      clearTimeout(projectedHudSpinFallbackTimeoutRef.current);
      projectedHudSpinFallbackTimeoutRef.current = null;
    }
    const wasSpinning = projectedHudSpinningRef.current;
    projectedHudSpinningRef.current = false;
    projectedHudSlotStepBusyRef.current = false;
    if (!wasSpinning || !options?.settleToCurrentTarget) return;
    projectedHudValueAnim.stopAnimation((currentValue) => {
      projectedHudValueAnim.setValue(Number(currentValue) || projectedHudDisplayValue);
      Animated.timing(projectedHudValueAnim, {
        toValue: projectedHudTargetRef.current,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    const targetText = fmtUsd(projectedHudTargetRef.current);
    projectedHudSlotTranslateY.stopAnimation();
    projectedHudSlotTranslateY.setValue(0);
    projectedHudSlotNextTextRef.current = targetText;
    setProjectedHudSlotNextText(targetText);
    Animated.timing(projectedHudSlotTranslateY, {
      toValue: -28,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      projectedHudSlotCurrentTextRef.current = targetText;
      setProjectedHudSlotCurrentText(targetText);
      projectedHudSlotTranslateY.setValue(0);
    });
  }

  const startProjectedHudSlotSpin = useCallback(() => {
    stopProjectedHudSlotSpin();
    projectedHudSpinningRef.current = true;
    projectedHudSpinTickRef.current = 0;
    projectedHudSpinStartedAtRef.current = Date.now();
    projectedHudSlotStepBusyRef.current = false;
    projectedHudValueAnim.stopAnimation((currentValue) => {
      const base = Math.max(0, Math.round(Number(currentValue) || projectedHudDisplayValue || projectedHudTargetRef.current));
      projectedHudValueAnim.setValue(base);
      const baseText = fmtUsd(base);
      projectedHudSlotCurrentTextRef.current = baseText;
      projectedHudSlotNextTextRef.current = baseText;
      setProjectedHudSlotCurrentText(baseText);
      setProjectedHudSlotNextText(baseText);
      projectedHudSlotTranslateY.setValue(0);
      projectedHudSpinIntervalRef.current = setInterval(() => {
        if (!projectedHudSpinningRef.current || projectedHudSlotStepBusyRef.current) return;
        projectedHudSlotStepBusyRef.current = true;
        projectedHudSpinTickRef.current += 1;
        const tick = projectedHudSpinTickRef.current;
        const bump = 600 + ((tick % 5) * 350) + ((tick % 3) * 220);
        const wobble = (tick % 2 === 0 ? 1 : -1) * (120 + (tick % 4) * 55);
        const next = Math.max(0, base + tick * bump + wobble);
        projectedHudValueAnim.setValue(next);
        const nextText = fmtUsd(next);
        projectedHudSlotNextTextRef.current = nextText;
        setProjectedHudSlotNextText(nextText);
        projectedHudSlotTranslateY.setValue(0);
        Animated.timing(projectedHudSlotTranslateY, {
          toValue: -28,
          duration: 50,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          projectedHudSlotCurrentTextRef.current = nextText;
          setProjectedHudSlotCurrentText(nextText);
          projectedHudSlotTranslateY.setValue(0);
          projectedHudSlotStepBusyRef.current = false;
        });
      }, 60);
    });
    projectedHudSpinFallbackTimeoutRef.current = setTimeout(() => {
      stopProjectedHudSlotSpin({ settleToCurrentTarget: true });
    }, 3200);
  }, [projectedHudDisplayValue, projectedHudSlotTranslateY, projectedHudValueAnim]);

  const bumpChartImpactBurst = useCallback(
    (amount: number) => {
      const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
      if (safeAmount <= 0) return;

      if (chartImpactBurstHideTimeoutRef.current) {
        clearTimeout(chartImpactBurstHideTimeoutRef.current);
        chartImpactBurstHideTimeoutRef.current = null;
      }

      if (!chartImpactBurstVisibleRef.current) {
        chartImpactBurstVisibleRef.current = true;
        chartImpactBurstOpacityAnim.stopAnimation();
        chartImpactBurstScaleAnim.stopAnimation();
        chartImpactBurstValueAnim.stopAnimation();
        chartImpactBurstOpacityAnim.setValue(0);
        chartImpactBurstScaleAnim.setValue(0.94);
        chartImpactBurstValueAnim.setValue(safeAmount);
        chartImpactBurstDisplayRef.current = safeAmount;
        setChartImpactBurstDisplay(safeAmount);
        Animated.parallel([
          Animated.timing(chartImpactBurstOpacityAnim, {
            toValue: 1,
            duration: 90,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(chartImpactBurstScaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 220,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        chartImpactBurstScaleAnim.stopAnimation();
        chartImpactBurstScaleAnim.setValue(1.04);
        Animated.spring(chartImpactBurstScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 220,
          useNativeDriver: true,
        }).start();
      }

      chartImpactBurstTargetRef.current += safeAmount;
      const nextTarget = chartImpactBurstTargetRef.current;
      const shouldAnimateValue = chartImpactBurstDisplayRef.current !== safeAmount || nextTarget !== safeAmount;
      if (shouldAnimateValue) {
        chartImpactBurstValueAnim.stopAnimation((currentValue) => {
          chartImpactBurstValueAnim.setValue(Number(currentValue) || chartImpactBurstDisplayRef.current);
          Animated.timing(chartImpactBurstValueAnim, {
            toValue: nextTarget,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        });
      }

      chartImpactBurstHideTimeoutRef.current = setTimeout(() => {
        Animated.timing(chartImpactBurstOpacityAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          chartImpactBurstVisibleRef.current = false;
          chartImpactBurstTargetRef.current = 0;
          chartImpactBurstValueAnim.stopAnimation();
          chartImpactBurstValueAnim.setValue(0);
          chartImpactBurstDisplayRef.current = 0;
          setChartImpactBurstDisplay(0);
        });
      }, 3650);
    },
    [chartImpactBurstOpacityAnim, chartImpactBurstScaleAnim, chartImpactBurstValueAnim]
  );

  const runKpiTilePressInFeedback = useCallback(
    (
      kpi: DashboardPayload['loggable_kpis'][number],
      options?: { surface?: 'home' | 'log' }
    ) => {
      animateKpiTilePress(kpi.id, true);
      if (options?.surface === 'home') {
        triggerHomeRapidTapHaptic();
      } else {
        void triggerHapticAsync('tap');
      }
      void playKpiTypeCueAsync(kpi.type);
      flashKpiTileConfirm(kpi.id);
    },
    [animateKpiTilePress, triggerHomeRapidTapHaptic, flashKpiTileConfirm]
  );

  const runKpiTilePressOutFeedback = useCallback((kpiId: string) => {
    animateKpiTilePress(kpiId, false);
  }, [animateKpiTilePress]);

  const onTapQuickLog = async (
    kpi: DashboardPayload['loggable_kpis'][number],
    options?: {
      skipTapFeedback?: boolean;
      skipOptimisticProjectionLaunch?: boolean;
      sourcePagePoint?: { x: number; y: number } | null;
    }
  ) => {
    if ((kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked)) {
      void triggerHapticAsync('warning');
      void playFeedbackCueAsync('locked');
      Alert.alert(
        'Category Locked',
        kpi.type === 'GP'
          ? 'Business Growth unlocks after 3 active days or 20 total KPI logs.'
          : 'Vitality unlocks after 7 active days or 40 total KPI logs.'
      );
      return;
    }

    // Immediate tap cues belong on tile onPressIn; this fallback is for non-tile callers.
    if (!options?.skipTapFeedback) {
      void triggerHapticAsync('tap');
      void playKpiTypeCueAsync(kpi.type);
      flashKpiTileConfirm(kpi.id);
    }

    if (kpi.requires_direct_value_input) {
      setDirectValue('');
      setPendingDirectLog({ kpiId: kpi.id, name: kpi.name, type: kpi.type });
      return;
    }

    animateKpiTileSuccess(kpi.id);

    let launchedOptimisticProjection = false;
    if (kpi.type === 'PC' && !options?.skipOptimisticProjectionLaunch) {
      if (!kpi.requires_direct_value_input) {
        animateProjectedHudValuePop();
        bumpChartImpactBurst(estimatePcGeneratedForKpi(kpi));
      }
      const delayDays = Math.max(0, Number(kpi.delay_days ?? 0));
      const holdDays = Math.max(0, Number(kpi.hold_days ?? 0));
      const optimisticPayoffDays = delayDays + holdDays;
      const optimisticPayoffStartIso = new Date(
        Date.now() + optimisticPayoffDays * 24 * 60 * 60 * 1000
      ).toISOString();
      launchedOptimisticProjection = true;
      const shouldKeepCurrentChartViewport = homePanel !== 'PC';
      void launchProjectionFlightFx(kpi.id, optimisticPayoffStartIso, {
        centerOnImpact:
          options?.sourcePagePoint && shouldKeepCurrentChartViewport ? false : undefined,
        sourcePagePoint: options?.sourcePagePoint ?? null,
      });
    }

    enqueueLogTask({
      kpiId: kpi.id,
      options: {
      kpiType: kpi.type,
      skipSuccessBadge: true,
      skipProjectionFlight: launchedOptimisticProjection || Boolean(options?.skipOptimisticProjectionLaunch),
      eventTimestampIso: eventTimestampIsoForSelectedDay(selectedLogDate),
      },
    });
  };

  const fireHomeQuickLogAtPoint = useCallback(
    (kpi: DashboardPayload['loggable_kpis'][number], sourcePagePoint: { x: number; y: number } | null) => {
      runKpiTilePressInFeedback(kpi, { surface: 'home' });
      void onTapQuickLog(kpi, {
        skipTapFeedback: true,
        sourcePagePoint,
      });
    },
    [onTapQuickLog, runKpiTilePressInFeedback]
  );

  const stopHomeAutoFire = useCallback((kpiId?: string) => {
    if (kpiId && homeAutoFireKpiIdRef.current && homeAutoFireKpiIdRef.current !== kpiId) return;
    if (homeAutoFireStartTimeoutRef.current) {
      clearTimeout(homeAutoFireStartTimeoutRef.current);
      homeAutoFireStartTimeoutRef.current = null;
    }
    if (homeAutoFireIntervalRef.current) {
      clearInterval(homeAutoFireIntervalRef.current);
      homeAutoFireIntervalRef.current = null;
    }
    homeAutoFireKpiIdRef.current = null;
  }, []);

  const startHomeAutoFire = useCallback(
    (
      kpi: DashboardPayload['loggable_kpis'][number],
      sourcePagePoint: { x: number; y: number } | null
    ) => {
      stopHomeAutoFire();
      homeAutoFireKpiIdRef.current = kpi.id;
      homeAutoFireStartTimeoutRef.current = setTimeout(() => {
        if (homeAutoFireKpiIdRef.current !== kpi.id) return;
        fireHomeQuickLogAtPoint(kpi, sourcePagePoint);
        homeAutoFireIntervalRef.current = setInterval(() => {
          if (homeAutoFireKpiIdRef.current !== kpi.id) return;
          fireHomeQuickLogAtPoint(kpi, sourcePagePoint);
        }, 88);
      }, 180);
    },
    [fireHomeQuickLogAtPoint, stopHomeAutoFire]
  );

  React.useEffect(() => {
    return () => {
      stopHomeAutoFire();
    };
  }, [stopHomeAutoFire]);

  React.useEffect(() => {
    stopHomeAutoFire();
  }, [homePanel, stopHomeAutoFire, viewMode]);

  const submitDirectLog = async () => {
    if (submitting || !pendingDirectLog) return;
    const parsed = Number(directValue.replace(/,/g, '').trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      void triggerHapticAsync('warning');
      Alert.alert('Invalid value', 'Enter a valid amount.');
      return;
    }

    const current = pendingDirectLog;
    const normalizedValue = current.type === 'Actual' ? parsed : Math.round(parsed);
    setPendingDirectLog(null);
    setDirectValue('');
    await sendLog(current.kpiId, normalizedValue, { kpiType: current.type });
  };

  const renderChartVisualPanel = (options?: { attachLiveChartRefs?: boolean }) => (
    <View style={styles.chartWrap}>
      <View pointerEvents="none" style={styles.chartBoostOverlay}>
        <Animated.View
          style={[
            styles.chartBoostChip,
            styles.chartBoostChipPink,
            !gpBoostActive && styles.boostInactive,
            !gpBoostActive && {
              opacity: boostPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.56, 0.84] }),
              transform: [{ scale: boostPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
            },
          ]}
        >
          <Text style={styles.chartBoostChipText}>{gpBoostActive ? 'Growth Boost' : 'Growth Boost 🔒'}</Text>
        </Animated.View>
        <Animated.View
          style={[
            styles.chartBoostChip,
            styles.chartBoostChipGold,
            !vpBoostActive && styles.boostInactive,
            !vpBoostActive && {
              opacity: boostPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.54, 0.8] }),
              transform: [{ scale: boostPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }],
            },
          ]}
        >
          <Text style={styles.chartBoostChipText}>{vpBoostActive ? 'Vitality Boost' : 'Vitality Boost 🔒'}</Text>
        </Animated.View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.chartImpactBurstOverlay,
          {
            opacity: chartImpactBurstOpacityAnim,
            transform: [{ scale: chartImpactBurstScaleAnim }],
          },
        ]}
      >
        <Text style={styles.chartImpactBurstValue}>{fmtUsd(chartImpactBurstDisplay)}</Text>
      </Animated.View>
      <View style={styles.chartRow}>
        <View style={styles.yAxisCol}>
          {chartSeries.yTicks.map((tick, idx) => (
            <Text key={`${tick}-${idx}`} style={styles.yAxisLabel}>
              {formatUsdAxis(tick)}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={options?.attachLiveChartRefs ? chartScrollRef : undefined}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={
            options?.attachLiveChartRefs
              ? (e) => {
                  const width = e.nativeEvent.layout.width;
                  setChartViewportWidth(width);
                  void refreshFlightMeasureCache();
                  if (preservePinnedChartScrollRef.current && chartPinnedScrollXRef.current != null) {
                    const maxScroll = Math.max(0, chartSeries.chartWidth - width);
                    const pinned = Math.min(maxScroll, Math.max(0, chartPinnedScrollXRef.current));
                    chartScrollXRef.current = pinned;
                    requestAnimationFrame(() => {
                      chartScrollRef.current?.scrollTo({ x: pinned, animated: false });
                    });
                    setTimeout(() => {
                      chartScrollRef.current?.scrollTo({ x: pinned, animated: false });
                    }, 80);
                  }
                }
              : undefined
          }
          onScroll={
            options?.attachLiveChartRefs
              ? (e) => {
                  chartScrollXRef.current = e.nativeEvent.contentOffset.x;
                }
              : undefined
          }
          scrollEventThrottle={16}
        >
          <View
            ref={
              options?.attachLiveChartRefs
                ? (node) => {
                    chartScrollableRef.current = node;
                  }
                : undefined
            }
            style={styles.chartScrollable}
          >
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
                      const deformLineY = (x: number, y: number) => {
                        if (chartImpactLineX == null) return y;
                        const spread = 74;
                        const distance = Math.abs(x - chartImpactLineX);
                        const normalized = distance / Math.max(1, spread);
                        const primary = Math.exp(-(normalized * normalized) * 1.15);
                        const rippleEnvelope = Math.exp(-(normalized * normalized) * 0.85);
                        const ripple = Math.cos(normalized * Math.PI * 1.45) * 0.12 * rippleEnvelope;
                        const influence = Math.max(-0.05, primary + ripple);
                        const amplitude = 32;
                        return y - chartImpactLineValue * amplitude * influence;
                      };
                      const monthTargetXs = chartSeries.futureProjected.map(
                        (_, idx) => chartSeries.step * (chartSeries.firstFutureIndex + idx)
                      );
                      let prevX = splitX;
                      let prevY = currentY;
                      return chartSeries.futureProjected.map((nextValue, idx) => {
                        const nextX = monthTargetXs[idx] ?? prevX;
                        if (nextX <= splitX) return null;
                        const nextYBase = yForValue(nextValue, 170, chartSeries.min, chartSeries.max);
                        const drawPrevY = deformLineY(prevX, prevY);
                        const drawNextY = deformLineY(nextX, nextYBase);
                        const band =
                          chartSeries.futureBands[idx] ?? payload?.projection.confidence.band ?? 'yellow';
                        const subdivisions = 24;
                        const pieces = Array.from({ length: subdivisions }, (_, subIdx) => {
                          const t1 = subIdx / subdivisions;
                          const t2 = (subIdx + 1) / subdivisions;
                          const xA = prevX + (nextX - prevX) * t1;
                          const xB = prevX + (nextX - prevX) * t2;
                          const yABase = prevY + (nextYBase - prevY) * t1;
                          const yBBase = prevY + (nextYBase - prevY) * t2;
                          return (
                            <Line
                              key={`future-segment-${idx}-${subIdx}`}
                              x1={String(xA)}
                              y1={String(deformLineY(xA, yABase))}
                              x2={String(xB)}
                              y2={String(deformLineY(xB, yBBase))}
                              stroke={confidenceColor(band)}
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          );
                        });
                        prevX = nextX;
                        prevY = nextYBase;
                        return pieces;
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
                <Animated.Text
                  key={`${label}-${idx}`}
                  style={[
                    styles.monthLabel,
                    idx === chartSeries.splitBaseIndex && styles.monthBoundaryLabel,
                    idx === chartImpactMonthIndex && styles.monthImpactLabel,
                    idx === chartImpactMonthIndex
                      ? {
                          opacity: chartImpactMonthPulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                          transform: [
                            {
                              scale: chartImpactMonthPulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.12],
                              }),
                            },
                          ],
                        }
                      : null,
                  ]}
                >
                  {label}
                </Animated.Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  const renderHudRail = () => {
    const projectedCardValueByWindow: Record<(typeof PROJECTED_CARD_WINDOWS)[number], number> = {
      30: cardMetrics.projectedNext30,
      60: cardMetrics.projectedNext60,
      90: cardMetrics.projectedNext90,
      180: cardMetrics.projectedNext180,
      360: cardMetrics.projectedNext360,
    };
    const cycleActualHudCard = () => {
      setActualHudCardView((prev) => {
        const idx = ACTUAL_CARD_VIEWS.indexOf(prev);
        return ACTUAL_CARD_VIEWS[(idx + 1) % ACTUAL_CARD_VIEWS.length] ?? 'actual365';
      });
    };
    const cycleProjectedCardWindow = () => {
      setProjectedCardWindowDays((prev) => {
        const idx = PROJECTED_CARD_WINDOWS.indexOf(prev);
        return PROJECTED_CARD_WINDOWS[(idx + 1) % PROJECTED_CARD_WINDOWS.length] ?? 360;
      });
    };
    const actualCard: {
      key: string;
      label: string;
      value: string;
      accent: string;
      subValue?: string;
      onPress?: () => void;
      kind?: 'actual' | 'projected';
    } =
      actualHudCardView === 'actual365'
        ? {
            key: 'actual365',
            label: 'Actual GCI (365d)',
            value: fmtUsd(cardMetrics.actualLast365),
            subValue: fmtUsd(cardMetrics.actualYtd),
            accent: '#2f9f56',
            onPress: cycleActualHudCard,
            kind: 'actual',
          }
        : {
            key: 'progress',
            label: 'Progress YTD',
            value: fmtUsd(cardMetrics.actualYtd),
            subValue: `${Math.round(cardMetrics.progressPct)}%`,
            accent: '#1f5fe2',
            onPress: cycleActualHudCard,
            kind: 'actual',
          };
    const hudCards: Array<{
      key: string;
      label: string;
      value: string;
      accent: string;
      subValue?: string;
      onPress?: () => void;
      kind?: 'actual' | 'projected';
    }> = [
      actualCard,
      {
        key: 'projCycle',
        label: `Projected (${projectedCardWindowDays}d)`,
        value: fmtUsd(projectedCardValueByWindow[projectedCardWindowDays]),
        subValue: `Next ${projectedCardWindowDays} days`,
        accent: '#2158d5',
        onPress: cycleProjectedCardWindow,
        kind: 'projected',
      },
    ];

    return (
      <View style={styles.hudRailWrap}>
        <View style={styles.hudRailStaticRow}>
          {hudCards.map((card, idx) => (
            <TouchableOpacity
              key={card.key}
              activeOpacity={card.onPress ? 0.8 : 1}
              disabled={!card.onPress}
              onPress={card.onPress}
              style={[
                styles.hudCard,
                card.onPress && styles.hudCardInteractive,
                card.onPress && styles.hudCardTappableGlow,
                card.kind === 'actual' && styles.hudCardActualInteractive,
                card.kind === 'projected' && styles.hudCardProjectedInteractive,
                styles.hudCardFill,
                idx === hudActiveIndex && styles.hudCardActive,
              ]}
            >
              <View style={styles.hudCardHeaderRow}>
                <Animated.View
                  style={[
                    styles.hudCardAccent,
                    { backgroundColor: card.accent },
                    card.key === 'projCycle'
                      ? {
                          opacity: projectedHudAccentFlashAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.7],
                          }),
                          transform: [
                            {
                              scaleX: projectedHudAccentFlashAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.5],
                              }),
                            },
                          ],
                        }
                      : null,
                  ]}
                />
                {card.onPress ? <View style={[styles.hudCardHintDot, { backgroundColor: card.accent }]} /> : null}
              </View>
              <Text style={styles.hudCardLabel}>{card.label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hudCardValueScroll}>
                <Animated.View
                  style={
                    card.key === 'projCycle'
                      ? {
                          transform: [
                            {
                              scale: projectedHudValuePopAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.08],
                              }),
                            },
                          ],
                        }
                      : undefined
                  }
                >
                  <Text style={styles.hudCardValue}>{card.value}</Text>
                </Animated.View>
              </ScrollView>
              {card.subValue ? <Text style={styles.hudCardSub}>{card.subValue}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderGameplayHeader = () => {
    const currentIdx = HOME_PANEL_ORDER.indexOf(homePanel);
    const prevPanel = HOME_PANEL_ORDER[(currentIdx - 1 + HOME_PANEL_ORDER.length) % HOME_PANEL_ORDER.length] ?? 'Quick';
    const nextPanel = HOME_PANEL_ORDER[(currentIdx + 1) % HOME_PANEL_ORDER.length] ?? 'Quick';
    const activeBg = homePanel === 'Quick' ? '#2f3645' : kpiTypeAccent(homePanel as Segment);
    const ActivePillBg = homePanelPillSvgBg[homePanel];
    return (
      <View style={styles.gameplayHeader}>
        <View style={styles.gameplayHeaderTopRow}>
          <View
            {...simpleHeaderSwipePanResponder.panHandlers}
            style={styles.modeRailShell}
          >
            <TouchableOpacity
              style={styles.modeRailEdgeBtn}
              onPress={() => void shiftHomePanelFromRail(-1)}
              accessibilityLabel={`Previous mode (${HOME_PANEL_LABELS[prevPanel]})`}
            >
              <Text style={styles.modeRailEdgeBtnText}>‹</Text>
            </TouchableOpacity>
            <View style={[styles.modeRailActivePill, { backgroundColor: activeBg }]}>
              <ActivePillBg width="100%" height="100%" preserveAspectRatio="none" style={styles.modeRailActivePillSvgBg} />
              <View style={styles.modeRailActivePillSvgShade} />
              <View style={styles.modeRailContent}>
                <Text style={[styles.gameplaySegmentText, styles.gameplaySegmentTextActive, styles.modeRailActivePillText]}>
                  {HOME_PANEL_LABELS[homePanel]}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modeRailEdgeBtn}
              onPress={() => void shiftHomePanelFromRail(1)}
              accessibilityLabel={`Next mode (${HOME_PANEL_LABELS[nextPanel]})`}
            >
              <Text style={styles.modeRailEdgeBtnText}>›</Text>
            </TouchableOpacity>
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
        <LottieSlot
          source={kind === 'GP' ? GP_LOTTIE_SOURCE : VP_LOTTIE_SOURCE}
          size={132}
          fallbackEmoji={kind === 'GP' ? '🏙️' : '🌳'}
        />
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

  const renderHomeGridPanel = (panel: HomePanel, options?: { attachLiveTileRefs?: boolean }) => {
    const locked = (panel === 'GP' && !gpUnlocked) || (panel === 'VP' && !vpUnlocked);
    const panelTiles =
      panel === homePanel
        ? homePanelTiles
        : buildHomePanelTiles(
            panel === 'Quick' ? homeQuickLog : managedKpis.filter((kpi) => kpi.type === panel).slice(0, 6),
            payload ?? null
          );

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
        {panelTiles.map(({ kpi, context }) => {
          const successAnim = getKpiTileSuccessAnim(kpi.id);
          const successOpacity = successAnim.interpolate({
            inputRange: [0, 0.12, 1],
            outputRange: [0, 1, 0],
          });
          const successTranslateY = successAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -14],
          });
          const successScale = successAnim.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0.8, 1.02, 0.96],
          });
          return (
            <Pressable
              key={kpi.id}
              style={styles.gridItem}
              onPress={() => {}}
              onPressIn={(e) => {
                const sourcePagePoint = {
                  x: e.nativeEvent.pageX,
                  y: e.nativeEvent.pageY,
                };
                fireHomeQuickLogAtPoint(kpi, sourcePagePoint);
                startHomeAutoFire(kpi, sourcePagePoint);
              }}
              onPressOut={() => {
                stopHomeAutoFire(kpi.id);
                runKpiTilePressOutFeedback(kpi.id);
              }}
            >
              <Animated.View style={[styles.gridTileAnimatedWrap, { transform: [{ scale: getKpiTileScale(kpi.id) }] }]}>
                <View
                  ref={
                    options?.attachLiveTileRefs
                      ? (node) => {
                          kpiTileCircleRefById.current[kpi.id] = node;
                        }
                      : undefined
                  }
                  style={styles.gridCircleWrap}
                >
                  <View
                    style={[
                      styles.gridCircle,
                      confirmedKpiTileIds[kpi.id] && styles.gridCircleConfirmed,
                      context.isRequired && styles.gridCircleRequired,
                    ]}
                  >
                    {renderKpiIcon(kpi)}
                  </View>
                  {context.badges.length > 0 ? (
                    <View pointerEvents="none" style={styles.gridContextBadgeStack}>
                      {context.badges.map((badge) => (
                        <View
                          key={`${kpi.id}:${badge}`}
                          style={[
                            styles.gridContextBadge,
                            badge === 'REQ' && styles.gridContextBadgeRequired,
                          ]}
                        >
                          <Text
                            style={[
                              styles.gridContextBadgeText,
                              badge === 'REQ' && styles.gridContextBadgeTextRequired,
                            ]}
                          >
                            {renderContextBadgeLabel(badge)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {/* Suppress local +1 in the looping home carousel to avoid duplicate copies peeking. */}
                </View>
                <Text style={[styles.gridLabel, confirmedKpiTileIds[kpi.id] && styles.gridLabelConfirmed]}>{kpi.name}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const visualPageWidth = Math.max(homeVisualViewportWidth, 1);
  const gridPageWidth = Math.max(homeGridViewportWidth, 1);
  const visualParallaxOffset = Math.max(10, Math.round(visualPageWidth * 0.035));
  const visualTranslateBaseX = Animated.multiply(homePanelAnim, -visualPageWidth);
  const visualTranslateX = Animated.add(
    visualTranslateBaseX,
    homePanelAnim.interpolate({
      inputRange: [0, 1000],
      outputRange: [0, visualParallaxOffset],
    })
  );
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
      setFavoriteKpiIds((prevFav) => {
        const nextFav = prevFav.filter((id) => next.includes(id)).slice(0, 6);
        void saveKpiPreferences(next, nextFav);
        return nextFav;
      });
      return next;
    });
  };

  const removeManagedKpi = (kpiId: string) => {
    setManagedKpiIds((prev) => {
      if (!prev.includes(kpiId)) return prev;
      const next = prev.filter((id) => id !== kpiId);
      setFavoriteKpiIds((prevFav) => {
        const nextFav = prevFav.filter((id) => id !== kpiId);
        void saveKpiPreferences(next, nextFav);
        return nextFav;
      });
      return next;
    });
  };

  const toggleFavoriteKpi = (kpiId: string) => {
    if (!managedKpiIds.includes(kpiId)) return;
    setFavoriteKpiIds((prev) => {
      const isFavorite = prev.includes(kpiId);
      const next = isFavorite ? prev.filter((id) => id !== kpiId) : [...prev, kpiId];
      if (!isFavorite && next.length > 6) {
        Alert.alert('Favorites full', 'You can star up to 6 Priority favorites.');
        return prev;
      }
      void saveKpiPreferences(managedKpiIds, next);
      return next;
    });
  };

  const openAddNewDrawer = () => {
    setDrawerFilter(homePanel);
    setAddDrawerVisible(true);
  };

  const activateHomePanel = useCallback(
    (item: HomePanel) => {
      if (item === 'GP' && !gpUnlocked) {
        Alert.alert('Business Growth Locked', 'Unlock after 3 active days or 20 KPI logs.');
        return false;
      }
      if (item === 'VP' && !vpUnlocked) {
        Alert.alert('Vitality Locked', 'Unlock after 7 active days or 40 KPI logs.');
        return false;
      }
      homePanelDirectionRef.current = 0;
      setHomePanel(item);
      return true;
    },
    [gpUnlocked, vpUnlocked]
  );

  const shiftHomePanelFromRail = useCallback(
    (direction: -1 | 1) => {
      const currentIdx = HOME_PANEL_ORDER.indexOf(homePanel);
      const nextIdx = (currentIdx + direction + HOME_PANEL_ORDER.length) % HOME_PANEL_ORDER.length;
      const next = HOME_PANEL_ORDER[nextIdx] ?? 'Quick';
      const changed = activateHomePanel(next);
      if (changed) void playFeedbackCueAsync('swipe');
      return changed;
    },
    [activateHomePanel, homePanel]
  );

  const commitModeRailSwipeSelection = useCallback(() => {
    if (modeRailDragCommittedRef.current) return;
    const startX = modeRailDragStartXRef.current;
    if (startX == null) return;
    const delta = modeRailDragLastXRef.current - startX;
    const absDelta = Math.abs(delta);
    if (absDelta < 8) return;
    const swipeDir: -1 | 1 = delta > 0 ? 1 : -1;

    let freezeTargetX = modeRailDragLastXRef.current;
    if (modeRailViewportWidth > 0) {
      const ACTIVE_W = GAMEPLAY_MODE_ACTIVE_WIDTH;
      const INACTIVE_W = GAMEPLAY_MODE_INACTIVE_WIDTH;
      const GAP = GAMEPLAY_MODE_GAP;
      const sidePad = Math.max(0, modeRailViewportWidth / 2 - ACTIVE_W / 2);
      const totalItems = HOME_PANEL_ORDER.length * MODE_RAIL_LOOP_CYCLES;
      const nextVirtualIdx = modeRailVirtualIndexRef.current + swipeDir;
      let xStart = sidePad;
      for (let i = 0; i < nextVirtualIdx; i += 1) xStart += INACTIVE_W + GAP;
      const activeCenter = xStart + ACTIVE_W / 2;
      const contentWidth =
        sidePad * 2 + ACTIVE_W + INACTIVE_W * (totalItems - 1) + GAP * (totalItems - 1);
      const maxScroll = Math.max(0, contentWidth - modeRailViewportWidth);
      freezeTargetX = Math.min(maxScroll, Math.max(0, activeCenter - modeRailViewportWidth / 2));
    }

    modeRailDragCommittedRef.current = true;
    modeRailDragStartXRef.current = null;
    modeRailFreezeXRef.current = freezeTargetX;
    modeRailScrollRef.current?.scrollTo({ x: modeRailFreezeXRef.current, animated: false });
    setModeRailScrollEnabled(false);
    if (swipeDir > 0) {
      void shiftHomePanelFromRail(1);
      return;
    }
    void shiftHomePanelFromRail(-1);
  }, [shiftHomePanelFromRail]);

  const simpleHeaderSwipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dy) < 26,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dy) < 26,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -14 || gesture.vx <= -0.2) {
            void shiftHomePanelFromRail(1);
            return;
          }
          if (gesture.dx >= 14 || gesture.vx >= 0.2) {
            void shiftHomePanelFromRail(-1);
          }
        },
      }),
    [shiftHomePanelFromRail]
  );

  const headerModeRailPanResponder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderTerminationRequest: () => false,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 4 && Math.abs(gesture.dy) < 32,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 && Math.abs(gesture.dy) < 32,
        onPanResponderGrant: () => {
          modeRailDragCommittedRef.current = false;
          modeRailHasMomentumRef.current = false;
          modeRailDragStartXRef.current = modeRailDragLastXRef.current;
          homePanelAnim.stopAnimation((value) => {
            modeRailPanelDragStartVirtualRef.current = value;
            homePanelVirtualIndexRef.current = value;
            homePanelAnim.setValue(value);
          });
        },
        onPanResponderMove: (_, gesture) => {
          const railStartX = modeRailDragStartXRef.current;
          const panelStart = modeRailPanelDragStartVirtualRef.current;
          if (railStartX == null || panelStart == null) return;
          modeRailScrollRef.current?.scrollTo({ x: Math.max(0, railStartX - gesture.dx), animated: false });
          const dragWidth = Math.max(1, gridPageWidth);
          const raw = panelStart - (gesture.dx / dragWidth) * 2.8;
          const clamped = Math.max(panelStart - 1.9, Math.min(panelStart + 1.9, raw));
          homePanelAnim.setValue(clamped);
        },
        onPanResponderRelease: (_, gesture) => {
          const panelStart = modeRailPanelDragStartVirtualRef.current;
          const railStartX = modeRailDragStartXRef.current;
          modeRailPanelDragStartVirtualRef.current = null;
          modeRailDragStartXRef.current = null;
          const panelCount = HOME_PANEL_ORDER.length;
          if (panelStart == null) return;
          const anchor = Math.round(panelStart);
          const shouldAdvance =
            gesture.dx <= -6 || gesture.vx <= -0.1 ? 1 : gesture.dx >= 6 || gesture.vx >= 0.1 ? -1 : 0;

          if (shouldAdvance !== 0) {
            homePanelAnim.stopAnimation();
            void shiftHomePanelFromRail(shouldAdvance as -1 | 1);
            return;
          }

          Animated.timing(homePanelAnim, {
            toValue: anchor,
            duration: 140,
            useNativeDriver: true,
          }).start(() => {
            const normalized = panelCount + (((anchor % panelCount) + panelCount) % panelCount);
            homePanelVirtualIndexRef.current = normalized;
            homePanelAnim.setValue(normalized);
            homePanelDirectionRef.current = 0;
          });
          if (railStartX != null) {
            modeRailScrollRef.current?.scrollTo({ x: railStartX, animated: true });
          }
        },
        onPanResponderTerminate: () => {
          const panelStart = modeRailPanelDragStartVirtualRef.current;
          const railStartX = modeRailDragStartXRef.current;
          modeRailPanelDragStartVirtualRef.current = null;
          modeRailDragStartXRef.current = null;
          if (panelStart != null) {
            const panelCount = HOME_PANEL_ORDER.length;
            const anchor = Math.round(panelStart);
            Animated.timing(homePanelAnim, {
              toValue: anchor,
              duration: 140,
              useNativeDriver: true,
            }).start(() => {
              const normalized = panelCount + (((anchor % panelCount) + panelCount) % panelCount);
              homePanelVirtualIndexRef.current = normalized;
              homePanelAnim.setValue(normalized);
              homePanelDirectionRef.current = 0;
            });
          }
          if (railStartX != null) {
            modeRailScrollRef.current?.scrollTo({ x: railStartX, animated: true });
          }
        },
      }),
    [gridPageWidth, homePanelAnim, shiftHomePanelFromRail]
  );


  const onBottomTabPress = (tab: BottomTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setViewMode('home');
      return;
    }
    if (tab === 'challenge') {
      setViewMode('log');
      return;
    }
    if (tab === 'logs') {
      setViewMode('log');
      setLogsReportsSubview('logs');
      return;
    }
    if (tab === 'team') {
      setViewMode('log');
      return;
    }
    if (tab === 'comms') {
      setViewMode('log');
      setCommsHubPrimaryTab('all');
      setCommsHubScopeFilter('all');
      setCommsHubSearchQuery('');
      setCoachingShellScreen('inbox');
      setCoachingShellContext({
        source: 'user_tab',
        preferredChannelScope: null,
        preferredChannelLabel: null,
        threadTitle: null,
        threadSub: null,
        broadcastAudienceLabel: null,
        broadcastRoleAllowed: false,
        selectedJourneyId: null,
        selectedJourneyTitle: null,
        selectedLessonId: null,
        selectedLessonTitle: null,
      });
      return;
    }
    Alert.alert('Coming next', 'This section is planned for later sprint scope.');
  };

  const handleOpenProfileFromAvatar = () => {
    if (onOpenProfile) {
      onOpenProfile();
      return;
    }
    Alert.alert('Profile unavailable', 'Profile and settings routing is not available in this build context.');
  };

  // Boost states remain inactive until dedicated boost metrics/policies are wired.
  const gpBoostActive = false;
  const vpBoostActive = false;

  const drawerCatalogKpis = useMemo(() => {
    const metric = (kpi: DashboardPayload['loggable_kpis'][number]) => {
      if (kpi.type === 'PC') return Number(kpi.pc_weight ?? 0) || 0;
      if (kpi.type === 'GP') return Number(kpi.gp_value ?? 0) || 0;
      if (kpi.type === 'VP') return Number(kpi.vp_value ?? 0) || 0;
      return 0;
    };
    const ordered = [...allSelectableKpis].sort((a, b) => {
      const orderedDelta = compareKpisForSelectionOrder(a, b);
      if (orderedDelta !== 0) return orderedDelta;
      const metricDelta = metric(a) - metric(b);
      if (Math.abs(metricDelta) > 0.000001) return metricDelta;
      return 0;
    });
    if (drawerFilter === 'Quick') return ordered;
    return ordered.filter((kpi) => kpi.type === drawerFilter);
  }, [allSelectableKpis, drawerFilter]);

  const selectedCountsByType = useMemo(() => {
    const byId = new Map(allSelectableKpis.map((kpi) => [kpi.id, kpi]));
    const counts: Record<'PC' | 'GP' | 'VP', number> = { PC: 0, GP: 0, VP: 0 };
    for (const id of managedKpiIds) {
      const kpi = byId.get(id);
      if (!kpi) continue;
      if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') counts[kpi.type] += 1;
    }
    return counts;
  }, [allSelectableKpis, managedKpiIds]);

  const sessionUserMeta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const sessionAppMeta = (session?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const estAveragePricePoint = Number(sessionUserMeta.average_price_point ?? 300000) || 300000;
  const estCommissionRatePct = Number(sessionUserMeta.commission_rate_percent ?? 3) || 3;
  const estCommissionRate = estCommissionRatePct / 100;

  const recentPcGeneratedByKpiId = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of [...(payload?.recent_logs ?? [])].reverse()) {
      const id = String(log.kpi_id ?? '');
      if (!id || map.has(id)) continue;
      const pc = Number(log.pc_generated ?? 0);
      if (pc > 0) map.set(id, pc);
    }
    return map;
  }, [payload?.recent_logs]);

  const estimatePcGeneratedForKpi = useCallback((kpi: DashboardPayload['loggable_kpis'][number]) => {
    if (kpi.type !== 'PC') return 0;
    const recentPc = recentPcGeneratedByKpiId.get(kpi.id);
    if (recentPc != null && recentPc > 0) return recentPc;
    const weight = Number(kpi.pc_weight ?? 0);
    return Math.max(0, Math.round(estAveragePricePoint * estCommissionRate * weight));
  }, [estAveragePricePoint, estCommissionRate, recentPcGeneratedByKpiId]);

  const formatDrawerKpiMeta = useCallback((kpi: DashboardPayload['loggable_kpis'][number]) => {
    if (kpi.type === 'PC') {
      const estPc = estimatePcGeneratedForKpi(kpi);
      const delay = Number(kpi.delay_days ?? 0);
      const hold = Number(kpi.hold_days ?? 0);
      const ttcLabel = (kpi.ttc_definition || '').trim() || `${delay + hold}d`;
      return `PC ${fmtUsd(estPc)} • TTC ${ttcLabel}`;
    }
    if (kpi.type === 'GP') {
      const pts = Number(kpi.gp_value ?? 1) || 1;
      return `GP +${fmtNum(pts)} pt${pts === 1 ? '' : 's'}`;
    }
    if (kpi.type === 'VP') {
      const pts = Number(kpi.vp_value ?? 1) || 1;
      return `VP +${fmtNum(pts)} pt${pts === 1 ? '' : 's'}`;
    }
    return kpi.requires_direct_value_input ? 'Manual value input' : 'Tap to log';
  }, [estimatePcGeneratedForKpi]);

  const openPipelineCheckinOverlay = useCallback(() => {
    setPipelineCheckinListings(pipelineAnchorCounts.listings);
    setPipelineCheckinBuyers(pipelineAnchorCounts.buyers);
    setPipelineCheckinReasonPromptVisible(false);
    setPipelineCheckinDecreaseFields([]);
    setPipelineCheckinReason(null);
    setPipelineCloseDateInput(isoTodayLocal());
    setPipelineCloseGciInput('');
    setPipelineLostEncouragement('');
    setPipelineCheckinVisible(true);
  }, [pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings]);

  React.useEffect(() => {
    let cancelled = false;
    setPipelineCheckinDismissalLoaded(false);
    if (!pipelineCheckinDismissStorageKey) {
      setPipelineCheckinDismissedDay(null);
      setPipelineCheckinDismissalLoaded(true);
      return;
    }
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(pipelineCheckinDismissStorageKey);
        if (!cancelled) setPipelineCheckinDismissedDay(stored || null);
      } catch {
        if (!cancelled) setPipelineCheckinDismissedDay(null);
      } finally {
        if (!cancelled) setPipelineCheckinDismissalLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineCheckinDismissStorageKey]);

  const persistPipelineDismissedDay = useCallback(
    async (isoDay: string) => {
      setPipelineCheckinDismissedDay(isoDay);
      if (!pipelineCheckinDismissStorageKey) return;
      try {
        await AsyncStorage.setItem(pipelineCheckinDismissStorageKey, isoDay);
      } catch {
        // Non-blocking local persistence.
      }
    },
    [pipelineCheckinDismissStorageKey]
  );

  const dismissPipelineCheckinForToday = useCallback(() => {
    const today = isoTodayLocal();
    PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.add(today);
    void persistPipelineDismissedDay(today);
    setPipelineCheckinReasonPromptVisible(false);
    setPipelineCheckinReason(null);
    setPipelineCheckinVisible(false);
  }, [persistPipelineDismissedDay]);

  React.useEffect(() => {
    if (!payload || state !== 'ready') return;
    if (pipelineCheckinVisible || pendingDirectLog) return;
    if (!pipelineCheckinDismissalLoaded) return;
    const today = isoTodayLocal();
    if (PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.has(today)) return;
    if (pipelineCheckinDismissedDay === today) return;
    if (pipelineAnchorNag.severity === 'ok') return;
    openPipelineCheckinOverlay();
  }, [
    openPipelineCheckinOverlay,
    payload,
    pendingDirectLog,
    pipelineAnchorNag.severity,
    pipelineCheckinDismissalLoaded,
    pipelineCheckinDismissedDay,
    pipelineCheckinVisible,
    state,
  ]);

  const persistPipelineCountsMetadata = useCallback(
    async (listings: number, buyers: number) => {
      const token = session?.access_token;
      if (!token) return;
      try {
        await fetch(`${API_URL}/me`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pipeline_listings_pending: listings,
            pipeline_buyers_uc: buyers,
          }),
        });
      } catch {
        // Non-blocking; anchor logs are the primary save path.
      }
    },
    [session?.access_token]
  );

  const finalizePipelineCheckinSave = useCallback(
    async (reason: PipelineCheckinReason) => {
      const listingsKpi = pipelineCheckinAnchors.listings;
      const buyersKpi = pipelineCheckinAnchors.buyers;
      if (!listingsKpi || !buyersKpi) {
        Alert.alert('Pipeline check-in unavailable', 'Required pipeline anchor KPIs are not available yet.');
        return;
      }
      let closeEventIso: string | null = null;
      let closeGciAmount: number | null = null;
      if (reason === 'deal_closed') {
        const normalizedDate = (pipelineCloseDateInput.trim() || isoTodayLocal()).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          Alert.alert('Invalid close date', 'Use YYYY-MM-DD for the close date.');
          return;
        }
        const parsedGci = Number(pipelineCloseGciInput.replace(/,/g, '').trim());
        if (!Number.isFinite(parsedGci) || parsedGci <= 0) {
          Alert.alert('Invalid GCI amount', 'Enter a valid GCI amount greater than 0.');
          return;
        }
        if (!actualGciLogKpi) {
          Alert.alert('Close logging unavailable', 'No Actual GCI log KPI is available for this account yet.');
          return;
        }
        closeEventIso = eventTimestampIsoForSelectedDay(normalizedDate);
        closeGciAmount = parsedGci;
      }

      setPipelineCheckinSubmitting(true);
      try {
        const eventIso = new Date().toISOString();
        const listingsSaved = await sendLog(listingsKpi.id, Math.max(0, Math.round(pipelineCheckinListings)), {
          kpiType: 'Pipeline_Anchor',
          skipSuccessBadge: true,
          skipProjectionFlight: true,
          eventTimestampIso: eventIso,
        });
        if (!listingsSaved) return;
        const buyersSaved = await sendLog(buyersKpi.id, Math.max(0, Math.round(pipelineCheckinBuyers)), {
          kpiType: 'Pipeline_Anchor',
          skipSuccessBadge: true,
          skipProjectionFlight: true,
          eventTimestampIso: eventIso,
        });
        if (!buyersSaved) return;
        await persistPipelineCountsMetadata(
          Math.max(0, Math.round(pipelineCheckinListings)),
          Math.max(0, Math.round(pipelineCheckinBuyers))
        );
        if (reason === 'deal_closed' && closeEventIso && closeGciAmount != null && actualGciLogKpi) {
          const closeSaved = await sendLog(actualGciLogKpi.id, closeGciAmount, {
            kpiType: 'Actual',
            skipSuccessBadge: true,
            skipProjectionFlight: true,
            eventTimestampIso: closeEventIso,
          });
          if (!closeSaved) return;
        }

        const today = isoTodayLocal();
        PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.add(today);
        void persistPipelineDismissedDay(today);
        setPipelineCheckinVisible(false);
        setPipelineCheckinReasonPromptVisible(false);

        if (reason === 'deal_lost' && pipelineLostEncouragement) {
          Alert.alert('Keep going', pipelineLostEncouragement);
        }
        if (reason === 'deal_closed') {
          const closeDate = pipelineCloseDateInput.trim() || isoTodayLocal();
          const gci = pipelineCloseGciInput.trim() || '0';
          Alert.alert(
            'Close event logged',
            `Actual GCI close logged and pipeline counts updated (${closeDate}, GCI ${gci}).`
          );
        }
      } finally {
        setPipelineCheckinSubmitting(false);
      }
    },
    [
      persistPipelineCountsMetadata,
      pipelineCheckinAnchors.buyers,
      pipelineCheckinAnchors.listings,
      actualGciLogKpi,
      pipelineCheckinBuyers,
      pipelineCheckinListings,
      pipelineCloseDateInput,
      pipelineCloseGciInput,
      pipelineLostEncouragement,
      persistPipelineDismissedDay,
      sendLog,
    ]
  );

  const onSavePipelineCheckin = useCallback(() => {
    const prevListings = pipelineAnchorCounts.listings;
    const prevBuyers = pipelineAnchorCounts.buyers;
    const nextListings = Math.max(0, Math.round(pipelineCheckinListings));
    const nextBuyers = Math.max(0, Math.round(pipelineCheckinBuyers));
    const decreased: PipelineCheckinFieldKey[] = [];
    if (nextListings < prevListings) decreased.push('listings');
    if (nextBuyers < prevBuyers) decreased.push('buyers');

    setPipelineCheckinDecreaseFields(decreased);
    if (decreased.length > 0) {
      setPipelineCheckinReasonPromptVisible(true);
      setPipelineCheckinReason(null);
      setPipelineLostEncouragement('');
      return;
    }
    void finalizePipelineCheckinSave('correction');
  }, [finalizePipelineCheckinSave, pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings, pipelineCheckinBuyers, pipelineCheckinListings]);

  const onChoosePipelineDecreaseReason = useCallback(
    (reason: PipelineCheckinReason) => {
      setPipelineCheckinReason(reason);
      setPipelineCheckinReasonPromptVisible(false);
      if (reason === 'correction') {
        void finalizePipelineCheckinSave(reason);
        return;
      }
      if (reason === 'deal_lost') {
        const msg =
          PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[
            Math.floor(Math.random() * PIPELINE_LOST_ENCOURAGEMENT_MESSAGES.length)
          ] ?? PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[0];
        setPipelineLostEncouragement(msg);
      }
      if (reason === 'deal_closed' && !pipelineCloseDateInput.trim()) {
        setPipelineCloseDateInput(isoTodayLocal());
      }
    },
    [finalizePipelineCheckinSave, pipelineCloseDateInput]
  );

  const renderChallengeKpiSection = (
    type: 'PC' | 'GP' | 'VP',
    title: string,
    kpis: DashboardPayload['loggable_kpis']
  ) => {
    if (kpis.length === 0) return null;
    const locked = (type === 'GP' && !gpUnlocked) || (type === 'VP' && !vpUnlocked);
    const typeCountLabel = `${fmtNum(kpis.length)} KPI${kpis.length === 1 ? '' : 's'}`;
    const sectionSub =
      type === 'PC'
        ? 'Projection-driving actions for challenge pace.'
        : type === 'GP'
          ? 'Business growth behaviors connected to challenge progress.'
          : 'Vitality habits that support consistency and energy.';
    return (
      <View style={styles.challengeSectionCard}>
        <View style={styles.challengeSectionHeader}>
          <View style={styles.challengeSectionHeaderCopy}>
            <View style={styles.challengeSectionTitleRow}>
              <Text style={styles.challengeSectionTitle}>{title}</Text>
              <Text style={styles.challengeSectionCount}>{typeCountLabel}</Text>
            </View>
            <Text style={styles.challengeSectionSub}>{sectionSub}</Text>
          </View>
          <View style={[styles.challengeSectionTypePill, { backgroundColor: kpiTypeTint(type) }]}>
            <Text style={[styles.challengeSectionTypePillText, { color: kpiTypeAccent(type) }]}>{type}</Text>
          </View>
        </View>
        <View style={styles.challengeSectionDivider} />
        {locked ? (
          <View style={[styles.emptyPanel, styles.challengeLockedPanel]}>
            <Text style={styles.metaText}>
              {type === 'GP'
                ? `Business Growth unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 3)}/3 days or ${Math.min(payload?.activity.total_logs ?? 0, 20)}/20 logs`
                : `Vitality unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 7)}/7 days or ${Math.min(payload?.activity.total_logs ?? 0, 40)}/40 logs`}
            </Text>
          </View>
        ) : (
          <View style={[styles.gridWrap, styles.challengeGridWrap]}>
            {kpis.map((kpi) => {
              const successAnim = getKpiTileSuccessAnim(kpi.id);
              const successOpacity = successAnim.interpolate({
                inputRange: [0, 0.12, 1],
                outputRange: [0, 1, 0],
              });
              const successTranslateY = successAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -14],
              });
              const successScale = successAnim.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0.8, 1.02, 0.96],
              });
              return (
                <Pressable
                  key={`challenge-${type}-${kpi.id}`}
                  style={[styles.gridItem, styles.challengeGridItem, submitting && submittingKpiId === kpi.id && styles.disabled]}
                  onPress={() => void onTapQuickLog(kpi, { skipTapFeedback: true })}
                  disabled={submitting}
                  onPressIn={() => runKpiTilePressInFeedback(kpi, { surface: 'log' })}
                  onPressOut={() => runKpiTilePressOutFeedback(kpi.id)}
                >
                  <Animated.View
                    style={[
                      styles.gridTileAnimatedWrap,
                      styles.challengeGridTileAnimatedWrap,
                      { transform: [{ scale: getKpiTileScale(kpi.id) }] },
                    ]}
                  >
                    <View style={styles.gridCircleWrap}>
                      <View style={styles.challengeTilePlate} />
                      <View style={[styles.gridCircle, confirmedKpiTileIds[kpi.id] && styles.gridCircleConfirmed]}>
                        {renderKpiIcon(kpi)}
                      </View>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.gridSuccessBadge,
                          {
                            opacity: successOpacity,
                            transform: [{ translateY: successTranslateY }, { scale: successScale }],
                          },
                        ]}
                      >
                        <View style={styles.gridSuccessCoinOuter}>
                          <View style={styles.gridSuccessCoinInner} />
                          <View style={styles.gridSuccessCoinHighlight} />
                        </View>
                      </Animated.View>
                    </View>
                    <Text
                      style={[
                        styles.gridLabel,
                        styles.challengeGridLabel,
                        confirmedKpiTileIds[kpi.id] && styles.gridLabelConfirmed,
                      ]}
                    >
                      {kpi.name}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderParticipationFocusCard = (
    kind: 'challenge' | 'team',
    sourceKpis: DashboardPayload['loggable_kpis'],
    options: { title: string; sub: string }
  ) => {
    const focusKpis = dedupeKpisById(sourceKpis).slice(0, 3);
    const tone = kind === 'challenge'
      ? { pillBg: '#fff3d8', pillBorder: '#f0d898', pillText: '#8a6207', accentBg: '#fff8e8' }
      : { pillBg: '#e8f4ff', pillBorder: '#cde3fb', pillText: '#1d5fa8', accentBg: '#f5faff' };
    return (
      <View style={styles.participationFocusCard}>
        <View style={styles.participationFocusHeader}>
          <View>
            <Text style={styles.participationFocusTitle}>{options.title}</Text>
            <Text style={styles.participationFocusSub}>{options.sub}</Text>
          </View>
          <View style={[styles.participationFocusPill, { backgroundColor: tone.pillBg, borderColor: tone.pillBorder }]}>
            <Text style={[styles.participationFocusPillText, { color: tone.pillText }]}>
              {focusKpis.length > 0 ? `${focusKpis.length} focus` : 'Placeholder'}
            </Text>
          </View>
        </View>
        {focusKpis.length === 0 ? (
          <Text style={styles.participationFocusEmpty}>
            Focus actions will appear here when {kind === 'challenge' ? 'challenge' : 'team'} relevance is available.
          </Text>
        ) : (
          <View style={styles.participationFocusGrid}>
            {focusKpis.map((kpi) => (
              <Pressable
                key={`${kind}-focus-${kpi.id}`}
                style={[styles.participationFocusItem, { backgroundColor: tone.accentBg }]}
                onPress={() => void onTapQuickLog(kpi, { skipTapFeedback: true })}
                disabled={submitting}
                onPressIn={() => runKpiTilePressInFeedback(kpi, { surface: 'log' })}
                onPressOut={() => runKpiTilePressOutFeedback(kpi.id)}
              >
                <View style={styles.participationFocusItemTop}>
                  <View style={[styles.participationFocusIconWrap, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                    <View style={styles.participationFocusIconInner}>{renderKpiIcon(kpi)}</View>
                  </View>
                  <View style={[styles.participationFocusTypePill, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                    <Text style={[styles.participationFocusTypePillText, { color: kpiTypeAccent(kpi.type) }]}>{kpi.type}</Text>
                  </View>
                </View>
                <Text numberOfLines={2} style={styles.participationFocusItemName}>{kpi.name}</Text>
                <Text style={styles.participationFocusItemCta}>Tap to log</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const isHomeGameplaySurface = activeTab === 'home' && viewMode === 'home';
  const challengeListItems = useMemo(() => mapChallengesToFlowItems(challengeApiRows), [challengeApiRows]);
  const challengeHasSponsorSignal =
    Array.isArray(challengeApiRows) &&
    challengeApiRows.some(
      (row) =>
        Object.prototype.hasOwnProperty.call(row, 'sponsored_challenge_id') ||
        Object.prototype.hasOwnProperty.call(row, 'sponsor_id')
    );
  const challengeFilteredListItems = useMemo(
    () => challengeListItems.filter((item) => challengeListFilterMatches(item, challengeListFilter)),
    [challengeListItems, challengeListFilter]
  );
  const teamPersonaVariant = useMemo<'leader' | 'member'>(() => {
    const roleCandidates = [
      sessionUserMeta.team_role,
      sessionUserMeta.role,
      sessionAppMeta.team_role,
      sessionAppMeta.role,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .filter(Boolean);
    if (roleCandidates.some((r) => r.includes('lead') || r.includes('manager'))) return 'leader';
    if (roleCandidates.some((r) => r.includes('member'))) return 'member';
    // TEAM-MEMBER-PARITY-A default: prefer member preview when role is absent.
    return 'member';
  }, [sessionAppMeta.role, sessionAppMeta.team_role, sessionUserMeta.role, sessionUserMeta.team_role]);
  const runtimeRoleSignals = useMemo(() => {
    const rawValues: unknown[] = [
      sessionUserMeta.team_role,
      sessionUserMeta.role,
      sessionUserMeta.persona,
      sessionAppMeta.team_role,
      sessionAppMeta.role,
      sessionAppMeta.persona,
      Array.isArray(sessionUserMeta.roles) ? sessionUserMeta.roles.join(',') : null,
      Array.isArray(sessionAppMeta.roles) ? sessionAppMeta.roles.join(',') : null,
    ];
    return rawValues
      .flatMap((v) => String(v ?? '').toLowerCase().split(/[,\s|/]+/g))
      .map((v) => v.trim())
      .filter(Boolean);
  }, [
    sessionAppMeta.persona,
    sessionAppMeta.role,
    sessionAppMeta.roles,
    sessionAppMeta.team_role,
    sessionUserMeta.persona,
    sessionUserMeta.role,
    sessionUserMeta.roles,
    sessionUserMeta.team_role,
  ]);
  const isCoachRuntimeOperator = useMemo(
    () => runtimeRoleSignals.some((signal) => signal.includes('coach')),
    [runtimeRoleSignals]
  );
  const isChallengeSponsorRuntime = useMemo(
    () => runtimeRoleSignals.some((signal) => signal.includes('sponsor')),
    [runtimeRoleSignals]
  );
  const isTeamLeaderCreatorParticipant = useMemo(
    () => teamPersonaVariant === 'leader' || runtimeRoleSignals.some((signal) => signal.includes('lead') || signal.includes('manager')),
    [runtimeRoleSignals, teamPersonaVariant]
  );
  const challengeCreateAllowed = teamPersonaVariant === 'member' || isTeamLeaderCreatorParticipant;
  const challengeMemberListItems = useMemo(
    () =>
      challengeListItems.filter((item) =>
        challengeMemberListTab === 'all' ? true : item.bucket === 'completed'
      ),
    [challengeListItems, challengeMemberListTab]
  );
  const challengeSelected =
    challengeListItems.find((item) => item.id === challengeSelectedId) ?? challengeListItems[0];
  const challengeIsCompleted = challengeSelected?.bucket === 'completed';
  const challengeHasApiBackedDetail = isApiBackedChallenge(challengeSelected);
  const challengeIsPlaceholderOnly = !challengeHasApiBackedDetail;
  const challengeLeaderboardHasRealRows = (challengeSelected?.leaderboardPreview?.length ?? 0) > 0;
  const challengeCoachingPackageOutcome = pickRuntimePackageVisibility(
    normalizePackagingReadModelToVisibilityOutcome(challengeSelected?.raw?.packaging_read_model ?? null),
    challengeSelected?.raw?.package_visibility ?? null
  );
  const challengeCoachingGatePresentation = deriveCoachingPackageGatePresentation(
    'Challenge coaching and updates',
    challengeCoachingPackageOutcome
  );
  const challengeCoachingGateBlocksCtas =
    challengeCoachingGatePresentation.tone === 'gated' || challengeCoachingGatePresentation.tone === 'blocked';
  const fallbackChannelsNotificationRows = useMemo<RuntimeNotificationItem[]>(() => {
    if (channelsNotificationItems.length > 0) return channelsNotificationItems;
    const rows = Array.isArray(channelsApiRows) ? channelsApiRows : [];
    const unreadRows = rows
      .filter((row) => Math.max(0, Number(row.unread_count ?? 0)) > 0)
      .slice(0, 4);
    return unreadRows.map((row) => {
      const scope = normalizeChannelTypeToScope(row.type) ?? 'community';
      return {
        id: `fallback-channel-unread-${row.id}`,
        notification_class:
          scope === 'team'
            ? 'team_message_unread'
            : scope === 'challenge'
              ? 'challenge_message_unread'
              : scope === 'sponsor'
                ? 'sponsor_message_unread'
                : scope === 'cohort'
                  ? 'cohort_message_unread'
                  : 'message_unread',
        title: `${row.name}: ${Math.max(0, Number(row.unread_count ?? 0))} unread`,
        body: `Open ${row.name} to review recent ${String(row.type ?? 'channel')} messages.`,
        badge_label: Math.max(0, Number(row.unread_count ?? 0)) > 0 ? String(Math.max(0, Number(row.unread_count ?? 0))) : null,
        read_state: 'unread',
        severity: 'info',
        delivery_channels: ['in_app', 'badge', 'banner'],
        route_target: {
          screen: 'channel_thread',
          channel_id: String(row.id),
          channel_name: row.name,
          preferred_channel_scope: scope,
          preferred_channel_label: row.name,
        },
        source_family: 'channels_fallback',
      };
    });
  }, [channelsApiRows, channelsNotificationItems]);
  const fallbackCoachingProgressNotificationRows = useMemo<RuntimeNotificationItem[]>(() => {
    if (coachingProgressNotificationItems.length > 0) return coachingProgressNotificationItems;
    const progress = coachingProgressSummary;
    if (!progress) return [];
    const totalRows = Math.max(0, Number(progress.total_progress_rows ?? 0));
    const inProgress = Math.max(0, Number(progress.status_counts?.in_progress ?? 0));
    const notStarted = Math.max(0, Number(progress.status_counts?.not_started ?? 0));
    const pct = Math.max(0, Math.round(Number(progress.completion_percent ?? 0)));
    const rows: RuntimeNotificationItem[] = [];
    if (notStarted > 0) {
      rows.push({
        id: 'fallback-coaching-assignment',
        notification_class: 'coaching_assignment_available',
        title: `${notStarted} coaching item${notStarted === 1 ? '' : 's'} not started`,
        body: 'Open Coaching Journeys to view assigned lessons and next actions.',
        read_state: 'unread',
        severity: 'info',
        delivery_channels: ['in_app', 'banner'],
        route_target: { screen: 'coaching_journeys' },
        source_family: 'coaching_progress_fallback',
      });
    }
    if (inProgress > 0 || totalRows > 0) {
      rows.push({
        id: 'fallback-coaching-reminder',
        notification_class: 'coaching_progress_reminder',
        title: `Coaching progress ${pct}%`,
        body: inProgress > 0 ? `${inProgress} lesson(s) are in progress.` : 'Continue your coaching journey progress.',
        badge_label: `${pct}%`,
        read_state: inProgress > 0 ? 'unread' : 'unknown',
        severity: pct >= 100 ? 'success' : 'info',
        delivery_channels: ['in_app', 'badge'],
        route_target: { screen: 'coaching_journeys' },
        source_family: 'coaching_progress_fallback',
      });
    }
    return rows;
  }, [coachingProgressNotificationItems, coachingProgressSummary]);
  const aiApprovalNotificationRows = useMemo<RuntimeNotificationItem[]>(() => {
    const pendingCount = Math.max(0, Number(aiSuggestionQueueSummary?.by_status?.pending ?? 0));
    const rows: RuntimeNotificationItem[] = [];
    if (pendingCount > 0) {
      rows.push({
        id: 'ai-approval-queue-pending',
        notification_class: 'ai_approval_queue_pending_review',
        title: `${pendingCount} AI draft${pendingCount === 1 ? '' : 's'} pending approval review`,
        body: 'Approval-first queue visibility only. No autonomous send/publish occurs from this state.',
        badge_label: String(pendingCount),
        read_state: 'unread',
        severity: 'warning',
        delivery_channels: ['in_app', 'badge', 'banner'],
        route_target: { screen: 'inbox' },
        source_family: 'ai_suggestions',
      });
    }
    const recentPending = (aiSuggestionRows ?? [])
      .filter((row) => String(row.status ?? '').toLowerCase() === 'pending')
      .slice(0, 2);
    for (const row of recentPending) {
      rows.push({
        id: `ai-queued-${row.id}`,
        notification_class: 'ai_queue_status_update',
        title: 'AI suggestion queued for approval review',
        body:
          row.ai_queue_read_model?.target_scope_summary ??
          row.scope ??
          'Approval queue item visible. Human review remains required before any send/publish.',
        read_state: 'unknown',
        severity: 'info',
        delivery_channels: ['in_app'],
        route_target: { screen: 'inbox' },
        source_family: 'ai_suggestions',
        created_at: row.created_at ?? null,
      });
    }
    return rows;
  }, [aiSuggestionQueueSummary, aiSuggestionRows]);
  const challengeSurfaceNotificationRows = useMemo<RuntimeNotificationItem[]>(() => {
    const rows: RuntimeNotificationItem[] = [];
    const channelRows = fallbackChannelsNotificationRows.filter((row) => {
      const cls = row.notification_class.toLowerCase();
      return cls.includes('challenge') || cls.includes('sponsor');
    });
    rows.push(...channelRows.slice(0, 2));
    if (challengeHasSponsorSignal) {
      rows.push({
        id: `challenge-sponsor-coaching-${challengeSelected?.id ?? 'current'}`,
        notification_class: 'sponsor_coaching_linked',
        title: 'Sponsor coaching updates available',
        body: 'Sponsor-linked challenge coaching routing is available from this challenge surface.',
        read_state: 'unknown',
        severity: 'info',
        delivery_channels: ['in_app', 'banner'],
        route_target: {
          screen: 'channel_thread',
          preferred_channel_scope: 'sponsor',
          preferred_channel_label: 'Sponsor / Challenge Updates',
          challenge_id: challengeSelected?.id ?? null,
          challenge_title: challengeSelected?.title ?? null,
        },
        source_family: 'challenge_surface_fallback',
      });
    }
    if (challengeCoachingGatePresentation.tone === 'gated' || challengeCoachingGatePresentation.tone === 'blocked') {
      rows.push({
        id: `challenge-access-change-${challengeSelected?.id ?? 'current'}`,
        notification_class: 'coaching_access_change',
        title: 'Challenge coaching access changed',
        body: challengeCoachingGatePresentation.summary,
        read_state: 'unread',
        severity: challengeCoachingGatePresentation.tone === 'blocked' ? 'error' : 'warning',
        delivery_channels: ['in_app', 'banner'],
        route_target: { screen: 'coaching_journeys' },
        source_family: 'challenge_surface_gate',
      });
    }
    return rows.slice(0, 3);
  }, [
    challengeCoachingGatePresentation.summary,
    challengeCoachingGatePresentation.tone,
    challengeHasSponsorSignal,
    challengeSelected?.id,
    challengeSelected?.title,
    fallbackChannelsNotificationRows,
  ]);
  const homeNotificationRows = useMemo(
    () => [...fallbackCoachingProgressNotificationRows, ...aiApprovalNotificationRows, ...fallbackChannelsNotificationRows].slice(0, 3),
    [aiApprovalNotificationRows, fallbackChannelsNotificationRows, fallbackCoachingProgressNotificationRows]
  );
  const teamNotificationRows = useMemo(
    () =>
      [
        ...fallbackChannelsNotificationRows.filter((row) => row.notification_class.toLowerCase().includes('team')),
        ...fallbackCoachingProgressNotificationRows,
        ...aiApprovalNotificationRows,
      ].slice(0, 3),
    [aiApprovalNotificationRows, fallbackChannelsNotificationRows, fallbackCoachingProgressNotificationRows]
  );
  const journeysNotificationRows = useMemo(
    () => [...coachingJourneysNotificationItems, ...fallbackCoachingProgressNotificationRows].slice(0, 4),
    [coachingJourneysNotificationItems, fallbackCoachingProgressNotificationRows]
  );
  const journeysNotificationSummaryEffective = useMemo(
    () =>
      coachingJourneysNotificationSummary ??
      coachingProgressNotificationSummary ??
      summarizeNotificationRows(journeysNotificationRows, { sourceLabel: 'coaching_journeys:effective' }),
    [coachingJourneysNotificationSummary, coachingProgressNotificationSummary, journeysNotificationRows]
  );
  const inboxNotificationRows = useMemo(
    () =>
      [
        ...fallbackChannelsNotificationRows,
        ...fallbackCoachingProgressNotificationRows,
        ...coachingJourneysNotificationItems,
        ...aiApprovalNotificationRows,
      ].slice(0, 6),
    [aiApprovalNotificationRows, coachingJourneysNotificationItems, fallbackChannelsNotificationRows, fallbackCoachingProgressNotificationRows]
  );
  const inboxNotificationSummaryEffective = useMemo(
    () =>
      channelsNotificationSummary ??
      coachingProgressNotificationSummary ??
      summarizeNotificationRows(inboxNotificationRows, { sourceLabel: 'inbox:effective' }),
    [channelsNotificationSummary, coachingProgressNotificationSummary, inboxNotificationRows]
  );
  const cohortChannelContextCount = useMemo(
    () =>
      (Array.isArray(channelsApiRows) ? channelsApiRows : []).filter(
        (row) => normalizeChannelTypeToScope(row.type) === 'cohort'
      ).length,
    [channelsApiRows]
  );
  const sponsorVisibilitySignalsPresent = useMemo(() => {
    const packageType = String(challengeCoachingPackageOutcome?.package_type ?? '').toLowerCase();
    return isChallengeSponsorRuntime || challengeHasSponsorSignal || packageType.includes('sponsored');
  }, [challengeCoachingPackageOutcome?.package_type, challengeHasSponsorSignal, isChallengeSponsorRuntime]);
  const runtimeCoachSponsorVisibilityRows = useMemo<RuntimeNotificationItem[]>(() => {
    const rows: RuntimeNotificationItem[] = [];
    if (isCoachRuntimeOperator) {
      rows.push({
        id: 'w7-coach-runtime-operator',
        notification_class: 'coach_runtime_operator',
        title: 'Coach runtime operator visibility enabled',
        body:
          cohortChannelContextCount > 0
            ? `Coach can operate on host surfaces/channels with ${cohortChannelContextCount} cohort context channel(s).`
            : 'Coach can operate on host surfaces/channels using current team/challenge/sponsor context signals.',
        read_state: 'unknown',
        severity: 'info',
        delivery_channels: ['in_app', 'badge', 'banner'],
        route_target: {
          screen: 'inbox_channels',
          preferred_channel_scope: cohortChannelContextCount > 0 ? 'cohort' : 'team',
          preferred_channel_label: cohortChannelContextCount > 0 ? 'Cohort Updates' : 'Team Updates',
        },
        source_family: 'w7_runtime_visibility',
      });
    }
    if (sponsorVisibilitySignalsPresent) {
      rows.push({
        id: 'w7-challenge-sponsor-visibility',
        notification_class: 'challenge_sponsor_runtime_visibility',
        title: 'Challenge Sponsor scoped runtime visibility',
        body:
          'Sponsor-scoped coaching visibility is active on challenge/coaching channels. Sponsor persona remains no-KPI-logging.',
        read_state: 'unknown',
        severity: 'info',
        delivery_channels: ['in_app', 'banner'],
        route_target: {
          screen: 'channel_thread',
          preferred_channel_scope: 'sponsor',
          preferred_channel_label: 'Sponsor Updates',
        },
        source_family: 'w7_runtime_visibility',
      });
    }
    if (isTeamLeaderCreatorParticipant) {
      rows.push({
        id: 'w7-team-leader-creator-participant',
        notification_class: 'team_leader_creator_participant',
        title: 'Team Leader creator + participant behavior active',
        body:
          'Team Leaders can create challenge/coaching flows and remain participants in the same runtime coaching surfaces.',
        read_state: 'unknown',
        severity: 'success',
        delivery_channels: ['in_app', 'banner'],
        route_target: {
          screen: 'challenge_details',
          challenge_id: challengeSelected?.id ?? null,
          challenge_title: challengeSelected?.title ?? null,
        },
        source_family: 'w7_runtime_visibility',
      });
    }
    if (cohortChannelContextCount > 0) {
      rows.push({
        id: 'w7-cohort-channel-context',
        notification_class: 'cohort_channel_context',
        title: `${cohortChannelContextCount} cohort channel context${cohortChannelContextCount === 1 ? '' : 's'} available`,
        body: 'Cohort channels are available for non-team individual coaching/comms routing.',
        read_state: 'unread',
        severity: 'info',
        delivery_channels: ['in_app', 'badge', 'banner'],
        route_target: {
          screen: 'inbox_channels',
          preferred_channel_scope: 'cohort',
          preferred_channel_label: 'Cohort Updates',
        },
        source_family: 'w7_runtime_visibility',
      });
    }
    return rows;
  }, [
    challengeSelected?.id,
    challengeSelected?.title,
    cohortChannelContextCount,
    isCoachRuntimeOperator,
    isTeamLeaderCreatorParticipant,
    sponsorVisibilitySignalsPresent,
  ]);
  const homeRuntimeVisibilityRows = useMemo(
    () => runtimeCoachSponsorVisibilityRows.slice(0, 2),
    [runtimeCoachSponsorVisibilityRows]
  );
  const teamRuntimeVisibilityRows = useMemo(
    () =>
      runtimeCoachSponsorVisibilityRows
        .filter((row) => row.notification_class !== 'challenge_sponsor_runtime_visibility' || sponsorVisibilitySignalsPresent)
        .slice(0, 3),
    [runtimeCoachSponsorVisibilityRows, sponsorVisibilitySignalsPresent]
  );
  const challengeRuntimeVisibilityRows = useMemo(
    () =>
      runtimeCoachSponsorVisibilityRows.filter(
        (row) =>
          row.notification_class === 'challenge_sponsor_runtime_visibility' ||
          row.notification_class === 'team_leader_creator_participant'
      ),
    [runtimeCoachSponsorVisibilityRows]
  );
  const journeysRuntimeVisibilityRows = useMemo(
    () =>
      runtimeCoachSponsorVisibilityRows.filter(
        (row) =>
          row.notification_class === 'coach_runtime_operator' ||
          row.notification_class === 'cohort_channel_context' ||
          row.notification_class === 'challenge_sponsor_runtime_visibility'
      ),
    [runtimeCoachSponsorVisibilityRows]
  );
  const inboxRuntimeVisibilityRows = useMemo(
    () =>
      runtimeCoachSponsorVisibilityRows.filter(
        (row) =>
          row.notification_class === 'cohort_channel_context' ||
          row.notification_class === 'coach_runtime_operator' ||
          row.notification_class === 'challenge_sponsor_runtime_visibility'
      ),
    [runtimeCoachSponsorVisibilityRows]
  );
  const homeRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Home',
        hasRows: homeNotificationRows.length > 0 || homeRuntimeVisibilityRows.length > 0,
        readModelStatus: coachingProgressNotificationSummary?.read_model_status ?? null,
      }),
    [coachingProgressNotificationSummary?.read_model_status, homeNotificationRows.length, homeRuntimeVisibilityRows.length]
  );
  const teamRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Team',
        hasRows: teamNotificationRows.length > 0 || teamRuntimeVisibilityRows.length > 0,
        readModelStatus:
          channelsNotificationSummary?.read_model_status ??
          coachingProgressNotificationSummary?.read_model_status ??
          null,
      }),
    [
      channelsNotificationSummary?.read_model_status,
      coachingProgressNotificationSummary?.read_model_status,
      teamNotificationRows.length,
      teamRuntimeVisibilityRows.length,
    ]
  );
  const challengeRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Challenge',
        hasRows: challengeSurfaceNotificationRows.length > 0 || challengeRuntimeVisibilityRows.length > 0,
        gateTone: challengeCoachingGatePresentation.tone,
        readModelStatus:
          challengeCoachingPackageOutcome?.read_model_status ??
          channelsNotificationSummary?.read_model_status ??
          null,
      }),
    [
      challengeCoachingGatePresentation.tone,
      challengeCoachingPackageOutcome?.read_model_status,
      challengeRuntimeVisibilityRows.length,
      challengeSurfaceNotificationRows.length,
      channelsNotificationSummary?.read_model_status,
    ]
  );
  const journeysRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Journeys',
        loading: coachingJourneysLoading || coachingProgressLoading,
        errorText: coachingJourneysError ?? coachingProgressError,
        hasRows: journeysNotificationRows.length > 0 || journeysRuntimeVisibilityRows.length > 0,
        gateTone:
          coachingJourneysPackageVisibility?.entitlement_result &&
          String(coachingJourneysPackageVisibility.entitlement_result).startsWith('blocked')
            ? 'blocked'
            : null,
        readModelStatus: journeysNotificationSummaryEffective?.read_model_status ?? null,
      }),
    [
      coachingJourneysError,
      coachingJourneysLoading,
      coachingJourneysPackageVisibility?.entitlement_result,
      coachingProgressError,
      coachingProgressLoading,
      journeysNotificationRows.length,
      journeysNotificationSummaryEffective?.read_model_status,
      journeysRuntimeVisibilityRows.length,
    ]
  );
  const inboxRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Inbox',
        loading: channelsLoading,
        errorText: channelsError,
        hasRows: inboxNotificationRows.length > 0 || inboxRuntimeVisibilityRows.length > 0,
        readModelStatus: inboxNotificationSummaryEffective?.read_model_status ?? null,
      }),
    [
      channelsError,
      channelsLoading,
      inboxNotificationRows.length,
      inboxNotificationSummaryEffective?.read_model_status,
      inboxRuntimeVisibilityRows.length,
    ]
  );
  const channelThreadRuntimeStateModel = useMemo(
    () =>
      deriveRuntimeSurfaceStateModel({
        surfaceLabel: 'Channel Thread',
        loading: channelMessagesLoading,
        errorText: channelMessagesError,
        hasRows: channelThreadNotificationItems.length > 0,
        gateTone:
          channelThreadPackageVisibility?.entitlement_result &&
          String(channelThreadPackageVisibility.entitlement_result).startsWith('blocked')
            ? 'blocked'
            : null,
        readModelStatus: channelThreadNotificationSummary?.read_model_status ?? null,
      }),
    [
      channelMessagesError,
      channelMessagesLoading,
      channelThreadNotificationItems.length,
      channelThreadNotificationSummary?.read_model_status,
      channelThreadPackageVisibility?.entitlement_result,
    ]
  );
  const challengeDaysLeft =
    challengeSelected?.bucket === 'active' && challengeSelected?.endAtIso
      ? Math.max(0, Math.ceil((new Date(challengeSelected.endAtIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;
  const challengeLeaderboardPreview = (challengeSelected?.leaderboardPreview ?? []) as ChallengeFlowLeaderboardEntry[];
  const challengeLeaderboardRowsForScreen = useMemo(() => {
    if ((challengeSelected?.leaderboardPreview?.length ?? 0) > 0) return challengeSelected.leaderboardPreview;
    return [] as ChallengeFlowLeaderboardEntry[];
  }, [challengeSelected]);
  const challengeLeaderboardHasLowEntry = challengeLeaderboardRowsForScreen.length > 0 && challengeLeaderboardRowsForScreen.length < 3;
  const challengeListUsingPlaceholderRows = !Array.isArray(challengeApiRows) || challengeApiRows.length === 0;
  const challengeDetailsSurfaceLabel =
    teamPersonaVariant === 'member'
      ? challengeIsCompleted
        ? 'Challenge Results'
        : 'Challenge Details'
      : challengeIsCompleted
        ? 'Challenge Results'
        : 'Challenge Details';
  const challengeMembershipStateLabel = challengeIsCompleted
    ? challengeSelected?.joined
      ? 'Completed participation'
      : 'Challenge completed'
    : challengeSelected?.joined
      ? 'Joined challenge'
      : challengeSelected?.bucket === 'upcoming'
        ? 'Not joined yet'
        : 'Not joined';
  const challengeDetailsSummaryTitle = challengeSelected?.joined ? 'Your participation' : 'Participation status';
  const challengeDetailsSummaryMetricValue = challengeSelected?.joined
    ? `${Math.max(0, challengeSelected?.progressPct ?? 0)}%`
    : `${Math.max(0, challengeSelected?.participants ?? 0)}`;
  const challengeDetailsSummaryMetricLabel = challengeSelected?.joined ? 'progress' : 'participants';
  const challengeDetailsSummaryStatus = challengeSelected?.joined
    ? challengeIsCompleted
      ? 'Your tracked participation is complete.'
      : challengeSelected?.bucket === 'upcoming'
        ? 'You are joined. Progress starts when the challenge begins.'
        : 'Your progress updates as you log qualifying activity.'
    : challengeIsCompleted
      ? 'You did not join this completed challenge.'
      : challengeIsPlaceholderOnly
        ? 'Placeholder challenge preview only. Join is available on live challenge rows.'
        : challengeSelected?.bucket === 'upcoming'
          ? 'Join now to be ready when this challenge starts.'
        : 'Join to track progress and appear on the leaderboard.';
  const challengeMemberResultsRequiresUpgrade =
    teamPersonaVariant === 'member' && challengeIsCompleted && !challengeSelected?.joined;
  const openCoachingShell = useCallback((screen: CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => {
    setCoachingShellScreen(screen);
    if (contextPatch) {
      setCoachingShellContext((prev) => ({
        ...prev,
        ...contextPatch,
      }));
    }
    setActiveTab('comms');
    setViewMode('log');
  }, []);

  const openCoachingNotificationTarget = useCallback(
    (item: RuntimeNotificationItem) => {
      const route = item.route_target ?? null;
      const screenRaw = String(route?.screen ?? '').toLowerCase();
      const preferredScopeRaw = String(route?.preferred_channel_scope ?? '').toLowerCase();
      const preferredScope: CoachingChannelScope | null =
        preferredScopeRaw === 'team' ||
        preferredScopeRaw === 'challenge' ||
        preferredScopeRaw === 'sponsor' ||
        preferredScopeRaw === 'cohort' ||
        preferredScopeRaw === 'community'
          ? preferredScopeRaw
          : null;
      if (screenRaw === 'challenge_details') {
        if (route?.challenge_id) setChallengeSelectedId(String(route.challenge_id));
        setActiveTab('challenge');
        setViewMode('log');
        setChallengeFlowScreen('details');
        return;
      }
      if (screenRaw === 'channel_thread') {
        if (route?.channel_id) {
          setSelectedChannelId(String(route.channel_id));
        }
        if (route?.channel_name) {
          setSelectedChannelName(String(route.channel_name));
        }
        openCoachingShell('channel_thread', {
          preferredChannelScope: preferredScope,
          preferredChannelLabel: route?.preferred_channel_label ?? route?.channel_name ?? null,
          threadTitle: route?.channel_name ?? route?.preferred_channel_label ?? coachingShellContext.threadTitle,
          threadSub:
            item.body ??
            'Notification-linked channel thread route. Display action only; send/write remains explicit human action.',
          broadcastAudienceLabel: preferredScope === 'team' ? route?.preferred_channel_label ?? route?.channel_name ?? null : null,
          broadcastRoleAllowed: preferredScope === 'team' ? coachingShellContext.broadcastRoleAllowed : false,
        });
        return;
      }
      if (screenRaw === 'coaching_journey_detail' || route?.journey_id) {
        openCoachingShell('coaching_journey_detail', {
          selectedJourneyId: route?.journey_id ?? null,
          selectedJourneyTitle: route?.journey_title ?? null,
          selectedLessonId: route?.lesson_id ?? null,
          selectedLessonTitle: route?.lesson_title ?? null,
        });
        return;
      }
      if (screenRaw === 'coaching_lesson_detail' || route?.lesson_id) {
        openCoachingShell('coaching_lesson_detail', {
          selectedJourneyId: route?.journey_id ?? coachingShellContext.selectedJourneyId,
          selectedJourneyTitle: route?.journey_title ?? coachingShellContext.selectedJourneyTitle,
          selectedLessonId: route?.lesson_id ?? null,
          selectedLessonTitle: route?.lesson_title ?? null,
        });
        return;
      }
      if (screenRaw === 'inbox_channels') {
        openCoachingShell('inbox_channels', {
          preferredChannelScope: preferredScope,
          preferredChannelLabel: route?.preferred_channel_label ?? null,
        });
        return;
      }
      if (screenRaw === 'coaching_journeys') {
        openCoachingShell('coaching_journeys');
        return;
      }
      openCoachingShell('inbox');
    },
    [
      coachingShellContext.broadcastRoleAllowed,
      coachingShellContext.selectedJourneyId,
      coachingShellContext.selectedJourneyTitle,
      coachingShellContext.threadTitle,
      openCoachingShell,
    ]
  );

  const renderCoachingNotificationSurface = useCallback(
    (
      title: string,
      items: RuntimeNotificationItem[],
      summary?: RuntimeNotificationSummaryReadModel | null,
      opts?: { compact?: boolean; maxRows?: number; mode?: 'banner' | 'list' | 'thread'; emptyHint?: string }
    ) => {
      const visibleRows = items.slice(0, Math.max(1, opts?.maxRows ?? (opts?.compact ? 2 : 4)));
      if (visibleRows.length === 0 && !summary) return null;
      const unreadCount = Math.max(0, Number(summary?.unread_count ?? 0));
      const badgeLabel = summary?.badge_label ?? (unreadCount > 0 ? String(unreadCount) : null);
      return (
        <View
          style={[
            styles.coachingNotificationCard,
            opts?.compact ? styles.coachingNotificationCardCompact : null,
            opts?.mode === 'thread' ? styles.coachingNotificationCardThread : null,
          ]}
        >
          <View style={styles.coachingNotificationHeaderRow}>
            <Text style={styles.coachingNotificationTitle}>{title}</Text>
            <View style={styles.coachingNotificationHeaderMetaRow}>
              {badgeLabel ? (
                <View style={styles.coachingNotificationCountBadge}>
                  <Text style={styles.coachingNotificationCountBadgeText}>{badgeLabel}</Text>
                </View>
              ) : null}
              <Text style={styles.coachingNotificationHeaderLabel}>in-app</Text>
              {unreadCount > 0 ? <Text style={styles.coachingNotificationHeaderUnread}>{unreadCount} unread</Text> : null}
            </View>
          </View>
          {visibleRows.length === 0 ? (
            <Text style={styles.coachingNotificationEmptyText}>{opts?.emptyHint ?? 'No notification rows available.'}</Text>
          ) : (
            <View style={styles.coachingNotificationRowsWrap}>
              {visibleRows.map((item, idx) => {
                const severity = String(item.severity ?? 'info').toLowerCase();
                const isUnread = String(item.read_state ?? 'unknown').toLowerCase() !== 'read';
                const toneStyle =
                  severity === 'warning'
                    ? styles.coachingNotificationRowWarning
                    : severity === 'error'
                      ? styles.coachingNotificationRowError
                      : severity === 'success'
                        ? styles.coachingNotificationRowSuccess
                        : styles.coachingNotificationRowInfo;
                const hasRoute =
                  Boolean(item.route_target?.screen) ||
                  Boolean(item.route_target?.channel_id) ||
                  Boolean(item.route_target?.journey_id) ||
                  Boolean(item.route_target?.lesson_id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.coachingNotificationRow,
                      toneStyle,
                      idx > 0 ? styles.coachingNotificationRowDivider : null,
                      !hasRoute ? styles.coachingNotificationRowDisabled : null,
                    ]}
                    disabled={!hasRoute}
                    onPress={() => {
                      if (!hasRoute) return;
                      openCoachingNotificationTarget(item);
                    }}
                  >
                    <View style={styles.coachingNotificationRowDotWrap}>
                      <View style={[styles.coachingNotificationRowDot, isUnread ? styles.coachingNotificationRowDotUnread : null]} />
                    </View>
                    <View style={styles.coachingNotificationRowCopy}>
                      <View style={styles.coachingNotificationRowTitleLine}>
                        <Text numberOfLines={1} style={styles.coachingNotificationRowTitle}>{item.title}</Text>
                        {item.badge_label ? (
                          <View style={styles.coachingNotificationInlineBadge}>
                            <Text style={styles.coachingNotificationInlineBadgeText}>{item.badge_label}</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.body ? <Text numberOfLines={2} style={styles.coachingNotificationRowBody}>{item.body}</Text> : null}
                      <View style={styles.coachingNotificationRowMetaLine}>
                        <Text style={styles.coachingNotificationRowClass}>{item.notification_class.replace(/_/g, ' ')}</Text>
                        <Text style={styles.coachingNotificationRowMetaSep}>•</Text>
                        <Text style={styles.coachingNotificationRowChannels}>
                          {(item.delivery_channels ?? ['in_app']).slice(0, 3).join(', ')}
                        </Text>
                        {hasRoute ? (
                          <>
                            <Text style={styles.coachingNotificationRowMetaSep}>•</Text>
                            <Text style={styles.coachingNotificationRowLink}>Open</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    },
    [openCoachingNotificationTarget]
  );

  const renderRuntimeStateBanner = useCallback((model: RuntimeSurfaceStateModel, opts?: { compact?: boolean }) => {
    const toneStyle =
      model.state === 'ready'
        ? styles.runtimeStateBannerReady
        : model.state === 'loading'
          ? styles.runtimeStateBannerLoading
          : model.state === 'empty'
            ? styles.runtimeStateBannerEmpty
            : model.state === 'permission_denied'
              ? styles.runtimeStateBannerDenied
              : model.state === 'partial_read_model'
                ? styles.runtimeStateBannerPartial
                : styles.runtimeStateBannerError;
    return (
      <View style={[styles.runtimeStateBanner, toneStyle, opts?.compact ? styles.runtimeStateBannerCompact : null]}>
        <View style={styles.runtimeStateBannerTopRow}>
          <Text style={styles.runtimeStateBannerTitle}>{opts?.compact ? model.state.replace(/_/g, ' ') : model.title}</Text>
          <Text style={styles.runtimeStateBannerStateText}>{model.state.replace(/_/g, ' ')}</Text>
        </View>
        <Text style={styles.runtimeStateBannerDetail}>{model.detail}</Text>
        {!opts?.compact ? <Text style={styles.runtimeStateBannerTransition}>{model.transitionHint}</Text> : null}
      </View>
    );
  }, []);

  const renderKnownLimitedDataChip = useCallback((label: string) => {
    return (
      <View style={styles.knownLimitedDataChip}>
        <Text style={styles.knownLimitedDataChipText}>Limited data: {label}</Text>
      </View>
    );
  }, []);

  const renderCoachingPackageGateBanner = useCallback(
    (
      surfaceLabel: string,
      outcome?: RuntimePackageVisibilityOutcome | null,
      opts?: { compact?: boolean }
    ) => {
      const presentation = deriveCoachingPackageGatePresentation(surfaceLabel, outcome);
      const toneStyle =
        presentation.tone === 'available'
          ? styles.coachingGateBannerAvailable
          : presentation.tone === 'gated'
            ? styles.coachingGateBannerGated
            : presentation.tone === 'blocked'
              ? styles.coachingGateBannerBlocked
              : styles.coachingGateBannerFallback;
      return (
        <View style={[styles.coachingGateBanner, toneStyle, opts?.compact ? styles.coachingGateBannerCompact : null]}>
          <View style={styles.coachingGateBannerTopRow}>
            <Text style={styles.coachingGateBannerTitle}>{opts?.compact ? presentation.tone : presentation.title}</Text>
            <Text style={styles.coachingGateBannerToneText}>{presentation.tone}</Text>
          </View>
          <Text style={styles.coachingGateBannerSummary}>{presentation.summary}</Text>
          {!opts?.compact && presentation.detail ? <Text style={styles.coachingGateBannerDetail}>{presentation.detail}</Text> : null}
          {!opts?.compact && presentation.policyNote ? <Text style={styles.coachingGateBannerPolicy}>{presentation.policyNote}</Text> : null}
        </View>
      );
    },
    []
  );

  const openAiAssistShell = useCallback(
    (ctx: AIAssistShellContext, seed?: { prompt?: string | null; draft?: string | null }) => {
      setAiAssistContext(ctx);
      setAiAssistPrompt(String(seed?.prompt ?? '').trim());
      setAiAssistDraftText(String(seed?.draft ?? '').trim());
      setAiAssistNotice(null);
      setAiSuggestionQueueError(null);
      setAiSuggestionQueueSuccess(null);
      setAiAssistGenerating(false);
      setAiAssistVisible(true);
    },
    []
  );

  const generateAiAssistDraft = useCallback(() => {
    if (!aiAssistContext) return;
    const prompt = aiAssistPrompt.trim();
    setAiAssistGenerating(true);
    const hostLabel = aiAssistContext.targetLabel;
    const host = aiAssistContext.host;
    const generated = [
      host === 'coach_broadcast_compose'
        ? `Team update draft for ${hostLabel}:`
        : host === 'channel_thread'
          ? `Reply draft for ${hostLabel}:`
          : host === 'coaching_lesson_detail'
            ? `Lesson reflection prompt draft for ${hostLabel}:`
            : `Coaching suggestion draft for ${hostLabel}:`,
      prompt ? `Focus: ${prompt}` : 'Focus: Clarify the next best action and keep the tone supportive.',
      host === 'coach_broadcast_compose'
        ? 'Draft (human review required): Team, here is the suggested update. Please review and edit before sending.'
        : 'Draft (human review required): Here is a suggested coaching/support message. Please edit before using.',
    ].join('\n');
    setAiAssistDraftText(generated);
    setAiAssistNotice('AI draft shell generated locally for review. No request was sent and no content was published.');
    setAiAssistGenerating(false);
  }, [aiAssistContext, aiAssistPrompt]);

  const applyAiAssistDraftToHumanInput = useCallback(() => {
    const ctx = aiAssistContext;
    const text = aiAssistDraftText.trim();
    if (!ctx || !text) {
      setAiAssistNotice('Add or generate a draft first.');
      return;
    }
    if (ctx.host === 'channel_thread') {
      setChannelMessageDraft(text);
      setAiAssistNotice('Draft inserted into the message composer. Human send is still required.');
      return;
    }
    if (ctx.host === 'coach_broadcast_compose') {
      setBroadcastDraft(text);
      setAiAssistNotice('Draft inserted into the broadcast composer. Human send is still required.');
      return;
    }
    setAiAssistNotice('Draft is ready for manual review/copy. No send/publish action is available from AI assist.');
  }, [aiAssistContext, aiAssistDraftText]);

  const buildAiSuggestionScopeForCurrentContext = useCallback(
    (ctx: AIAssistShellContext) => {
      const intent = aiAssistIntentForHost(ctx.host);
      const segments = [
        'w5_mobile_ai_assist',
        `host:${ctx.host}`,
        `intent:${intent}`,
        `source:${coachingShellContext.source}`,
      ];
      if (selectedChannelId) segments.push(`channel_id:${selectedChannelId}`);
      if (selectedChannelName) segments.push(`channel_name:${selectedChannelName.replace(/[:|]/g, '_')}`);
      if (coachingShellContext.selectedJourneyId) segments.push(`journey_id:${coachingShellContext.selectedJourneyId}`);
      if (coachingShellContext.selectedLessonId) segments.push(`lesson_id:${coachingShellContext.selectedLessonId}`);
      if (challengeSelectedId) segments.push(`challenge_id:${challengeSelectedId}`);
      if (teamFlowScreen) segments.push(`team_screen:${teamFlowScreen}`);
      if (coachingShellContext.preferredChannelScope) segments.push(`channel_scope:${coachingShellContext.preferredChannelScope}`);
      return segments.join('|');
    },
    [
      challengeSelectedId,
      coachingShellContext.preferredChannelScope,
      coachingShellContext.selectedJourneyId,
      coachingShellContext.selectedLessonId,
      coachingShellContext.source,
      selectedChannelId,
      selectedChannelName,
      teamFlowScreen,
    ]
  );

  const fetchAiSuggestions = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setAiSuggestionRows(null);
      setAiSuggestionQueueSummary(null);
      setAiSuggestionListError('Sign in is required to load AI suggestion queue status.');
      return;
    }
    setAiSuggestionListLoading(true);
    setAiSuggestionListError(null);
    try {
      const response = await fetch(`${API_URL}/api/ai/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as AiSuggestionsListResponse;
      if (!response.ok) {
        setAiSuggestionRows(null);
        setAiSuggestionQueueSummary(null);
        setAiSuggestionListError(String(body.error ?? `AI suggestions request failed (${response.status})`));
        return;
      }
      setAiSuggestionRows(Array.isArray(body.suggestions) ? body.suggestions : []);
      setAiSuggestionQueueSummary(body.queue_summary ?? null);
    } catch (err) {
      setAiSuggestionRows(null);
      setAiSuggestionQueueSummary(null);
      setAiSuggestionListError(err instanceof Error ? err.message : 'AI suggestions request failed');
    } finally {
      setAiSuggestionListLoading(false);
    }
  }, [session?.access_token]);

  const queueAiSuggestionForApproval = useCallback(async () => {
    const token = session?.access_token;
    const ctx = aiAssistContext;
    const proposedMessage = aiAssistDraftText.trim();
    if (!token) {
      setAiSuggestionQueueError('Sign in is required to queue AI suggestions.');
      setAiSuggestionQueueSuccess(null);
      return;
    }
    if (!ctx) {
      setAiSuggestionQueueError('AI assist context is missing.');
      setAiSuggestionQueueSuccess(null);
      return;
    }
    if (!proposedMessage) {
      setAiSuggestionQueueError('Generate or enter a draft before queueing for approval.');
      setAiSuggestionQueueSuccess(null);
      return;
    }
    setAiSuggestionQueueSubmitting(true);
    setAiSuggestionQueueError(null);
    setAiSuggestionQueueSuccess(null);
    try {
      const payload = {
        scope: buildAiSuggestionScopeForCurrentContext(ctx),
        proposed_message: proposedMessage,
      };
      const response = await fetch(`${API_URL}/api/ai/suggestions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as AiSuggestionCreateResponse;
      if (!response.ok) {
        setAiSuggestionQueueError(String(body.error ?? `Queue request failed (${response.status})`));
        return;
      }
      const queued = body.suggestion ?? null;
      const queueStatus = queued?.ai_queue_read_model?.approval_queue?.queue_status ?? queued?.status ?? 'pending';
      setAiSuggestionQueueSuccess(
        `Queued for approval review (${String(queueStatus).replace(/_/g, ' ')}). No send/publish occurred; human approval remains required.`
      );
      setAiAssistNotice('AI suggestion queued for approval review. Human send/publish still uses existing explicit actions only.');
      await fetchAiSuggestions();
    } catch (err) {
      setAiSuggestionQueueError(err instanceof Error ? err.message : 'Queue request failed');
    } finally {
      setAiSuggestionQueueSubmitting(false);
    }
  }, [aiAssistContext, aiAssistDraftText, buildAiSuggestionScopeForCurrentContext, fetchAiSuggestions, session?.access_token]);

  useEffect(() => {
    if (!aiAssistVisible) return;
    void fetchAiSuggestions();
  }, [aiAssistVisible, fetchAiSuggestions]);

  const fetchCoachingJourneys = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setCoachingJourneysError('Sign in is required to view coaching journeys.');
      setCoachingJourneys([]);
      setCoachingJourneysPackageVisibility(null);
      setCoachingJourneysNotificationItems([]);
      setCoachingJourneysNotificationSummary(null);
      return;
    }
    setCoachingJourneysLoading(true);
    setCoachingJourneysError(null);
    try {
      const response = await fetch(`${API_URL}/api/coaching/journeys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as CoachingJourneyListResponse;
      if (!response.ok) {
        setCoachingJourneysError(
          response.status === 403
            ? 'Permission denied for coaching journeys in this scope (403).'
            : String(body.error ?? `Journeys request failed (${response.status})`)
        );
        setCoachingJourneys([]);
        setCoachingJourneysPackageVisibility(
          pickRuntimePackageVisibility(
            normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
            body.package_visibility ?? null
          )
        );
        setCoachingJourneysNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys'));
        setCoachingJourneysNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys'), {
              sourceLabel: 'coaching_journeys:error',
            })
        );
        return;
      }
      const normalizedJourneyNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys');
      setCoachingJourneys(Array.isArray(body.journeys) ? body.journeys : []);
      setCoachingJourneysPackageVisibility(
        pickRuntimePackageVisibility(
          normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
          body.package_visibility ?? null
        )
      );
      setCoachingJourneysNotificationItems(normalizedJourneyNotifications);
      setCoachingJourneysNotificationSummary(
        normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
          summarizeNotificationRows(normalizedJourneyNotifications, {
            sourceLabel: 'coaching_journeys',
          })
      );
    } catch (err) {
      setCoachingJourneysError(err instanceof Error ? err.message : 'Failed to load coaching journeys');
      setCoachingJourneys([]);
      setCoachingJourneysPackageVisibility(null);
      setCoachingJourneysNotificationItems([]);
      setCoachingJourneysNotificationSummary(null);
    } finally {
      setCoachingJourneysLoading(false);
    }
  }, [session?.access_token]);

  const fetchCoachingProgressSummary = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setCoachingProgressError('Sign in is required to view coaching progress.');
      setCoachingProgressSummary(null);
      setCoachingProgressNotificationItems([]);
      setCoachingProgressNotificationSummary(null);
      return;
    }
    setCoachingProgressLoading(true);
    setCoachingProgressError(null);
    try {
      const response = await fetch(`${API_URL}/api/coaching/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as CoachingProgressSummaryResponse;
      if (!response.ok) {
        setCoachingProgressError(
          response.status === 403
            ? 'Permission denied for coaching progress in this scope (403).'
            : String(body.error ?? `Progress request failed (${response.status})`)
        );
        setCoachingProgressSummary(null);
        setCoachingProgressNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress'));
        setCoachingProgressNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress'), {
              sourceLabel: 'coaching_progress:error',
            })
        );
        return;
      }
      const normalizedProgressNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress');
      setCoachingProgressSummary(body);
      setCoachingProgressNotificationItems(normalizedProgressNotifications);
      setCoachingProgressNotificationSummary(
        normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
          summarizeNotificationRows(normalizedProgressNotifications, {
            sourceLabel: 'coaching_progress',
          })
      );
    } catch (err) {
      setCoachingProgressError(err instanceof Error ? err.message : 'Failed to load coaching progress');
      setCoachingProgressSummary(null);
      setCoachingProgressNotificationItems([]);
      setCoachingProgressNotificationSummary(null);
    } finally {
      setCoachingProgressLoading(false);
    }
  }, [session?.access_token]);

  const fetchCoachingJourneyDetail = useCallback(
    async (journeyId: string) => {
      const token = session?.access_token;
      if (!token) {
        setCoachingJourneyDetailError('Sign in is required to view this journey.');
        setCoachingJourneyDetail(null);
        return;
      }
      if (!journeyId) {
        setCoachingJourneyDetailError('Journey id is required.');
        setCoachingJourneyDetail(null);
        return;
      }
      setCoachingJourneyDetailLoading(true);
      setCoachingJourneyDetailError(null);
      try {
        const response = await fetch(`${API_URL}/api/coaching/journeys/${encodeURIComponent(journeyId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => ({}))) as CoachingJourneyDetailResponse;
        if (!response.ok) {
          setCoachingJourneyDetailError(
            response.status === 403
              ? 'Permission denied for this journey detail in current scope (403).'
              : String(body.error ?? `Journey detail request failed (${response.status})`)
          );
          setCoachingJourneyDetail(null);
          return;
        }
        setCoachingJourneyDetail(body);
      } catch (err) {
        setCoachingJourneyDetailError(err instanceof Error ? err.message : 'Failed to load journey detail');
        setCoachingJourneyDetail(null);
      } finally {
        setCoachingJourneyDetailLoading(false);
      }
    },
    [session?.access_token]
  );

  const submitCoachingLessonProgress = useCallback(
    async (lessonId: string, status: 'not_started' | 'in_progress' | 'completed') => {
      const token = session?.access_token;
      if (!token) {
        setCoachingLessonProgressError('Sign in is required to update lesson progress.');
        return;
      }
      setCoachingLessonProgressSubmittingId(lessonId);
      setCoachingLessonProgressError(null);
      try {
        const response = await fetch(`${API_URL}/api/coaching/lessons/${encodeURIComponent(lessonId)}/progress`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        });
        const body = (await response.json().catch(() => ({}))) as CoachingLessonProgressWriteResponse;
        if (!response.ok) {
          setCoachingLessonProgressError(String(body.error ?? `Lesson progress update failed (${response.status})`));
          return;
        }
        const activeJourneyId = coachingShellContext.selectedJourneyId;
        if (activeJourneyId) {
          await Promise.all([fetchCoachingJourneyDetail(activeJourneyId), fetchCoachingJourneys(), fetchCoachingProgressSummary()]);
        } else {
          await Promise.all([fetchCoachingJourneys(), fetchCoachingProgressSummary()]);
        }
      } catch (err) {
        setCoachingLessonProgressError(err instanceof Error ? err.message : 'Failed to update lesson progress');
      } finally {
        setCoachingLessonProgressSubmittingId(null);
      }
    },
    [
      coachingShellContext.selectedJourneyId,
      fetchCoachingJourneyDetail,
      fetchCoachingJourneys,
      fetchCoachingProgressSummary,
      session?.access_token,
    ]
  );

  const fetchChannels = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setChannelsError('Sign in is required to view channels.');
      setChannelsApiRows([]);
      setChannelsPackageVisibility(null);
      setChannelsNotificationItems([]);
      setChannelsNotificationSummary(null);
      return;
    }
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const response = await fetch(`${API_URL}/api/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as ChannelsListResponse;
      if (!response.ok) {
        setChannelsError(
          response.status === 403
            ? 'Permission denied for channel visibility in this scope (403).'
            : String(body.error ?? `Channels request failed (${response.status})`)
        );
        setChannelsApiRows([]);
        setChannelsPackageVisibility(
          pickRuntimePackageVisibility(
            normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
            body.package_visibility ?? null
          )
        );
        setChannelsNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'channels'));
        setChannelsNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'channels'), {
              sourceLabel: 'channels:error',
            })
        );
        return;
      }
      const rows = Array.isArray(body.channels) ? body.channels : [];
      const normalizedChannelNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'channels');
      setChannelsApiRows(rows);
      setChannelsPackageVisibility(
        pickRuntimePackageVisibility(
          normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
          body.package_visibility ?? null
        )
      );
      setSelectedChannelId((prev) => (prev && rows.some((r) => String(r.id) === prev) ? prev : prev));
      setChannelsNotificationItems(normalizedChannelNotifications);
      setChannelsNotificationSummary(
        normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
          summarizeNotificationRows(normalizedChannelNotifications, {
            sourceLabel: 'channels',
          })
      );
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Failed to load channels');
      setChannelsApiRows([]);
      setChannelsPackageVisibility(null);
      setChannelsNotificationItems([]);
      setChannelsNotificationSummary(null);
    } finally {
      setChannelsLoading(false);
    }
  }, [session?.access_token]);

  const fetchChannelMessages = useCallback(
    async (channelId: string, { markSeen = true }: { markSeen?: boolean } = {}) => {
      const token = session?.access_token;
      if (!token) {
        setChannelMessagesError('Sign in is required to view channel messages.');
        setChannelMessages([]);
        setChannelThreadPackageVisibility(null);
        setChannelThreadNotificationItems([]);
        setChannelThreadNotificationSummary(null);
        return;
      }
      if (!channelId) {
        setChannelMessagesError('Channel id is required.');
        setChannelMessages([]);
        setChannelThreadPackageVisibility(null);
        setChannelThreadNotificationItems([]);
        setChannelThreadNotificationSummary(null);
        return;
      }
      setChannelMessagesLoading(true);
      setChannelMessagesError(null);
      try {
        const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(channelId)}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => ({}))) as ChannelMessagesResponse;
        if (!response.ok) {
          setChannelMessagesError(
            response.status === 403
              ? 'Permission denied for this channel thread in current scope (403).'
              : String(body.error ?? `Channel messages request failed (${response.status})`)
          );
          setChannelMessages([]);
          setChannelThreadPackageVisibility(
            pickRuntimePackageVisibility(
              normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
              normalizePackagingReadModelToVisibilityOutcome(body.channel?.packaging_read_model ?? null),
              body.package_visibility ?? null
            )
          );
          setChannelThreadNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'channel_thread'));
          setChannelThreadNotificationSummary(
            normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
              summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'channel_thread'), {
                sourceLabel: 'channel_thread:error',
              })
          );
          return;
        }
        const normalizedThreadNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'channel_thread');
        setChannelMessages(Array.isArray(body.messages) ? body.messages : []);
        setChannelThreadPackageVisibility(
          pickRuntimePackageVisibility(
            normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
            normalizePackagingReadModelToVisibilityOutcome(body.channel?.packaging_read_model ?? null),
            body.package_visibility ?? null
          )
        );
        if (body.channel?.name && (!selectedChannelName || String(selectedChannelId) === String(channelId))) {
          setSelectedChannelName(String(body.channel.name));
        }
        setChannelThreadNotificationItems(normalizedThreadNotifications);
        setChannelThreadNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizedThreadNotifications, {
              sourceLabel: 'channel_thread',
            })
        );
        if (markSeen) {
          await fetch(`${API_URL}/api/messages/mark-seen`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channel_id: channelId }),
          }).catch(() => undefined);
          // Refresh channel list unread counters opportunistically.
          void fetchChannels();
        }
      } catch (err) {
        setChannelMessagesError(err instanceof Error ? err.message : 'Failed to load channel messages');
        setChannelMessages([]);
        setChannelThreadPackageVisibility(null);
        setChannelThreadNotificationItems([]);
        setChannelThreadNotificationSummary(null);
      } finally {
        setChannelMessagesLoading(false);
      }
    },
    [fetchChannels, selectedChannelId, selectedChannelName, session?.access_token]
  );

  const sendChannelMessage = useCallback(
    async (channelId: string) => {
      const token = session?.access_token;
      const bodyText = channelMessageDraft.trim();
      if (!token) {
        setChannelMessageSubmitError('Sign in is required to send messages.');
        return;
      }
      if (!channelId) {
        setChannelMessageSubmitError('Select a channel before sending.');
        return;
      }
      if (!bodyText) {
        setChannelMessageSubmitError('Message body is required.');
        return;
      }
      setChannelMessageSubmitting(true);
      setChannelMessageSubmitError(null);
      try {
        const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: bodyText }),
        });
        const payload = (await response.json().catch(() => ({}))) as ChannelMessageWriteResponse;
        if (!response.ok) {
          setChannelMessageSubmitError(
            response.status === 403
              ? 'Permission denied to send messages in this channel (403).'
              : String(payload.error ?? `Send failed (${response.status})`)
          );
          return;
        }
        setChannelMessageDraft('');
        await fetchChannelMessages(channelId, { markSeen: false });
      } catch (err) {
        setChannelMessageSubmitError(err instanceof Error ? err.message : 'Failed to send message');
      } finally {
        setChannelMessageSubmitting(false);
      }
    },
    [channelMessageDraft, fetchChannelMessages, session?.access_token]
  );

  const sendChannelBroadcast = useCallback(
    async (channelId: string) => {
      const token = session?.access_token;
      const bodyText = broadcastDraft.trim();
      if (!token) {
        setBroadcastError('Sign in is required to send broadcasts.');
        return;
      }
      if (!channelId) {
        setBroadcastError('A team channel is required for this broadcast path.');
        return;
      }
      if (!bodyText) {
        setBroadcastError('Broadcast body is required.');
        return;
      }
      setBroadcastSubmitting(true);
      setBroadcastError(null);
      setBroadcastSuccessNote(null);
      try {
        const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(channelId)}/broadcast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: bodyText }),
        });
        const payload = (await response.json().catch(() => ({}))) as ChannelBroadcastWriteResponse;
        if (!response.ok) {
          setBroadcastError(
            response.status === 403
              ? 'Permission denied to broadcast in this channel (403).'
              : String(payload.error ?? `Broadcast failed (${response.status})`)
          );
          return;
        }
        setBroadcastDraft('');
        setBroadcastSuccessNote('Broadcast sent.');
        await Promise.all([fetchChannelMessages(channelId, { markSeen: false }), fetchChannels()]);
      } catch (err) {
        setBroadcastError(err instanceof Error ? err.message : 'Failed to send broadcast');
      } finally {
        setBroadcastSubmitting(false);
      }
    },
    [broadcastDraft, fetchChannelMessages, fetchChannels, session?.access_token]
  );

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (
      coachingShellScreen === 'coaching_journeys' ||
      coachingShellScreen === 'coaching_journey_detail' ||
      coachingShellScreen === 'coaching_lesson_detail'
    ) {
      if (!coachingJourneys && !coachingJourneysLoading) {
        void fetchCoachingJourneys();
      }
      if (!coachingProgressSummary && !coachingProgressLoading) {
        void fetchCoachingProgressSummary();
      }
    }
  }, [
    activeTab,
    coachingJourneys,
    coachingJourneysLoading,
    coachingProgressLoading,
    coachingProgressSummary,
    coachingShellScreen,
    fetchCoachingJourneys,
    fetchCoachingProgressSummary,
  ]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (coachingShellScreen !== 'coaching_journey_detail' && coachingShellScreen !== 'coaching_lesson_detail') return;
    const desiredJourneyId =
      coachingShellContext.selectedJourneyId ??
      (Array.isArray(coachingJourneys) && coachingJourneys.length > 0 ? String(coachingJourneys[0].id) : null);
    if (!desiredJourneyId) return;
    if (coachingJourneyDetail?.journey?.id && String(coachingJourneyDetail.journey.id) === desiredJourneyId) return;
    void fetchCoachingJourneyDetail(desiredJourneyId);
  }, [
    activeTab,
    coachingJourneyDetail?.journey?.id,
    coachingJourneys,
    coachingShellContext.selectedJourneyId,
    coachingShellScreen,
    fetchCoachingJourneyDetail,
  ]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (
      coachingShellScreen === 'inbox_channels' ||
      coachingShellScreen === 'channel_thread' ||
      coachingShellScreen === 'coach_broadcast_compose'
    ) {
      if (!channelsApiRows && !channelsLoading) {
        void fetchChannels();
      }
    }
  }, [activeTab, channelsApiRows, channelsLoading, coachingShellScreen, fetchChannels]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (!Array.isArray(channelsApiRows) || channelsApiRows.length === 0) return;
    const rows = channelsApiRows;
    const preferredScope = coachingShellContext.preferredChannelScope;
    const visibleRows = preferredScope
      ? rows.filter((row) => {
          const scope = normalizeChannelTypeToScope(row.type);
          return scope === preferredScope || scope === 'community';
        })
      : rows;
    const defaultRow = visibleRows[0] ?? rows[0];
    if (!defaultRow) return;
    if (!selectedChannelId || !rows.some((row) => String(row.id) === String(selectedChannelId))) {
      setSelectedChannelId(String(defaultRow.id));
      setSelectedChannelName(defaultRow.name);
    }
  }, [activeTab, channelsApiRows, coachingShellContext.preferredChannelScope, selectedChannelId]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (coachingShellScreen !== 'channel_thread') return;
    if (!selectedChannelId) return;
    void fetchChannelMessages(selectedChannelId);
  }, [activeTab, coachingShellScreen, fetchChannelMessages, selectedChannelId]);

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

  const resolvedDisplayName =
    String(
      session?.user?.user_metadata?.full_name ??
        session?.user?.user_metadata?.name ??
        session?.user?.user_metadata?.first_name ??
        session?.user?.email?.split('@')[0] ??
        'there'
    ) || 'there';
  const greetingFirstName = resolvedDisplayName.trim().split(' ')[0] || 'there';
  const profileInitials = resolvedDisplayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  return (
    <View
      ref={(node) => {
        screenRootRef.current = node;
      }}
      style={styles.screenRoot}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPad }]}
        scrollEnabled={!isHomeGameplaySurface}
        bounces={!isHomeGameplaySurface}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={!isHomeGameplaySurface}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.homeHeaderRow}>
          <View>
            <Text style={styles.hello}>Hi, {greetingFirstName}</Text>
            <Text style={styles.welcomeBack}>Welcome back</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            accessibilityRole="button"
            accessibilityLabel="Open profile and settings"
            onPress={handleOpenProfileFromAvatar}
          >
            <Text style={styles.avatarText}>{profileInitials}</Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'challenge' ? (
          <View style={styles.challengeSurfaceWrap}>
            {challengeFlowScreen === 'list' ? (
              <>
                <View style={styles.challengeListShell}>
                  <View style={styles.challengeListHeaderRow}>
                    <Text style={styles.challengeListTitle}>Challenges</Text>
                    {challengeCreateAllowed ? (
                      <TouchableOpacity
                        style={styles.challengeListCreateBtn}
                        onPress={() => {
                          setChallengeMemberCreateMode('team');
                          setChallengeMemberCreateModalVisible(true);
                        }}
                      >
                        <Text style={styles.challengeListCreateBtnText}>Create ⊕</Text>
                      </TouchableOpacity>
                    ) : (
                      renderKnownLimitedDataChip('challenge create')
                    )}
                  </View>
                  <Text style={styles.challengeListSub}>
                    {teamPersonaVariant === 'member'
                      ? 'Browse active and completed challenges for participation progress.'
                      : 'See active challenges and jump into challenge progress details.'}
                  </Text>
                  {teamPersonaVariant === 'member' ? (
                    <>
                      <View style={styles.challengeMemberSearchGhost}>
                        <Text style={styles.challengeMemberSearchGhostIcon}>⌕</Text>
                        <Text style={styles.challengeMemberSearchGhostText}>Search challenges..</Text>
                      </View>
                      <View style={styles.challengeMemberSegmentRow}>
                        {([
                          { key: 'all', label: 'ALL' },
                          { key: 'completed', label: 'Completed' },
                        ] as const).map((tab) => {
                          const active = challengeMemberListTab === tab.key;
                          return (
                            <TouchableOpacity
                              key={`challenge-member-tab-${tab.key}`}
                              style={[styles.challengeMemberSegmentPill, active && styles.challengeMemberSegmentPillActive]}
                              onPress={() => setChallengeMemberListTab(tab.key)}
                            >
                              <Text
                                style={[
                                  styles.challengeMemberSegmentPillText,
                                  active && styles.challengeMemberSegmentPillTextActive,
                                ]}
                              >
                                {tab.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  {challengeApiFetchError
                    ? renderKnownLimitedDataChip('live challenge list unavailable')
                    : challengeListUsingPlaceholderRows
                      ? renderKnownLimitedDataChip('preview rows only')
                      : null}

                  {teamPersonaVariant !== 'member' ? (
                  <View style={styles.challengeListFilterRow}>
                    {([
                      { key: 'all', label: 'All' },
                      { key: 'sponsored', label: 'Sponsored' },
                      { key: 'team', label: 'Team' },
                    ] as const).map((chip) => {
                      const active = challengeListFilter === chip.key;
                      return (
                        <TouchableOpacity
                          key={`challenge-filter-${chip.key}`}
                          style={[styles.challengeListFilterChip, active && styles.challengeListFilterChipActive]}
                          onPress={() => setChallengeListFilter(chip.key)}
                        >
                          <Text style={[styles.challengeListFilterChipText, active && styles.challengeListFilterChipTextActive]}>
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  ) : null}
                  {teamPersonaVariant !== 'member' && challengeListFilter === 'sponsored' && !challengeHasSponsorSignal
                    ? renderKnownLimitedDataChip('sponsor flag coverage')
                    : null}

                  <View style={styles.challengeListCardStack}>
                    {teamPersonaVariant === 'member'
                      ? challengeMemberListItems.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.challengeMemberListCard}
                            onPress={() => {
                              setChallengeSelectedId(item.id);
                              setChallengeFlowScreen('details');
                            }}
                          >
                            <View style={styles.challengeListItemTopRow}>
                              <Text numberOfLines={2} style={styles.challengeMemberListCardTitle}>{item.title}</Text>
                              <View
                                style={[
                                  styles.challengeListStatusPill,
                                  item.bucket === 'completed'
                                    ? styles.challengeListStatusCompleted
                                    : styles.challengeListStatusActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.challengeListStatusPillText,
                                    item.bucket === 'completed'
                                      ? styles.challengeListStatusCompletedText
                                      : styles.challengeListStatusActiveText,
                                  ]}
                                >
                                  {item.bucket === 'completed' ? 'Completed' : 'Active'}
                                </Text>
                              </View>
                            </View>
                            <Text numberOfLines={2} style={styles.challengeMemberListCardSub}>
                              {item.subtitle}
                            </Text>
                            <View style={styles.challengeMemberListCardMeta}>
                              <Text style={styles.challengeMemberListMetaStrong}>{item.timeframe}</Text>
                              <Text style={styles.challengeListItemMetaText}>{item.daysLabel}</Text>
                            </View>
                            <View style={styles.teamChallengesProgressTrack}>
                              <View
                                style={[
                                  styles.teamChallengesProgressFill,
                                  item.progressPct < 40 && styles.teamChallengesProgressFillYellow,
                                  { width: `${Math.max(2, item.progressPct)}%` },
                                ]}
                              />
                            </View>
                            <Text style={styles.challengeMemberListProgressText}>Progress: {item.progressPct}%</Text>
                          </TouchableOpacity>
                        ))
                      : (['active', 'upcoming', 'completed'] as const).map((bucket) => {
                      const rows = challengeFilteredListItems.filter((item) => item.bucket === bucket);
                      if (rows.length === 0) return null;
                      return (
                        <View key={`challenge-bucket-${bucket}`} style={styles.challengeListBucket}>
                          <Text style={styles.challengeListBucketTitle}>
                            {bucket === 'active' ? 'Active' : bucket === 'upcoming' ? 'Upcoming' : 'Completed'}
                          </Text>
                          {rows.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              style={styles.challengeListItemCard}
                              onPress={() => {
                                setChallengeSelectedId(item.id);
                                setChallengeFlowScreen('details');
                              }}
                            >
                              <View style={styles.challengeListItemTopRow}>
                                <Text numberOfLines={1} style={styles.challengeListItemTitle}>{item.title}</Text>
                                <View
                                  style={[
                                    styles.challengeListStatusPill,
                                    item.bucket === 'active'
                                      ? styles.challengeListStatusActive
                                      : item.bucket === 'upcoming'
                                        ? styles.challengeListStatusUpcoming
                                        : styles.challengeListStatusCompleted,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.challengeListStatusPillText,
                                      item.bucket === 'active'
                                        ? styles.challengeListStatusActiveText
                                        : item.bucket === 'upcoming'
                                          ? styles.challengeListStatusUpcomingText
                                          : styles.challengeListStatusCompletedText,
                                    ]}
                                  >
                                    {item.status}
                                  </Text>
                                </View>
                              </View>
                              <Text numberOfLines={2} style={styles.challengeListItemSub}>{item.subtitle}</Text>
                              <View style={styles.challengeListItemMetaRow}>
                                <Text style={styles.challengeListItemMetaText}>{item.timeframe}</Text>
                                <Text style={styles.challengeListItemMetaText}>{item.daysLabel}</Text>
                              </View>
                              <View style={styles.challengeListItemMetaRow}>
                                <Text style={styles.challengeListItemMetaText}>
                                  {isApiBackedChallenge(item) ? 'Live challenge' : 'Placeholder preview'}
                                </Text>
                                {!isApiBackedChallenge(item) && item.bucket !== 'completed' ? (
                                  <Text style={styles.challengeListItemMetaText}>Join unavailable</Text>
                                ) : null}
                              </View>
                              <View style={styles.challengeListItemProgressTrack}>
                                <View style={[styles.challengeListItemProgressFill, { width: `${item.progressPct}%` }]} />
                              </View>
                              <View style={styles.challengeListItemBottomRow}>
                                <Text style={styles.challengeListItemBottomText}>
                                  {item.joined ? 'Joined' : 'Not joined'} · {item.participants} participant{item.participants === 1 ? '' : 's'}
                                </Text>
                                <Text style={styles.challengeListItemBottomLink}>
                                  {item.bucket === 'completed' ? 'View results ›' : 'View details ›'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    })}
                    {(teamPersonaVariant === 'member' ? challengeMemberListItems.length === 0 : challengeFilteredListItems.length === 0) ? (
                      <View style={styles.challengeListEmptyFilterCard}>
                        <Text style={styles.challengeListEmptyFilterTitle}>No challenges match this filter</Text>
                        <Text style={styles.challengeListEmptyFilterSub}>
                          {teamPersonaVariant === 'member'
                            ? challengeMemberListTab === 'completed'
                              ? 'No completed challenges are available for this account yet.'
                              : 'No challenge cards are available yet.'
                            : challengeListFilter === 'sponsored'
                            ? 'Try All or Team to view more challenges.'
                            : challengeListFilter === 'team'
                              ? 'No team-mode challenges match right now.'
                              : challengeListUsingPlaceholderRows
                                ? 'No placeholder challenge cards are available for this filter.'
                                : 'No live challenges are available for this filter right now.'}
                        </Text>
                        {teamPersonaVariant !== 'member' && challengeListFilter !== 'all' ? (
                          <TouchableOpacity
                            style={styles.challengeListEmptyFilterBtn}
                            onPress={() => setChallengeListFilter('all')}
                          >
                            <Text style={styles.challengeListEmptyFilterBtnText}>Show all challenges</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
                {challengeCreateAllowed ? (
                  <Modal
                    visible={challengeMemberCreateModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setChallengeMemberCreateModalVisible(false)}
                  >
                    <Pressable
                      style={styles.challengeMemberCreateModalBackdrop}
                      onPress={() => setChallengeMemberCreateModalVisible(false)}
                    >
                      <Pressable style={styles.challengeMemberCreateModalCard} onPress={() => {}}>
                        <Text style={styles.challengeMemberCreateModalTitle}>Create New Challenge</Text>
                        <View style={styles.challengeMemberCreateModeGrid}>
                          {([
                            { key: 'public', label: 'Public Challenge', icon: '👜' },
                            { key: 'team', label: 'Team Challenge', icon: '👥' },
                          ] as const).map((option) => {
                            const active = challengeMemberCreateMode === option.key;
                            return (
                              <TouchableOpacity
                                key={option.key}
                                style={[
                                  styles.challengeMemberCreateModeCard,
                                  active && styles.challengeMemberCreateModeCardActive,
                                ]}
                                onPress={() => setChallengeMemberCreateMode(option.key)}
                              >
                                <Text style={styles.challengeMemberCreateModeIcon}>{option.icon}</Text>
                                <Text
                                  style={[
                                    styles.challengeMemberCreateModeLabel,
                                    active && styles.challengeMemberCreateModeLabelActive,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity
                          style={styles.challengeMemberCreateContinueBtn}
                          onPress={() => {
                            setChallengeMemberCreateModalVisible(false);
                            if (challengeMemberCreateMode === 'team') {
                              const completedOrTeam =
                                challengeListItems.find((item) => item.bucket === 'completed') ??
                                challengeListItems.find((item) => item.challengeModeLabel === 'Team') ??
                                challengeListItems[0];
                              if (completedOrTeam) setChallengeSelectedId(completedOrTeam.id);
                              setChallengeFlowScreen('leaderboard');
                              return;
                            }
                            const preferred = challengeListItems[0];
                            if (preferred) setChallengeSelectedId(preferred.id);
                            setChallengeFlowScreen('details');
                          }}
                        >
                          <Text style={styles.challengeMemberCreateContinueBtnText}>Continue</Text>
                        </TouchableOpacity>
                      </Pressable>
                    </Pressable>
                  </Modal>
                ) : null}
              </>
            ) : challengeFlowScreen === 'leaderboard' ? (
              <View style={styles.challengeDetailsShell}>
                <View style={styles.challengeDetailsNavRow}>
                  <TouchableOpacity
                    style={styles.challengeDetailsIconBtn}
                    onPress={() => setChallengeFlowScreen('details')}
                  >
                    <Text style={styles.challengeDetailsIconBtnText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.challengeDetailsNavTitle}>
                    {challengeIsCompleted ? 'Results' : 'Leaderboard'}
                  </Text>
                  <View style={styles.challengeDetailsNavSpacer} />
                </View>

                {challengeMemberResultsRequiresUpgrade ? (
                  <View style={styles.challengeMemberUpgradeShell}>
                    <View style={styles.challengeMemberUpgradeHeroIcon}>
                      <Text style={styles.challengeMemberUpgradeHeroIconText}>👑</Text>
                    </View>
                    <Text style={styles.challengeMemberUpgradeTitle}>This Feature Is for Pro Users</Text>
                    <Text style={styles.challengeMemberUpgradeSub}>
                      This challenge is part of our Pro plan. Upgrade now to join exclusive challenges, unlock premium KPIs, and boost your performance tracking.
                    </Text>
                    <View style={styles.challengeMemberUpgradeChallengeCard}>
                      <View style={styles.challengeMemberUpgradeChallengeIcon}>
                        <Text style={styles.challengeMemberUpgradeChallengeIconText}>🏆</Text>
                      </View>
                      <View style={styles.challengeMemberUpgradeChallengeCopy}>
                        <Text style={styles.challengeMemberUpgradeChallengeTitle}>{challengeSelected.title}</Text>
                        <Text style={styles.challengeMemberUpgradeChallengeSub}>Monthly Target</Text>
                        <Text style={styles.challengeMemberUpgradeChallengeGoal}>
                          Goal: {challengeSelected.targetValueLabel} · {challengeSelected.participants} participants
                        </Text>
                      </View>
                      <Text style={styles.challengeMemberUpgradeLock}>🔒</Text>
                    </View>
                    <Text style={styles.challengeMemberUpgradeSectionLabel}>What You Get With Pro</Text>
                    <View style={styles.challengeMemberUpgradeBenefits}>
                      {[
                        ['✨', 'Access to All KPI Tracking Features', 'Track unlimited KPIs and get detailed analytics'],
                        ['🏆', 'Join Unlimited Challenges', 'Participate in exclusive team and individual challenges'],
                        ['🎯', 'Custom Goal Setting', 'Set personalized targets and milestones'],
                        ['👥', 'Team Performance Tools', 'Collaborate and compete with your team'],
                        ['❓', 'Priority Support', 'Get help when you need it most'],
                      ].map(([icon, title, sub]) => (
                        <View key={title} style={styles.challengeMemberUpgradeBenefitCard}>
                          <View style={styles.challengeMemberUpgradeBenefitIcon}>
                            <Text style={styles.challengeMemberUpgradeBenefitIconText}>{icon}</Text>
                          </View>
                          <View style={styles.challengeMemberUpgradeBenefitCopy}>
                            <Text style={styles.challengeMemberUpgradeBenefitTitle}>{title}</Text>
                            <Text style={styles.challengeMemberUpgradeBenefitSub}>{sub}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.challengeMemberUpgradePrimaryBtn}
                      onPress={() =>
                        Alert.alert(
                          'Upgrade options',
                          'Checkout is not wired in this build yet. This screen remains evaluable for package-gated challenge states.'
                        )
                      }
                    >
                      <Text style={styles.challengeMemberUpgradePrimaryBtnText}>View Upgrade Options</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.challengeMemberUpgradeSecondaryBtn}
                      onPress={() => setChallengeFlowScreen('details')}
                    >
                      <Text style={styles.challengeMemberUpgradeSecondaryBtnText}>May Be Later</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                <View style={styles.challengeLeaderboardScreenCard}>
                  <Text style={styles.challengeLeaderboardScreenTitle}>{challengeSelected.title}</Text>
                  <Text style={styles.challengeLeaderboardScreenSub}>
                    {challengeIsCompleted
                      ? 'Challenge results and leaderboard standings.'
                      : challengeSelected.joined
                        ? 'Leaderboard standings for this challenge.'
                        : 'Leaderboard preview for this challenge. Join to track your progress.'}
                  </Text>
                  <View style={styles.challengeLeaderboardScreenTop3}>
                    {challengeLeaderboardRowsForScreen.slice(0, 3).map((entry) => (
                      <View key={`challenge-lb-full-${entry.rank}`} style={styles.challengeLeaderboardScreenTopCard}>
                        <Text style={styles.challengeDetailsLeaderboardRank}>#{entry.rank}</Text>
                        <View style={styles.challengeDetailsLeaderboardAvatar}>
                          <Text style={styles.challengeDetailsLeaderboardAvatarText}>
                            {entry.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.challengeDetailsLeaderboardName}>{entry.name}</Text>
                        <Text style={styles.challengeLeaderboardScreenTopValue}>{entry.value}</Text>
                        <Text style={styles.challengeDetailsLeaderboardVal}>logs</Text>
                      </View>
                    ))}
                  </View>
                  {challengeLeaderboardRowsForScreen.length > 0 ? (
                    <>
                      <View style={styles.challengeLeaderboardScreenRows}>
                        {challengeLeaderboardRowsForScreen.map((entry) => (
                          <View key={`challenge-lb-screen-row-${entry.rank}`} style={styles.challengeLeaderboardScreenRow}>
                            <Text style={styles.challengeDetailsLeaderboardRowRank}>{String(entry.rank).padStart(2, '0')}</Text>
                            <Text numberOfLines={1} style={styles.challengeDetailsLeaderboardRowName}>{entry.name}</Text>
                            <Text style={styles.challengeLeaderboardScreenRowMetric}>{entry.value} logs</Text>
                            <Text style={styles.challengeDetailsLeaderboardRowPct}>{entry.pct}%</Text>
                          </View>
                        ))}
                      </View>
                      {challengeLeaderboardHasLowEntry ? (
                        <View style={styles.challengeLeaderboardEmptyCard}>
                          <Text style={styles.challengeLeaderboardEmptyTitle}>
                            {challengeIsCompleted ? 'Limited results available' : 'Leaderboard has limited entries so far'}
                          </Text>
                          <Text style={styles.challengeLeaderboardEmptySub}>
                            {challengeIsCompleted
                              ? 'Only part of the final standings are available.'
                              : 'More rows will appear as additional participants join and log challenge activity.'}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.challengeLeaderboardEmptyCard}>
                      <Text style={styles.challengeLeaderboardEmptyTitle}>
                        {challengeIsCompleted ? 'Results are not available yet' : 'Leaderboard will populate after challenge activity starts'}
                      </Text>
                      <Text style={styles.challengeLeaderboardEmptySub}>
                        {challengeIsCompleted
                            ? 'This challenge has ended. Final standings are still loading.'
                          : 'Once participants join and log challenge activity, standings will appear here.'}
                      </Text>
                    </View>
                  )}
                </View>
                )}
              </View>
            ) : (
              <>
                <View style={styles.challengeDetailsShell}>
                  <View style={styles.challengeDetailsNavRow}>
                    <TouchableOpacity
                      style={styles.challengeDetailsIconBtn}
                      onPress={() => setChallengeFlowScreen('list')}
                    >
                      <Text style={styles.challengeDetailsIconBtnText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.challengeDetailsNavTitle}>
                      {challengeDetailsSurfaceLabel}
                    </Text>
                    <TouchableOpacity
                      style={[styles.challengeDetailsActionBtn, styles.disabled]}
                      disabled
                    >
                      <Text style={styles.challengeDetailsActionBtnText}>KPIs Below</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.challengeDetailsTitleBlock}>
                    <Text style={styles.challengeDetailsTitle}>{challengeSelected.title}</Text>
                    <Text style={styles.challengeDetailsSubtitle}>
                      {challengeSelected.subtitle}
                    </Text>
                  </View>

                  <View style={styles.challengeDetailsHeroCard}>
                    <View style={styles.challengeDetailsHeroTop}>
                      <Text style={styles.challengeDetailsHeroLabel}>
                        {challengeIsCompleted ? 'Challenge Results' : 'Challenge Progress'}
                      </Text>
                      <View
                        style={[
                          styles.challengeDetailsStatusPill,
                          challengeSelected.bucket === 'completed' && styles.challengeDetailsStatusPillCompleted,
                          challengeSelected.bucket === 'upcoming' && styles.challengeDetailsStatusPillUpcoming,
                        ]}
                      >
                        <Text
                          style={[
                            styles.challengeDetailsStatusPillText,
                            challengeSelected.bucket === 'completed' && styles.challengeDetailsStatusPillTextCompleted,
                            challengeSelected.bucket === 'upcoming' && styles.challengeDetailsStatusPillTextUpcoming,
                          ]}
                        >
                          {challengeSelected.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.challengeDetailsGaugeWrap}>
                      <View style={styles.challengeDetailsGaugeOuter}>
                        <View style={styles.challengeDetailsGaugeArcBase} />
                        <View style={styles.challengeDetailsGaugeArcFill} />
                        <View style={styles.challengeDetailsGaugeInner}>
                          <Text style={styles.challengeDetailsGaugeValue}>{challengeSelected.progressPct}%</Text>
                          <Text style={styles.challengeDetailsGaugeCaption}>
                            {challengeSelected.bucket === 'completed' ? 'Completed' : 'Complete'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.challengeDetailsHeroHint}>
                      {challengeIsCompleted
                        ? 'Results summary is shown here.'
                        : challengeIsPlaceholderOnly
                          ? 'This is a placeholder preview card. Join/leave is disabled until a live challenge row is available.'
                          : 'Progress and leaderboard update from challenge participation data. Some detail fields still use fallback values.'}
                    </Text>
                  </View>

                  <View style={styles.challengeDetailsOwnerCard}>
                    <View style={styles.challengeDetailsOwnerLeft}>
                      <View style={styles.challengeDetailsOwnerAvatar}>
                        <Text style={styles.challengeDetailsOwnerAvatarText}>
                          {challengeSelected.joined ? 'ME' : challengeIsCompleted ? 'RS' : 'CH'}
                        </Text>
                      </View>
                      <View style={styles.challengeDetailsOwnerCopy}>
                        <Text style={styles.challengeDetailsOwnerName}>{challengeDetailsSummaryTitle}</Text>
                        <Text style={styles.challengeDetailsOwnerStatus}>
                          {challengeMembershipStateLabel} · {challengeDetailsSummaryStatus}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.challengeDetailsOwnerMetric}>
                      <Text style={styles.challengeDetailsOwnerMetricValue}>{challengeDetailsSummaryMetricValue}</Text>
                      <Text style={styles.challengeDetailsOwnerMetricLabel}>{challengeDetailsSummaryMetricLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.challengeDetailsMetaCard}>
                    <View style={styles.challengeDetailsDateRangeRow}>
                      <Text style={styles.challengeDetailsDateRangeTitle}>{challengeSelected.timeframe}</Text>
                      <View style={styles.challengeDetailsDaysPill}>
                        <Text style={styles.challengeDetailsDaysPillText}>
                          {challengeSelected.bucket === 'active' ? `${challengeDaysLeft} days left` : challengeSelected.daysLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.challengeDetailsMetaRows}>
                      <View style={styles.challengeDetailsMetaRow}>
                        <Text style={styles.challengeDetailsMetaKey}>Start Date</Text>
                        <Text style={styles.challengeDetailsMetaVal}>
                          {fmtShortMonthDayYear(challengeSelected.startAtIso) || 'TBD'}
                        </Text>
                      </View>
                      <View style={styles.challengeDetailsMetaRow}>
                        <Text style={styles.challengeDetailsMetaKey}>End Date</Text>
                        <Text style={styles.challengeDetailsMetaVal}>
                          {fmtShortMonthDayYear(challengeSelected.endAtIso) || 'TBD'}
                        </Text>
                      </View>
                      <View style={styles.challengeDetailsMetaRow}>
                        <Text style={styles.challengeDetailsMetaKey}>Challenge Type</Text>
                        <Text style={styles.challengeDetailsMetaVal}>{challengeSelected.challengeModeLabel}</Text>
                      </View>
                      <View style={styles.challengeDetailsMetaRow}>
                        <Text style={styles.challengeDetailsMetaKey}>Target Value</Text>
                        <Text style={styles.challengeDetailsMetaVal}>{challengeSelected.targetValueLabel}</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.challengeDetailsLeaderboardCard}
                    activeOpacity={0.9}
                    onPress={() => setChallengeFlowScreen('leaderboard')}
                  >
                    <View style={styles.challengeDetailsLeaderboardHeader}>
                      <Text style={styles.challengeDetailsLeaderboardTitle}>
                        {challengeIsCompleted ? 'Results & Leaderboard' : 'Leaderboard & Progress'}
                      </Text>
                      <Text style={styles.challengeDetailsLeaderboardMeta}>
                        {challengeIsCompleted ? 'Open results' : 'Open leaderboard'}
                      </Text>
                    </View>
                    {challengeLeaderboardHasRealRows ? (
                      <>
                        <View style={styles.challengeDetailsLeaderboardTop3}>
                          {challengeLeaderboardPreview.slice(0, 3).map((entry) => (
                            <View key={`challenge-lb-${entry.rank}`} style={styles.challengeDetailsLeaderboardTopCard}>
                              <Text style={styles.challengeDetailsLeaderboardRank}>#{entry.rank}</Text>
                              <View style={styles.challengeDetailsLeaderboardAvatar}>
                                <Text style={styles.challengeDetailsLeaderboardAvatarText}>
                                  {entry.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                                </Text>
                              </View>
                              <Text numberOfLines={1} style={styles.challengeDetailsLeaderboardName}>{entry.name}</Text>
                              <Text style={styles.challengeDetailsLeaderboardPct}>{entry.pct}%</Text>
                              <Text style={styles.challengeDetailsLeaderboardVal}>{entry.value} logs</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.challengeDetailsLeaderboardList}>
                          {challengeLeaderboardPreview.map((entry) => (
                            <View key={`challenge-lb-row-${entry.rank}`} style={styles.challengeDetailsLeaderboardRow}>
                              <Text style={styles.challengeDetailsLeaderboardRowRank}>{String(entry.rank).padStart(2, '0')}</Text>
                              <Text numberOfLines={1} style={styles.challengeDetailsLeaderboardRowName}>{entry.name}</Text>
                              <Text style={styles.challengeDetailsLeaderboardRowPct}>{entry.pct}%</Text>
                            </View>
                          ))}
                        </View>
                        {challengeLeaderboardPreview.length < 3 ? (
                          <View style={styles.challengeLeaderboardPreviewEmpty}>
                            <Text style={styles.challengeLeaderboardPreviewEmptyTitle}>
                              {challengeIsCompleted ? 'Partial results loaded' : 'Leaderboard is just getting started'}
                            </Text>
                            <Text style={styles.challengeLeaderboardPreviewEmptySub}>
                              {challengeIsCompleted
                                ? 'Only part of the final standings are available.'
                                : 'Additional leaderboard rows will appear after more participation activity.'}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <View style={styles.challengeLeaderboardPreviewEmpty}>
                        <Text style={styles.challengeLeaderboardPreviewEmptyTitle}>
                          {challengeIsCompleted ? 'Results details are not available yet' : 'Leaderboard will appear after challenge activity starts'}
                        </Text>
                        <Text style={styles.challengeLeaderboardPreviewEmptySub}>
                          {challengeIsCompleted
                            ? 'This challenge is complete. Final standings are still loading.'
                            : 'Join and log challenge activity to populate leaderboard standings.'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.coachingEntryCard}>
                    <View style={styles.coachingEntryHeaderRow}>
                      <Text style={styles.coachingEntryTitle}>
                        {challengeIsCompleted ? 'Challenge Coaching & Updates' : 'Challenge Updates & Coaching'}
                      </Text>
                      <Text style={styles.coachingEntryBadge}>W2 comms</Text>
                    </View>
                    <Text style={styles.coachingEntrySub}>
                      Challenge updates and coaching paths.
                    </Text>
                    {renderRuntimeStateBanner(challengeRuntimeStateModel, { compact: true })}
                    {renderCoachingPackageGateBanner('Challenge coaching and updates', challengeCoachingPackageOutcome, { compact: true })}
                    {renderCoachingNotificationSurface(
                      'Challenge notifications',
                      challengeSurfaceNotificationRows,
                      summarizeNotificationRows(challengeSurfaceNotificationRows, { sourceLabel: 'challenge_surface' }),
                      { compact: true, maxRows: 2, mode: 'banner', emptyHint: 'No challenge coaching notifications yet.' }
                    )}
                    {challengeCoachingGateBlocksCtas ? (
                      renderKnownLimitedDataChip('challenge coaching access')
                    ) : (
                      <>
                        <View style={styles.coachingEntryButtonRow}>
                          <TouchableOpacity
                            style={styles.coachingEntryPrimaryBtn}
                            onPress={() =>
                              openCoachingShell('channel_thread', {
                                source: 'challenge_details',
                                preferredChannelScope: challengeHasSponsorSignal ? 'sponsor' : 'challenge',
                                preferredChannelLabel: challengeHasSponsorSignal ? 'Sponsor / Challenge Updates' : 'Challenge Updates',
                                threadTitle: challengeHasSponsorSignal
                                  ? `${challengeSelected?.title ?? 'Challenge'} Sponsor Channel`
                                  : `${challengeSelected?.title ?? 'Challenge'} Channel`,
                                threadSub: challengeHasSponsorSignal
                                  ? 'Sponsor/challenge updates thread.'
                                  : 'Challenge updates thread.',
                                broadcastAudienceLabel: null,
                                broadcastRoleAllowed: false,
                              })
                            }
                          >
                            <Text style={styles.coachingEntryPrimaryBtnText}>Challenge Updates</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.coachingEntrySecondaryBtn}
                            onPress={() =>
                              openCoachingShell(challengeIsCompleted ? 'coaching_journeys' : 'coaching_journey_detail', {
                                source: 'challenge_details',
                                selectedJourneyId: null,
                                selectedJourneyTitle: null,
                                selectedLessonId: null,
                                selectedLessonTitle: null,
                              })
                            }
                          >
                            <Text style={styles.coachingEntrySecondaryBtnText}>Coaching Prompt</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={styles.coachingEntryDarkBtn}
                          onPress={() =>
                            openAiAssistShell(
                              {
                                host: 'challenge_coaching_module',
                                title: 'AI Assist (Approval-First)',
                                sub: 'Draft only. Human review required.',
                                targetLabel: challengeSelected?.title ?? 'Challenge coaching module',
                                approvedInsertOnly: true,
                              },
                              {
                                prompt: `Draft a short coaching/support note for ${challengeSelected?.title ?? 'this challenge'} without changing challenge results or participation state.`,
                              }
                            )
                          }
                        >
                          <Text style={styles.coachingEntryDarkBtnText}>AI Assist Draft (Review)</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  <View style={styles.challengeDetailsCtaBlock}>
                    {(() => {
                      const isJoinSubmitting = challengeJoinSubmittingId === challengeSelected.id;
                      const isLeaveSubmitting = challengeLeaveSubmittingId === challengeSelected.id;
                      const canJoinLiveChallenge =
                        challengeHasApiBackedDetail && !challengeSelected.joined && challengeSelected.bucket !== 'completed';
                      const canLeaveJoinedActiveChallenge =
                        challengeHasApiBackedDetail && challengeSelected.joined && !challengeIsCompleted;
                      const primaryActionIsJoin = canJoinLiveChallenge;
                      const primaryActionLabel = primaryActionIsJoin
                        ? isJoinSubmitting
                          ? 'Joining…'
                          : 'Join Challenge'
                        : challengeIsCompleted
                          ? 'View Results'
                          : 'View Full Leaderboard';
                      const secondaryActionLabel = canLeaveJoinedActiveChallenge
                        ? isLeaveSubmitting
                          ? 'Leaving…'
                          : 'Leave Challenge'
                        : 'Back to Challenges';
                      const challengeMutationError =
                        challengeJoinError ??
                        challengeLeaveError ??
                        (!challengeHasApiBackedDetail && !challengeSelected.joined && !challengeIsCompleted
                          ? 'This challenge is placeholder-only right now. Pull to refresh and choose a live challenge to join.'
                          : null);
                      return (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.challengeDetailsPrimaryCta,
                              (primaryActionIsJoin && (isJoinSubmitting || !challengeHasApiBackedDetail)) && styles.disabled,
                              (!primaryActionIsJoin && isLeaveSubmitting) && styles.disabled,
                            ]}
                            onPress={() => {
                              if (primaryActionIsJoin) {
                                if (!challengeHasApiBackedDetail) return;
                                void joinChallenge(challengeSelected.id);
                                return;
                              }
                              setChallengeFlowScreen('leaderboard');
                            }}
                            disabled={
                              isLeaveSubmitting ||
                              isJoinSubmitting ||
                              (primaryActionIsJoin && !challengeHasApiBackedDetail)
                            }
                          >
                            <Text style={styles.challengeDetailsPrimaryCtaText}>{primaryActionLabel}</Text>
                          </TouchableOpacity>
                          {!challengeMutationError && challengeIsPlaceholderOnly && !challengeSelected.joined
                            ? renderKnownLimitedDataChip('join disabled on preview rows')
                            : null}
                    {challengeMutationError ? (
                      <Text style={styles.challengeJoinErrorText}>{challengeMutationError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.challengeDetailsSecondaryCta,
                        canLeaveJoinedActiveChallenge && isLeaveSubmitting && styles.disabled,
                      ]}
                      onPress={() => {
                        if (challengeIsCompleted) {
                          setChallengeFlowScreen('list');
                          return;
                        }
                        if (canLeaveJoinedActiveChallenge) {
                          if (isJoinSubmitting || isLeaveSubmitting) return;
                          Alert.alert(
                            'Leave Challenge',
                            'Are you sure you want to leave this challenge? Your participation progress will no longer be tracked.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Leave',
                                style: 'destructive',
                                onPress: () => {
                                  void leaveChallenge(challengeSelected.id);
                                },
                              },
                            ]
                          );
                          return;
                        }
                        setChallengeFlowScreen('list');
                      }}
                      disabled={isJoinSubmitting || isLeaveSubmitting}
                    >
                      <Text style={styles.challengeDetailsSecondaryCtaText}>
                        {secondaryActionLabel}
                      </Text>
                    </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>

                </View>

                {challengeTileCount === 0 ? (
                  <View style={styles.challengeEmptyCard}>
                    <View style={styles.challengeEmptyBadge}>
                      <Text style={styles.challengeEmptyBadgeText}>Challenge</Text>
                    </View>
                    <Text style={styles.challengeEmptyTitle}>No challenge KPIs available yet</Text>
                    <Text style={styles.challengeEmptyText}>
                      Challenge-relevant KPIs will appear here once challenge context is available for your account.
                    </Text>
                    <TouchableOpacity
                      style={styles.challengeEmptyCta}
                      onPress={() => {
                        setActiveTab('home');
                        setViewMode('home');
                      }}
                    >
                      <Text style={styles.challengeEmptyCtaText}>Back to Home</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.challengeSectionsWrap}>
                    <View style={styles.challengeLoggingHeaderCard}>
                      <Text style={styles.challengeLoggingHeaderTitle}>Challenge Logging</Text>
                      <Text style={styles.challengeLoggingHeaderSub}>
                        Log challenge-related KPIs below while keeping this screen focused on challenge details and progress.
                      </Text>
                    </View>
                    {renderChallengeKpiSection('PC', 'Projections (PC)', challengeKpiGroups.PC)}
                    {renderChallengeKpiSection('GP', 'Growth (GP)', challengeKpiGroups.GP)}
                    {renderChallengeKpiSection('VP', 'Vitality (VP)', challengeKpiGroups.VP)}
                  </View>
                )}
              </>
            )}
          </View>
        ) : activeTab === 'team' ? (
          <View style={styles.challengeSurfaceWrap}>
            {(() => {
              const teamRouteMeta: Record<Exclude<TeamFlowScreen, 'dashboard'>, { title: string; figmaNode: string }> = {
                invite_member: { title: 'Invite Member', figmaNode: '173-4448' },
                pending_invitations: { title: teamPersonaVariant === 'member' ? 'Pending Invites' : 'Pending Invitations', figmaNode: '173-4612' },
                kpi_settings: { title: teamPersonaVariant === 'member' ? 'Team KPI Setting' : 'Team KPI Settings', figmaNode: '173-4531' },
                pipeline: { title: 'Pipeline', figmaNode: '168-16300' },
                team_challenges: {
                  title: teamPersonaVariant === 'member' ? 'Team Challenges' : 'Single Person Challenges',
                  figmaNode: teamPersonaVariant === 'member' ? '389-21273' : '173-4905',
                },
              };

              const teamMembers = [
                { name: 'Sarah Johnson', metric: '98%', sub: '8 KPIs logged' },
                { name: 'Alex Rodriguez', metric: '92%', sub: '8 KPIs logged' },
                { name: 'James Mateo', metric: '90%', sub: 'sarah@company.com' },
              ] as const;

              const teamInviteHistory = [
                { name: 'Sarah Johnson', status: 'Pending', statusTone: 'pending', action: 'send' },
                { name: 'Philip Antony', status: 'Joined', statusTone: 'joined', action: 'check' },
                { name: 'James Matew', status: 'Declined', statusTone: 'declined', action: 'send' },
              ] as const;
              const teamPendingRows = [
                { name: 'Sarah Johnson', email: 'sarah@company.com', sentAt: 'Sent on Oct 30, 2025', status: 'Pending' },
                { name: 'Philip Antony', email: 'philip@company.com', sentAt: 'Sent on Oct 30, 2025', status: 'Expired' },
              ] as const;
              const teamKpiSettingRows: Array<{
                title: string;
                sub: string;
                enabled: boolean;
                tone: 'mint' | 'sand' | 'lavender' | 'rose' | 'locked';
                badge?: string;
              }> = [
                { title: 'Sphere Calls', sub: 'Daily outreach calls', enabled: true, tone: 'mint' },
                { title: 'Appointments', sub: 'Client meetings scheduled', enabled: true, tone: 'sand' },
                { title: 'Closing', sub: 'Completed transactions', enabled: true, tone: 'lavender' },
                { title: 'Listing Taken', sub: 'New property listings', enabled: false, tone: 'rose' },
                { title: 'Advanced Analytics', sub: 'Detailed performance', enabled: false, tone: 'locked', badge: 'Pro' },
              ];
              const teamPipelineRows = [
                { name: 'Sarah Johnson', pending: 4, current: 3 },
                { name: 'Philip Antony', pending: 4, current: 2 },
                { name: 'James Matew', pending: 6, current: 1 },
              ] as const;
              const teamChallengeRows = [
                { title: '30 Day Listing Challenge', started: 'Started Oct 15, 2025', due: 'Till Nov 30, 2025', daysLeft: '12 days left', progress: 60, tone: 'green' },
                { title: '30 Day Listing Challenge', started: 'Started Oct 15, 2025', due: 'Till Nov 30, 2025', daysLeft: '12 days left', progress: 35, tone: 'yellow' },
              ] as const;
              const openChallengeFlowFromTeam = (mode: 'list' | 'details' | 'leaderboard' = 'details') => {
                const preferred = challengeListItems.find((item) => item.challengeModeLabel === 'Team') ?? challengeListItems[0];
                if (preferred) setChallengeSelectedId(preferred.id);
                setChallengeFlowScreen(mode);
                setActiveTab('challenge');
              };
              const openTeamCommsHandoff = (source: CoachingShellEntrySource) => {
                openCoachingShell('inbox_channels', {
                  source,
                  preferredChannelScope: 'team',
                  preferredChannelLabel: 'Team Updates',
                  threadTitle: 'Team Updates',
                  threadSub: 'Team updates thread.',
                  broadcastAudienceLabel: source === 'team_leader_dashboard' ? 'The Elite Group' : null,
                  broadcastRoleAllowed: source === 'team_leader_dashboard',
                });
              };
              const teamPrimaryChallenge =
                challengeListItems.find((item) => item.challengeModeLabel === 'Team') ?? challengeListItems[0] ?? null;
              const teamLightKpis = teamSurfaceKpis.slice(0, 3);
              const teamFocusSelectedRows = teamSurfaceKpis.filter((kpi) => teamFocusSelectedKpiIds.includes(String(kpi.id)));
              const teamFocusKpisForDisplay = teamFocusSelectedRows.length > 0 ? teamFocusSelectedRows : teamSurfaceKpis.slice(0, 4);
              const toggleTeamFocusKpi = (kpiId: string) => {
                setTeamFocusSelectedKpiIds((prev) =>
                  prev.includes(kpiId) ? prev.filter((id) => id !== kpiId) : [...prev, kpiId]
                );
              };
              const parsePercent = (value: string) => {
                const normalized = Number(String(value).replace('%', '').trim());
                return Number.isFinite(normalized) ? normalized : 0;
              };
              const teamLeaderRows = teamMembers.map((member, idx) => {
                const basePct = parsePercent(member.metric);
                const kpis = {
                  PC: Math.max(0, Math.min(100, basePct - (idx === 2 ? 12 : 4))),
                  GP: Math.max(0, Math.min(100, basePct - (idx === 1 ? 10 : 6))),
                  VP: Math.max(0, Math.min(100, basePct - (idx === 0 ? 8 : 14))),
                };
                const average = Math.round((kpis.PC + kpis.GP + kpis.VP) / 3);
                const status: TeamLeaderKpiStatusFilter =
                  average >= 86 ? 'on_track' : average >= 72 ? 'watch' : 'at_risk';
                const concerns: string[] = [];
                if (kpis.PC < 75) concerns.push('Projection confidence trending low');
                if (kpis.GP < 72) concerns.push('Growth KPIs under target cadence');
                if (kpis.VP < 70) concerns.push('Vitality activity missing this cycle');
                return {
                  id: member.name.toLowerCase().replace(/\s+/g, '-'),
                  name: member.name,
                  sub: member.sub,
                  metric: member.metric,
                  kpis,
                  average,
                  status,
                  concerns,
                };
              });
              const teamLeaderEscrowDeals = teamPipelineRows.reduce((sum, row) => sum + Math.max(0, Number(row.pending ?? 0)), 0);
              const teamLeaderProjectedRevenue = Math.round(Math.max(0, Number(cardMetrics.projectedNext90 ?? 0)));
              const teamLeaderConcernRows = teamLeaderRows
                .flatMap((row) => row.concerns.map((concern) => ({ member: row.name, concern, critical: row.status === 'at_risk' })))
                .slice(0, 6);
              const teamLeaderRowsFiltered = teamLeaderRows.filter((row) => {
                if (teamLeaderMemberFilter !== 'all' && row.id !== teamLeaderMemberFilter) return false;
                if (teamLeaderKpiStatusFilter !== 'all' && row.status !== teamLeaderKpiStatusFilter) return false;
                if (teamLeaderConcernFilter === 'flagged' && row.concerns.length === 0) return false;
                if (teamLeaderConcernFilter === 'critical' && row.status !== 'at_risk') return false;
                if (teamLeaderKpiTypeFilter !== 'all' && row.kpis[teamLeaderKpiTypeFilter] >= 75) return false;
                return true;
              });

              const teamLoggingBlock = (
                <View style={styles.challengeSectionsWrap}>
                  <View style={styles.challengeLoggingHeaderCard}>
                    <Text style={styles.challengeLoggingHeaderTitle}>Team Focus KPIs</Text>
                    <Text style={styles.challengeLoggingHeaderSub}>
                      Selected focus KPIs only. Shared KPI logging mechanics stay unchanged.
                    </Text>
                  </View>
                  {teamPersonaVariant === 'leader' ? (
                    <TouchableOpacity
                      style={styles.teamFocusEditorToggleBtn}
                      onPress={() => setTeamFocusKpiEditorOpen((prev) => !prev)}
                    >
                      <Text style={styles.teamFocusEditorToggleBtnText}>
                        {teamFocusKpiEditorOpen ? 'Close Team Focus KPI Selector' : 'Select Team Focus KPIs'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {teamPersonaVariant === 'member' ? (
                    <Text style={styles.teamFocusReadOnlyLabel}>Read-only focus KPIs</Text>
                  ) : null}

                  {teamTileCount === 0 ? (
                    <View style={styles.challengeEmptyCard}>
                      <View style={[styles.challengeEmptyBadge, styles.teamHeaderBadge]}>
                        <Text style={[styles.challengeEmptyBadgeText, styles.teamHeaderBadgeText]}>Team</Text>
                      </View>
                      <Text style={styles.challengeEmptyTitle}>No team KPIs available yet</Text>
                      <Text style={styles.challengeEmptyText}>
                        Team-relevant KPIs will appear here once team context is available for your account. Dashboard modules above remain in place for parity scaffolding.
                      </Text>
                      <TouchableOpacity
                        style={styles.challengeEmptyCta}
                        onPress={() => {
                          setActiveTab('home');
                          setViewMode('home');
                        }}
                      >
                        <Text style={styles.challengeEmptyCtaText}>Back to Home</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.teamFocusSummaryCard}>
                        {teamFocusKpisForDisplay.length === 0 ? (
                          <Text style={styles.teamFocusSummaryEmpty}>No focus KPIs selected yet.</Text>
                        ) : (
                          teamFocusKpisForDisplay.map((kpi) => (
                            <View key={`team-focus-kpi-${kpi.id}`} style={styles.teamFocusSummaryRow}>
                              <Text style={styles.teamFocusSummaryName}>{kpi.name}</Text>
                              <Text style={styles.teamFocusSummaryValue}>
                                {fmtNum(Number(kpi.vp_value ?? kpi.gp_value ?? kpi.pc_weight ?? 0))}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                      {teamPersonaVariant === 'leader' && teamFocusKpiEditorOpen ? (
                        <View style={styles.teamFocusEditorPanel}>
                          <Text style={styles.teamFocusEditorTitle}>Select Team Focus KPIs</Text>
                          {teamSurfaceKpis.map((kpi) => {
                            const kpiId = String(kpi.id);
                            const selected = teamFocusSelectedKpiIds.includes(kpiId);
                            return (
                              <TouchableOpacity
                                key={`team-focus-editor-${kpiId}`}
                                style={styles.teamFocusEditorRow}
                                onPress={() => toggleTeamFocusKpi(kpiId)}
                              >
                                <Text style={styles.teamFocusEditorRowName}>{kpi.name}</Text>
                                <Text style={selected ? styles.teamFocusEditorSelectedText : styles.teamFocusEditorUnselectedText}>
                                  {selected ? 'Selected' : 'Select'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={styles.teamFocusEditorDoneBtn}
                            onPress={() => setTeamFocusKpiEditorOpen(false)}
                          >
                            <Text style={styles.teamFocusEditorDoneBtnText}>Save and Close</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              );

              const renderTeamRouteScreen = (screen: Exclude<TeamFlowScreen, 'dashboard'>) => {
                const meta = teamRouteMeta[screen];
                return (
                  <View style={styles.teamRouteScreenWrap}>
                    <View style={styles.teamRouteScreenNavRow}>
                      <TouchableOpacity style={styles.teamRouteScreenBackBtn} onPress={() => setTeamFlowScreen('dashboard')}>
                        <Text style={styles.teamRouteScreenBackBtnText}>‹</Text>
                      </TouchableOpacity>
                      <Text style={styles.teamRouteScreenNavTitle}>{meta.title}</Text>
                      <View style={styles.teamRouteScreenNavSpacer} />
                    </View>

                    {screen === 'invite_member' ? (
                      <>
                        <View style={styles.teamRouteInfoBanner}>
                          <Text style={styles.teamRouteInfoIcon}>i</Text>
                          <Text style={styles.teamRouteInfoBannerText}>
                            Add teammates to your group by sending them an invite.
                          </Text>
                        </View>
                        <Text style={styles.teamRouteFieldLabel}>Send Invite by Email or Username</Text>
                        <View style={styles.teamRouteInlineInputRow}>
                          <View style={styles.teamRouteInputGhost}>
                            <Text style={styles.teamRouteInputGhostText}>Enter friend's name or email</Text>
                          </View>
                          <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn} onPress={() => setTeamFlowScreen('pending_invitations')}>
                            <Text style={styles.teamRouteSmallPrimaryBtnText}>Send</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.teamRouteFieldLabel}>Share Challenge Link</Text>
                        <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('team_challenges')}>
                          <Text style={styles.teamRoutePrimaryBtnText}>Copy Challenge Link</Text>
                        </TouchableOpacity>
                        <View style={styles.teamRouteSectionHeaderRow}>
                          <Text style={styles.teamRouteSectionTitle}>Invite History</Text>
                          <TouchableOpacity onPress={() => setTeamFlowScreen('pending_invitations')}>
                            <Text style={styles.teamRouteSectionLink}>View All</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.teamRouteStack}>
                          {teamInviteHistory.map((row) => (
                            <View key={`${row.name}-${row.status}`} style={styles.teamRouteCardRow}>
                              <View style={styles.teamRouteAvatarCircle}>
                                <Text style={styles.teamRouteAvatarText}>
                                  {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.teamRouteCardRowCopy}>
                                <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                                <Text style={styles.teamRouteCardRowSub}>{row.status}</Text>
                              </View>
                              <View style={styles.teamRouteTrailingActions}>
                                {row.action === 'send' ? (
                                  <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                                    <Text style={styles.teamRouteIconGhostBtnText}>↗</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                                    <Text style={styles.teamRouteIconGhostBtnText}>✓</Text>
                                  </TouchableOpacity>
                                )}
                                {row.statusTone === 'pending' ? (
                                  <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                                    <Text style={styles.teamRouteIconGhostBtnText}>×</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}

                    {screen === 'pending_invitations' ? (
                      <>
                        <View style={styles.teamRouteInfoBanner}>
                          <Text style={styles.teamRouteInfoIcon}>i</Text>
                          <Text style={styles.teamRouteInfoBannerText}>
                            Manage pending invites or approve join requests from new members.
                          </Text>
                        </View>
                        <View style={styles.teamRouteStack}>
                          {teamPendingRows.map((row) => (
                            <View key={`${row.name}-${row.status}`} style={styles.teamRoutePendingCard}>
                              <View style={styles.teamRoutePendingTopRow}>
                                <View style={styles.teamRouteAvatarCircle}>
                                  <Text style={styles.teamRouteAvatarText}>
                                    {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={styles.teamRouteCardRowCopy}>
                                  <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                                  <Text style={styles.teamRouteCardRowSub}>{row.email}</Text>
                                  <Text style={styles.teamRouteCardRowSub}>{row.sentAt}</Text>
                                </View>
                                <View
                                  style={[
                                    styles.teamRouteStatusBadge,
                                    row.status === 'Pending' ? styles.teamRouteStatusBadgePending : styles.teamRouteStatusBadgeExpired,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.teamRouteStatusBadgeText,
                                      row.status === 'Pending' ? styles.teamRouteStatusBadgeTextPending : styles.teamRouteStatusBadgeTextExpired,
                                    ]}
                                  >
                                    {row.status}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.teamRouteInlineButtonsRow}>
                                <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn}>
                                  <Text style={styles.teamRouteSmallPrimaryBtnText}>Resend</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.teamRouteSmallSecondaryBtn}>
                                  <Text style={styles.teamRouteSmallSecondaryBtnText}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('dashboard')}>
                          <Text style={styles.teamRoutePrimaryBtnText}>Save Changes</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}

                    {screen === 'kpi_settings' ? (
                      <>
                        <View style={styles.teamRouteInfoBanner}>
                          <Text style={styles.teamRouteInfoIcon}>i</Text>
                          <Text style={styles.teamRouteInfoBannerText}>
                            Select the KPIs your team will be required to track. These KPIs will appear on every member's dashboard.
                          </Text>
                        </View>
                        <View style={styles.teamRouteStack}>
                          {teamKpiSettingRows.map((row, idx) => (
                            <View key={row.title} style={[styles.teamRouteKpiRow, idx > 0 && styles.teamRouteKpiRowDivider]}>
                              <View
                                style={[
                                  styles.teamRouteKpiIconWrap,
                                  row.tone === 'mint'
                                    ? styles.teamRouteKpiIconMint
                                    : row.tone === 'sand'
                                      ? styles.teamRouteKpiIconSand
                                      : row.tone === 'lavender'
                                        ? styles.teamRouteKpiIconLavender
                                        : row.tone === 'rose'
                                          ? styles.teamRouteKpiIconRose
                                          : styles.teamRouteKpiIconGray,
                                ]}
                              >
                                <Text style={styles.teamRouteKpiIconText}>
                                  {row.tone === 'locked' ? '🔒' : row.tone === 'mint' ? '🎧' : row.tone === 'sand' ? '📖' : row.tone === 'lavender' ? '🤝' : '🏠'}
                                </Text>
                              </View>
                              <View style={styles.teamRouteCardRowCopy}>
                                <Text style={[styles.teamRouteCardRowTitle, row.tone === 'locked' && styles.teamRouteMutedText]}>{row.title}</Text>
                                <Text style={[styles.teamRouteCardRowSub, row.tone === 'locked' && styles.teamRouteMutedText]}>{row.sub}</Text>
                              </View>
                              {row.badge ? (
                                <View style={styles.teamRouteProBadge}>
                                  <Text style={styles.teamRouteProBadgeText}>{row.badge}</Text>
                                </View>
                              ) : (
                                <View style={[styles.teamRouteToggle, row.enabled && styles.teamRouteToggleOn]}>
                                  <View style={[styles.teamRouteToggleKnob, row.enabled && styles.teamRouteToggleKnobOn]} />
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('dashboard')}>
                          <Text style={styles.teamRoutePrimaryBtnText}>Save Changes</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}

                    {screen === 'pipeline' ? (
                      <>
                        <View style={[styles.teamRouteInfoBanner, styles.teamRouteInfoBannerLavender]}>
                          <Text style={styles.teamRouteInfoIcon}>⚡</Text>
                          <View style={styles.teamRouteCardRowCopy}>
                            <Text style={styles.teamRouteCardRowTitle}>14 Pending Deals</Text>
                            <Text style={styles.teamRouteCardRowSub}>Team Deal Closed</Text>
                          </View>
                        </View>
                        <View style={styles.teamRouteStack}>
                          {teamPipelineRows.map((row) => (
                            <View key={row.name} style={styles.teamRouteCardRow}>
                              <View style={styles.teamRouteAvatarCircle}>
                                <Text style={styles.teamRouteAvatarText}>
                                  {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.teamRouteCardRowCopy}>
                                <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                                <Text style={styles.teamRouteCardRowSub}>{row.pending} Deals Pending</Text>
                                <Text style={styles.teamRouteCardRowSub}>{row.current} Current Deals</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}

                    {screen === 'team_challenges' ? (
                      <>
                        <View style={styles.teamChallengesHeroRow}>
                          <View style={styles.teamChallengesUpcomingCard}>
                            <View style={styles.teamChallengesUpcomingIcon}>
                              <Text style={styles.teamChallengesUpcomingIconText}>⚡</Text>
                            </View>
                            <View style={styles.teamRouteCardRowCopy}>
                              <Text style={styles.teamRouteCardRowTitle}>Upcoming</Text>
                              <Text style={styles.teamRouteCardRowSub}>New challenge on</Text>
                            </View>
                            <Text style={styles.teamChallengesUpcomingDate}>Nov 8</Text>
                          </View>
                          {teamPersonaVariant !== 'member' ? (
                            <TouchableOpacity
                              style={styles.teamChallengesCreateBtn}
                              onPress={() => openChallengeFlowFromTeam('list')}
                            >
                              <Text style={styles.teamChallengesCreateBtnText}>Open Challenges</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <View style={styles.teamChallengesStatsRow}>
                          <View style={[styles.teamChallengesStatCard, styles.teamParityStatCardGreen]}>
                            <Text style={styles.teamParityStatTitle}>Active</Text>
                            <Text style={styles.teamParityStatValue}>02</Text>
                            <Text style={styles.teamParityStatFoot}>Challenges</Text>
                          </View>
                          <View style={[styles.teamChallengesStatCard, styles.teamParityStatCardPurple]}>
                            <Text style={styles.teamParityStatTitle}>Completed</Text>
                            <Text style={styles.teamParityStatValue}>03</Text>
                            <Text style={styles.teamParityStatFoot}>Challenges</Text>
                          </View>
                        </View>
                        <View style={styles.teamChallengesSegmentRow}>
                          <View style={[styles.teamChallengesSegmentPill, styles.teamChallengesSegmentPillActive]}>
                            <Text style={[styles.teamChallengesSegmentPillText, styles.teamChallengesSegmentPillTextActive]}>Active</Text>
                          </View>
                          <View style={styles.teamChallengesSegmentPill}>
                            <Text style={styles.teamChallengesSegmentPillText}>Completed</Text>
                          </View>
                        </View>
                        <View style={styles.teamRouteStack}>
                          {teamChallengeRows.map((row) => (
                            <TouchableOpacity
                              key={`${row.title}-${row.progress}`}
                              style={styles.teamChallengesCard}
                              onPress={() => openChallengeFlowFromTeam('details')}
                            >
                              <View style={styles.teamChallengesCardTopRow}>
                                <View style={styles.teamRouteCardRowCopy}>
                                  <Text style={styles.teamRouteCardRowTitle}>{row.title}</Text>
                                  <Text style={styles.teamRouteCardRowSub}>{row.started}</Text>
                                </View>
                                <View style={styles.teamChallengesActiveBadge}>
                                  <Text style={styles.teamChallengesActiveBadgeText}>Active</Text>
                                </View>
                              </View>
                              <View style={styles.teamChallengesCardMetaRow}>
                                <Text style={styles.teamChallengesMetaStrong}>{row.due}</Text>
                                <Text style={styles.teamRouteCardRowSub}>{row.daysLeft}</Text>
                              </View>
                              <View style={styles.teamChallengesProgressTrack}>
                                <View
                                  style={[
                                    styles.teamChallengesProgressFill,
                                    row.tone === 'yellow' && styles.teamChallengesProgressFillYellow,
                                    { width: `${row.progress}%` },
                                  ]}
                                />
                              </View>
                              <Text style={styles.teamRouteCardRowSub}>Progress: {row.progress}%</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                );
              };

              if (teamFlowScreen !== 'dashboard') {
                return renderTeamRouteScreen(teamFlowScreen);
              }

              return (
                <>
                  {teamPersonaVariant === 'member' ? (
                    <View style={styles.teamMemberDashboardWrap}>
                      <Text style={styles.teamMemberDashTitle}>Team</Text>

                      <View style={styles.teamMemberGroupCard}>
                        <View style={styles.teamMemberGroupRow}>
                          <View style={styles.teamMemberGroupIcon}>
                            <Text style={styles.teamMemberGroupIconText}>👥</Text>
                          </View>
                          <View style={styles.teamMemberGroupCopy}>
                            <Text style={styles.teamMemberGroupName}>The Elite Group</Text>
                            <Text style={styles.teamMemberGroupSub}>3 Members | 2 Ongoing challenges</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.teamMemberInviteBtn} onPress={() => setTeamFlowScreen('invite_member')}>
                          <Text style={styles.teamMemberInviteBtnText}>⊕ Invite Member</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity style={styles.teamMemberChallengeCard} activeOpacity={0.92} onPress={() => openChallengeFlowFromTeam('details')}>
                        <View style={styles.teamMemberChallengeTopRow}>
                          <Text style={styles.teamMemberChallengeLabel}>Active Challenge</Text>
                          <Text style={styles.teamMemberChallengeLink}>Open</Text>
                        </View>
                        <Text style={styles.teamMemberChallengeTitle}>{teamPrimaryChallenge?.title ?? 'Team Challenge'}</Text>
                        <Text style={styles.teamMemberChallengeSub}>
                          {teamPrimaryChallenge?.daysLabel ?? 'Open team challenge details and leaderboard.'}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.teamMemberLightKpiCard}>
                        <View style={styles.teamMemberLightKpiHeader}>
                          <Text style={styles.teamMemberSectionLabel}>Team KPIs</Text>
                          {renderKnownLimitedDataChip('team KPI relevance')}
                        </View>
                        {teamLightKpis.length === 0 ? (
                          <Text style={styles.teamMemberLightKpiEmpty}>No team KPI rows yet.</Text>
                        ) : (
                          teamLightKpis.map((kpi) => (
                            <View key={`team-member-kpi-${kpi.id}`} style={styles.teamMemberLightKpiRow}>
                              <Text style={styles.teamMemberLightKpiName}>{kpi.name}</Text>
                              <Text style={styles.teamMemberLightKpiValue}>
                                {fmtNum(Number(kpi.vp_value ?? kpi.gp_value ?? kpi.pc_weight ?? 0))}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>

                      <Text style={styles.teamMemberSectionLabel}>Team Members</Text>
                      <View style={styles.teamMemberRowsCard}>
                        {[
                          { name: 'Sarah Johnson', role: 'Team Lead', tone: '#e8dfcc' },
                          { name: 'Alex Rodriguez', role: 'Member', tone: '#f1cb66' },
                          { name: 'James Matew', role: 'Team Lead', tone: '#dfc2a4' },
                        ].map((member, idx) => (
                          <TouchableOpacity
                            key={member.name}
                            style={[styles.teamMemberRow, idx > 0 && styles.teamParityDividerTop]}
                            activeOpacity={0.92}
                            onPress={() => setTeamFlowScreen('team_challenges')}
                          >
                            <View style={[styles.teamMemberRowAvatar, { backgroundColor: member.tone }]}>
                              <Text style={styles.teamMemberRowAvatarText}>
                                {member.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                              </Text>
                            </View>
                            <View style={styles.teamMemberRowCopy}>
                              <Text style={styles.teamMemberRowName}>{member.name}</Text>
                              <Text style={styles.teamMemberRowSub}>{member.role}</Text>
                            </View>
                            <Text style={styles.teamMemberRowMenu}>›</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.teamMemberFooterButtonsRow}>
                        <TouchableOpacity
                          style={[styles.teamMemberFooterBtn, styles.teamMemberFooterBtnPrimary]}
                          onPress={() => openTeamCommsHandoff('team_member_dashboard')}
                        >
                          <Text style={styles.teamMemberFooterBtnTextPrimary}>Team Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.teamMemberFooterBtn, styles.teamMemberFooterBtnDark]}
                          onPress={() => openChallengeFlowFromTeam('details')}
                        >
                          <Text style={styles.teamMemberFooterBtnTextDark}>Challenge Details</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.teamMemberViewChallengesBtn} onPress={() => setTeamFlowScreen('team_challenges')}>
                        <Text style={styles.teamMemberViewChallengesBtnText}>View Team Challenges</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.teamLeaderOpsWrap}>
                      <View style={styles.teamLeaderOpsHeader}>
                        <Text style={styles.teamParityNavTitle}>Team Leader Ops</Text>
                        {renderKnownLimitedDataChip('member KPI contracts')}
                      </View>

                      <View style={styles.teamLeaderTotalsRow}>
                        <TouchableOpacity style={[styles.teamParityStatCard, styles.teamParityStatCardGreen]} onPress={() => setTeamFlowScreen('pipeline')}>
                          <Text style={styles.teamParityStatTitle}>Deals in Escrow</Text>
                          <Text style={styles.teamParityStatValue}>{teamLeaderEscrowDeals}</Text>
                          <Text style={styles.teamParityStatFoot}>Open pipeline deals</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.teamParityStatCard, styles.teamParityStatCardPurple]} onPress={() => openChallengeFlowFromTeam('details')}>
                          <Text style={styles.teamParityStatTitle}>Projected Revenue</Text>
                          <Text style={styles.teamParityStatValue}>{fmtUsd(teamLeaderProjectedRevenue)}</Text>
                          <Text style={styles.teamParityStatFoot}>Next 90 days</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.teamLeaderFiltersCard}>
                        <View style={styles.teamLeaderFilterRow}>
                          {([{ key: 'all', label: 'All' }, ...teamLeaderRows.map((row) => ({ key: row.id, label: row.name.split(' ')[0] }))] as const).map((filter) => (
                            <TouchableOpacity
                              key={`team-leader-member-${filter.key}`}
                              style={[styles.teamLeaderFilterChip, teamLeaderMemberFilter === filter.key ? styles.teamLeaderFilterChipActive : null]}
                              onPress={() => setTeamLeaderMemberFilter(filter.key)}
                            >
                              <Text style={[styles.teamLeaderFilterChipText, teamLeaderMemberFilter === filter.key ? styles.teamLeaderFilterChipTextActive : null]}>
                                {filter.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={styles.teamLeaderFilterRow}>
                          {([
                            { key: 'all', label: 'All KPI' },
                            { key: 'PC', label: 'PC' },
                            { key: 'GP', label: 'GP' },
                            { key: 'VP', label: 'VP' },
                          ] as const).map((filter) => (
                            <TouchableOpacity
                              key={`team-leader-type-${filter.key}`}
                              style={[styles.teamLeaderFilterChip, teamLeaderKpiTypeFilter === filter.key ? styles.teamLeaderFilterChipActive : null]}
                              onPress={() => setTeamLeaderKpiTypeFilter(filter.key)}
                            >
                              <Text style={[styles.teamLeaderFilterChipText, teamLeaderKpiTypeFilter === filter.key ? styles.teamLeaderFilterChipTextActive : null]}>
                                {filter.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={styles.teamLeaderFilterRow}>
                          {([
                            { key: 'all', label: 'All Status' },
                            { key: 'on_track', label: 'On Track' },
                            { key: 'watch', label: 'Watch' },
                            { key: 'at_risk', label: 'At Risk' },
                          ] as const).map((filter) => (
                            <TouchableOpacity
                              key={`team-leader-status-${filter.key}`}
                              style={[styles.teamLeaderFilterChip, teamLeaderKpiStatusFilter === filter.key ? styles.teamLeaderFilterChipActive : null]}
                              onPress={() => setTeamLeaderKpiStatusFilter(filter.key)}
                            >
                              <Text style={[styles.teamLeaderFilterChipText, teamLeaderKpiStatusFilter === filter.key ? styles.teamLeaderFilterChipTextActive : null]}>
                                {filter.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={styles.teamLeaderFilterRow}>
                          {([
                            { key: 'all', label: 'All Flags' },
                            { key: 'flagged', label: 'Flagged' },
                            { key: 'critical', label: 'Critical' },
                          ] as const).map((filter) => (
                            <TouchableOpacity
                              key={`team-leader-concern-${filter.key}`}
                              style={[styles.teamLeaderFilterChip, teamLeaderConcernFilter === filter.key ? styles.teamLeaderFilterChipActive : null]}
                              onPress={() => setTeamLeaderConcernFilter(filter.key)}
                            >
                              <Text style={[styles.teamLeaderFilterChipText, teamLeaderConcernFilter === filter.key ? styles.teamLeaderFilterChipTextActive : null]}>
                                {filter.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.teamLeaderExpandableList}>
                        {teamLeaderRowsFiltered.length === 0 ? (
                          <View style={styles.teamLeaderEmptyState}>
                            <Text style={styles.teamLeaderEmptyTitle}>No members match active filters</Text>
                            <Text style={styles.teamLeaderEmptySub}>Try broader KPI type or concern filters.</Text>
                          </View>
                        ) : (
                          teamLeaderRowsFiltered.map((row) => {
                            const isExpanded = teamLeaderExpandedMemberId === row.id;
                            const activeType = teamLeaderKpiTypeFilter === 'all' ? 'PC' : teamLeaderKpiTypeFilter;
                            return (
                              <View key={row.id} style={styles.teamLeaderMemberCard}>
                                <TouchableOpacity
                                  style={styles.teamLeaderMemberHeader}
                                  onPress={() => setTeamLeaderExpandedMemberId(isExpanded ? null : row.id)}
                                >
                                  <View style={styles.teamParityMemberAvatar}>
                                    <Text style={styles.teamParityMemberAvatarText}>
                                      {row.name
                                        .split(' ')
                                        .map((part) => part[0])
                                        .join('')
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </Text>
                                  </View>
                                  <View style={styles.teamParityMemberCopy}>
                                    <Text style={styles.teamParityMemberName}>{row.name}</Text>
                                    <Text style={styles.teamParityMemberSub}>{row.sub}</Text>
                                  </View>
                                  <Text style={styles.teamLeaderMemberStatus}>{row.status.replace('_', ' ')}</Text>
                                </TouchableOpacity>
                                {isExpanded ? (
                                  <View style={styles.teamLeaderMemberExpandedBody}>
                                    <Text style={styles.teamLeaderExpandedKpiRow}>
                                      {activeType} KPI: {row.kpis[activeType]}% ({row.average}% avg)
                                    </Text>
                                    <Text style={styles.teamLeaderExpandedKpiRow}>PC {row.kpis.PC}% • GP {row.kpis.GP}% • VP {row.kpis.VP}%</Text>
                                    {row.concerns.length === 0 ? (
                                      <Text style={styles.teamLeaderExpandedKpiRow}>No concern flags.</Text>
                                    ) : (
                                      row.concerns.map((concern) => (
                                        <Text key={`${row.id}-${concern}`} style={styles.teamLeaderConcernBullet}>• {concern}</Text>
                                      ))
                                    )}
                                    <View style={styles.teamLeaderExpandedActionsRow}>
                                      <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn} onPress={() => openChallengeFlowFromTeam('details')}>
                                        <Text style={styles.teamRouteSmallPrimaryBtnText}>Challenge</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity style={styles.teamRouteSmallSecondaryBtn} onPress={() => openTeamCommsHandoff('team_leader_dashboard')}>
                                        <Text style={styles.teamRouteSmallSecondaryBtnText}>Comms</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })
                        )}
                      </View>

                      <View style={styles.teamLeaderConcernCard}>
                        <View style={styles.teamMemberChallengeTopRow}>
                          <Text style={styles.teamMemberChallengeLabel}>KPI Concern Flags</Text>
                          <Text style={styles.teamMemberChallengeLink}>{teamLeaderConcernRows.length}</Text>
                        </View>
                        {teamLeaderConcernRows.length === 0 ? (
                          <Text style={styles.teamMemberChallengeSub}>No flagged indicators in the current filter set.</Text>
                        ) : (
                          teamLeaderConcernRows.slice(0, 3).map((row) => (
                            <Text key={`${row.member}-${row.concern}`} style={styles.teamLeaderConcernBullet}>
                              • {row.member}: {row.concern}
                            </Text>
                          ))
                        )}
                      </View>
                    </View>
                  )}

                  {teamLoggingBlock}
                </>
              );
            })()}
          </View>
        ) : activeTab === 'comms' ? (
          <View style={styles.coachingShellWrap}>
            {(() => {
              const sourceLabelByKey: Record<CoachingShellEntrySource, string> = {
                home: 'Home / Priority',
                challenge_details: 'Challenge Details',
                team_leader_dashboard: 'Team Dashboard (Leader)',
                team_member_dashboard: 'Team Dashboard (Member)',
                user_tab: 'Comms Hub',
                unknown: 'Direct Shell',
              };
              const preferredChannelScope = coachingShellContext.preferredChannelScope;
              const sourceLabel = sourceLabelByKey[coachingShellContext.source];
              const roleCanOpenBroadcast = isCoachRuntimeOperator || (teamPersonaVariant === 'leader' && !isChallengeSponsorRuntime);
              const commsPersonaVariant: 'coach' | 'team_leader' | 'sponsor' | 'member' | 'solo' = isCoachRuntimeOperator
                ? 'coach'
                : isChallengeSponsorRuntime
                  ? 'sponsor'
                  : teamPersonaVariant === 'leader'
                    ? 'team_leader'
                    : runtimeRoleSignals.some((signal) => signal.includes('solo'))
                      ? 'solo'
                      : 'member';
              const commsPersonaBadgeLabel = commsPersonaVariant.replace('_', ' ');
              const commsPersonaSummary =
                commsPersonaVariant === 'coach'
                  ? 'Coach layout: monitor channels, keep journeys active, and draft guidance with approval-first controls.'
                  : commsPersonaVariant === 'team_leader'
                    ? 'Team Leader layout: run team communications, keep journeys moving, and publish reviewed broadcasts.'
                    : commsPersonaVariant === 'sponsor'
                      ? 'Sponsor layout: monitor sponsor-scoped channels and journey progress visibility. KPI logging stays disabled.'
                      : commsPersonaVariant === 'solo'
                        ? 'Solo layout: focus on your journey milestones and direct channel updates.'
                        : 'Member layout: keep up with team/challenge updates and journey lesson progress.';
              const allChannelApiRows = Array.isArray(channelsApiRows) ? channelsApiRows : [];
              const scopeFilterMatch = (row: ChannelApiRow) => {
                const scope = normalizeChannelTypeToScope(row.type);
                if (commsHubScopeFilter === 'all') return true;
                if (commsHubScopeFilter === 'team') return scope === 'team';
                if (commsHubScopeFilter === 'cohort') return scope === 'cohort';
                if (commsHubScopeFilter === 'segment') return scope === 'challenge' || scope === 'sponsor';
                if (commsHubScopeFilter === 'global') return scope === 'community';
                return true;
              };
              const searchNeedle = commsHubSearchQuery.trim().toLowerCase();
              const searchMatch = (row: ChannelApiRow) => {
                if (!searchNeedle) return true;
                const scope = normalizeChannelTypeToScope(row.type) ?? 'community';
                const chips = [row.name, row.type, scope, row.my_role ?? '', String(row.unread_count ?? 0)];
                return chips.some((v) => String(v).toLowerCase().includes(searchNeedle));
              };
              const filteredChannelApiRows = (coachingShellContext.preferredChannelScope
                ? allChannelApiRows.filter((row) => {
                    const scope = normalizeChannelTypeToScope(row.type);
                    return scope === coachingShellContext.preferredChannelScope || scope === 'community';
                  })
                : allChannelApiRows) as ChannelApiRow[];
              const dmApiRows = allChannelApiRows.filter((row) => String(row.type ?? '').toLowerCase() === 'direct');
              const scopeFilteredChannelRows = allChannelApiRows
                .filter((row) => String(row.type ?? '').toLowerCase() !== 'direct')
                .filter(scopeFilterMatch)
                .filter(searchMatch);
              const scopeFilteredDmRows = dmApiRows.filter(searchMatch);
              const broadcastTargetOptions: Array<'team' | 'cohort' | 'channel'> = isCoachRuntimeOperator
                ? ['team', 'cohort', 'channel']
                : teamPersonaVariant === 'leader' && !isChallengeSponsorRuntime
                  ? ['team', 'cohort']
                  : [];
              const effectiveBroadcastTargetScope = broadcastTargetOptions.includes(broadcastTargetScope)
                ? broadcastTargetScope
                : (broadcastTargetOptions[0] ?? 'team');
              const broadcastCandidateRows = allChannelApiRows
                .filter((row) => String(row.type ?? '').toLowerCase() !== 'direct')
                .filter((row) => {
                  const scope = normalizeChannelTypeToScope(row.type);
                  if (effectiveBroadcastTargetScope === 'team') return scope === 'team';
                  if (effectiveBroadcastTargetScope === 'cohort') return scope === 'cohort';
                  return true;
                })
                .filter(searchMatch);
              const primaryTabRows =
                commsHubPrimaryTab === 'dms'
                  ? scopeFilteredDmRows
                  : commsHubPrimaryTab === 'channels'
                    ? scopeFilteredChannelRows
                    : filteredChannelApiRows;
              const searchPlaceholder =
                commsHubPrimaryTab === 'channels'
                  ? commsHubScopeFilter === 'all'
                    ? 'Search channels...'
                    : `Search ${commsHubScopeFilter} channels...`
                  : commsHubPrimaryTab === 'dms'
                    ? 'Search direct messages...'
                    : commsHubPrimaryTab === 'broadcast'
                      ? 'Search broadcast destinations...'
                      : 'Search all communications...';
              const selectedChannelRow =
                filteredChannelApiRows.find((row) => String(row.id) === String(selectedChannelId ?? '')) ??
                allChannelApiRows.find((row) => String(row.id) === String(selectedChannelId ?? '')) ??
                null;
              const selectedChannelResolvedId = selectedChannelRow ? String(selectedChannelRow.id) : null;
              const selectedChannelResolvedName = selectedChannelRow?.name ?? selectedChannelName ?? null;
              const journeyListRows = Array.isArray(coachingJourneys) ? coachingJourneys : [];
              const selectedJourneyId =
                coachingShellContext.selectedJourneyId ?? (journeyListRows[0]?.id ? String(journeyListRows[0].id) : null);
              const selectedJourneyTitle =
                coachingShellContext.selectedJourneyTitle ??
                (journeyListRows.find((row) => String(row.id) === selectedJourneyId)?.title ?? null);
              const milestoneRows = Array.isArray(coachingJourneyDetail?.milestones) ? coachingJourneyDetail.milestones : [];
              const allLessonRows = milestoneRows.flatMap((milestone) =>
                (Array.isArray(milestone.lessons) ? milestone.lessons : []).map((lesson) => ({
                  ...lesson,
                  milestoneTitle: milestone.title,
                }))
              );
              const selectedLessonId =
                coachingShellContext.selectedLessonId ?? (allLessonRows[0]?.id ? String(allLessonRows[0].id) : null);
              const selectedLesson =
                allLessonRows.find((lesson) => String(lesson.id) === selectedLessonId) ?? null;
              const selectedLessonStatus = String(selectedLesson?.progress_status ?? 'not_started') as
                | 'not_started'
                | 'in_progress'
                | 'completed';
              const contextualThreadTitle = coachingShellContext.threadTitle ?? 'Channel Thread';
              const contextualThreadSub =
                coachingShellContext.threadSub ??
                'Read and send updates in this channel.';
              const contextualChannelSub = preferredChannelScope
                ? `Choose a ${coachingShellContext.preferredChannelLabel ?? preferredChannelScope} channel.`
                : 'Choose a channel to continue.';
              const shellMeta: Record<
                CoachingShellScreen,
                { title: string; sub: string; badge: string; primary?: { label: string; to: CoachingShellScreen }[] }
              > = {
                inbox: {
                  title: 'Inbox',
                  sub: 'Review coaching updates and next actions.',
                  badge: 'communication',
                  primary: [{ label: 'Open Channels', to: 'inbox_channels' }],
                },
                inbox_channels: {
                  title: 'Inbox / Channels',
                  sub: contextualChannelSub,
                  badge: 'communication',
                },
                channel_thread: {
                  title: contextualThreadTitle,
                  sub: contextualThreadSub,
                  badge: 'communication',
                },
                coach_broadcast_compose: {
                  title: 'Broadcast Composer',
                  sub: roleCanOpenBroadcast
                    ? `Draft a broadcast for ${coachingShellContext.broadcastAudienceLabel ?? 'your team channel'}.`
                    : 'Leader-only broadcast tool.',
                  badge: roleCanOpenBroadcast ? 'leader-gated' : 'blocked',
                },
                coaching_journeys: {
                  title: 'Coaching Journeys',
                  sub: 'Tap a journey to open milestones and lessons.',
                  badge: 'coaching_content',
                },
                coaching_journey_detail: {
                  title: 'Coaching Journey Detail',
                  sub: selectedJourneyTitle
                    ? `Tap a lesson in ${selectedJourneyTitle} to open lesson detail.`
                    : 'Select a journey to view milestones.',
                  badge: 'coaching_content',
                },
                coaching_lesson_detail: {
                  title: 'Coaching Lesson Detail',
                  sub: selectedLesson
                    ? 'Read the lesson and update progress.'
                    : 'Choose a lesson from Journey Detail.',
                  badge: 'coaching_content',
                },
              };
              const meta = shellMeta[coachingShellScreen];
              const shellPackageOutcome =
                coachingShellScreen === 'inbox' || coachingShellScreen === 'inbox_channels'
                  ? pickRuntimePackageVisibility(
                    channelsPackageVisibility,
                    normalizePackagingReadModelToVisibilityOutcome(selectedChannelRow?.packaging_read_model ?? null),
                    selectedChannelRow?.package_visibility ?? null
                  )
                  : coachingShellScreen === 'channel_thread'
                    ? pickRuntimePackageVisibility(
                        channelThreadPackageVisibility,
                        normalizePackagingReadModelToVisibilityOutcome(selectedChannelRow?.packaging_read_model ?? null),
                        selectedChannelRow?.package_visibility ?? null,
                        channelsPackageVisibility
                      )
                    : coachingShellScreen === 'coach_broadcast_compose'
                      ? pickRuntimePackageVisibility(
                          normalizePackagingReadModelToVisibilityOutcome(selectedChannelRow?.packaging_read_model ?? null),
                          selectedChannelRow?.package_visibility ?? null,
                          channelsPackageVisibility
                        )
                      : coachingShellScreen === 'coaching_journeys'
                        ? pickRuntimePackageVisibility(
                            coachingJourneysPackageVisibility,
                            normalizePackagingReadModelToVisibilityOutcome(coachingProgressSummary?.packaging_read_model ?? null),
                            coachingProgressSummary?.package_visibility ?? null,
                            normalizePackagingReadModelToVisibilityOutcome(journeyListRows[0]?.packaging_read_model ?? null),
                            journeyListRows[0]?.package_visibility ?? null
                          )
                        : pickRuntimePackageVisibility(
                            normalizePackagingReadModelToVisibilityOutcome(coachingJourneyDetail?.packaging_read_model ?? null),
                            coachingJourneyDetail?.package_visibility ?? null,
                            normalizePackagingReadModelToVisibilityOutcome(coachingJourneyDetail?.journey?.packaging_read_model ?? null),
                            coachingJourneyDetail?.journey?.package_visibility ?? null,
                            coachingJourneysPackageVisibility,
                            normalizePackagingReadModelToVisibilityOutcome(coachingProgressSummary?.packaging_read_model ?? null),
                            coachingProgressSummary?.package_visibility ?? null
                          );
              const shellPackageGatePresentation = deriveCoachingPackageGatePresentation(meta.title, shellPackageOutcome);
              const shellPackageGateBlocksActions =
                shellPackageGatePresentation.tone === 'gated' || shellPackageGatePresentation.tone === 'blocked';
              const channelRows = ([
                { scope: 'team', label: 'Team Updates', context: 'Team updates' },
                { scope: 'challenge', label: 'Challenge Updates', context: 'Challenge updates' },
                { scope: 'sponsor', label: 'Sponsor Updates', context: 'Sponsor updates' },
                { scope: 'cohort', label: 'Cohort Updates', context: 'Cohort updates' },
                { scope: 'community', label: 'Community Updates', context: 'Community updates' },
              ] as const)
                .filter((row) => {
                  if (!preferredChannelScope) return true;
                  return row.scope === preferredChannelScope || row.scope === 'community';
                })
                .map((row) => ({
                  ...row,
                  context:
                    preferredChannelScope === row.scope
                      ? `${row.context} • linked from ${sourceLabel}`
                      : `${row.context} • optional`,
                }));
              const fallbackChannelRowsVisible = !Array.isArray(channelsApiRows) || (channelsApiRows?.length ?? 0) === 0;
              return (
                <>
                  <View style={styles.coachingShellCard}>
                    <View style={styles.coachingShellTopRow}>
                      <Text style={styles.coachingShellTitle}>Comms Hub</Text>
                      <View style={styles.coachingShellBadge}>
                        <Text style={styles.coachingShellBadgeText}>{commsPersonaBadgeLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.coachingShellSub}>{commsPersonaSummary}</Text>
                    <View style={styles.coachingShellActionRow}>
                      {([
                        { key: 'all' as const, label: 'All' },
                        { key: 'channels' as const, label: 'Channels' },
                        { key: 'dms' as const, label: 'DMs' },
                        ...(roleCanOpenBroadcast ? [{ key: 'broadcast' as const, label: 'Broadcast' }] : []),
                      ] as const).map((tab) => (
                        <TouchableOpacity
                          key={`comms-tab-${tab.key}`}
                          style={[
                            styles.coachingLessonActionBtn,
                            commsHubPrimaryTab === tab.key ? styles.coachingLessonActionBtnActive : null,
                          ]}
                          onPress={() => {
                            setCommsHubPrimaryTab(tab.key);
                            if (tab.key === 'all') {
                              openCoachingShell('inbox', {
                                source: 'user_tab',
                                preferredChannelScope: null,
                                preferredChannelLabel: null,
                                threadTitle: null,
                                threadSub: null,
                                broadcastAudienceLabel: null,
                                broadcastRoleAllowed: false,
                              });
                              return;
                            }
                            if (tab.key === 'channels' || tab.key === 'dms') {
                              openCoachingShell('inbox_channels', {
                                source: 'user_tab',
                                preferredChannelScope: null,
                                preferredChannelLabel: null,
                                threadTitle: null,
                                threadSub: null,
                                broadcastAudienceLabel: null,
                                broadcastRoleAllowed: false,
                              });
                              return;
                            }
                            openCoachingShell('coach_broadcast_compose');
                          }}
                        >
                          <Text
                            style={[
                              styles.coachingLessonActionBtnText,
                              commsHubPrimaryTab === tab.key ? styles.coachingLessonActionBtnTextActive : null,
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {commsHubPrimaryTab === 'channels' ? (
                      <View style={styles.coachingShellActionRow}>
                        {([
                          { key: 'all' as const, label: 'All Types' },
                          { key: 'team' as const, label: 'Team' },
                          { key: 'cohort' as const, label: 'Cohort' },
                          { key: 'segment' as const, label: 'Segment' },
                          { key: 'global' as const, label: 'Global' },
                        ] as const).map((filter) => (
                          <TouchableOpacity
                            key={`comms-scope-${filter.key}`}
                            style={[
                              styles.coachingLessonActionBtn,
                              commsHubScopeFilter === filter.key ? styles.coachingLessonActionBtnActive : null,
                            ]}
                            onPress={() => setCommsHubScopeFilter(filter.key)}
                          >
                            <Text
                              style={[
                                styles.coachingLessonActionBtnText,
                                commsHubScopeFilter === filter.key ? styles.coachingLessonActionBtnTextActive : null,
                              ]}
                            >
                              {filter.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <TextInput
                      value={commsHubSearchQuery}
                      onChangeText={setCommsHubSearchQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor="#9aa3b0"
                      style={styles.coachingShellSearchInput}
                    />
                    <Text style={styles.coachingShellSub}>Current: {meta.title} · {meta.sub}</Text>
                    {renderCoachingPackageGateBanner(meta.title, shellPackageOutcome, { compact: true })}
                    {shellPackageGateBlocksActions ? (
                      renderKnownLimitedDataChip('coaching package access')
                    ) : (
                      <>
                        {meta.primary?.map((action) => (
                          <TouchableOpacity
                            key={`${coachingShellScreen}-${action.to}`}
                            style={styles.coachingShellPrimaryBtn}
                            onPress={() => openCoachingShell(action.to)}
                          >
                            <Text style={styles.coachingShellPrimaryBtnText}>{action.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {coachingShellScreen === 'inbox'
                      ? renderCoachingNotificationSurface(
                          'Coaching notifications inbox rows',
                          inboxNotificationRows,
                          inboxNotificationSummaryEffective,
                          {
                            maxRows: 4,
                            mode: 'list',
                            emptyHint: 'No coaching notification rows are available yet.',
                          }
                        )
                      : null}
                    {coachingShellScreen === 'inbox' || coachingShellScreen === 'inbox_channels'
                      ? renderRuntimeStateBanner(inboxRuntimeStateModel, { compact: true })
                      : null}
                    {coachingShellScreen === 'inbox_channels' ? (
                      <View style={styles.coachingShellList}>
                        {(fallbackChannelsNotificationRows.length > 0 ||
                          Number(channelsNotificationSummary?.total_count ?? 0) > 0 ||
                          Number(channelsNotificationSummary?.unread_count ?? 0) > 0)
                          ? renderCoachingNotificationSurface(
                              'Channel notification rows',
                              fallbackChannelsNotificationRows,
                              channelsNotificationSummary ??
                                summarizeNotificationRows(fallbackChannelsNotificationRows, { sourceLabel: 'channels:effective' }),
                              {
                                compact: true,
                                maxRows: 3,
                                mode: 'list',
                                emptyHint: 'No channel notification rows yet.',
                              }
                            )
                          : null}
                        {channelsLoading ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <ActivityIndicator size="small" />
                            <Text style={styles.coachingJourneyEmptyTitle}>Loading channels…</Text>
                          </View>
                        ) : channelsError ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>Channels failed to load</Text>
                            <Text style={styles.coachingJourneyEmptySub}>{channelsError}</Text>
                            <TouchableOpacity style={styles.coachingJourneyRetryBtn} onPress={() => void fetchChannels()}>
                              <Text style={styles.coachingJourneyRetryBtnText}>Retry Channels</Text>
                            </TouchableOpacity>
                          </View>
                        ) : primaryTabRows.length > 0 ? (
                          primaryTabRows.map((row) => {
                            const rowScope = normalizeChannelTypeToScope(row.type) ?? 'community';
                            const isSelected = String(row.id) === String(selectedChannelResolvedId ?? '');
                            const typeLabel = String(row.type ?? 'channel');
                            const scopeLabel =
                              rowScope === 'community'
                                ? 'Global'
                                : rowScope === 'challenge'
                                  ? 'Segment'
                                  : rowScope.charAt(0).toUpperCase() + rowScope.slice(1);
                            const lastActivityPreview = row.last_seen_at
                              ? `Last activity ${fmtMonthDayTime(row.last_seen_at)}`
                              : row.created_at
                                ? `Created ${fmtShortMonthDay(row.created_at)}`
                                : 'Recent activity unavailable';
                            return (
                              <TouchableOpacity
                                key={`api-channel-${row.id}`}
                              style={[
                                styles.coachingShellListRow,
                                isSelected ? styles.coachingShellListRowSelected : null,
                                shellPackageGateBlocksActions ? styles.disabled : null,
                              ]}
                                disabled={shellPackageGateBlocksActions}
                                onPress={() => {
                                  if (shellPackageGateBlocksActions) return;
                                  setSelectedChannelId(String(row.id));
                                  setSelectedChannelName(row.name);
                                  setChannelMessageSubmitError(null);
                                  setBroadcastError(null);
                                  setBroadcastSuccessNote(null);
                                  openCoachingShell('channel_thread', {
                                    preferredChannelScope: rowScope,
                                    preferredChannelLabel: row.name,
                                    threadTitle: row.name,
                                    threadSub: `Messages in ${row.name}.`,
                                    broadcastAudienceLabel:
                                      rowScope === 'team' && roleCanOpenBroadcast
                                        ? row.name
                                        : coachingShellContext.broadcastAudienceLabel,
                                    broadcastRoleAllowed: rowScope === 'team' ? roleCanOpenBroadcast : false,
                                  });
                                }}
                              >
                                <View style={styles.coachingShellListIcon}>
                                  <Text style={styles.coachingShellListIconText}>#</Text>
                                </View>
                                <View style={styles.coachingShellListCopy}>
                                  <Text style={styles.coachingShellListTitle}>{row.name}</Text>
                                  <View style={styles.coachingShellChipRow}>
                                    <View style={styles.coachingShellChip}>
                                      <Text style={styles.coachingShellChipText}>{scopeLabel}</Text>
                                    </View>
                                    <View style={styles.coachingShellChip}>
                                      <Text style={styles.coachingShellChipText}>{typeLabel}</Text>
                                    </View>
                                    {row.my_role ? (
                                      <View style={styles.coachingShellChip}>
                                        <Text style={styles.coachingShellChipText}>{row.my_role}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text style={styles.coachingShellListSubText}>
                                    {lastActivityPreview} • unread: {Math.max(0, Number(row.unread_count ?? 0))}
                                  </Text>
                                </View>
                                <Text style={styles.coachingShellListChevron}>›</Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : fallbackChannelRowsVisible ? (
                          commsHubPrimaryTab === 'dms'
                            ? ([
                                { id: 'dm-sarah', name: 'Sarah Johnson', role: 'Team Lead' },
                                { id: 'dm-alex', name: 'Alex Rodriguez', role: 'Member' },
                                { id: 'dm-james', name: 'James Matew', role: 'Team Lead' },
                              ] as const).map((member) => (
                                <TouchableOpacity
                                  key={member.id}
                                  style={[styles.coachingShellListRow, shellPackageGateBlocksActions ? styles.disabled : null]}
                                  disabled={shellPackageGateBlocksActions}
                                  onPress={() =>
                                    shellPackageGateBlocksActions
                                      ? undefined
                                      : openCoachingShell('channel_thread', {
                                          preferredChannelScope: 'community',
                                          preferredChannelLabel: member.name,
                                          threadTitle: member.name,
                                          threadSub: `Direct message with ${member.name}.`,
                                          broadcastAudienceLabel: null,
                                          broadcastRoleAllowed: false,
                                        })
                                  }
                                >
                                  <View style={styles.coachingShellListIcon}>
                                    <Text style={styles.coachingShellListIconText}>@</Text>
                                  </View>
                                  <View style={styles.coachingShellListCopy}>
                                    <Text style={styles.coachingShellListTitle}>{member.name}</Text>
                                    <Text style={styles.coachingShellListSubText}>Direct thread • {member.role}</Text>
                                  </View>
                                  <Text style={styles.coachingShellListChevron}>›</Text>
                                </TouchableOpacity>
                              ))
                            : channelRows.map((row) => (
                                <TouchableOpacity
                                  key={row.label}
                                  style={[styles.coachingShellListRow, shellPackageGateBlocksActions ? styles.disabled : null]}
                                  disabled={shellPackageGateBlocksActions}
                                  onPress={() =>
                                    shellPackageGateBlocksActions
                                      ? undefined
                                      : openCoachingShell('channel_thread', {
                                          preferredChannelScope: row.scope,
                                          preferredChannelLabel: row.label,
                                          threadTitle: row.label,
                                          threadSub: `${row.context}.`,
                                          broadcastAudienceLabel:
                                            row.scope === 'team' && roleCanOpenBroadcast
                                              ? coachingShellContext.broadcastAudienceLabel ?? 'The Elite Group'
                                              : null,
                                          broadcastRoleAllowed: row.scope === 'team' ? roleCanOpenBroadcast : false,
                                        })
                                  }
                                >
                                  <View style={styles.coachingShellListIcon}>
                                    <Text style={styles.coachingShellListIconText}>#</Text>
                                  </View>
                                  <View style={styles.coachingShellListCopy}>
                                    <Text style={styles.coachingShellListTitle}>{row.label}</Text>
                                    <Text style={styles.coachingShellListSubText}>{row.context}</Text>
                                  </View>
                                  <Text style={styles.coachingShellListChevron}>›</Text>
                                </TouchableOpacity>
                              ))
                        ) : (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>
                              {commsHubPrimaryTab === 'dms' ? 'No direct messages for this view' : 'No channels for this scope'}
                            </Text>
                            <Text style={styles.coachingJourneyEmptySub}>
                              {commsHubPrimaryTab === 'dms'
                                ? 'No direct message rows match the active search/filter.'
                                : 'The API returned channels, but none match the current scope/search filter.'}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : null}
                    {coachingShellScreen === 'channel_thread' ? (
                      <View style={styles.coachingShellComposeCard}>
                        {renderRuntimeStateBanner(channelThreadRuntimeStateModel, { compact: true })}
                        <Text style={styles.coachingShellComposeTitle}>
                          {selectedChannelResolvedName ?? contextualThreadTitle}
                        </Text>
                        <Text style={styles.coachingShellComposeSub}>
                          {selectedChannelResolvedId
                            ? 'Channel messages'
                            : 'Select a channel to start messaging.'}
                        </Text>
                        {renderCoachingNotificationSurface(
                          'Thread system notifications',
                          channelThreadNotificationItems,
                          channelThreadNotificationSummary,
                          {
                            compact: true,
                            maxRows: 2,
                            mode: 'thread',
                            emptyHint: 'No thread notification rows returned for this channel.',
                          }
                        )}
                        {shellPackageGateBlocksActions ? (
                          renderKnownLimitedDataChip('thread actions')
                        ) : (
                          <TouchableOpacity
                            style={styles.coachingAiAssistBtn}
                            onPress={() =>
                              openAiAssistShell(
                                {
                                  host: 'channel_thread',
                                  title: 'AI Reply Draft (Approval-First)',
                                  sub: 'Draft only. Human send is required.',
                                  targetLabel: selectedChannelResolvedName ?? contextualThreadTitle,
                                  approvedInsertOnly: true,
                                },
                                {
                                  prompt: `Draft a reply for ${selectedChannelResolvedName ?? contextualThreadTitle} that is supportive and action-oriented.`,
                                  draft: channelMessageDraft,
                                }
                              )
                            }
                          >
                            <Text style={styles.coachingAiAssistBtnText}>AI Assist Draft / Rewrite</Text>
                          </TouchableOpacity>
                        )}
                        {channelMessagesError ? (
                          <Text style={styles.coachingJourneyInlineError}>{channelMessagesError}</Text>
                        ) : null}
                        {channelMessagesLoading ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <ActivityIndicator size="small" />
                            <Text style={styles.coachingJourneyEmptyTitle}>Loading messages…</Text>
                          </View>
                        ) : Array.isArray(channelMessages) && channelMessages.length > 0 ? (
                          <View style={styles.coachingThreadMessagesList}>
                            {channelMessages.map((message) => {
                              const isMine = String(message.sender_user_id ?? '') === String(session?.user?.id ?? '');
                              const isBroadcast = String(message.message_type ?? '') === 'broadcast';
                              return (
                                <View
                                  key={`channel-message-${message.id}`}
                                  style={[
                                    styles.coachingThreadMessageBubble,
                                    isMine ? styles.coachingThreadMessageBubbleMine : null,
                                  ]}
                                >
                                  <Text style={styles.coachingThreadMessageMeta}>
                                    {isBroadcast ? 'Broadcast' : 'Message'} • {fmtMonthDayTime(message.created_at ?? null)}
                                  </Text>
                                  <Text style={styles.coachingThreadMessageBody}>{message.body}</Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>
                              {selectedChannelResolvedId ? 'No messages yet' : 'Thread shell only'}
                            </Text>
                            <Text style={styles.coachingJourneyEmptySub}>
                              {selectedChannelResolvedId
                                ? 'This channel has no visible messages yet.'
                                : 'Select an API channel from Inbox / Channels to enable read/send behavior.'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.coachingThreadComposerWrap}>
                          <TextInput
                            value={channelMessageDraft}
                            onChangeText={(text) => {
                              setChannelMessageDraft(text);
                              if (channelMessageSubmitError) setChannelMessageSubmitError(null);
                            }}
                            placeholder="Write a message…"
                            placeholderTextColor="#9aa3b0"
                            multiline
                            style={styles.coachingThreadComposerInput}
                          />
                          {channelMessageSubmitError ? (
                            <Text style={styles.coachingJourneyInlineError}>{channelMessageSubmitError}</Text>
                          ) : null}
                          <View style={styles.coachingLessonActionRow}>
                            <TouchableOpacity
                              style={[styles.coachingLessonActionBtn, channelMessageSubmitting ? styles.disabled : null]}
                              disabled={channelMessageSubmitting}
                              onPress={() => {
                                if (selectedChannelResolvedId) {
                                  void fetchChannelMessages(selectedChannelResolvedId);
                                }
                              }}
                            >
                              <Text style={styles.coachingLessonActionBtnText}>Refresh</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.coachingLessonActionBtn,
                                styles.coachingLessonActionBtnActive,
                                (!selectedChannelResolvedId || channelMessageSubmitting || shellPackageGateBlocksActions)
                                  ? styles.disabled
                                  : null,
                              ]}
                              disabled={!selectedChannelResolvedId || channelMessageSubmitting || shellPackageGateBlocksActions}
                              onPress={() => {
                                if (selectedChannelResolvedId) void sendChannelMessage(selectedChannelResolvedId);
                              }}
                            >
                              <Text style={[styles.coachingLessonActionBtnText, styles.coachingLessonActionBtnTextActive]}>
                                {channelMessageSubmitting ? 'Sending…' : 'Send'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : null}
                    {coachingShellScreen === 'coach_broadcast_compose' ? (
                      <View style={styles.coachingShellComposeCard}>
                        <Text style={styles.coachingShellComposeTitle}>Broadcast Composer</Text>
                        <Text style={styles.coachingShellComposeSub}>
                          {roleCanOpenBroadcast
                            ? `Role-gated broadcast entry. Audience context: ${coachingShellContext.broadcastAudienceLabel ?? selectedChannelResolvedName ?? 'choose a destination'}.`
                            : 'Broadcast is hidden for member/solo/sponsor runtime flows.'}
                        </Text>
                        {!roleCanOpenBroadcast || shellPackageGateBlocksActions ? (
                          renderKnownLimitedDataChip('broadcast compose access')
                        ) : (
                          <TouchableOpacity
                            style={styles.coachingAiAssistBtn}
                            onPress={() =>
                              openAiAssistShell(
                                {
                                  host: 'coach_broadcast_compose',
                                  title: 'AI Broadcast Draft (Approval-First)',
                                  sub: 'Draft only. Human send is required.',
                                  targetLabel:
                                    coachingShellContext.broadcastAudienceLabel ??
                                    selectedChannelResolvedName ??
                                    'Broadcast audience',
                                  approvedInsertOnly: true,
                                },
                                {
                                  prompt: `Draft a team coaching broadcast for ${coachingShellContext.broadcastAudienceLabel ?? selectedChannelResolvedName ?? 'this audience'} with a clear next action.`,
                                  draft: broadcastDraft,
                                }
                              )
                            }
                          >
                              <Text style={styles.coachingAiAssistBtnText}>AI Assist Draft / Rewrite</Text>
                            </TouchableOpacity>
                        )}
                        {roleCanOpenBroadcast ? (
                          <>
                            <View style={styles.coachingLessonActionRow}>
                              {broadcastTargetOptions.map((target) => (
                                <TouchableOpacity
                                  key={`broadcast-target-${target}`}
                                  style={[
                                    styles.coachingLessonActionBtn,
                                    effectiveBroadcastTargetScope === target ? styles.coachingLessonActionBtnActive : null,
                                  ]}
                                  onPress={() => {
                                    setBroadcastTargetScope(target);
                                    setBroadcastError(null);
                                    setBroadcastSuccessNote(null);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.coachingLessonActionBtnText,
                                      effectiveBroadcastTargetScope === target ? styles.coachingLessonActionBtnTextActive : null,
                                    ]}
                                  >
                                    {target === 'team' ? 'Team' : target === 'cohort' ? 'Cohort' : 'Channel'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <View style={styles.coachingShellList}>
                              {broadcastCandidateRows.length > 0 ? (
                                broadcastCandidateRows.slice(0, 8).map((row) => {
                                  const isActive = String(row.id) === String(selectedChannelResolvedId ?? '');
                                  const scope = normalizeChannelTypeToScope(row.type) ?? 'community';
                                  return (
                                    <TouchableOpacity
                                      key={`broadcast-destination-${row.id}`}
                                      style={[styles.coachingShellListRow, isActive ? styles.coachingShellListRowSelected : null]}
                                      onPress={() => {
                                        setSelectedChannelId(String(row.id));
                                        setSelectedChannelName(row.name);
                                      }}
                                    >
                                      <View style={styles.coachingShellListIcon}>
                                        <Text style={styles.coachingShellListIconText}>#</Text>
                                      </View>
                                      <View style={styles.coachingShellListCopy}>
                                        <Text style={styles.coachingShellListTitle}>{row.name}</Text>
                                        <Text style={styles.coachingShellListSubText}>
                                          {scope} • {String(row.type ?? 'channel')}
                                        </Text>
                                      </View>
                                      <Text style={styles.coachingShellListChevron}>›</Text>
                                    </TouchableOpacity>
                                  );
                                })
                              ) : (
                                <View style={styles.coachingJourneyEmptyCard}>
                                  <Text style={styles.coachingJourneyEmptyTitle}>No destination channels found</Text>
                                  <Text style={styles.coachingJourneyEmptySub}>
                                    No channels match this target scope for your current role.
                                  </Text>
                                </View>
                              )}
                            </View>
                          </>
                        ) : null}
                        <View style={styles.coachingShellInputGhost}>
                          <Text style={styles.coachingShellInputGhostText}>
                            {roleCanOpenBroadcast
                              ? `Broadcast path: /api/channels/{id}/broadcast (${selectedChannelResolvedId ? `selected ${selectedChannelResolvedName ?? 'channel'}` : 'select a destination channel first'})`
                              : 'Audience selector unavailable for this persona'}
                          </Text>
                        </View>
                        <TextInput
                          value={broadcastDraft}
                          onChangeText={(text) => {
                            setBroadcastDraft(text);
                            if (broadcastError) setBroadcastError(null);
                            if (broadcastSuccessNote) setBroadcastSuccessNote(null);
                          }}
                          placeholder="Broadcast message body…"
                          placeholderTextColor="#9aa3b0"
                          multiline
                          style={[styles.coachingThreadComposerInput, styles.coachingThreadComposerInputTall]}
                        />
                        {broadcastError ? <Text style={styles.coachingJourneyInlineError}>{broadcastError}</Text> : null}
                        {broadcastSuccessNote ? <Text style={styles.coachingThreadSuccessText}>{broadcastSuccessNote}</Text> : null}
                        <View style={styles.coachingLessonActionRow}>
                          <TouchableOpacity
                            style={[styles.coachingLessonActionBtn, channelsLoading ? styles.disabled : null]}
                            disabled={channelsLoading}
                            onPress={() => void fetchChannels()}
                          >
                            <Text style={styles.coachingLessonActionBtnText}>Refresh Channels</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.coachingLessonActionBtn,
                              styles.coachingLessonActionBtnActive,
                              (!roleCanOpenBroadcast || !selectedChannelResolvedId || broadcastSubmitting || shellPackageGateBlocksActions)
                                ? styles.disabled
                                : null,
                            ]}
                            disabled={!roleCanOpenBroadcast || !selectedChannelResolvedId || broadcastSubmitting || shellPackageGateBlocksActions}
                            onPress={() => {
                              if (selectedChannelResolvedId) void sendChannelBroadcast(selectedChannelResolvedId);
                            }}
                          >
                            <Text style={[styles.coachingLessonActionBtnText, styles.coachingLessonActionBtnTextActive]}>
                              {shellPackageGateBlocksActions
                                ? 'Package Gated'
                                : broadcastSubmitting
                                  ? 'Sending…'
                                  : roleCanOpenBroadcast
                                    ? 'Send Broadcast'
                                    : 'Leader Only'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                    {coachingShellScreen === 'coaching_journeys' ? (
                      <View style={styles.coachingJourneyModule}>
                        {renderRuntimeStateBanner(journeysRuntimeStateModel, { compact: true })}
                        {renderCoachingNotificationSurface(
                          'Coaching journey notifications',
                          journeysNotificationRows,
                          journeysNotificationSummaryEffective,
                          {
                            compact: true,
                            maxRows: 3,
                            mode: 'banner',
                            emptyHint: 'No coaching journey notifications available.',
                          }
                        )}
                        {shellPackageGateBlocksActions ? (
                          renderKnownLimitedDataChip('journey actions')
                        ) : (
                          <TouchableOpacity
                            style={styles.coachingAiAssistBtn}
                            onPress={() =>
                              openAiAssistShell(
                                {
                                  host: 'coaching_journeys',
                                  title: 'AI Coaching Suggestion (Approval-First)',
                                  sub: 'Draft only. Human review required.',
                                  targetLabel: selectedJourneyTitle ?? 'Coaching Journeys',
                                  approvedInsertOnly: true,
                                },
                                {
                                  prompt: `Draft a coaching suggestion based on ${selectedJourneyTitle ?? 'the current journeys'} progress summary.`,
                                }
                              )
                            }
                          >
                            <Text style={styles.coachingAiAssistBtnText}>AI Coaching Suggestion Draft</Text>
                          </TouchableOpacity>
                        )}
                        <View style={styles.coachingJourneySummaryRow}>
                          <View style={styles.coachingJourneySummaryCard}>
                            <Text style={styles.coachingJourneySummaryLabel}>Progress Rows</Text>
                            <Text style={styles.coachingJourneySummaryValue}>
                              {coachingProgressLoading ? '…' : String(coachingProgressSummary?.total_progress_rows ?? 0)}
                            </Text>
                          </View>
                          <View style={styles.coachingJourneySummaryCard}>
                            <Text style={styles.coachingJourneySummaryLabel}>Completed</Text>
                            <Text style={styles.coachingJourneySummaryValue}>
                              {coachingProgressLoading
                                ? '…'
                                : String(coachingProgressSummary?.status_counts?.completed ?? 0)}
                            </Text>
                          </View>
                          <View style={styles.coachingJourneySummaryCard}>
                            <Text style={styles.coachingJourneySummaryLabel}>Completion</Text>
                            <Text style={styles.coachingJourneySummaryValue}>
                              {coachingProgressLoading
                                ? '…'
                                : `${Math.round(Number(coachingProgressSummary?.completion_percent ?? 0))}%`}
                            </Text>
                          </View>
                        </View>
                        {coachingProgressError ? (
                          <Text style={styles.coachingJourneyInlineError}>{coachingProgressError}</Text>
                        ) : null}
                        {coachingJourneysLoading ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <ActivityIndicator size="small" />
                            <Text style={styles.coachingJourneyEmptyTitle}>Loading coaching journeys…</Text>
                          </View>
                        ) : coachingJourneysError ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>Journeys failed to load</Text>
                            <Text style={styles.coachingJourneyEmptySub}>Could not load journeys.</Text>
                            <TouchableOpacity
                              style={styles.coachingJourneyRetryBtn}
                              onPress={() => {
                                void fetchCoachingJourneys();
                                void fetchCoachingProgressSummary();
                              }}
                            >
                              <Text style={styles.coachingJourneyRetryBtnText}>Retry Journeys</Text>
                            </TouchableOpacity>
                          </View>
                        ) : journeyListRows.length === 0 ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>No journeys available</Text>
                            <Text style={styles.coachingJourneyEmptySub}>No visible journeys in this scope.</Text>
                          </View>
                        ) : (
                          <View style={styles.coachingJourneyListCard}>
                            {journeyListRows.map((journey, idx) => {
                              const lessonsTotal = Number(journey.lessons_total ?? 0);
                              const lessonsCompleted = Number(journey.lessons_completed ?? 0);
                              const pct = Math.max(0, Math.round(Number(journey.completion_percent ?? 0)));
                              const isSelected = String(journey.id) === String(selectedJourneyId ?? '');
                              return (
                                <TouchableOpacity
                                  key={`coaching-journey-${journey.id}`}
                                  style={[
                                    styles.coachingJourneyRow,
                                    idx > 0 && styles.coachingJourneyRowDivider,
                                    isSelected ? styles.coachingJourneyRowSelected : null,
                                    shellPackageGateBlocksActions ? styles.disabled : null,
                                  ]}
                                  disabled={shellPackageGateBlocksActions}
                                  onPress={() =>
                                    openCoachingShell('coaching_journey_detail', {
                                      source: coachingShellContext.source,
                                      selectedJourneyId: String(journey.id),
                                      selectedJourneyTitle: journey.title,
                                      selectedLessonId: null,
                                      selectedLessonTitle: null,
                                    })
                                  }
                                >
                                  <View style={styles.coachingJourneyRowCopy}>
                                    <Text numberOfLines={1} style={styles.coachingJourneyRowTitle}>{journey.title}</Text>
                                    <Text numberOfLines={2} style={styles.coachingJourneyRowSub}>
                                      {(journey.description || 'No journey description yet.').trim()}
                                    </Text>
                                    <Text style={styles.coachingJourneyRowMeta}>
                                      {Number(journey.milestones_count ?? 0)} milestones • {lessonsCompleted}/{lessonsTotal} lessons completed
                                    </Text>
                                  </View>
                                  <View style={styles.coachingJourneyRowMetricWrap}>
                                    <Text style={styles.coachingJourneyRowMetric}>{pct}%</Text>
                                    <Text style={styles.coachingJourneyRowChevron}>›</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    ) : null}
                    {coachingShellScreen === 'coaching_journey_detail' ? (
                      <View style={styles.coachingJourneyModule}>
                        {renderRuntimeStateBanner(journeysRuntimeStateModel, { compact: true })}
                        {renderCoachingNotificationSurface(
                          'Journey detail notifications',
                          journeysNotificationRows,
                          journeysNotificationSummaryEffective,
                          {
                            compact: true,
                            maxRows: 2,
                            mode: 'banner',
                            emptyHint: 'No journey detail notifications available.',
                          }
                        )}
                        {!selectedJourneyId ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>Choose a journey first</Text>
                            <Text style={styles.coachingJourneyEmptySub}>Open Coaching Journeys to continue.</Text>
                          </View>
                        ) : coachingJourneyDetailLoading ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <ActivityIndicator size="small" />
                            <Text style={styles.coachingJourneyEmptyTitle}>Loading journey detail…</Text>
                          </View>
                        ) : coachingJourneyDetailError ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>Journey detail failed to load</Text>
                            <Text style={styles.coachingJourneyEmptySub}>Could not load journey detail.</Text>
                            <TouchableOpacity
                              style={styles.coachingJourneyRetryBtn}
                              onPress={() => {
                                if (selectedJourneyId) void fetchCoachingJourneyDetail(selectedJourneyId);
                              }}
                            >
                              <Text style={styles.coachingJourneyRetryBtnText}>Retry Detail</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <View style={styles.coachingJourneyDetailHeader}>
                              <Text style={styles.coachingJourneyDetailTitle}>
                                {coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? 'Journey Detail'}
                              </Text>
                              <Text style={styles.coachingJourneyDetailSub}>
                                {String(coachingJourneyDetail?.journey?.description ?? 'Milestones and lessons loaded from coaching endpoints.')}
                              </Text>
                            </View>
                            <View style={styles.coachingLessonActionRow}>
                              <TouchableOpacity
                                style={styles.coachingLessonActionBtn}
                                onPress={() =>
                                  openCoachingShell('coaching_journeys', {
                                    source: coachingShellContext.source,
                                    selectedJourneyId: selectedJourneyId ?? null,
                                    selectedJourneyTitle:
                                      coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? null,
                                    selectedLessonId: null,
                                    selectedLessonTitle: null,
                                  })
                                }
                              >
                                <Text style={styles.coachingLessonActionBtnText}>Back to Journeys</Text>
                              </TouchableOpacity>
                            </View>
                            {shellPackageGateBlocksActions ? (
                              renderKnownLimitedDataChip('journey detail actions')
                            ) : (
                              <TouchableOpacity
                                style={styles.coachingAiAssistBtn}
                                onPress={() =>
                                  openAiAssistShell(
                                    {
                                      host: 'coaching_journey_detail',
                                      title: 'AI Journey Coaching Draft (Approval-First)',
                                      sub: 'Draft only. Human review required.',
                                      targetLabel:
                                        coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? 'Journey Detail',
                                      approvedInsertOnly: true,
                                    },
                                    {
                                      prompt: `Draft a coaching note for the journey ${coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? 'current journey'} using milestone progress context.`,
                                    }
                                  )
                                }
                              >
                                <Text style={styles.coachingAiAssistBtnText}>AI Journey Draft</Text>
                              </TouchableOpacity>
                            )}
                            {milestoneRows.length === 0 ? (
                              <View style={styles.coachingJourneyEmptyCard}>
                                <Text style={styles.coachingJourneyEmptyTitle}>No milestones found</Text>
                                <Text style={styles.coachingJourneyEmptySub}>No milestones available.</Text>
                              </View>
                            ) : (
                              <View style={styles.coachingJourneyListCard}>
                                {milestoneRows.map((milestone, milestoneIdx) => (
                                  <View
                                    key={`coaching-milestone-${milestone.id}`}
                                    style={[
                                      styles.coachingMilestoneBlock,
                                      milestoneIdx > 0 ? styles.coachingJourneyRowDivider : null,
                                    ]}
                                  >
                                    <Text style={styles.coachingMilestoneTitle}>{milestone.title}</Text>
                                    {(milestone.lessons ?? []).length === 0 ? (
                                      <Text style={styles.coachingMilestoneEmpty}>No active lessons yet.</Text>
                                    ) : (
                                      (milestone.lessons ?? []).map((lesson, lessonIdx) => {
                                        const statusLabel = String(lesson.progress_status ?? 'not_started').replace('_', ' ');
                                        const isActiveLesson = String(lesson.id) === String(selectedLessonId ?? '');
                                        return (
                                          <TouchableOpacity
                                            key={`coaching-lesson-${lesson.id}`}
                                            style={[
                                              styles.coachingLessonRow,
                                              lessonIdx > 0 ? styles.coachingLessonRowDivider : null,
                                              isActiveLesson ? styles.coachingLessonRowSelected : null,
                                              shellPackageGateBlocksActions ? styles.disabled : null,
                                            ]}
                                            disabled={shellPackageGateBlocksActions}
                                            onPress={() =>
                                              openCoachingShell('coaching_lesson_detail', {
                                                selectedJourneyId: selectedJourneyId ?? null,
                                                selectedJourneyTitle:
                                                  coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? null,
                                                selectedLessonId: String(lesson.id),
                                                selectedLessonTitle: lesson.title,
                                              })
                                            }
                                          >
                                            <View style={styles.coachingLessonRowCopy}>
                                              <Text numberOfLines={1} style={styles.coachingLessonRowTitle}>{lesson.title}</Text>
                                              <Text numberOfLines={2} style={styles.coachingLessonRowSub}>
                                                {lesson.body?.trim() || 'Lesson content body available on lesson detail.'}
                                              </Text>
                                            </View>
                                            <View style={styles.coachingLessonRowStatusPill}>
                                              <Text style={styles.coachingLessonRowStatusText}>{statusLabel}</Text>
                                            </View>
                                          </TouchableOpacity>
                                        );
                                      })
                                    )}
                                  </View>
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    ) : null}
                    {coachingShellScreen === 'coaching_lesson_detail' ? (
                      <View style={styles.coachingJourneyModule}>
                        {renderRuntimeStateBanner(journeysRuntimeStateModel, { compact: true })}
                        {renderCoachingNotificationSurface(
                          'Lesson notifications',
                          selectedLesson
                            ? [
                                {
                                  id: `lesson-progress-notice-${selectedLesson.id}`,
                                  notification_class:
                                    selectedLessonStatus === 'completed'
                                      ? 'lesson_completed_status'
                                      : selectedLessonStatus === 'in_progress'
                                        ? 'lesson_progress_reminder'
                                        : 'lesson_assignment_prompt',
                                  title:
                                    selectedLessonStatus === 'completed'
                                      ? 'Lesson completed'
                                      : selectedLessonStatus === 'in_progress'
                                        ? 'Lesson in progress'
                                        : 'Lesson ready to start',
                                  body:
                                    selectedLessonStatus === 'completed'
                                      ? 'Progress is already recorded. Notification UI is informational only.'
                                      : 'Use explicit progress buttons below to update status. Notification taps do not write progress.',
                                  read_state: selectedLessonStatus === 'completed' ? 'read' : 'unread',
                                  severity: selectedLessonStatus === 'completed' ? 'success' : 'info',
                                  delivery_channels: ['in_app', 'banner'],
                                  route_target: { screen: 'coaching_lesson_detail', lesson_id: String(selectedLesson.id) },
                                  source_family: 'lesson_detail_local',
                                },
                                ...aiApprovalNotificationRows.slice(0, 1),
                              ]
                            : aiApprovalNotificationRows.slice(0, 1),
                          summarizeNotificationRows(
                            selectedLesson
                              ? [
                                  {
                                    id: `lesson-progress-notice-${selectedLesson.id}`,
                                    notification_class: 'lesson_progress_status',
                                    title: 'Lesson progress status',
                                  },
                                  ...aiApprovalNotificationRows.slice(0, 1),
                                ]
                              : aiApprovalNotificationRows.slice(0, 1),
                            { sourceLabel: 'lesson_detail' }
                          ),
                          {
                            compact: true,
                            maxRows: 2,
                            mode: 'banner',
                            emptyHint: 'No lesson notifications available.',
                          }
                        )}
                        {!selectedLesson ? (
                          <View style={styles.coachingJourneyEmptyCard}>
                            <Text style={styles.coachingJourneyEmptyTitle}>Choose a lesson first</Text>
                            <Text style={styles.coachingJourneyEmptySub}>Open a lesson from Journey Detail.</Text>
                          </View>
                        ) : (
                          <View style={styles.coachingJourneyListCard}>
                            <View style={styles.coachingLessonDetailHeader}>
                              <View style={styles.coachingLessonActionRow}>
                                <TouchableOpacity
                                  style={styles.coachingLessonActionBtn}
                                  onPress={() =>
                                    openCoachingShell('coaching_journey_detail', {
                                      source: coachingShellContext.source,
                                      selectedJourneyId: selectedJourneyId ?? null,
                                      selectedJourneyTitle:
                                        coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? null,
                                      selectedLessonId: String(selectedLesson.id),
                                      selectedLessonTitle: selectedLesson.title,
                                    })
                                  }
                                >
                                  <Text style={styles.coachingLessonActionBtnText}>Back to Journey</Text>
                                </TouchableOpacity>
                              </View>
                              <Text style={styles.coachingLessonDetailTitle}>
                                {coachingShellContext.selectedLessonTitle ?? selectedLesson.title}
                              </Text>
                              <Text style={styles.coachingLessonDetailMeta}>
                                {selectedLesson.milestoneTitle} • {selectedJourneyTitle ?? coachingJourneyDetail?.journey?.title ?? 'Journey'}
                              </Text>
                              <Text style={styles.coachingLessonDetailBody}>
                                {selectedLesson.body?.trim() || 'No lesson content yet.'}
                              </Text>
                            </View>
                            {shellPackageGateBlocksActions ? (
                              renderKnownLimitedDataChip('lesson actions')
                            ) : (
                              <TouchableOpacity
                                style={styles.coachingAiAssistBtn}
                                onPress={() =>
                                  openAiAssistShell(
                                    {
                                      host: 'coaching_lesson_detail',
                                      title: 'AI Lesson Reflection Draft (Approval-First)',
                                      sub: 'Draft only. Human review required.',
                                      targetLabel: selectedLesson.title,
                                      approvedInsertOnly: true,
                                    },
                                    {
                                      prompt: `Draft a short reflection prompt and next-step coaching note for the lesson "${selectedLesson.title}".`,
                                    }
                                  )
                                }
                              >
                                <Text style={styles.coachingAiAssistBtnText}>AI Lesson Draft</Text>
                              </TouchableOpacity>
                            )}
                            <View style={styles.coachingLessonProgressCard}>
                              <Text style={styles.coachingLessonProgressTitle}>Lesson Progress</Text>
                              <Text style={styles.coachingLessonProgressStatus}>
                                Current status: {selectedLessonStatus.replace('_', ' ')}
                              </Text>
                              {selectedLesson.completed_at ? (
                                <Text style={styles.coachingLessonProgressTime}>
                                  Completed: {fmtMonthDayTime(selectedLesson.completed_at)}
                                </Text>
                              ) : null}
                              {coachingLessonProgressError ? (
                                <Text style={styles.coachingJourneyInlineError}>{coachingLessonProgressError}</Text>
                              ) : null}
                              {shellPackageGateBlocksActions ? (
                                renderKnownLimitedDataChip('lesson progress updates')
                              ) : (
                                <View style={styles.coachingLessonActionRow}>
                                  {(['not_started', 'in_progress', 'completed'] as const).map((status) => {
                                    const isCurrent = selectedLessonStatus === status;
                                    const isSubmitting =
                                      coachingLessonProgressSubmittingId === String(selectedLesson.id);
                                    return (
                                      <TouchableOpacity
                                        key={`lesson-progress-${status}`}
                                        style={[
                                          styles.coachingLessonActionBtn,
                                          isCurrent ? styles.coachingLessonActionBtnActive : null,
                                          isSubmitting ? styles.disabled : null,
                                        ]}
                                        disabled={isSubmitting}
                                        onPress={() => {
                                          void submitCoachingLessonProgress(String(selectedLesson.id), status);
                                        }}
                                      >
                                        <Text
                                          style={[
                                            styles.coachingLessonActionBtnText,
                                            isCurrent ? styles.coachingLessonActionBtnTextActive : null,
                                          ]}
                                        >
                                          {isSubmitting && isCurrent
                                            ? 'Saving…'
                                            : status === 'not_started'
                                              ? 'Reset'
                                              : status === 'in_progress'
                                                ? 'Start'
                                                : 'Complete'}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>

                </>
              );
            })()}
          </View>
        ) : viewMode === 'home' ? (
          <>
            {renderHudRail()}

            <View style={styles.homeCockpitStage}>
              <View style={styles.homeCockpitVisualShell}>
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
                            ? renderChartVisualPanel({
                                attachLiveChartRefs: cycleIdx === 1 && homePanel === panel,
                              })
                            : renderHomeVisualPlaceholder(panel as 'GP' | 'VP')}
                        </View>
                      ))}
                    </Animated.View>
                  </View>
                </View>
                {renderGameplayHeader()}
              </View>

              <View style={styles.homeCockpitActionShell}>
                <View
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
                        {renderHomeGridPanel(panel, {
                          attachLiveTileRefs: cycleIdx === 1 && homePanel === panel,
                        })}
                      </View>
                    ))}
                  </Animated.View>
                </View>
              </View>
            </View>

            <View style={styles.coachingEntryCard}>
              <View style={styles.coachingEntryHeaderRow}>
                <Text style={styles.coachingEntryTitle}>Coaching Nudge (W1 Allocation)</Text>
                <Text style={styles.coachingEntryBadge}>coaching</Text>
              </View>
              <Text style={styles.coachingEntrySub}>
                Coaching entry point. Home/Priority logging stays unchanged.
              </Text>
              {renderRuntimeStateBanner(homeRuntimeStateModel, { compact: true })}
              {renderCoachingPackageGateBanner('Home / Priority coaching nudge', null, { compact: true })}
              {renderCoachingNotificationSurface(
                'Coaching notifications',
                homeNotificationRows,
                summarizeNotificationRows(homeNotificationRows, { sourceLabel: 'home_coaching_nudge' }),
                { compact: true, maxRows: 2, mode: 'banner', emptyHint: 'No coaching notifications right now.' }
              )}
              <View style={styles.coachingEntryButtonRow}>
                <TouchableOpacity
                  style={styles.coachingEntryPrimaryBtn}
                  onPress={() =>
                    openCoachingShell('coaching_journeys', {
                      source: 'home',
                      selectedJourneyId: null,
                      selectedJourneyTitle: null,
                      selectedLessonId: null,
                      selectedLessonTitle: null,
                    })
                  }
                >
                  <Text style={styles.coachingEntryPrimaryBtnText}>Open Coaching Journeys</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.coachingEntrySecondaryBtn}
                  onPress={() => openCoachingShell('inbox')}
                >
                  <Text style={styles.coachingEntrySecondaryBtnText}>Inbox</Text>
                </TouchableOpacity>
              </View>
            </View>

          </>
        ) : (
          <>
            <View style={styles.activityHeroCard}>
              <View style={styles.activityHeroTopRow}>
                <Text style={styles.activityHeroEyebrow}>Activity / Logs & History</Text>
                <TouchableOpacity style={styles.logPipelineBtn} onPress={openPipelineCheckinOverlay}>
                  <Text style={styles.logPipelineBtnText}>Update pipeline</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.logTitle}>Activity</Text>
              <Text style={styles.activityHeroSub}>
                Review prior entries, backfill a selected day, and manage corrections without leaving the dashboard flow.
              </Text>
            </View>
            <View style={styles.logsReportsSwitchCard}>
              <TouchableOpacity
                style={[
                  styles.logsReportsSwitchBtn,
                  logsReportsSubview === 'logs' ? styles.logsReportsSwitchBtnActive : null,
                ]}
                onPress={() => setLogsReportsSubview('logs')}
                accessibilityRole="button"
                accessibilityState={{ selected: logsReportsSubview === 'logs' }}
                accessibilityLabel="Open logs history"
              >
                <Text
                  style={[
                    styles.logsReportsSwitchText,
                    logsReportsSubview === 'logs' ? styles.logsReportsSwitchTextActive : null,
                  ]}
                >
                  Logs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.logsReportsSwitchBtn,
                  logsReportsSubview === 'reports' ? styles.logsReportsSwitchBtnActive : null,
                ]}
                onPress={() => setLogsReportsSubview('reports')}
                accessibilityRole="button"
                accessibilityState={{ selected: logsReportsSubview === 'reports' }}
                accessibilityLabel="Open reports summary"
              >
                <Text
                  style={[
                    styles.logsReportsSwitchText,
                    logsReportsSubview === 'reports' ? styles.logsReportsSwitchTextActive : null,
                  ]}
                >
                  Reports
                </Text>
              </TouchableOpacity>
            </View>

            {logsReportsSubview === 'logs' ? (
              <>
            <View style={styles.activityDateCard}>
              <View style={styles.activityDateHeaderRow}>
                <View>
                  <Text style={styles.activityDateLabel}>Selected day</Text>
                  <Text style={styles.dateText}>{formatLogDateHeading(selectedLogDate)}</Text>
                </View>
                <View style={styles.activityDateChipRow}>
                  <View
                    style={[
                      styles.activityDateChip,
                      selectedLogDate === isoTodayLocal() ? styles.activityDateChipToday : styles.activityDateChipHistory,
                    ]}
                  >
                    <Text
                      style={[
                        styles.activityDateChipText,
                        selectedLogDate === isoTodayLocal()
                          ? styles.activityDateChipTextToday
                          : styles.activityDateChipTextHistory,
                      ]}
                    >
                      {selectedLogDate === isoTodayLocal() ? 'Today' : 'History'}
                    </Text>
                  </View>
                  {selectedLogDate !== isoTodayLocal() ? (
                    <TouchableOpacity
                      style={styles.activityTodayJumpBtn}
                      onPress={() => setSelectedLogDateIso(isoTodayLocal())}
                    >
                      <Text style={styles.activityTodayJumpBtnText}>Today</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.arrowBtn, !canGoBackwardDate && styles.arrowBtnDisabled]}
                  disabled={!canGoBackwardDate}
                  onPress={() => {
                    if (!canGoBackwardDate) return;
                    setSelectedLogDateIso((prev) => shiftIsoLocalDate(prev ?? isoTodayLocal(), -1));
                  }}
                >
                  <Text style={[styles.arrow, !canGoBackwardDate && styles.arrowDisabled]}>←</Text>
                </TouchableOpacity>
                <Text style={styles.activityDateNavHint}>
                  {selectedLogDate === isoTodayLocal()
                    ? 'Logging updates today by default'
                    : 'Backfill logs will be saved to the selected day'}
                </Text>
                <TouchableOpacity
                  style={[styles.arrowBtn, !canGoForwardDate && styles.arrowBtnDisabled]}
                  disabled={!canGoForwardDate}
                  onPress={() => {
                    if (!canGoForwardDate) return;
                    setSelectedLogDateIso((prev) => {
                      const next = shiftIsoLocalDate(prev ?? isoTodayLocal(), 1);
                      const today = isoTodayLocal();
                      return next > today ? today : next;
                    });
                  }}
                >
                  <Text style={[styles.arrow, !canGoForwardDate && styles.arrowDisabled]}>→</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.activityPipelineCard}>
              <View style={styles.activityPipelineCopy}>
                <Text style={styles.activityPipelineTitle}>Pipeline check-in</Text>
                <Text style={styles.activityPipelineSub}>
                  Update pending listings and buyers under contract anytime from Activity.
                </Text>
              </View>
              <TouchableOpacity style={styles.activityPipelineCta} onPress={openPipelineCheckinOverlay}>
                <Text style={styles.activityPipelineCtaText}>Update pipeline</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.todayLogsCard}>
              <Text style={styles.todayLogsHeading}>
                {selectedLogDate === isoTodayLocal() ? "TODAY'S LOG SUMMARY" : 'SELECTED DAY LOG SUMMARY'}
              </Text>
              {todaysLogRows.length === 0 ? (
                <Text style={styles.todayLogsEmpty}>
                  {selectedLogDate === isoTodayLocal()
                    ? 'No logs recorded yet today.'
                    : 'No logs recorded for this selected day yet.'}
                </Text>
              ) : (
                todaysLogRows.map((row) => (
                  <View key={row.kpiId} style={styles.todayLogsRow}>
                    <Text style={styles.todayLogsName}>{row.name}</Text>
                    <Text style={styles.todayLogsCount}>{String(row.count).padStart(2, '0')}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.activityBackfillCard}>
              <View style={styles.quickLogHeader}>
                <View style={styles.activitySectionTitleWrap}>
                  <Text style={styles.sectionTitle}>BACKFILL / LOG FOR SELECTED DAY</Text>
                  <Text style={styles.activitySectionSub}>
                    Use this grid to add logs to {selectedLogDate === isoTodayLocal() ? 'today' : 'the selected history day'}.
                  </Text>
                </View>
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
                <View style={[styles.emptyPanel, styles.activityBackfillEmptyPanel]}>
                  <Text style={styles.metaText}>
                    {segment === 'GP'
                      ? `Business Growth unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 3)}/3 days or ${Math.min(payload?.activity.total_logs ?? 0, 20)}/20 logs`
                      : `Vitality unlock progress: ${Math.min(payload?.activity.active_days ?? 0, 7)}/7 days or ${Math.min(payload?.activity.total_logs ?? 0, 40)}/40 logs`}
                  </Text>
                </View>
              ) : (
                <View style={styles.gridWrap}>
                  {quickLogKpis.map((kpi, idx) => {
                    const successAnim = getKpiTileSuccessAnim(kpi.id);
                    const successOpacity = successAnim.interpolate({
                      inputRange: [0, 0.12, 1],
                      outputRange: [0, 1, 0],
                    });
                    const successTranslateY = successAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -14],
                    });
                    const successScale = successAnim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.8, 1.02, 0.96],
                    });
                    return (
                      <Pressable
                        key={kpi.id}
                        style={[styles.gridItem, submitting && submittingKpiId === kpi.id && styles.disabled]}
                        onPress={() => void onTapQuickLog(kpi, { skipTapFeedback: true })}
                        onLongPress={() =>
                          Alert.alert('Remove from Priority?', `${kpi.name} will be removed from your priority set.`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeManagedKpi(kpi.id) },
                          ])
                        }
                        delayLongPress={280}
                        disabled={submitting}
                        onPressIn={() => runKpiTilePressInFeedback(kpi, { surface: 'log' })}
                        onPressOut={() => runKpiTilePressOutFeedback(kpi.id)}
                      >
                        <Animated.View
                          style={[styles.gridTileAnimatedWrap, { transform: [{ scale: getKpiTileScale(kpi.id) }] }]}
                        >
                          <View
                            ref={(node) => {
                              kpiTileCircleRefById.current[kpi.id] = node;
                            }}
                            style={styles.gridCircleWrap}
                          >
                            <View
                              style={[
                                styles.gridCircle,
                                confirmedKpiTileIds[kpi.id] && styles.gridCircleConfirmed,
                              ]}
                            >
                              {renderKpiIcon(kpi)}
                            </View>
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                styles.gridSuccessBadge,
                                {
                                  opacity: successOpacity,
                                  transform: [{ translateY: successTranslateY }, { scale: successScale }],
                                },
                              ]}
                            >
                              <View style={styles.gridSuccessCoinOuter}>
                                <View style={styles.gridSuccessCoinInner} />
                                <View style={styles.gridSuccessCoinHighlight} />
                              </View>
                            </Animated.View>
                          </View>
                          <Text style={[styles.gridLabel, confirmedKpiTileIds[kpi.id] && styles.gridLabelConfirmed]}>
                            {kpi.name}
                          </Text>
                        </Animated.View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.recentEntriesCard}>
              <Text style={styles.todayLogsHeading}>RECENT ACTIVITY</Text>
              {recentLogEntries.length === 0 ? (
                <Text style={styles.todayLogsEmpty}>No recent activity yet.</Text>
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

            <View style={styles.logsHeroCard}>
              <Image source={dashboardAssets.crown} style={styles.crownImage} resizeMode="contain" />
              <View style={styles.celebrationRow}>
                <Image source={dashboardAssets.confettiLeft} style={styles.confettiImage} resizeMode="contain" />
                <Image source={dashboardAssets.confettiRight} style={styles.confettiImage} resizeMode="contain" />
              </View>
              <Text style={styles.logsCount}>{fmtNum(payload?.activity.total_logs ?? 0)}</Text>
              <Text style={styles.logsSub}>Total logs (today)</Text>
              <Text style={styles.hiWork}>Hi, Sarah Roy, Great work</Text>
              <View style={styles.greenBanner}>
                <Text style={styles.greenBannerText}>
                  🎉 You have made a total of {fmtNum(payload?.activity.total_logs ?? 0)} logs so far today.
                </Text>
              </View>
            </View>
              </>
            ) : (
              <>
                <View style={styles.logsReportsSummaryGrid}>
                  <View style={styles.logsReportsSummaryCard}>
                    <Text style={styles.logsReportsSummaryLabel}>Active Days</Text>
                    <Text style={styles.logsReportsSummaryValue}>{fmtNum(payload?.activity.active_days ?? 0)}</Text>
                    <Text style={styles.logsReportsSummarySub}>Logging streak context</Text>
                  </View>
                  <View style={styles.logsReportsSummaryCard}>
                    <Text style={styles.logsReportsSummaryLabel}>Total Logs</Text>
                    <Text style={styles.logsReportsSummaryValue}>{fmtNum(payload?.activity.total_logs ?? 0)}</Text>
                    <Text style={styles.logsReportsSummarySub}>Historical entries</Text>
                  </View>
                </View>

                <View style={styles.logsReportsCard}>
                  <Text style={styles.logsReportsCardTitle}>Reports snapshot</Text>
                  <Text style={styles.logsReportsCardSub}>
                    Reports remain in this shared surface. Use Logs for date-based entry history and Reports for trend review.
                  </Text>
                  <View style={styles.logsReportsMetricRow}>
                    <Text style={styles.logsReportsMetricLabel}>Projected (90d)</Text>
                    <Text style={styles.logsReportsMetricValue}>{fmtUsd(cardMetrics.projectedNext90)}</Text>
                  </View>
                  <View style={styles.logsReportsMetricRow}>
                    <Text style={styles.logsReportsMetricLabel}>Actual (365d)</Text>
                    <Text style={styles.logsReportsMetricValue}>{fmtUsd(cardMetrics.actualLast365)}</Text>
                  </View>
                </View>

                <View style={styles.logsReportsCard}>
                  <Text style={styles.logsReportsCardTitle}>Recent activity (read-only)</Text>
                  {recentLogEntries.length === 0 ? (
                    <Text style={styles.todayLogsEmpty}>No recent activity yet.</Text>
                  ) : (
                    recentLogEntries.slice(0, 6).map((log) => (
                      <View key={`report-${log.id}`} style={styles.recentEntryRow}>
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
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {activeFlightFx.map((flightFx) => (
        <React.Fragment key={flightFx.key}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.fxProjectile,
              {
                left: flightFx.startX,
                top: flightFx.startY,
                opacity: flightFx.anim.interpolate({ inputRange: [0, 0.06, 0.95, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: flightFx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, flightFx.deltaX] }) },
                  {
                    translateY: flightFx.anim.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [0, -flightFx.arcLift, flightFx.deltaY],
                    }),
                  },
                  { rotate: '-8deg' },
                  { scale: flightFx.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.08, 0.96] }) },
                ],
              },
            ]}
          >
            <View style={styles.fxCoinOuter}>
              <View style={styles.fxCoinInner} />
              <View style={styles.fxCoinHighlight} />
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.fxProjectile,
              {
                left: flightFx.startX - 8,
                top: flightFx.startY + 6,
                opacity: flightFx.anim.interpolate({ inputRange: [0, 0.12, 0.9, 1], outputRange: [0, 0.85, 0.85, 0] }),
                transform: [
                  { translateX: flightFx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, flightFx.deltaX + 12] }) },
                  {
                    translateY: flightFx.anim.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [0, -Math.max(24, flightFx.arcLift * 0.72), flightFx.deltaY + 4],
                    }),
                  },
                  { rotate: '10deg' },
                  { scale: flightFx.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.75, 0.95, 0.8] }) },
                ],
              },
            ]}
          >
            <View style={[styles.fxCoinOuter, styles.fxCoinOuterTrail]}>
              <View style={styles.fxCoinInner} />
              <View style={styles.fxCoinHighlight} />
            </View>
          </Animated.View>
        </React.Fragment>
      ))}

      <View style={[styles.bottomNav, { paddingTop: bottomNavPadTop, paddingBottom: bottomNavPadBottom }]}>
        {bottomTabOrder.map((tab) => (
          <TouchableOpacity
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={bottomTabAccessibilityLabel[tab]}
            accessibilityState={{ selected: activeTab === tab }}
            style={[
              styles.bottomItem,
              tab === 'home' ? styles.bottomItemLogCta : null,
              activeTab === tab && styles.bottomItemActivePill,
              tab === 'home' && activeTab === tab ? styles.bottomItemLogCtaActive : null,
            ]}
            onPress={() => onBottomTabPress(tab)}
          >
            <Animated.View
              style={
                activeTab === tab
                  ? {
                      transform: [
                        {
                          scale: modeLanePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
                        },
                      ],
                    }
                  : undefined
              }
            >
              {(() => {
                const TabIcon = bottomTabIconSvgByKey[tab];
                const isActive = activeTab === tab;
                const iconColor = tab === 'home' ? '#f7fff8' : isActive ? bottomTabTheme.activeFg : bottomTabTheme.inactiveFg;
                return (
                  <View
                    style={[
                      styles.bottomIconSvgWrap,
                      tab === 'home' ? styles.bottomIconSvgWrapLog : null,
                      tab === 'home' ? null : isActive && { backgroundColor: bottomTabTheme.activeBg },
                      isActive ? styles.bottomIconImageActive : styles.bottomIconImageInactive,
                    ]}
                  >
                    {tab === 'home' ? (
                      <>
                        <View style={[styles.bottomLogSparkle, styles.bottomLogSparkleOne]} />
                        <View style={[styles.bottomLogSparkle, styles.bottomLogSparkleTwo]} />
                      </>
                    ) : null}
                    <TabIcon
                      width="100%"
                      height="100%"
                      color={iconColor}
                      style={[
                        styles.bottomIconSvg,
                        tab === 'home' ? styles.bottomIconSvgLog : null,
                        bottomTabIconStyleByKey[tab],
                      ]}
                    />
                    {tab === 'home' ? <Text style={styles.bottomLogLabel}>LOG</Text> : null}
                    {tab === 'logs' ? <Text style={styles.bottomLogsReportsLabel}>Logs/Reports</Text> : null}
                  </View>
                );
              })()}
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={aiAssistVisible} transparent animationType="fade" onRequestClose={() => setAiAssistVisible(false)}>
        <Pressable style={styles.aiAssistBackdrop} onPress={() => setAiAssistVisible(false)}>
          <Pressable style={styles.aiAssistCard} onPress={() => {}}>
            <View style={styles.aiAssistHeader}>
              <View style={styles.aiAssistHeaderCopy}>
                <Text style={styles.aiAssistTitle}>{aiAssistContext?.title ?? 'AI Assist (Approval-First)'}</Text>
                <Text style={styles.aiAssistSub}>
                  {aiAssistContext?.sub ??
                    'AI assist is advisory only. Review and edit all content before any human send/publish action.'}
                </Text>
              </View>
              <TouchableOpacity style={styles.aiAssistCloseBtn} onPress={() => setAiAssistVisible(false)}>
                <Text style={styles.aiAssistCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.aiAssistPolicyBanner}>
              <Text style={styles.aiAssistPolicyBannerText}>
                Approval-first shell: no KPI writes, no forecast/challenge-state mutation, no auto-send or auto-publish.
              </Text>
            </View>
            <View style={styles.aiAssistField}>
              <Text style={styles.aiAssistFieldLabel}>Approved insert point</Text>
              <Text style={styles.aiAssistFieldValue}>{aiAssistContext?.targetLabel ?? 'Unknown context'}</Text>
            </View>
            <View style={styles.aiAssistField}>
              <Text style={styles.aiAssistFieldLabel}>Draft request (human guided)</Text>
              <TextInput
                value={aiAssistPrompt}
                onChangeText={(text) => {
                  setAiAssistPrompt(text);
                  if (aiAssistNotice) setAiAssistNotice(null);
                }}
                placeholder="Describe the draft tone, purpose, and audience..."
                placeholderTextColor="#97a1af"
                multiline
                style={[styles.aiAssistInput, styles.aiAssistInputTall]}
              />
            </View>
            <View style={styles.aiAssistField}>
              <Text style={styles.aiAssistFieldLabel}>AI draft review (editable)</Text>
              <TextInput
                value={aiAssistDraftText}
                onChangeText={(text) => {
                  setAiAssistDraftText(text);
                  if (aiAssistNotice) setAiAssistNotice(null);
                }}
                placeholder="Generated draft appears here. Edit before applying."
                placeholderTextColor="#97a1af"
                multiline
                style={[styles.aiAssistInput, styles.aiAssistDraftInput]}
              />
            </View>
            <View style={styles.aiAssistQueueCard}>
              <View style={styles.aiAssistQueueCardTopRow}>
                <Text style={styles.aiAssistQueueTitle}>Approval Queue (Review-Only)</Text>
                {aiSuggestionListLoading ? <ActivityIndicator size="small" /> : null}
              </View>
              {aiSuggestionListError ? <Text style={styles.aiAssistQueueError}>{aiSuggestionListError}</Text> : null}
              {aiSuggestionQueueError ? <Text style={styles.aiAssistQueueError}>{aiSuggestionQueueError}</Text> : null}
              {aiSuggestionQueueSuccess ? <Text style={styles.aiAssistQueueSuccess}>{aiSuggestionQueueSuccess}</Text> : null}
              {aiSuggestionQueueSummary ? (
                <Text style={styles.aiAssistQueueSummaryText}>
                  Queue summary: {Number(aiSuggestionQueueSummary.total ?? 0)} total • pending{' '}
                  {Number(aiSuggestionQueueSummary.by_status?.pending ?? 0)} • approved{' '}
                  {Number(aiSuggestionQueueSummary.by_status?.approved ?? 0)} • rejected{' '}
                  {Number(aiSuggestionQueueSummary.by_status?.rejected ?? 0)}
                </Text>
              ) : (
                <Text style={styles.aiAssistQueueSummaryText}>
                  Queue summary unavailable in this session. Queueing still creates a pending review item only (no send/publish).
                </Text>
              )}
              {(() => {
                const hostKey = aiAssistContext?.host ?? null;
                const hostMatches = (aiSuggestionRows ?? []).filter((row) => {
                  const source = String(row.ai_queue_read_model?.source_surface ?? '');
                  if (!hostKey) return true;
                  if (hostKey === 'coaching_journeys') return source === 'coaching_journey_detail' || source === 'coaching_journey_list';
                  if (hostKey === 'coaching_journey_detail') return source === 'coaching_journey_detail';
                  if (hostKey === 'coaching_lesson_detail') return source === 'coaching_lesson_detail';
                  if (hostKey === 'coach_broadcast_compose') return source === 'coach_broadcast_compose';
                  if (hostKey === 'channel_thread') return source === 'channel_thread';
                  if (hostKey === 'challenge_coaching_module') return source === 'challenge_coaching_block';
                  if (hostKey === 'team_member_coaching_module' || hostKey === 'team_leader_coaching_module') {
                    return source === 'team_coaching_module';
                  }
                  return true;
                });
                const rows = (hostMatches.length > 0 ? hostMatches : aiSuggestionRows ?? []).slice(0, 3);
                if (rows.length === 0) {
                  return (
                    <Text style={styles.aiAssistQueueRecentEmpty}>
                      No recent AI review items for this user/context yet. Queueing remains approval-first and advisory only.
                    </Text>
                  );
                }
                return (
                  <View style={styles.aiAssistQueueRecentList}>
                    {rows.map((row, idx) => {
                      const queueStatus = String(
                        row.ai_queue_read_model?.approval_queue?.queue_status ?? row.status ?? 'unknown'
                      );
                      const createdAt = fmtMonthDayTime(row.created_at ?? null);
                      return (
                        <View
                          key={`ai-suggestion-recent-${row.id}`}
                          style={[styles.aiAssistQueueRecentRow, idx > 0 ? styles.aiAssistQueueRecentRowDivider : null]}
                        >
                          <View style={styles.aiAssistQueueRecentRowCopy}>
                            <Text style={styles.aiAssistQueueRecentStatus}>{queueStatus}</Text>
                            <Text style={styles.aiAssistQueueRecentMeta}>
                              {row.ai_queue_read_model?.target_scope_summary ?? row.scope ?? 'scope unavailable'}
                            </Text>
                            <Text style={styles.aiAssistQueueRecentMeta}>
                              {createdAt ? `Created ${createdAt}` : `Suggestion ${row.id}`}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
            {aiAssistNotice ? <Text style={styles.aiAssistNotice}>{aiAssistNotice}</Text> : null}
            <View style={styles.aiAssistActionRow}>
              <TouchableOpacity
                style={[styles.aiAssistSecondaryBtn, aiAssistGenerating ? styles.disabled : null]}
                disabled={aiAssistGenerating}
                onPress={generateAiAssistDraft}
              >
                <Text style={styles.aiAssistSecondaryBtnText}>
                  {aiAssistGenerating ? 'Generating…' : 'Generate Draft (Shell)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiAssistSecondaryBtn} onPress={applyAiAssistDraftToHumanInput}>
                <Text style={styles.aiAssistSecondaryBtnText}>
                  {aiAssistContext?.host === 'channel_thread' || aiAssistContext?.host === 'coach_broadcast_compose'
                    ? 'Insert Into Human Composer'
                    : 'Mark Ready For Human Review'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.aiAssistPrimaryBtn,
                (aiSuggestionQueueSubmitting || aiAssistGenerating || !aiAssistDraftText.trim()) ? styles.disabled : null,
              ]}
              disabled={aiSuggestionQueueSubmitting || aiAssistGenerating || !aiAssistDraftText.trim()}
              onPress={() => void queueAiSuggestionForApproval()}
            >
              <Text style={styles.aiAssistPrimaryBtnText}>
                {aiSuggestionQueueSubmitting ? 'Queueing For Review…' : 'Queue For Approval Review'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addDrawerVisible} transparent animationType="fade" onRequestClose={() => setAddDrawerVisible(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerCard}>
            <Text style={styles.drawerTitle}>Priority Settings</Text>
            <Text style={styles.drawerUnlockedHint}>Toggle On/Off and mark up to 6 favorites.</Text>
            <View style={styles.drawerFilterRow}>
              {(['Quick', 'PC', 'GP', 'VP'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.drawerFilterChip, drawerFilter === filter && styles.drawerFilterChipActive]}
                  onPress={() => setDrawerFilter(filter)}
                >
                  <Text style={[styles.drawerFilterChipText, drawerFilter === filter && styles.drawerFilterChipTextActive]}>
                    {filter === 'Quick' ? 'Priority' : `${filter} ${selectedCountsByType[filter]}/6`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={styles.drawerGridScroll} contentContainerStyle={styles.drawerList}>
              {drawerCatalogKpis.map((kpi) => {
                const locked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
                const selected = managedKpiIdSet.has(kpi.id);
                const isFavorite = favoriteKpiIds.includes(kpi.id);
                const favoriteRank = favoriteKpiIds.indexOf(kpi.id);
                const categoryFull =
                  (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') &&
                  selectedCountsByType[kpi.type] >= 6 &&
                  !selected;
                const selectionDisabled = locked || categoryFull;
                return (
                <TouchableOpacity
                  key={kpi.id}
                  style={[
                    styles.drawerListRow,
                    selectionDisabled && styles.disabled,
                    selected && styles.drawerListRowSelected,
                    categoryFull && styles.drawerListRowCapReached,
                  ]}
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
                    if (categoryFull) {
                      Alert.alert('Category Full', `You already have 6 ${kpi.type} KPIs selected. Turn one off first.`);
                      return;
                    }
                    toggleManagedKpi(kpi.id);
                  }}
                >
                  <View style={[styles.drawerListIconWrap, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                    <View style={styles.drawerListIconInner}>
                      {renderKpiIcon(kpi)}
                    </View>
                  </View>
                  <View style={styles.drawerListMain}>
                    <View style={styles.drawerListTitleRow}>
                      <Text numberOfLines={1} style={styles.drawerListLabel}>{kpi.name}</Text>
                      <View style={[styles.drawerTypeBadge, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                        <Text style={[styles.drawerTypeBadgeText, { color: kpiTypeAccent(kpi.type) }]}>{kpi.type}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.drawerListMeta}>{formatDrawerKpiMeta(kpi)}</Text>
                    <View style={styles.drawerStateRow}>
                      <View style={[styles.drawerStateChip, selected ? styles.drawerStateChipOn : styles.drawerStateChipOff]}>
                        <Text style={styles.drawerStateChipText}>{selected ? 'Selected' : 'Not Selected'}</Text>
                      </View>
                      {categoryFull ? (
                        <View style={[styles.drawerStateChip, styles.drawerStateChipCap]}>
                          <Text style={styles.drawerStateChipText}>Type Full (6/6)</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.drawerActionCol}>
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
                      <Text style={styles.drawerActionText}>{isFavorite ? `★${favoriteRank + 1}` : '☆'}</Text>
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

      <Modal
        visible={pipelineCheckinVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissPipelineCheckinForToday}
      >
        <Pressable style={styles.pipelineCheckinBackdrop} onPress={dismissPipelineCheckinForToday}>
          <Pressable style={styles.pipelineCheckinCard} onPress={() => {}}>
            <ScrollView
              style={styles.pipelineCheckinScroll}
              contentContainerStyle={styles.pipelineCheckinScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.pipelineCheckinHeader}>
                <View style={styles.pipelineCheckinHeaderCopy}>
                  <Text style={styles.pipelineCheckinTitle}>Update your pipeline</Text>
                  <Text style={styles.pipelineCheckinHelp}>
                    Keep your forecast accurate with current pipeline counts.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pipelineCheckinCloseBtn}
                  onPress={dismissPipelineCheckinForToday}
                  disabled={pipelineCheckinSubmitting}
                >
                  <Text style={styles.pipelineCheckinCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pipelineCheckinFieldCard}>
                <Text style={styles.pipelineCheckinFieldLabel}>Pending listings</Text>
                <View style={styles.pipelineCheckinStepperRow}>
                  <TouchableOpacity
                    style={styles.pipelineStepperBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCheckinListings((v) => Math.max(0, v - 1))}
                  >
                    <Text style={styles.pipelineStepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.pipelineCheckinCountValue}>{fmtNum(pipelineCheckinListings)}</Text>
                  <TouchableOpacity
                    style={styles.pipelineStepperBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCheckinListings((v) => Math.max(0, v + 1))}
                  >
                    <Text style={styles.pipelineStepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.pipelineCheckinFieldCard}>
                <Text style={styles.pipelineCheckinFieldLabel}>Buyers under contract</Text>
                <View style={styles.pipelineCheckinStepperRow}>
                  <TouchableOpacity
                    style={styles.pipelineStepperBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCheckinBuyers((v) => Math.max(0, v - 1))}
                  >
                    <Text style={styles.pipelineStepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.pipelineCheckinCountValue}>{fmtNum(pipelineCheckinBuyers)}</Text>
                  <TouchableOpacity
                    style={styles.pipelineStepperBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCheckinBuyers((v) => Math.max(0, v + 1))}
                  >
                    <Text style={styles.pipelineStepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {pipelineCheckinReasonPromptVisible ? (
                <View style={styles.pipelineCheckinBranchCard}>
                  <Text style={styles.pipelineCheckinBranchTitle}>Your pipeline count went down. What happened?</Text>
                  {pipelineCheckinDecreaseFields.length > 0 ? (
                    <Text style={styles.pipelineCheckinBranchSub}>
                      Updated lower: {pipelineCheckinDecreaseFields.map((field) => (field === 'listings' ? 'Pending listings' : 'Buyers under contract')).join(', ')}
                    </Text>
                  ) : null}
                  <View style={styles.pipelineCheckinBranchButtons}>
                    <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('deal_closed')}>
                      <Text style={styles.pipelineBranchOptionText}>A deal closed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('deal_lost')}>
                      <Text style={styles.pipelineBranchOptionText}>A deal was lost</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pipelineBranchOption} onPress={() => onChoosePipelineDecreaseReason('correction')}>
                      <Text style={styles.pipelineBranchOptionText}>Just correcting my count</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {pipelineCheckinReason === 'deal_closed' ? (
                <View style={styles.pipelineCheckinBranchCard}>
                  <Text style={styles.pipelineCheckinBranchTitle}>Capture close follow-up</Text>
                <Text style={styles.pipelineCheckinBranchSub}>
                  Enter a close date and GCI amount to log the close and update pipeline counts.
                </Text>
                <View style={styles.pipelineCheckinDateRow}>
                  <TouchableOpacity
                    style={styles.pipelineCheckinDateBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => setPipelineCloseDateInput((prev) => shiftIsoLocalDate(prev || isoTodayLocal(), -1))}
                  >
                    <Text style={styles.pipelineCheckinDateBtnText}>‹</Text>
                  </TouchableOpacity>
                  <View style={styles.pipelineCheckinDateValueWrap}>
                    <Text style={styles.pipelineCheckinDateValueLabel}>Close date</Text>
                    <Text style={styles.pipelineCheckinDateValueText}>
                      {formatLogDateHeading(pipelineCloseDateInput || isoTodayLocal())}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pipelineCheckinDateBtn}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() =>
                      setPipelineCloseDateInput((prev) => {
                        const next = shiftIsoLocalDate(prev || isoTodayLocal(), 1);
                        const today = isoTodayLocal();
                        return next > today ? today : next;
                      })
                    }
                  >
                    <Text style={styles.pipelineCheckinDateBtnText}>›</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.pipelineCheckinInlineInput}
                  value={pipelineCloseGciInput}
                    onChangeText={setPipelineCloseGciInput}
                    placeholder="GCI amount"
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => void finalizePipelineCheckinSave('deal_closed')}
                  >
                    <Text style={styles.pipelineCheckinPrimaryBtnText}>
                      {pipelineCheckinSubmitting ? 'Logging…' : 'Log close & save counts'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {pipelineCheckinReason === 'deal_lost' ? (
                <View style={styles.pipelineCheckinBranchCard}>
                  <Text style={styles.pipelineCheckinBranchTitle}>Reset and keep moving</Text>
                  <Text style={styles.pipelineCheckinBranchSub}>
                    {pipelineLostEncouragement || PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[0]}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                    disabled={pipelineCheckinSubmitting}
                    onPress={() => void finalizePipelineCheckinSave('deal_lost')}
                  >
                    <Text style={styles.pipelineCheckinPrimaryBtnText}>
                      {pipelineCheckinSubmitting ? 'Logging…' : 'Log & save counts'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.pipelineCheckinActions}>
                <TouchableOpacity
                  style={styles.pipelineCheckinSecondaryBtn}
                  disabled={pipelineCheckinSubmitting}
                  onPress={dismissPipelineCheckinForToday}
                >
                  <Text style={styles.pipelineCheckinSecondaryBtnText}>Dismiss for today</Text>
                </TouchableOpacity>
                {pipelineCheckinReason !== 'deal_closed' && pipelineCheckinReason !== 'deal_lost' ? (
                  <TouchableOpacity
                    style={[styles.pipelineCheckinPrimaryBtn, pipelineCheckinSubmitting && styles.disabled]}
                    disabled={pipelineCheckinSubmitting || pipelineCheckinReasonPromptVisible}
                    onPress={onSavePipelineCheckin}
                  >
                    <Text style={styles.pipelineCheckinPrimaryBtnText}>
                      {pipelineCheckinSubmitting ? 'Updating…' : 'Update pipeline'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 116,
    gap: 12,
    backgroundColor: '#f6f7f9',
  },
  challengeSurfaceWrap: {
    gap: 12,
  },
  challengeListShell: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 12,
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  challengeListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeListTitle: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeListCreateBtn: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  challengeListCreateBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeListSub: {
    color: '#728094',
    fontSize: 12,
    lineHeight: 17,
  },
  challengeMemberSearchGhost: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  challengeMemberSearchGhostIcon: {
    color: '#a3acb9',
    fontSize: 14,
    fontWeight: '700',
  },
  challengeMemberSearchGhostText: {
    color: '#a3acb9',
    fontSize: 12,
  },
  challengeMemberSegmentRow: {
    marginTop: 8,
    flexDirection: 'row',
    backgroundColor: '#eceff4',
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  challengeMemberSegmentPill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  challengeMemberSegmentPillActive: {
    backgroundColor: '#1f5fe2',
  },
  challengeMemberSegmentPillText: {
    color: '#485467',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeMemberSegmentPillTextActive: {
    color: '#fff',
  },
  challengeListFallbackHint: {
    color: '#8b5f14',
    fontSize: 10,
    lineHeight: 13,
  },
  challengeListFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeListFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dde5f1',
    backgroundColor: '#f7f9fc',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  challengeListFilterChipActive: {
    backgroundColor: '#1f5fe2',
    borderColor: '#1f5fe2',
  },
  challengeListFilterChipText: {
    color: '#66758b',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeListFilterChipTextActive: {
    color: '#fff',
  },
  challengeListCardStack: {
    gap: 10,
  },
  challengeMemberListCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 12,
    gap: 8,
  },
  challengeMemberListCardTitle: {
    flex: 1,
    color: '#3d4655',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeMemberListCardSub: {
    color: '#7d8797',
    fontSize: 11,
    lineHeight: 15,
    marginTop: -2,
  },
  challengeMemberListCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeMemberListMetaStrong: {
    color: '#454e5f',
    fontSize: 12,
    fontWeight: '700',
  },
  challengeMemberListProgressText: {
    color: '#8d97a6',
    fontSize: 11,
  },
  challengeMemberCreateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    justifyContent: 'flex-end',
    padding: 10,
  },
  challengeMemberCreateModalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  challengeMemberCreateModalTitle: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  challengeMemberCreateModeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeMemberCreateModeCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e8ef',
    backgroundColor: '#fafbff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 8,
  },
  challengeMemberCreateModeCardActive: {
    backgroundColor: '#eef0f7',
    borderColor: '#d5dbe8',
  },
  challengeMemberCreateModeIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
  challengeMemberCreateModeLabel: {
    color: '#2f3442',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  challengeMemberCreateModeLabelActive: {
    color: '#23283a',
  },
  challengeMemberCreateContinueBtn: {
    borderRadius: 10,
    backgroundColor: '#474a6f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  challengeMemberCreateContinueBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeListBucket: {
    gap: 8,
  },
  challengeListBucketTitle: {
    color: '#556277',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    paddingHorizontal: 2,
  },
  challengeListItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 8,
  },
  challengeListItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeListItemTitle: {
    flex: 1,
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeListStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  challengeListStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  challengeListStatusActive: {
    backgroundColor: '#eef8ef',
    borderColor: '#d2e9d3',
  },
  challengeListStatusActiveText: {
    color: '#2e8a49',
  },
  challengeListStatusUpcoming: {
    backgroundColor: '#eef4ff',
    borderColor: '#d8e5ff',
  },
  challengeListStatusUpcomingText: {
    color: '#2d63e1',
  },
  challengeListStatusCompleted: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e0e4ea',
  },
  challengeListStatusCompletedText: {
    color: '#596579',
  },
  challengeListItemSub: {
    color: '#728094',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeListItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  challengeListItemMetaText: {
    color: '#7c8798',
    fontSize: 10,
    fontWeight: '600',
  },
  challengeListItemProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e8edf5',
    overflow: 'hidden',
  },
  challengeListItemProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#57d36a',
  },
  challengeListItemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeListItemBottomText: {
    color: '#6f7d90',
    fontSize: 10,
    fontWeight: '600',
  },
  challengeListItemBottomLink: {
    color: '#1f5fe2',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeListEmptyFilterCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  challengeListEmptyFilterTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeListEmptyFilterSub: {
    color: '#728094',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeListEmptyFilterBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7e3fb',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  challengeListEmptyFilterBtnText: {
    color: '#1f5fe2',
    fontSize: 11,
    fontWeight: '800',
  },
  challengeDetailsShell: {
    gap: 12,
  },
  challengeDetailsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDetailsIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeDetailsIconBtnText: {
    color: '#3b4658',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  challengeDetailsNavTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
  },
  challengeDetailsNavSpacer: {
    minWidth: 64,
  },
  challengeDetailsActionBtn: {
    borderRadius: 999,
    backgroundColor: '#131722',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  challengeDetailsActionBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeDetailsTitleBlock: {
    gap: 4,
  },
  challengeDetailsTitle: {
    color: '#2f3442',
    fontSize: 20,
    fontWeight: '800',
  },
  challengeDetailsSubtitle: {
    color: '#707c8f',
    fontSize: 12,
    lineHeight: 17,
  },
  challengeDetailsHeroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 14,
    gap: 10,
    shadowColor: '#1f355f',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  challengeDetailsHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDetailsHeroLabel: {
    color: '#465267',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  challengeDetailsStatusPill: {
    borderRadius: 999,
    backgroundColor: '#eef8ef',
    borderWidth: 1,
    borderColor: '#d2e9d3',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  challengeDetailsStatusPillText: {
    color: '#2e8a49',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeDetailsStatusPillCompleted: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e0e4ea',
  },
  challengeDetailsStatusPillTextCompleted: {
    color: '#596579',
  },
  challengeDetailsStatusPillUpcoming: {
    backgroundColor: '#eef4ff',
    borderColor: '#d8e5ff',
  },
  challengeDetailsStatusPillTextUpcoming: {
    color: '#2d63e1',
  },
  challengeDetailsGaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  challengeDetailsGaugeOuter: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  challengeDetailsGaugeArcBase: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 6,
    borderColor: '#e6ebf4',
  },
  challengeDetailsGaugeArcFill: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 6,
    borderColor: '#59d86d',
    borderRightColor: '#59d86d',
    borderTopColor: '#59d86d',
    borderLeftColor: '#59d86d',
    borderBottomColor: '#e6ebf4',
    transform: [{ rotate: '-30deg' }],
  },
  challengeDetailsGaugeInner: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eef2f8',
  },
  challengeDetailsGaugeValue: {
    color: '#2f3442',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  challengeDetailsGaugeCaption: {
    marginTop: 2,
    color: '#7a8698',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeDetailsHeroHint: {
    color: '#7b879a',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  challengeDetailsOwnerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e8f2',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  challengeDetailsOwnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  challengeDetailsOwnerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#dfe6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeDetailsOwnerAvatarText: {
    color: '#365fcf',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeDetailsOwnerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  challengeDetailsOwnerName: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '700',
  },
  challengeDetailsOwnerStatus: {
    color: '#7a8798',
    fontSize: 11,
    lineHeight: 13,
  },
  challengeDetailsOwnerMetric: {
    alignItems: 'flex-end',
  },
  challengeDetailsOwnerMetricValue: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  challengeDetailsOwnerMetricLabel: {
    color: '#7b8799',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeDetailsMetaCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e8f2',
    padding: 12,
    gap: 10,
  },
  challengeDetailsDateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  challengeDetailsDateRangeTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '700',
  },
  challengeDetailsDaysPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f0dca8',
    backgroundColor: '#fff4d8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  challengeDetailsDaysPillText: {
    color: '#8a6207',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeDetailsMetaRows: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 8,
    gap: 6,
  },
  challengeDetailsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  challengeDetailsMetaKey: {
    color: '#778395',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDetailsMetaVal: {
    color: '#2f3442',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  challengeDetailsLeaderboardCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e8f2',
    padding: 12,
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  challengeDetailsLeaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDetailsLeaderboardTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeDetailsLeaderboardMeta: {
    color: '#7b8799',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeDetailsLeaderboardTop3: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeDetailsLeaderboardTopCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    backgroundColor: '#fbfcff',
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 3,
  },
  challengeDetailsLeaderboardRank: {
    color: '#8a6207',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeDetailsLeaderboardAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5ff',
    borderWidth: 1,
    borderColor: '#dfe7fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeDetailsLeaderboardAvatarText: {
    color: '#3e63cf',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeDetailsLeaderboardName: {
    color: '#3b4557',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  challengeDetailsLeaderboardPct: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },
  challengeDetailsLeaderboardVal: {
    color: '#7a8799',
    fontSize: 9,
    fontWeight: '700',
  },
  challengeDetailsLeaderboardList: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 6,
    gap: 4,
  },
  challengeDetailsLeaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  challengeDetailsLeaderboardRowRank: {
    width: 18,
    color: '#7a8799',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeDetailsLeaderboardRowName: {
    flex: 1,
    color: '#49566a',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDetailsLeaderboardRowPct: {
    color: '#2f3442',
    fontSize: 11,
    fontWeight: '800',
  },
  challengeLeaderboardScreenCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 12,
    gap: 10,
  },
  challengeLeaderboardScreenTitle: {
    color: '#2f3442',
    fontSize: 17,
    fontWeight: '800',
  },
  challengeLeaderboardScreenSub: {
    color: '#748296',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeLeaderboardScreenTop3: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeLeaderboardScreenTopCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    backgroundColor: '#fbfcff',
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 3,
  },
  challengeLeaderboardScreenTopValue: {
    color: '#2f3442',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  challengeLeaderboardScreenRows: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 6,
    gap: 4,
  },
  challengeMemberUpgradeShell: {
    gap: 12,
    paddingTop: 2,
  },
  challengeMemberUpgradeHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeMemberUpgradeHeroIconText: {
    fontSize: 40,
  },
  challengeMemberUpgradeTitle: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  challengeMemberUpgradeSub: {
    color: '#7f8998',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  challengeMemberUpgradeChallengeCard: {
    borderRadius: 12,
    backgroundColor: '#eef0f4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeMemberUpgradeChallengeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f5fe2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeMemberUpgradeChallengeIconText: {
    color: '#fff',
    fontSize: 14,
  },
  challengeMemberUpgradeChallengeCopy: {
    flex: 1,
    gap: 1,
  },
  challengeMemberUpgradeChallengeTitle: {
    color: '#36404f',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeMemberUpgradeChallengeSub: {
    color: '#8a93a3',
    fontSize: 11,
  },
  challengeMemberUpgradeChallengeGoal: {
    color: '#576274',
    fontSize: 10,
    lineHeight: 13,
  },
  challengeMemberUpgradeLock: {
    fontSize: 14,
  },
  challengeMemberUpgradeSectionLabel: {
    color: '#6a7381',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  challengeMemberUpgradeBenefits: {
    gap: 8,
  },
  challengeMemberUpgradeBenefitCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeMemberUpgradeBenefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#a7df5f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeMemberUpgradeBenefitIconText: {
    fontSize: 14,
  },
  challengeMemberUpgradeBenefitCopy: {
    flex: 1,
  },
  challengeMemberUpgradeBenefitTitle: {
    color: '#384252',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeMemberUpgradeBenefitSub: {
    color: '#8a94a3',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  challengeMemberUpgradePrimaryBtn: {
    borderRadius: 8,
    backgroundColor: '#1f5fe2',
    paddingVertical: 11,
    alignItems: 'center',
  },
  challengeMemberUpgradePrimaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeMemberUpgradeSecondaryBtn: {
    borderRadius: 8,
    backgroundColor: '#343c49',
    paddingVertical: 11,
    alignItems: 'center',
  },
  challengeMemberUpgradeSecondaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  challengeLeaderboardEmptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#fbfcff',
    padding: 10,
    gap: 5,
  },
  challengeLeaderboardEmptyTitle: {
    color: '#415063',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeLeaderboardEmptySub: {
    color: '#748296',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeLeaderboardScreenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  challengeLeaderboardScreenRowMetric: {
    color: '#536077',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeDetailsCtaBlock: {
    gap: 8,
  },
  challengeLeaderboardPreviewEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7edf5',
    backgroundColor: '#fbfcff',
    padding: 10,
    gap: 5,
  },
  challengeLeaderboardPreviewEmptyTitle: {
    color: '#415063',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeLeaderboardPreviewEmptySub: {
    color: '#748296',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeDetailsPrimaryCta: {
    borderRadius: 10,
    backgroundColor: '#1f5fe2',
    paddingVertical: 11,
    alignItems: 'center',
  },
  challengeDetailsPrimaryCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeJoinErrorText: {
    color: '#b91c1c',
    fontSize: 11,
    lineHeight: 14,
  },
  challengeDetailsSecondaryCta: {
    borderRadius: 10,
    backgroundColor: '#2f3442',
    paddingVertical: 10,
    alignItems: 'center',
  },
  challengeDetailsSecondaryCtaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  challengeHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 14,
    gap: 10,
    shadowColor: '#1f355f',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  challengeHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeHeaderBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#edf3ff',
    borderWidth: 1,
    borderColor: '#d6e3ff',
  },
  challengeHeaderBadgeText: {
    color: '#1f5fe2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  challengeHeaderMeta: {
    color: '#7b8697',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeHeaderTitle: {
    color: '#2f3442',
    fontSize: 24,
    fontWeight: '800',
  },
  challengeHeaderSub: {
    color: '#657184',
    fontSize: 13,
    lineHeight: 19,
  },
  challengeHeaderStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeHeaderStatChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3ebf6',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  challengeHeaderStatLabel: {
    color: '#7b8494',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  challengeHeaderStatValue: {
    marginTop: 2,
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeHeaderStatFoot: {
    marginTop: 3,
    color: '#8590a2',
    fontSize: 10,
    lineHeight: 12,
  },
  challengeProgressCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    backgroundColor: '#fbfcff',
    padding: 10,
    gap: 8,
  },
  challengeProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeProgressTitle: {
    color: '#334056',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  challengeProgressMeta: {
    color: '#8b95a5',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeProgressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#e9eff8',
    overflow: 'hidden',
  },
  challengeProgressFill: {
    width: '38%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4f84ff',
  },
  challengeProgressLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  challengeProgressLegendText: {
    color: '#7b879a',
    fontSize: 11,
    lineHeight: 14,
    flex: 1,
    minWidth: 140,
  },
  challengePaceChip: {
    borderRadius: 999,
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#cfe7cf',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  challengePaceChipText: {
    color: '#2f8c4b',
    fontSize: 10,
    fontWeight: '800',
  },
  teamHeaderBadge: {
    backgroundColor: '#eaf3ff',
    borderColor: '#cfe0fb',
  },
  teamHeaderBadgeText: {
    color: '#2764b3',
  },
  teamProgressFill: {
    width: '31%',
    backgroundColor: '#5d93ff',
  },
  teamPaceChip: {
    backgroundColor: '#fff2e1',
    borderColor: '#efd8b0',
  },
  teamPaceChipText: {
    color: '#8b5f14',
  },
  teamDashboardHeroCtaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamDashboardHeroPrimaryCta: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamDashboardHeroPrimaryCtaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  teamDashboardHeroSecondaryCta: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e4f7',
    backgroundColor: '#f8fbff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamDashboardHeroSecondaryCtaText: {
    color: '#35557f',
    fontSize: 12,
    fontWeight: '800',
  },
  teamDashboardModuleCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1eaf5',
    padding: 12,
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  teamDashboardModuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamDashboardModuleTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  teamDashboardModuleMeta: {
    color: '#7a8799',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamDashboardModuleHint: {
    color: '#7a8798',
    fontSize: 11,
    lineHeight: 14,
  },
  teamDashboardMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamDashboardMetricCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4ebf5',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 4,
  },
  teamDashboardMetricLabel: {
    color: '#738094',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamDashboardMetricValue: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  teamDashboardMetricFoot: {
    color: '#8591a3',
    fontSize: 10,
    lineHeight: 12,
  },
  teamDashboardChartCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6edf7',
    backgroundColor: '#fafdff',
    padding: 12,
    gap: 10,
  },
  teamDashboardChartPlaceholderLine: {
    height: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe8f5',
    backgroundColor: '#fff',
  },
  teamDashboardChartAxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamDashboardChartAxisLabel: {
    color: '#8190a4',
    fontSize: 10,
    fontWeight: '700',
  },
  teamDashboardSplitRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  teamDashboardHalfCard: {
    flex: 1,
  },
  teamDashboardGaugePlaceholderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  teamDashboardGaugePlaceholderOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 5,
    borderColor: '#e7edf7',
    borderTopColor: '#5e94ff',
    borderRightColor: '#5e94ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafdff',
  },
  teamDashboardGaugePlaceholderInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: '#eaf0f8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  teamDashboardGaugeValue: {
    color: '#2f3442',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  teamDashboardGaugeCaption: {
    marginTop: 1,
    color: '#7b8799',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  teamDashboardMiniMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamDashboardMiniMetricChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5ebf4',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  teamDashboardMiniMetricLabel: {
    color: '#7c879a',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamDashboardMiniMetricValue: {
    color: '#2f3442',
    fontSize: 12,
    fontWeight: '800',
  },
  teamDashboardInlineLinkBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dfe7f5',
    backgroundColor: '#f7faff',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  teamDashboardInlineLinkBtnText: {
    color: '#255ea7',
    fontSize: 10,
    fontWeight: '800',
  },
  teamDashboardPreviewList: {
    gap: 8,
  },
  teamDashboardPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7edf6',
    backgroundColor: '#fbfdff',
    padding: 9,
  },
  teamDashboardPreviewRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  teamDashboardPreviewRowTitle: {
    color: '#334055',
    fontSize: 11,
    fontWeight: '700',
  },
  teamDashboardPreviewRowMeta: {
    color: '#7a8699',
    fontSize: 10,
    lineHeight: 13,
  },
  teamDashboardStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e5ff',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamDashboardStatusPillText: {
    color: '#2d63e1',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  teamDashboardMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7edf6',
    backgroundColor: '#fbfdff',
    padding: 9,
  },
  teamDashboardMemberRankBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d8e4fb',
  },
  teamDashboardMemberRankBadgeText: {
    color: '#2b60b5',
    fontSize: 10,
    fontWeight: '800',
  },
  teamDashboardMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f5ff',
    borderWidth: 1,
    borderColor: '#dfe7fb',
  },
  teamDashboardMemberAvatarText: {
    color: '#3a63cf',
    fontSize: 10,
    fontWeight: '800',
  },
  teamDashboardMemberCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  teamDashboardMemberName: {
    color: '#334055',
    fontSize: 11,
    fontWeight: '700',
  },
  teamDashboardMemberSub: {
    color: '#7a8699',
    fontSize: 10,
    lineHeight: 12,
  },
  teamDashboardMemberMetric: {
    color: '#2f3442',
    fontSize: 12,
    fontWeight: '800',
  },
  teamDashboardActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamDashboardActionTile: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4ebf5',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 4,
  },
  teamDashboardActionTileTitle: {
    color: '#344156',
    fontSize: 11,
    fontWeight: '800',
  },
  teamDashboardActionTileSub: {
    color: '#8090a4',
    fontSize: 10,
    lineHeight: 12,
  },
  teamParityDashboardWrap: {
    gap: 12,
  },
  teamMemberDashboardWrap: {
    gap: 12,
  },
  teamMemberDashTitle: {
    color: '#3a4250',
    fontSize: 16,
    fontWeight: '700',
  },
  teamMemberGroupCard: {
    borderRadius: 12,
    backgroundColor: '#eef0f4',
    padding: 12,
    gap: 10,
  },
  teamMemberGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamMemberGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#a7df5f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberGroupIconText: {
    fontSize: 15,
  },
  teamMemberGroupCopy: {
    flex: 1,
  },
  teamMemberGroupName: {
    color: '#3d4655',
    fontSize: 14,
    fontWeight: '800',
  },
  teamMemberGroupSub: {
    color: '#818b9a',
    fontSize: 11,
    marginTop: 1,
  },
  teamMemberInviteBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#5f6773',
    borderRadius: 8,
    backgroundColor: '#f7f8fb',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  teamMemberInviteBtnText: {
    color: '#404958',
    fontSize: 12,
    fontWeight: '700',
  },
  teamMemberPerformanceCard: {
    borderRadius: 10,
    backgroundColor: '#f6efdb',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamMemberPerformanceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberPerformanceIconText: {
    fontSize: 13,
  },
  teamMemberPerformanceCopy: {
    flex: 1,
  },
  teamMemberPerformanceTitle: {
    color: '#3f4858',
    fontSize: 14,
    fontWeight: '800',
  },
  teamMemberPerformanceSub: {
    color: '#7f8999',
    fontSize: 11,
    marginTop: 1,
  },
  teamMemberPerformanceValue: {
    color: '#3c4452',
    fontSize: 18,
    fontWeight: '900',
  },
  teamMemberSectionLabel: {
    color: '#444d5b',
    fontSize: 13,
    fontWeight: '700',
  },
  teamMemberRowsCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    overflow: 'hidden',
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  teamMemberRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberRowAvatarText: {
    color: '#4b4f57',
    fontSize: 10,
    fontWeight: '800',
  },
  teamMemberRowCopy: {
    flex: 1,
  },
  teamMemberRowName: {
    color: '#3f4756',
    fontSize: 13,
    fontWeight: '800',
  },
  teamMemberRowSub: {
    color: '#8b94a3',
    fontSize: 11,
    marginTop: 1,
  },
  teamMemberRowMenu: {
    color: '#303746',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -2,
  },
  teamMemberFooterButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamMemberFooterBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberFooterBtnPrimary: {
    backgroundColor: '#1f5fe2',
  },
  teamMemberFooterBtnDark: {
    backgroundColor: '#343c49',
  },
  teamMemberFooterBtnTextPrimary: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  teamMemberFooterBtnTextDark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  teamMemberViewChallengesBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#707886',
    backgroundColor: '#f8f9fb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamMemberViewChallengesBtnText: {
    color: '#404958',
    fontSize: 12,
    fontWeight: '700',
  },
  teamMemberChallengeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dde7f4',
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 4,
  },
  teamMemberChallengeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamMemberChallengeLabel: {
    color: '#50607a',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamMemberChallengeLink: {
    color: '#2b5fdd',
    fontSize: 11,
    fontWeight: '700',
  },
  teamMemberChallengeTitle: {
    color: '#2f3a4a',
    fontSize: 15,
    fontWeight: '800',
  },
  teamMemberChallengeSub: {
    color: '#768399',
    fontSize: 11,
    lineHeight: 15,
  },
  teamMemberLightKpiCard: {
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e8f3',
    padding: 10,
    gap: 7,
  },
  teamMemberLightKpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamMemberLightKpiEmpty: {
    color: '#7b8798',
    fontSize: 11,
  },
  teamMemberLightKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamMemberLightKpiName: {
    color: '#465267',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  teamMemberLightKpiValue: {
    color: '#2f3b4b',
    fontSize: 12,
    fontWeight: '800',
  },
  teamLeaderOpsWrap: {
    gap: 12,
  },
  teamLeaderOpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLeaderTotalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamLeaderFiltersCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e7f3',
    backgroundColor: '#f9fbff',
    padding: 10,
    gap: 8,
  },
  teamLeaderFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  teamLeaderFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7e0ef',
    backgroundColor: '#fff',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  teamLeaderFilterChipActive: {
    borderColor: '#2f63dd',
    backgroundColor: '#eaf0ff',
  },
  teamLeaderFilterChipText: {
    color: '#5a6a82',
    fontSize: 10,
    fontWeight: '700',
  },
  teamLeaderFilterChipTextActive: {
    color: '#2047a9',
  },
  teamLeaderExpandableList: {
    gap: 8,
  },
  teamLeaderEmptyState: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e7f2',
    backgroundColor: '#f7f9fc',
    padding: 10,
    gap: 4,
  },
  teamLeaderEmptyTitle: {
    color: '#425168',
    fontSize: 12,
    fontWeight: '700',
  },
  teamLeaderEmptySub: {
    color: '#7f8ca0',
    fontSize: 11,
  },
  teamLeaderMemberCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f4',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  teamLeaderMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teamLeaderMemberStatus: {
    color: '#4b5d79',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  teamLeaderMemberExpandedBody: {
    borderTopWidth: 1,
    borderTopColor: '#e7ecf5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  teamLeaderExpandedKpiRow: {
    color: '#516179',
    fontSize: 11,
  },
  teamLeaderExpandedActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  teamLeaderConcernCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ead8d8',
    backgroundColor: '#fff7f7',
    padding: 10,
    gap: 6,
  },
  teamLeaderConcernBullet: {
    color: '#6d4b4b',
    fontSize: 11,
    lineHeight: 15,
  },
  teamFocusEditorToggleBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfdcf2',
    backgroundColor: '#f3f8ff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  teamFocusEditorToggleBtnText: {
    color: '#2f58b7',
    fontSize: 11,
    fontWeight: '700',
  },
  teamFocusReadOnlyLabel: {
    color: '#6f7e95',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamFocusSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 7,
  },
  teamFocusSummaryEmpty: {
    color: '#77839a',
    fontSize: 11,
  },
  teamFocusSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamFocusSummaryName: {
    color: '#425069',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  teamFocusSummaryValue: {
    color: '#2f3b4b',
    fontSize: 12,
    fontWeight: '800',
  },
  teamFocusEditorPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e3f5',
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
  },
  teamFocusEditorTitle: {
    color: '#32405a',
    fontSize: 13,
    fontWeight: '800',
  },
  teamFocusEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4ebf6',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  teamFocusEditorRowName: {
    color: '#44526a',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  teamFocusEditorSelectedText: {
    color: '#1e5ac8',
    fontSize: 11,
    fontWeight: '800',
  },
  teamFocusEditorUnselectedText: {
    color: '#7a879c',
    fontSize: 11,
    fontWeight: '700',
  },
  teamFocusEditorDoneBtn: {
    marginTop: 2,
    borderRadius: 8,
    backgroundColor: '#1f5fe2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  teamFocusEditorDoneBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  teamParityNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamParityBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamParityBackBtnText: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: -2,
  },
  teamParityNavTitle: {
    color: '#3a4250',
    fontSize: 16,
    fontWeight: '700',
  },
  teamParityGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#eef0f4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  teamParityGroupIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#a7df5f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamParityGroupIconText: {
    fontSize: 14,
  },
  teamParityGroupCopy: {
    flex: 1,
    gap: 1,
  },
  teamParityGroupName: {
    color: '#3b434f',
    fontSize: 14,
    fontWeight: '700',
  },
  teamParityGroupSub: {
    color: '#8d96a6',
    fontSize: 11,
    fontWeight: '500',
  },
  teamParitySectionLabel: {
    color: '#6d7482',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  teamParitySectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamParitySectionLink: {
    color: '#4b6fe2',
    fontSize: 11,
    fontWeight: '700',
  },
  teamParityPerfCard: {
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  teamParityGaugeWrap: {
    alignSelf: 'center',
    width: 220,
    height: 110,
    position: 'relative',
    marginTop: 4,
  },
  teamParityGaugeArcBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 110,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
    borderWidth: 8,
    borderBottomWidth: 0,
    borderColor: '#d9dde5',
    borderStyle: 'dashed',
  },
  teamParityGaugeArcSegment: {
    position: 'absolute',
    top: 0,
    height: 110,
    borderWidth: 8,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  teamParityGaugeArcRed: {
    left: 0,
    width: 82,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 40,
    borderColor: '#f36b57',
    borderRightWidth: 0,
  },
  teamParityGaugeArcOrange: {
    left: 68,
    width: 84,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    borderColor: '#f4a04c',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  teamParityGaugeArcGreen: {
    right: 0,
    width: 90,
    borderTopLeftRadius: 44,
    borderTopRightRadius: 110,
    borderColor: '#57b520',
    borderLeftWidth: 0,
  },
  teamParityGaugeCenter: {
    position: 'absolute',
    left: 42,
    right: 42,
    top: 34,
    alignItems: 'center',
  },
  teamParityGaugeValue: {
    color: '#2f3442',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  teamParityPerformancePill: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#a7df5f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -2,
  },
  teamParityPerformancePillText: {
    color: '#33401f',
    fontSize: 11,
    fontWeight: '800',
  },
  teamParityPerfRatio: {
    color: '#303947',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  teamParityPerfCaption: {
    color: '#9aa4b1',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
  },
  teamParityStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamParityStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  teamParityStatCardGreen: {
    backgroundColor: '#dff0da',
  },
  teamParityStatCardPurple: {
    backgroundColor: '#e2def6',
  },
  teamParityStatTitle: {
    color: '#465063',
    fontSize: 11,
    fontWeight: '700',
  },
  teamParityStatValue: {
    color: '#3a4250',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  teamParityStatFoot: {
    color: '#6e7787',
    fontSize: 11,
  },
  teamParityConfidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    backgroundColor: '#f7efd6',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teamParityConfidenceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff2c4',
  },
  teamParityConfidenceIconText: {
    fontSize: 12,
  },
  teamParityConfidenceCopy: {
    flex: 1,
    gap: 1,
  },
  teamParityConfidenceTitle: {
    color: '#3a4250',
    fontSize: 12,
    fontWeight: '800',
  },
  teamParityConfidenceSub: {
    color: '#989ca5',
    fontSize: 10,
  },
  teamParityConfidenceValue: {
    color: '#394150',
    fontSize: 16,
    fontWeight: '900',
  },
  teamParityListCard: {
    borderRadius: 12,
    backgroundColor: '#f0f2f5',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e6ebf2',
  },
  teamParityDividerTop: {
    borderTopWidth: 1,
    borderTopColor: '#dde3ec',
  },
  teamParityMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teamParityMemberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dce7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamParityMemberAvatarText: {
    color: '#355483',
    fontSize: 11,
    fontWeight: '800',
  },
  teamParityMemberCopy: {
    flex: 1,
    minWidth: 0,
  },
  teamParityMemberName: {
    color: '#404857',
    fontSize: 13,
    fontWeight: '700',
  },
  teamParityMemberSub: {
    color: '#8d97a6',
    fontSize: 11,
  },
  teamParityMemberMetric: {
    color: '#3a4250',
    fontSize: 18,
    fontWeight: '900',
  },
  teamParityActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  teamParityActivityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dff0da',
  },
  teamParityActivityIconText: {
    fontSize: 14,
  },
  teamParityActivityCopy: {
    flex: 1,
    gap: 2,
  },
  teamParityActivityTitle: {
    color: '#3e4653',
    fontSize: 13,
    fontWeight: '700',
  },
  teamParityActivityTime: {
    color: '#919aa9',
    fontSize: 11,
  },
  teamParityRouteChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamParityRouteChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dde5f2',
    backgroundColor: '#f7f9fd',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  teamParityRouteChipText: {
    color: '#50607a',
    fontSize: 11,
    fontWeight: '700',
  },
  teamRouteShellWrap: {
    gap: 12,
  },
  teamRouteShellCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 12,
    gap: 12,
  },
  teamRouteShellNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamRouteShellBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteShellBackBtnText: {
    color: '#3b4658',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  teamRouteShellTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
  },
  teamRouteShellSub: {
    color: '#6f7d90',
    fontSize: 12,
    lineHeight: 16,
  },
  teamRouteShellInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5ebf5',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 4,
  },
  teamRouteShellInfoTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  teamRouteShellInfoMeta: {
    color: '#7b8799',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamRouteShellInfoBody: {
    color: '#6f7d90',
    fontSize: 11,
    lineHeight: 15,
  },
  teamRouteShellPrimaryBtn: {
    borderRadius: 10,
    backgroundColor: '#1f5fe2',
    paddingVertical: 11,
    alignItems: 'center',
  },
  teamRouteShellPrimaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  teamRouteScreenWrap: {
    gap: 12,
  },
  teamRouteScreenNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamRouteScreenBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteScreenBackBtnText: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: -2,
  },
  teamRouteScreenNavTitle: {
    color: '#3a4250',
    fontSize: 16,
    fontWeight: '700',
  },
  teamRouteScreenNavSpacer: {
    width: 28,
    height: 28,
  },
  teamRouteInfoBanner: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamRouteInfoBannerLavender: {
    backgroundColor: '#e4e0f8',
    alignItems: 'center',
  },
  teamRouteInfoIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cdd5e3',
    color: '#47556c',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 1,
  },
  teamRouteInfoBannerText: {
    flex: 1,
    color: '#5f6878',
    fontSize: 11,
    lineHeight: 14,
  },
  teamRouteFieldLabel: {
    color: '#4f586a',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  teamRouteInlineInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  teamRouteInputGhost: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#eef0f4',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  teamRouteInputGhostText: {
    color: '#9aa3b0',
    fontSize: 11,
  },
  teamRouteSmallPrimaryBtn: {
    borderRadius: 8,
    backgroundColor: '#343c49',
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  teamRouteSmallPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRoutePrimaryBtn: {
    borderRadius: 8,
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamRoutePrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  teamRouteSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  teamRouteSectionTitle: {
    color: '#666f7e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  teamRouteSectionLink: {
    color: '#5c6474',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  teamRouteStack: {
    gap: 10,
  },
  teamRouteCardRow: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamRouteAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dce7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteAvatarText: {
    color: '#3c5e8f',
    fontSize: 10,
    fontWeight: '800',
  },
  teamRouteCardRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  teamRouteCardRowTitle: {
    color: '#404858',
    fontSize: 13,
    fontWeight: '700',
  },
  teamRouteCardRowSub: {
    color: '#858f9d',
    fontSize: 11,
    lineHeight: 13,
  },
  teamRouteTrailingActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  teamRouteIconGhostBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteIconGhostBtnText: {
    color: '#4c5565',
    fontSize: 13,
    fontWeight: '700',
  },
  teamRoutePendingCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    gap: 8,
  },
  teamRoutePendingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamRouteStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  teamRouteStatusBadgePending: {
    backgroundColor: '#fff3e4',
  },
  teamRouteStatusBadgeExpired: {
    backgroundColor: '#ffe4e4',
  },
  teamRouteStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  teamRouteStatusBadgeTextPending: {
    color: '#f08a18',
  },
  teamRouteStatusBadgeTextExpired: {
    color: '#f14a4a',
  },
  teamRouteInlineButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 42,
  },
  teamRouteSmallSecondaryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d5562',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteSmallSecondaryBtnText: {
    color: '#4d5562',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRouteKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  teamRouteKpiRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e2e7ee',
  },
  teamRouteKpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteKpiIconMint: { backgroundColor: '#dff5ef' },
  teamRouteKpiIconSand: { backgroundColor: '#f4ecd9' },
  teamRouteKpiIconLavender: { backgroundColor: '#e8e1f8' },
  teamRouteKpiIconRose: { backgroundColor: '#f7e1e3' },
  teamRouteKpiIconGray: { backgroundColor: '#e9ebef' },
  teamRouteKpiIconText: {
    fontSize: 13,
  },
  teamRouteToggle: {
    width: 34,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#e1e5eb',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  teamRouteToggleOn: {
    backgroundColor: '#1f5fe2',
  },
  teamRouteToggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  teamRouteToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  teamRouteProBadge: {
    borderRadius: 999,
    backgroundColor: '#b3b3b3',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamRouteProBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  teamRouteMutedText: {
    color: '#b0b5be',
  },
  teamChallengesHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamChallengesUpcomingCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#f0ead7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamChallengesUpcomingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff7dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamChallengesUpcomingIconText: {
    fontSize: 11,
  },
  teamChallengesUpcomingDate: {
    color: '#3f4653',
    fontSize: 14,
    fontWeight: '800',
  },
  teamChallengesCreateBtn: {
    borderRadius: 999,
    backgroundColor: '#0f1218',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  teamChallengesCreateBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  teamChallengesStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamChallengesStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  teamChallengesSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#eceff4',
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  teamChallengesSegmentPill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  teamChallengesSegmentPillActive: {
    backgroundColor: '#1f5fe2',
  },
  teamChallengesSegmentPillText: {
    color: '#4e5c71',
    fontSize: 12,
    fontWeight: '700',
  },
  teamChallengesSegmentPillTextActive: {
    color: '#fff',
  },
  teamChallengesCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    gap: 8,
  },
  teamChallengesCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamChallengesActiveBadge: {
    borderRadius: 999,
    backgroundColor: '#a7df5f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  teamChallengesActiveBadgeText: {
    color: '#35451f',
    fontSize: 10,
    fontWeight: '800',
  },
  teamChallengesCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamChallengesMetaStrong: {
    color: '#474f5f',
    fontSize: 12,
    fontWeight: '700',
  },
  teamChallengesProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#dde2e8',
    overflow: 'hidden',
  },
  teamChallengesProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4fd15f',
  },
  teamChallengesProgressFillYellow: {
    backgroundColor: '#e7cb53',
  },
  coachingEntryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1eaf5',
    padding: 12,
    gap: 8,
  },
  coachingEntryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  coachingEntryTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  coachingEntryBadge: {
    color: '#6f7d93',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coachingEntrySub: {
    color: '#7a8699',
    fontSize: 11,
    lineHeight: 14,
  },
  runtimeStateBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  runtimeStateBannerCompact: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  runtimeStateBannerReady: {
    backgroundColor: '#eefaf1',
    borderColor: '#c7ead0',
  },
  runtimeStateBannerLoading: {
    backgroundColor: '#eef4ff',
    borderColor: '#cdddf8',
  },
  runtimeStateBannerEmpty: {
    backgroundColor: '#f6f8fc',
    borderColor: '#dbe2ec',
  },
  runtimeStateBannerError: {
    backgroundColor: '#fff2f2',
    borderColor: '#efc9c9',
  },
  runtimeStateBannerDenied: {
    backgroundColor: '#fff7e8',
    borderColor: '#edd398',
  },
  runtimeStateBannerPartial: {
    backgroundColor: '#f4f1ff',
    borderColor: '#ddd5ff',
  },
  runtimeStateBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  runtimeStateBannerTitle: {
    color: '#2f3d52',
    fontSize: 10,
    fontWeight: '800',
    flex: 1,
  },
  runtimeStateBannerStateText: {
    color: '#607089',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  runtimeStateBannerDetail: {
    color: '#5f6f86',
    fontSize: 10,
    lineHeight: 13,
  },
  runtimeStateBannerTransition: {
    color: '#71829a',
    fontSize: 9,
    lineHeight: 12,
  },
  knownLimitedDataChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4d5a1',
    backgroundColor: '#fff8e8',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  knownLimitedDataChipText: {
    color: '#6f6030',
    fontSize: 10,
    fontWeight: '700',
  },
  runtimeStateEvidenceOverlay: {
    position: 'absolute',
    top: 96,
    right: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce5f2',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 3,
    zIndex: 20,
    shadowColor: '#1d2c44',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  runtimeStateEvidenceOverlayTitle: {
    color: '#324663',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  runtimeStateEvidenceOverlayChip: {
    color: '#4f5f75',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  coachingNotificationCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe7f3',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  coachingNotificationCardCompact: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  coachingNotificationCardThread: {
    backgroundColor: '#f5f7fb',
    borderColor: '#e3e8f1',
  },
  coachingNotificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  coachingNotificationTitle: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  coachingNotificationHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachingNotificationCountBadge: {
    borderRadius: 999,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coachingNotificationCountBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  coachingNotificationHeaderLabel: {
    color: '#67768c',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachingNotificationHeaderUnread: {
    color: '#45566e',
    fontSize: 9,
    fontWeight: '700',
  },
  coachingNotificationSummaryMeta: {
    color: '#79879a',
    fontSize: 9,
    lineHeight: 12,
  },
  coachingNotificationRowsWrap: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e6edf6',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  coachingNotificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  coachingNotificationRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  coachingNotificationRowDisabled: {
    opacity: 0.88,
  },
  coachingNotificationRowInfo: {
    backgroundColor: '#ffffff',
  },
  coachingNotificationRowWarning: {
    backgroundColor: '#fffdf4',
  },
  coachingNotificationRowError: {
    backgroundColor: '#fff7f7',
  },
  coachingNotificationRowSuccess: {
    backgroundColor: '#f6fff7',
  },
  coachingNotificationRowDotWrap: {
    width: 10,
    alignItems: 'center',
    paddingTop: 5,
  },
  coachingNotificationRowDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#c0cad8',
  },
  coachingNotificationRowDotUnread: {
    backgroundColor: '#2d63e1',
  },
  coachingNotificationRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  coachingNotificationRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachingNotificationRowTitle: {
    color: '#364254',
    fontSize: 10,
    fontWeight: '800',
    flex: 1,
  },
  coachingNotificationInlineBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9e5fa',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  coachingNotificationInlineBadgeText: {
    color: '#315fc5',
    fontSize: 8,
    fontWeight: '800',
  },
  coachingNotificationRowBody: {
    color: '#67768c',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingNotificationRowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  coachingNotificationRowClass: {
    color: '#516175',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  coachingNotificationRowMetaSep: {
    color: '#98a3b4',
    fontSize: 9,
  },
  coachingNotificationRowChannels: {
    color: '#708096',
    fontSize: 9,
  },
  coachingNotificationRowLink: {
    color: '#245fd6',
    fontSize: 9,
    fontWeight: '800',
  },
  coachingNotificationEmptyText: {
    color: '#7a879a',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingGateBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  coachingGateBannerCompact: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  coachingGateBannerAvailable: {
    backgroundColor: '#edf9ef',
    borderColor: '#bfe6c6',
  },
  coachingGateBannerGated: {
    backgroundColor: '#fff8e9',
    borderColor: '#efd79a',
  },
  coachingGateBannerBlocked: {
    backgroundColor: '#fff0f0',
    borderColor: '#efc1c1',
  },
  coachingGateBannerFallback: {
    backgroundColor: '#f4f6fa',
    borderColor: '#e1e7f0',
  },
  coachingGateBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  coachingGateBannerTitle: {
    color: '#344054',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  coachingGateBannerToneText: {
    color: '#617086',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachingGateBannerSummary: {
    color: '#566579',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingGateBannerDetail: {
    color: '#6b788d',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingGateBannerPolicy: {
    color: '#7a8699',
    fontSize: 9,
    lineHeight: 12,
  },
  coachingContractGapCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe6f1',
    backgroundColor: '#f8fafd',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  coachingContractGapTitle: {
    color: '#425066',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachingContractGapText: {
    color: '#6f7d93',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingEntryButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coachingEntryPrimaryBtn: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingEntryPrimaryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  coachingEntrySecondaryBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d9e4f7',
    backgroundColor: '#f8fbff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingEntrySecondaryBtnText: {
    color: '#35557f',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  coachingEntryDarkBtn: {
    borderRadius: 9,
    backgroundColor: '#2f3442',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingEntryDarkBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  coachingAiAssistBtn: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d7def0',
    backgroundColor: '#f7f9fe',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingAiAssistBtnText: {
    color: '#344b77',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  aiAssistBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  aiAssistCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe4f2',
    padding: 14,
    gap: 10,
    shadowColor: '#1f2f46',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    maxHeight: '86%',
  },
  aiAssistHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  aiAssistHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  aiAssistTitle: {
    color: '#263142',
    fontSize: 15,
    fontWeight: '900',
  },
  aiAssistSub: {
    color: '#6d7a8d',
    fontSize: 11,
    lineHeight: 15,
  },
  aiAssistCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2f8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dce4f1',
  },
  aiAssistCloseBtnText: {
    color: '#44536a',
    fontSize: 12,
    fontWeight: '800',
  },
  aiAssistPolicyBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3d7ff',
    backgroundColor: '#f7f1ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiAssistPolicyBannerText: {
    color: '#55476f',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  aiAssistField: {
    gap: 5,
  },
  aiAssistFieldLabel: {
    color: '#57657a',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiAssistFieldValue: {
    color: '#2f3949',
    fontSize: 12,
    fontWeight: '700',
  },
  aiAssistInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dde5f0',
    backgroundColor: '#fbfcfe',
    color: '#2e3646',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  aiAssistInputTall: {
    minHeight: 70,
  },
  aiAssistDraftInput: {
    minHeight: 118,
  },
  aiAssistQueueCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce4ef',
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 6,
  },
  aiAssistQueueCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  aiAssistQueueTitle: {
    color: '#304258',
    fontSize: 11,
    fontWeight: '800',
  },
  aiAssistQueueSummaryText: {
    color: '#55677f',
    fontSize: 10,
    lineHeight: 14,
  },
  aiAssistQueueError: {
    color: '#b42318',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  aiAssistQueueSuccess: {
    color: '#1d6f42',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  aiAssistQueueRecentEmpty: {
    color: '#697a90',
    fontSize: 10,
    lineHeight: 14,
  },
  aiAssistQueueRecentList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3eaf3',
    backgroundColor: '#fff',
  },
  aiAssistQueueRecentRow: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  aiAssistQueueRecentRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#edf1f6',
  },
  aiAssistQueueRecentRowCopy: {
    gap: 2,
  },
  aiAssistQueueRecentStatus: {
    color: '#33465f',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  aiAssistQueueRecentMeta: {
    color: '#65778f',
    fontSize: 10,
    lineHeight: 13,
  },
  aiAssistNotice: {
    color: '#4c5f79',
    fontSize: 11,
    lineHeight: 14,
  },
  aiAssistActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aiAssistSecondaryBtn: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f5f8fd',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistSecondaryBtnText: {
    color: '#364a6d',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  aiAssistPrimaryBtn: {
    borderRadius: 9,
    backgroundColor: '#2f3442',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistPrimaryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  coachingShellWrap: {
    gap: 12,
  },
  coachingShellCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1eaf5',
    padding: 12,
    gap: 10,
  },
  coachingShellTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  coachingShellTitle: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  coachingShellBadge: {
    borderRadius: 999,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d8e5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coachingShellBadgeText: {
    color: '#2d63e1',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachingShellSub: {
    color: '#778395',
    fontSize: 11,
    lineHeight: 15,
  },
  coachingShellActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  coachingShellActionBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dfe7f5',
    backgroundColor: '#f7faff',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingShellActionBtnText: {
    color: '#35557f',
    fontSize: 10,
    fontWeight: '800',
  },
  coachingShellPrimaryBtn: {
    borderRadius: 10,
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingShellPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingStateEvidenceCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce4f1',
    backgroundColor: '#f8fbff',
    padding: 8,
    gap: 6,
  },
  coachingStateEvidenceTitle: {
    color: '#384b67',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachingShellList: {
    gap: 8,
  },
  coachingShellListRow: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachingShellListRowSelected: {
    borderWidth: 1,
    borderColor: '#cfe0ff',
    backgroundColor: '#f1f6ff',
  },
  coachingShellListIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dce7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingShellListIconText: {
    color: '#3c5e8f',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingShellListCopy: {
    flex: 1,
    minWidth: 0,
  },
  coachingShellListTitle: {
    color: '#404858',
    fontSize: 12,
    fontWeight: '700',
  },
  coachingShellListSubText: {
    color: '#858f9d',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
  },
  coachingShellSearchInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfe5ef',
    backgroundColor: '#fff',
    color: '#2f3442',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  coachingShellChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  coachingShellChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dce4f1',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coachingShellChipText: {
    color: '#44536a',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coachingShellListChevron: {
    color: '#556277',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
  coachingShellComposeCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    gap: 8,
  },
  coachingShellComposeTitle: {
    color: '#404858',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingShellComposeSub: {
    color: '#7a8699',
    fontSize: 11,
    lineHeight: 14,
  },
  coachingShellInputGhost: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe5ef',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  coachingShellInputGhostTall: {
    minHeight: 70,
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  coachingShellInputGhostText: {
    color: '#9aa3b0',
    fontSize: 11,
  },
  coachingThreadMessagesList: {
    gap: 8,
    maxHeight: 240,
  },
  coachingThreadMessageBubble: {
    borderRadius: 10,
    backgroundColor: '#f4f6fa',
    borderWidth: 1,
    borderColor: '#e1e7f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
    alignSelf: 'stretch',
  },
  coachingThreadMessageBubbleMine: {
    backgroundColor: '#edf4ff',
    borderColor: '#cfe0ff',
  },
  coachingThreadMessageMeta: {
    color: '#6d7b91',
    fontSize: 10,
    fontWeight: '700',
  },
  coachingThreadMessageBody: {
    color: '#384456',
    fontSize: 11,
    lineHeight: 15,
  },
  coachingThreadComposerWrap: {
    gap: 8,
  },
  coachingThreadComposerInput: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe5ef',
    backgroundColor: '#fff',
    color: '#2f3442',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  coachingThreadComposerInputTall: {
    minHeight: 84,
  },
  coachingThreadSuccessText: {
    color: '#2f7d42',
    fontSize: 11,
    fontWeight: '700',
  },
  coachingJourneyModule: {
    gap: 10,
  },
  coachingJourneySummaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coachingJourneySummaryCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#dbe7ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  coachingJourneySummaryLabel: {
    color: '#5c6f8f',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coachingJourneySummaryValue: {
    color: '#2f3442',
    fontSize: 16,
    fontWeight: '900',
  },
  coachingJourneyInlineError: {
    color: '#b54444',
    fontSize: 11,
    lineHeight: 14,
  },
  coachingJourneyEmptyCard: {
    borderRadius: 10,
    backgroundColor: '#f4f6fa',
    borderWidth: 1,
    borderColor: '#e4e9f1',
    padding: 10,
    gap: 6,
    alignItems: 'flex-start',
  },
  coachingJourneyEmptyTitle: {
    color: '#3b4556',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingJourneyEmptySub: {
    color: '#7d8899',
    fontSize: 11,
    lineHeight: 15,
  },
  coachingJourneyRetryBtn: {
    borderRadius: 8,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  coachingJourneyRetryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  coachingJourneyListCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f2',
    backgroundColor: '#f7f9fc',
    overflow: 'hidden',
  },
  coachingJourneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f7f9fc',
  },
  coachingJourneyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e3e8f0',
  },
  coachingJourneyRowSelected: {
    backgroundColor: '#edf4ff',
  },
  coachingJourneyRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  coachingJourneyRowTitle: {
    color: '#364052',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingJourneyRowSub: {
    color: '#798596',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingJourneyRowMeta: {
    color: '#5f6f86',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  coachingJourneyRowMetricWrap: {
    alignItems: 'flex-end',
    gap: 0,
  },
  coachingJourneyRowMetric: {
    color: '#2a4f9f',
    fontSize: 14,
    fontWeight: '900',
  },
  coachingJourneyRowChevron: {
    color: '#627089',
    fontSize: 16,
    marginTop: -2,
  },
  coachingJourneyDetailHeader: {
    borderRadius: 10,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#dbe7ff',
    padding: 10,
    gap: 4,
  },
  coachingJourneyDetailTitle: {
    color: '#314056',
    fontSize: 13,
    fontWeight: '800',
  },
  coachingJourneyDetailSub: {
    color: '#6f7f95',
    fontSize: 11,
    lineHeight: 15,
  },
  coachingMilestoneBlock: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  coachingMilestoneTitle: {
    color: '#4a5569',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  coachingMilestoneEmpty: {
    color: '#8a93a3',
    fontSize: 11,
  },
  coachingLessonRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e1e7f0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachingLessonRowDivider: {
    marginTop: 6,
  },
  coachingLessonRowSelected: {
    borderColor: '#cfe0ff',
    backgroundColor: '#f2f7ff',
  },
  coachingLessonRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  coachingLessonRowTitle: {
    color: '#394455',
    fontSize: 12,
    fontWeight: '700',
  },
  coachingLessonRowSub: {
    color: '#7f8999',
    fontSize: 10,
    lineHeight: 13,
  },
  coachingLessonRowStatusPill: {
    borderRadius: 999,
    backgroundColor: '#eef2f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coachingLessonRowStatusText: {
    color: '#5d6b81',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  coachingLessonDetailHeader: {
    gap: 4,
  },
  coachingLessonDetailTitle: {
    color: '#334055',
    fontSize: 13,
    fontWeight: '800',
  },
  coachingLessonDetailMeta: {
    color: '#738097',
    fontSize: 11,
  },
  coachingLessonDetailBody: {
    color: '#4f5d72',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  coachingLessonProgressCard: {
    borderRadius: 10,
    backgroundColor: '#f3f6fb',
    borderWidth: 1,
    borderColor: '#e2e8f1',
    padding: 10,
    gap: 7,
  },
  coachingLessonProgressTitle: {
    color: '#394658',
    fontSize: 12,
    fontWeight: '800',
  },
  coachingLessonProgressStatus: {
    color: '#637186',
    fontSize: 11,
  },
  coachingLessonProgressTime: {
    color: '#7c8798',
    fontSize: 10,
  },
  coachingLessonActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  coachingLessonActionBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e0ee',
    backgroundColor: '#fff',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachingLessonActionBtnActive: {
    borderColor: '#1f5fe2',
    backgroundColor: '#1f5fe2',
  },
  coachingLessonActionBtnText: {
    color: '#55647a',
    fontSize: 11,
    fontWeight: '800',
  },
  coachingLessonActionBtnTextActive: {
    color: '#fff',
  },
  participationFocusCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1eaf5',
    padding: 12,
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  participationFocusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  participationFocusTitle: {
    color: '#2f3442',
    fontSize: 14,
    fontWeight: '800',
  },
  participationFocusSub: {
    marginTop: 2,
    color: '#7a8597',
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 230,
  },
  participationFocusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  participationFocusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  participationFocusEmpty: {
    color: '#8a93a3',
    fontSize: 12,
    lineHeight: 16,
  },
  participationFocusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  participationFocusItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    padding: 8,
    gap: 6,
  },
  participationFocusItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  participationFocusIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participationFocusIconInner: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  participationFocusTypePill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  participationFocusTypePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  participationFocusItemName: {
    color: '#3a4354',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    minHeight: 26,
  },
  participationFocusItemCta: {
    color: '#1f5fe2',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeHeaderHint: {
    color: '#8a93a3',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeSectionsWrap: {
    gap: 10,
  },
  challengeLoggingHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1e8f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  challengeLoggingHeaderTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeLoggingHeaderSub: {
    color: '#778395',
    fontSize: 11,
    lineHeight: 14,
  },
  challengeSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1eaf5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  challengeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeSectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  challengeSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  challengeSectionTitle: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
  },
  challengeSectionCount: {
    color: '#7a879a',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeSectionSub: {
    color: '#798496',
    fontSize: 11,
    lineHeight: 14,
  },
  challengeSectionTypePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  challengeSectionTypePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  challengeSectionDivider: {
    height: 1,
    backgroundColor: '#eef2f7',
  },
  challengeLockedPanel: {
    backgroundColor: '#fafbfd',
  },
  challengeGridWrap: {
    rowGap: 10,
    paddingTop: 2,
  },
  challengeGridItem: {
    gap: 4,
  },
  challengeGridTileAnimatedWrap: {
    paddingTop: 1,
  },
  challengeTilePlate: {
    position: 'absolute',
    width: 102,
    height: 102,
    borderRadius: 28,
    backgroundColor: '#f7fbff',
    borderWidth: 1,
    borderColor: '#e5effe',
    shadowColor: '#1f5fe2',
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  challengeGridLabel: {
    color: '#515c6f',
    fontSize: 11,
    lineHeight: 13,
    marginTop: -1,
    paddingHorizontal: 2,
  },
  challengeEmptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 16,
    gap: 10,
    alignItems: 'flex-start',
    shadowColor: '#233a61',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  challengeEmptyBadge: {
    borderRadius: 999,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d8e5ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  challengeEmptyBadgeText: {
    color: '#2d63e1',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeEmptyTitle: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeEmptyText: {
    color: '#6f7888',
    fontSize: 13,
    lineHeight: 19,
  },
  challengeEmptyCta: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  challengeEmptyCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
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
    marginBottom: 2,
  },
  hudRailContent: {
    paddingRight: 6,
    gap: 10,
  },
  hudRailStaticRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  hudCardFill: {
    flex: 1,
  },
  hudCardInteractive: {
    borderColor: '#dfe7f5',
  },
  hudCardTappableGlow: {
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  hudCardActualInteractive: {
    backgroundColor: '#fbfefc',
  },
  hudCardProjectedInteractive: {
    backgroundColor: '#fbfcff',
  },
  hudCardActive: {
    borderColor: '#d8e3f8',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    transform: [{ scale: 1.015 }],
  },
  hudCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  hudCardAccent: {
    width: 24,
    height: 3,
    borderRadius: 999,
  },
  hudCardHintDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    opacity: 0.65,
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
  hudCardValueSlotViewport: {
    height: 28,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  hudCardValueSlotTrack: {
    flexDirection: 'column',
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
    shadowColor: '#223453',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  homeCockpitStage: {
    gap: 6,
  },
  homeCockpitVisualShell: {
    backgroundColor: '#f2f5fa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e9f3',
    padding: 6,
    gap: 4,
  },
  homeCockpitActionShell: {
    backgroundColor: '#f2f5fa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e9f3',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 4,
  },
  anchorNagCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  anchorNagCardWarning: {
    backgroundColor: '#fff4de',
    borderColor: '#f2d28a',
  },
  anchorNagCardStale: {
    backgroundColor: '#f8f2e4',
    borderColor: '#e7cf9f',
  },
  anchorNagCopy: {
    flex: 1,
    minWidth: 0,
  },
  anchorNagEyebrow: {
    color: '#7f6432',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  anchorNagTitle: {
    marginTop: 1,
    color: '#4e4020',
    fontSize: 14,
    fontWeight: '800',
  },
  anchorNagText: {
    marginTop: 2,
    color: '#6b5a35',
    fontSize: 11,
    lineHeight: 14,
  },
  anchorNagCtaPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(128,101,45,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  anchorNagCtaText: {
    color: '#5a4824',
    fontSize: 11,
    fontWeight: '800',
  },
  gameplayHeader: {
    gap: 4,
    marginBottom: 0,
  },
  homeAnchorNagChip: {
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  homeAnchorNagChipWarning: {
    backgroundColor: '#fff6e3',
    borderColor: '#efd79c',
  },
  homeAnchorNagChipStale: {
    backgroundColor: '#faf4e8',
    borderColor: '#e8d7b3',
  },
  homeAnchorNagChipText: {
    flex: 1,
    color: '#5a4a27',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  homeAnchorNagChipCta: {
    color: '#7a5a23',
    fontSize: 11,
    fontWeight: '800',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeRailEdgeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  modeRailEdgeBtnText: {
    color: '#43506a',
    fontSize: 21,
    lineHeight: 22,
    fontWeight: '700',
  },
  modeRailActivePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  modeRailActivePillSvgBg: {
    ...StyleSheet.absoluteFillObject,
  },
  modeRailActivePillSvgShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 14, 24, 0.16)',
  },
  modeRailActivePillText: {
    fontSize: 14.5,
    letterSpacing: 0.45,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  modeRailHintText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.35,
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  modeRailContent: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
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
  panelSfxBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7dde8',
    backgroundColor: '#eef5ff',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSfxBtnMuted: {
    backgroundColor: '#f4f5f7',
    borderColor: '#dfe3ea',
  },
  panelSfxText: {
    color: '#1f5fe2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  panelSfxTextMuted: {
    color: '#6f7888',
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
  chartMarkerPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#4c79e6',
    backgroundColor: 'rgba(76, 121, 230, 0.08)',
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
  chartImpactBurstOverlay: {
    position: 'absolute',
    left: 52,
    right: 12,
    top: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  chartImpactBurstValue: {
    color: '#1f5fe2',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  chartImpactBurstLabel: {
    marginTop: 2,
    color: '#5f6e86',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  monthImpactLabel: {
    color: '#1f5fe2',
    fontWeight: '800',
    backgroundColor: '#e8f0ff',
    borderRadius: 8,
    overflow: 'hidden',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  activitySectionTitleWrap: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  activitySectionSub: {
    color: '#7b8494',
    fontSize: 11,
    lineHeight: 14,
  },
  activityBackfillCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  activityBackfillEmptyPanel: {
    marginTop: 2,
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
  activityHeroCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#223453',
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  activityHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  activityHeroEyebrow: {
    color: '#647083',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  logTitle: {
    fontSize: 20,
    color: '#2f3442',
    fontWeight: '700',
  },
  activityHeroSub: {
    color: '#6f7888',
    fontSize: 12,
    lineHeight: 17,
  },
  logsReportsSwitchCard: {
    backgroundColor: '#eef2f8',
    borderRadius: 999,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  logsReportsSwitchBtn: {
    flex: 1,
    borderRadius: 999,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsReportsSwitchBtnActive: {
    backgroundColor: '#1f5fe2',
  },
  logsReportsSwitchText: {
    color: '#5e6779',
    fontSize: 13,
    fontWeight: '800',
  },
  logsReportsSwitchTextActive: {
    color: '#fff',
  },
  logsReportsSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  logsReportsSummaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  logsReportsSummaryLabel: {
    color: '#6f7888',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  logsReportsSummaryValue: {
    color: '#2f3442',
    fontSize: 24,
    fontWeight: '800',
  },
  logsReportsSummarySub: {
    color: '#7f8795',
    fontSize: 11,
  },
  logsReportsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  logsReportsCardTitle: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
  },
  logsReportsCardSub: {
    color: '#6f7888',
    fontSize: 12,
    lineHeight: 17,
  },
  logsReportsMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#edf1f6',
    paddingTop: 8,
  },
  logsReportsMetricLabel: {
    color: '#5f6a7d',
    fontSize: 12,
    fontWeight: '700',
  },
  logsReportsMetricValue: {
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
  },
  logPipelineBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e2f2',
    backgroundColor: '#eef5ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logPipelineBtnText: {
    color: '#1f5fe2',
    fontSize: 12,
    fontWeight: '800',
  },
  activityDateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#223453',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  activityDateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityDateLabel: {
    color: '#6f7888',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 2,
  },
  activityDateChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  activityDateChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activityDateChipToday: {
    backgroundColor: '#eaf4ea',
    borderColor: '#cfe4d0',
  },
  activityDateChipHistory: {
    backgroundColor: '#eef3ff',
    borderColor: '#dbe5fb',
  },
  activityDateChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activityDateChipTextToday: {
    color: '#2f8c4b',
  },
  activityDateChipTextHistory: {
    color: '#3d5ca8',
  },
  activityTodayJumpBtn: {
    borderRadius: 999,
    backgroundColor: '#2f3645',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activityTodayJumpBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
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
  activityDateNavHint: {
    flex: 1,
    textAlign: 'center',
    color: '#6f7888',
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: 8,
    fontWeight: '600',
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
  activityPipelineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#223453',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  activityPipelineCopy: {
    flex: 1,
    gap: 2,
  },
  activityPipelineTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  activityPipelineSub: {
    color: '#6f7888',
    fontSize: 11,
    lineHeight: 14,
  },
  activityPipelineCta: {
    borderRadius: 999,
    backgroundColor: '#eef5ff',
    borderWidth: 1,
    borderColor: '#d8e2f2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activityPipelineCtaText: {
    color: '#1f5fe2',
    fontSize: 11,
    fontWeight: '800',
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
    letterSpacing: 0.25,
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
  gridTileAnimatedWrap: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  gridCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridCircleWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContextBadgeStack: {
    position: 'absolute',
    top: 2,
    right: -2,
    maxWidth: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 2,
  },
  gridContextBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  gridContextBadgeRequired: {
    backgroundColor: '#fff2c7',
    borderColor: '#efd279',
    borderWidth: 1,
    minWidth: 24,
    height: 14,
    paddingHorizontal: 5,
  },
  gridCircleConfirmed: {
    borderColor: 'rgba(31, 95, 226, 0.28)',
    backgroundColor: 'rgba(31, 95, 226, 0.045)',
    shadowColor: '#1f5fe2',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  gridCircleRequired: {
    borderColor: 'rgba(201, 136, 33, 0.32)',
    backgroundColor: 'rgba(255, 208, 108, 0.07)',
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
  gridLabelConfirmed: {
    color: '#1f5fe2',
    fontWeight: '700',
  },
  gridContextBadgeText: {
    color: '#2f3645',
    fontSize: 12,
    lineHeight: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  gridContextBadgeTextRequired: {
    color: '#735413',
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'transparent',
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 0 },
  },
  gridSuccessBadge: {
    position: 'absolute',
    top: 6,
    right: 2,
    minWidth: 30,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#fff2c7',
    borderWidth: 1,
    borderColor: '#f3d677',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    shadowColor: '#b88714',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  gridSuccessCoinOuter: {
    width: 15,
    height: 15,
    borderRadius: 999,
    backgroundColor: '#f1b40f',
    borderWidth: 1,
    borderColor: '#d19406',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridSuccessCoinInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ffd45a',
    borderWidth: 1,
    borderColor: '#efc43d',
  },
  gridSuccessCoinHighlight: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 4,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
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
    left: 6,
    right: 6,
    bottom: 0,
    zIndex: 90,
    elevation: 90,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e6ebf1',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 0,
  },
  bottomItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 0,
    minWidth: 68,
    minHeight: 68,
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 0,
  },
  bottomItemActivePill: {
    backgroundColor: '#eef4ff',
  },
  bottomItemLogCta: {
    minWidth: 86,
    minHeight: 84,
    marginTop: -8,
    paddingTop: 0,
    paddingHorizontal: 0,
    borderRadius: 28,
    backgroundColor: 'transparent',
  },
  bottomItemLogCtaActive: {
    backgroundColor: 'transparent',
  },
  fxProjectile: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 40,
  },
  fxProjectileText: {
    color: '#2f9f56',
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '900',
    textShadowColor: 'rgba(33, 88, 213, 0.16)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
  fxProjectileTextAlt: {
    color: '#4c79e6',
    fontSize: 19,
    lineHeight: 19,
  },
  fxCoinOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#f1b40f',
    borderWidth: 1,
    borderColor: '#d19406',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#b88714',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  fxCoinOuterTrail: {
    width: 16,
    height: 16,
    opacity: 0.9,
  },
  fxCoinInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#ffd45a',
    borderWidth: 1,
    borderColor: '#efc43d',
  },
  fxCoinHighlight: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 5,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  bottomIcon: {
    color: '#a0a8b7',
    fontSize: 15,
    lineHeight: 16,
  },
  bottomIconImage: {
    width: 62,
    height: 62,
  },
  bottomIconSvgWrap: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIconSvg: {
    width: 62,
    height: 62,
  },
  bottomIconSvgWrapLog: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#2cae54',
    borderWidth: 1,
    borderColor: '#218944',
    shadowColor: '#2cae54',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginBottom: 2,
  },
  bottomIconSvgLog: {
    width: 58,
    height: 58,
  },
  bottomLogSparkle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#e7ffe6',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  bottomLogSparkleOne: {
    top: 10,
    right: 12,
  },
  bottomLogSparkleTwo: {
    top: 16,
    left: 11,
    width: 5,
    height: 5,
  },
  bottomLogLabel: {
    position: 'absolute',
    bottom: 6,
    color: '#f7fff8',
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bottomLogsReportsLabel: {
    position: 'absolute',
    bottom: -11,
    color: '#5f6b7f',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  bottomIconImageInactive: {
    opacity: 0.88,
  },
  bottomIconImageActive: {
    opacity: 1,
  },
  bottomLabel: {
    color: '#a0a8b7',
    fontSize: 11,
    lineHeight: 12,
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
    maxWidth: 420,
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
  drawerList: {
    gap: 8,
    paddingBottom: 4,
  },
  drawerGridScroll: {
    maxHeight: 500,
  },
  drawerListRow: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ecf4',
    backgroundColor: '#fbfcfe',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerListRowSelected: {
    borderColor: '#d4e2fb',
    backgroundColor: '#f5f9ff',
  },
  drawerListRowCapReached: {
    borderColor: '#efe2be',
    backgroundColor: '#fffaf0',
  },
  drawerListIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  drawerListIconInner: {
    transform: [{ scale: 0.48 }],
  },
  drawerListMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  drawerListTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerListLabel: {
    flex: 1,
    color: '#334055',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  drawerListMeta: {
    color: '#6d7889',
    fontSize: 11,
    lineHeight: 14,
  },
  drawerTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  drawerTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  drawerStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
    flexWrap: 'wrap',
  },
  drawerStateChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  drawerStateChipOn: {
    backgroundColor: '#dcf4de',
  },
  drawerStateChipOff: {
    backgroundColor: '#eef2f8',
  },
  drawerStateChipFav: {
    backgroundColor: '#ffe9bc',
  },
  drawerStateChipCap: {
    backgroundColor: '#fff0cf',
  },
  drawerStateChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#415064',
  },
  drawerActionCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  drawerActionPill: {
    borderRadius: 999,
    minWidth: 42,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  pipelineCheckinBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(18, 22, 31, 0.42)',
  },
  pipelineCheckinCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf3',
    maxHeight: '82%',
    overflow: 'hidden',
  },
  pipelineCheckinScroll: {
    maxHeight: '100%',
  },
  pipelineCheckinScrollContent: {
    padding: 14,
    gap: 10,
  },
  pipelineCheckinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pipelineCheckinHeaderCopy: {
    flex: 1,
  },
  pipelineCheckinTitle: {
    color: '#2d3442',
    fontSize: 20,
    fontWeight: '800',
  },
  pipelineCheckinHelp: {
    marginTop: 2,
    color: '#6f7888',
    fontSize: 12,
    lineHeight: 16,
  },
  pipelineCheckinCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f4f9',
  },
  pipelineCheckinCloseBtnText: {
    color: '#596478',
    fontSize: 13,
    fontWeight: '800',
  },
  pipelineCheckinFieldCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    backgroundColor: '#fbfcfe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pipelineCheckinFieldLabel: {
    color: '#3b4454',
    fontSize: 13,
    fontWeight: '700',
  },
  pipelineCheckinStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pipelineStepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineStepperBtnText: {
    color: '#1f5fe2',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  pipelineCheckinCountValue: {
    minWidth: 72,
    textAlign: 'center',
    color: '#2f3442',
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '800',
  },
  pipelineCheckinBranchCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead39f',
    backgroundColor: '#fff8ea',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  pipelineCheckinBranchTitle: {
    color: '#5a4824',
    fontSize: 13,
    fontWeight: '800',
  },
  pipelineCheckinBranchSub: {
    color: '#745f31',
    fontSize: 12,
    lineHeight: 16,
  },
  pipelineCheckinBranchButtons: {
    gap: 8,
  },
  pipelineBranchOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8d3a6',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pipelineBranchOptionText: {
    color: '#4f4121',
    fontSize: 12,
    fontWeight: '700',
  },
  pipelineCheckinInlineInput: {
    borderWidth: 1,
    borderColor: '#dddff0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2f3442',
  },
  pipelineCheckinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineCheckinDateBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e1ef',
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineCheckinDateBtnText: {
    color: '#1f5fe2',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '800',
  },
  pipelineCheckinDateValueWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dddff0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pipelineCheckinDateValueLabel: {
    color: '#7a8394',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  pipelineCheckinDateValueText: {
    marginTop: 2,
    color: '#2f3442',
    fontSize: 14,
    fontWeight: '700',
  },
  pipelineCheckinActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
    paddingTop: 2,
  },
  pipelineCheckinPrimaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#1f5fe2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pipelineCheckinPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  pipelineCheckinSecondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe2ee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pipelineCheckinSecondaryBtnText: {
    color: '#5a6578',
    fontSize: 12,
    fontWeight: '700',
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
