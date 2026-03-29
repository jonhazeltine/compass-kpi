import type { Animated } from 'react-native';
import type { KpiAuthoringIconSource } from '../../lib/kpiIcons';
import type { LinkedTaskCard } from '../../components/comms/messageLinkedTasks';

export type DashboardPayload = {
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
    vp_raw?: number;
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
    icon_source?: 'brand_asset' | 'vector_icon' | 'emoji' | null;
    icon_name?: string | null;
    icon_emoji?: string | null;
    icon_file?: string | null;
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

export type MePayload = {
  tier?: string | null;
  effective_plan?: string | null;
  entitlements?: Record<string, boolean | number | string | null> | null;
  role?: string | null;
  geo_city?: string | null;
  geo_state?: string | null;
  user_metadata?: {
    selected_kpis?: string[];
    favorite_kpis?: string[];
    role?: string | null;
    team_role?: string | null;
    is_coach?: boolean | null;
  };
};

export type LoadState = 'loading' | 'empty' | 'error' | 'ready';
export type Segment = 'PC' | 'GP' | 'VP';
export type ViewMode = 'home' | 'log';
export type BottomTab = 'home' | 'challenge' | 'coach' | 'logs' | 'team' | 'comms';
export type LogsReportsSubview = 'logs' | 'reports';
export type CommsHubPrimaryTab = 'all' | 'channels' | 'dms' | 'broadcast';
export type CommsHubScopeFilter = 'all' | 'team' | 'cohort' | 'global';
export type DrawerFilter = 'Quick' | 'PC' | 'GP' | 'VP';
export type LogOtherFilter = 'All' | 'PC' | 'GP' | 'VP';
export type HomePanel = 'Quick' | 'PC' | 'GP' | 'VP';
export type ChallengeMemberListTab = 'all' | 'completed';
export type ChallengeStateTab = 'active' | 'upcoming' | 'completed';
export type ChallengeKind = 'team' | 'mini' | 'sponsored';
export type ChallengeGoalScope = 'team' | 'individual';
export type KpiTileContextBadge = 'CH' | 'TM' | 'TC' | 'REQ';
export type KpiTileContextMeta = {
  badges: KpiTileContextBadge[];
  isRequired?: boolean;
  isLagging?: boolean;
};
export type HomePanelTile = {
  kpi: DashboardPayload['loggable_kpis'][number];
  context: KpiTileContextMeta;
};
export type PipelineAnchorNagState =
  | { severity: 'ok' }
  | { severity: 'warning' | 'stale'; missingCount: number; staleDays: number; lowConfidence: boolean };
export type PipelineCheckinReason = 'deal_closed' | 'deal_lost' | 'correction';
export type PipelineCheckinFieldKey = 'listings' | 'buyers';
export type PipelineCheckinAnchorTargets = {
  listings: DashboardPayload['loggable_kpis'][number] | null;
  buyers: DashboardPayload['loggable_kpis'][number] | null;
};
export type ChallengeKpiGroups = {
  PC: DashboardPayload['loggable_kpis'];
  GP: DashboardPayload['loggable_kpis'];
  VP: DashboardPayload['loggable_kpis'];
};
export type TeamKpiGroups = {
  PC: DashboardPayload['loggable_kpis'];
  GP: DashboardPayload['loggable_kpis'];
  VP: DashboardPayload['loggable_kpis'];
};
export type TeamLeaderKpiStatusFilter = 'all' | 'on_track' | 'watch' | 'at_risk';
export type TeamFocusEditorFilter = 'PC' | 'GP' | 'VP';
export type CustomKpiDraft = {
  id?: string;
  name: string;
  slug: string;
  requiresDirectValueInput: boolean;
  iconSource?: KpiAuthoringIconSource | null;
  iconName?: string | null;
};
export type ChallengeApiLeaderboardRow = {
  user_id: string;
  activity_count: number;
  progress_percent: number;
};
export type ChallengeApiRow = {
  id: string;
  name: string;
  description?: string | null;
  mode?: string | null;
  challenge_kind?: ChallengeKind | string | null;
  team_id?: string | null;
  team_identity?: {
    id?: string | null;
    name?: string | null;
    identity_avatar?: string | null;
    identity_background?: string | null;
  } | null;
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
  kpi_goal_summary?: {
    total_kpis?: number | null;
    team_goal_count?: number | null;
    individual_goal_count?: number | null;
  } | null;
  leaderboard_top?: ChallengeApiLeaderboardRow[] | null;
};
export type ChallengeListFilter = 'all' | ChallengeKind;
export type ChallengeTemplateRow = {
  id: string;
  title: string;
  description: string;
  suggested_duration_days: number;
  duration_weeks: number | null;
  phase_count: number;
  default_challenge_name: string | null;
  kpi_defaults: Array<{
    kpi_id: string;
    label: string;
    goal_scope_default: ChallengeGoalScope;
    suggested_target: number | null;
    display_order: number;
  }>;
};
export type ChallengeListApiResponse = {
  challenges?: ChallengeApiRow[];
};
export type ChallengeTemplateListApiResponse = {
  templates?: ChallengeTemplateRow[];
  error?: string;
};
export type ChallengeJoinApiResponse = {
  participant?: {
    id?: string;
    challenge_id?: string;
    user_id?: string;
    progress_percent?: number | null;
  };
  leaderboard_top?: ChallengeApiLeaderboardRow[];
  error?: string;
};
export type ChallengeLeaveApiResponse = {
  left?: boolean;
  challenge_id?: string;
  user_id?: string;
  error?: string;
};
export type ChallengeFlowLeaderboardEntry = {
  rank: number;
  name: string;
  pct: number;
  value: number;
  userId?: string;
};
export type ChallengeFlowItem = {
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
  challengeKind: ChallengeKind;
  challengeModeLabel: string;
  targetValueLabel: string;
  startAtIso?: string | null;
  endAtIso?: string | null;
  raw?: ChallengeApiRow | null;
  leaderboardPreview: ChallengeFlowLeaderboardEntry[];
};
export type ChallengeWizardStep = 'source' | 'basics' | 'kpis' | 'audience' | 'review';
/** V2 wizard steps (full-screen redesign) */
export type ChallengeWizardStepV2 = 'templates' | 'goal_timeline' | 'kpis' | 'invite_launch';
export type ChallengeWizardGoalDraft = {
  kpi_id: string;
  label: string;
  goal_scope: ChallengeGoalScope;
  goal_target: string;
  display_order: number;
  kpi_type?: string;
  suggested?: boolean;
};
/** Phase from a challenge template (stored in template_payload.phases[]) */
export type ChallengeTemplatePhase = {
  phase_order: number;
  phase_name: string;
  starts_at_week: number;
  kpi_goals: Array<{
    kpi_id: string;
    target_value: number;
    goal_scope: ChallengeGoalScope;
  }>;
};
export type TeamFlowScreen =
  | 'dashboard'
  | 'invite_member'
  | 'pending_invitations'
  | 'kpi_settings'
  | 'pipeline'
  | 'team_challenges';
export type TeamLogContextSource = 'team_leader_member_detail';
export type TeamLogContext = {
  member_id: string;
  member_name: string;
  kpi_id: string;
  source: TeamLogContextSource;
};
export type TeamDirectoryMember = {
  id: string;
  userId: string | null;
  name: string;
  metric: string;
  sub: string;
  roleLabel: string;
  avatarTone: string;
  avatarPresetId?: string | null;
  avatarUrl: string | null;
  email: string;
  phone: string;
  coachingGoals: string[];
  kpiGoals: string[];
  cohorts: string[];
  journeys: string[];
  onboardingKpiGoals?: Partial<Record<'PC' | 'GP' | 'VP', number>>;
  profileKpiGoals?: Partial<Record<'PC' | 'GP' | 'VP', number>>;
};
export type TeamApiMemberSummary = {
  user_id: string;
  role?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatar_preset_id?: string | null;
};
export type TeamDetailResponse = {
  team?: {
    id?: string;
    name?: string | null;
    identity_avatar?: string | null;
    identity_background?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  members?: TeamApiMemberSummary[] | null;
  error?: string;
};
export type TeamMembershipMutationResponse = {
  left?: boolean;
  removed?: boolean;
  error?: string;
  cleanup?: {
    challenge_participants_removed?: number;
    channel_memberships_removed?: number;
  } | null;
  warning?: {
    challenge_enrollment_removed?: boolean;
    team_contribution_metrics_removed?: boolean;
    custom_kpi_visibility_note?: string;
  } | null;
};
export type CoachingShellScreen =
  | 'inbox'
  | 'inbox_channels'
  | 'channel_thread'
  | 'coach_broadcast_compose'
  | 'coaching_journeys'
  | 'coaching_journey_detail'
  | 'coaching_lesson_detail';
export type CoachTabScreen =
  | 'coach_marketplace'
  | 'coach_subscription_shell'
  | 'coach_hub_primary'
  | 'coach_video_session'
  | 'coach_content_library'
  | 'coach_direct_comms'
  | 'coach_goals_tasks'
  | 'coach_challenges'
  | 'coach_offer_dm_coaching'
  | 'coach_offer_fourth_reason';
export type CoachEntitlementState = 'allowed' | 'pending' | 'blocked' | 'fallback';
export type CoachEngagementStatus = 'none' | 'pending' | 'active' | 'ended';
export type CoachAssignmentType = 'personal_goal' | 'team_leader_goal' | 'coach_goal' | 'personal_task' | 'coach_task';
/* ── Coach Workflow types ── */
export type CoachWorkflowSection = 'journeys' | 'clients' | 'cohorts' | 'segments';
export type CoachCohortRow = {
  id: string;
  name: string;
  members_count: number;
  leaders_count: number;
  member_user_ids: string[];
  my_membership_role: 'team_leader' | 'member' | null;
};
export type CoachSegmentPreset = {
  id: string;
  label: string;
  rule: 'kpi_completion' | 'gci_direction' | 'journey_progress' | 'manual';
  status: 'live' | 'preview';
  description: string;
};
export type CoachWorkflowAssignMode = 'none' | 'cohort' | 'individual';
/* ── Journey Builder types (ported from CoachPortalScreen) ── */
export type JourneyBuilderTask = {
  id: string;
  title: string;
  assetId: string | null;
  progressStatus?: 'not_started' | 'in_progress' | 'completed';
  completedAt?: string | null;
};
export type JourneyBuilderLesson = { id: string; title: string; tasks: JourneyBuilderTask[]; is_locked?: boolean; release_strategy?: string; release_date?: string | null };
export type JourneyBuilderSaveState = 'idle' | 'pending' | 'saved' | 'error';
export type LibraryAsset = { id: string; title: string; category: string; scope: string; duration: string; playbackId?: string | null };
export type LibraryCollection = { id: string; name: string; assetIds: string[] };

export type CoachAssignmentStatus = 'pending' | 'in_progress' | 'completed';
export type CoachAssignment = {
  id: string;
  type: CoachAssignmentType;
  title: string;
  status: CoachAssignmentStatus;
  due_at: string | null;
  assignee_id: string | null;
  source: 'goals' | 'message_linked';
  created_at: string;
  channel_id?: string | null;
  source_message_id?: string | null;
  last_thread_event_at?: string | null;
  thread_read_state?: 'unread' | 'read' | 'unknown' | string;
  rights?: {
    can_edit_fields?: boolean;
    can_update_status?: boolean;
    can_mark_complete?: boolean;
    can_reassign?: boolean;
  } | null;
};
export type CoachProfile = {
  id: string;
  name: string;
  specialties: string[];
  bio: string;
  engagement_availability: 'available' | 'waitlist' | 'unavailable';
};
export type CoachEngagement = {
  id: string;
  coach_id: string;
  client_id: string;
  status: 'pending' | 'active' | 'ended';
  entitlement_state: CoachEntitlementState;
  plan_tier_label: string;
  status_reason: string;
  next_step_cta: string;
  coach: { id: string; name: string; specialties: string[] } | null;
  created_at: string;
};
export type CoachingChannelScope = 'team' | 'challenge' | 'sponsor' | 'cohort' | 'community';
export type CoachingShellEntrySource =
  | 'home'
  | 'challenge_details'
  | 'team_leader_dashboard'
  | 'team_member_dashboard'
  | 'user_tab'
  | 'unknown';
export type CoachingShellContext = {
  source: CoachingShellEntrySource;
  preferredChannelScope: CoachingChannelScope | null;
  preferredChannelLabel: string | null;
  threadTitle: string | null;
  threadHeaderDisplayName: string | null;
  threadSub: string | null;
  broadcastAudienceLabel: string | null;
  broadcastRoleAllowed: boolean;
  selectedJourneyId: string | null;
  selectedJourneyTitle: string | null;
  selectedLessonId: string | null;
  selectedLessonTitle: string | null;
};
export type RuntimePackageDisplayRequirements = {
  disclaimer?: string | null;
  sponsor_attribution?: string | null;
  paywall_cta_required?: boolean | null;
  sponsor_disclaimer_required?: boolean | null;
  sponsor_attribution_required?: boolean | null;
};
export type RuntimePackagingReadModel = {
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
export type RuntimeNotificationReadState = 'read' | 'unread' | 'unknown' | string;
export type RuntimeNotificationSeverity = 'info' | 'warning' | 'success' | 'error' | string;
export type RuntimeNotificationDeliveryChannel = 'in_app' | 'badge' | 'banner' | 'push' | string;
export type RuntimeNotificationRouteTarget = {
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
export type RuntimeNotificationItem = {
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
export type RuntimeNotificationSummaryReadModel = {
  total_count?: number | null;
  unread_count?: number | null;
  banner_count?: number | null;
  badge_count?: number | null;
  badge_label?: string | null;
  read_model_status?: string | null;
  notes?: string[] | null;
};
export type RuntimeSurfaceState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'permission_denied'
  | 'partial_read_model'
  | 'ready';
export type RuntimeSurfaceStateModel = {
  state: RuntimeSurfaceState;
  title: string;
  detail: string;
  transitionHint: string;
};
export type RuntimePackageVisibilityOutcome = {
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
export type CoachingPackageGateTone = 'available' | 'gated' | 'blocked' | 'fallback';
export type CoachingPackageGatePresentation = {
  tone: CoachingPackageGateTone;
  title: string;
  summary: string;
  detail?: string | null;
  policyNote?: string | null;
};
export type AIAssistHostSurface =
  | 'challenge_coaching_module'
  | 'team_member_coaching_module'
  | 'team_leader_coaching_module'
  | 'channel_thread'
  | 'coach_broadcast_compose'
  | 'coaching_journeys'
  | 'coaching_journey_detail'
  | 'coaching_lesson_detail';
export type AIAssistShellContext = {
  host: AIAssistHostSurface;
  title: string;
  sub: string;
  targetLabel: string;
  approvedInsertOnly: boolean;
};
export type AIAssistRequestIntent = 'draft_reply' | 'draft_broadcast' | 'reflection_prompt' | 'rewrite' | 'draft_support_note';
export type AiSuggestionQueueReadModel = {
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
export type AiSuggestionApiRow = {
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
export type AiSuggestionQueueSummary = {
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
export type AiSuggestionCreateResponse = {
  suggestion?: AiSuggestionApiRow;
  error?: string;
};
export type AiSuggestionsListResponse = {
  suggestions?: AiSuggestionApiRow[];
  queue_summary?: AiSuggestionQueueSummary | null;
  error?: string;
};
export type CoachingJourneyListItem = {
  id: string;
  title: string;
  description?: string | null;
  team_id?: string | null;
  created_by?: string | null;
  is_active?: boolean | null;
  status?: 'draft' | 'active' | 'hidden' | string | null;
  created_at?: string | null;
  milestones_count?: number;
  lessons_total?: number;
  lessons_completed?: number;
  completion_percent?: number;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
};
export type CoachingJourneyListResponse = {
  journeys?: CoachingJourneyListItem[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
export type CoachingJourneyDetailLesson = {
  id: string;
  title: string;
  body?: string | null;
  sort_order?: number;
  progress_status?: 'not_started' | 'in_progress' | 'completed' | string;
  completed_at?: string | null;
  is_locked?: boolean;
};
export type CoachingJourneyDetailMilestone = {
  id: string;
  journey_id?: string;
  title: string;
  sort_order?: number;
  release_strategy?: 'immediate' | 'sequential' | 'scheduled' | string;
  release_date?: string | null;
  is_locked?: boolean;
  lessons?: CoachingJourneyDetailLesson[];
};
export type CoachingJourneyDetailResponse = {
  journey?: CoachingJourneyListItem;
  milestones?: CoachingJourneyDetailMilestone[];
  assets?: Array<{ id: string; title: string; category: string; scope: string; duration: string; playbackId?: string | null }>;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  error?: string;
};
export type CoachingProgressSummaryResponse = {
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
export type CoachingLessonProgressWriteResponse = {
  progress?: {
    lesson_id?: string;
    user_id?: string;
    status?: 'not_started' | 'in_progress' | 'completed' | string;
    completed_at?: string | null;
    updated_at?: string | null;
  };
  error?: string;
};
export type ChannelApiRow = {
  id: string;
  type: 'team' | 'challenge' | 'sponsor' | 'cohort' | 'direct' | string;
  name: string;
  avatar_url?: string | null;
  avatar_label?: string | null;
  avatar_tone?: string | null;
  team_id?: string | null;
  context_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  my_role?: string | null;
  unread_count?: number;
  last_seen_at?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  dm_display_name?: string | null;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
};
export type ChannelsListResponse = {
  channels?: ChannelApiRow[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
export type ChannelCreateResponse = {
  channel?: ChannelApiRow | null;
  error?: string;
};
export type ChannelMessageRow = {
  id: string;
  channel_id: string;
  sender_user_id?: string | null;
  body: string;
  message_kind?: 'text' | 'personal_task' | 'coach_task' | string;
  linked_task_card?: LinkedTaskCard | null;
  message_type?: 'message' | 'broadcast' | 'media_attachment' | string;
  created_at?: string | null;
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  /** Structured media attachment from API read model */
  media_attachment?: {
    media_id: string;
    caption?: string;
    lifecycle?: { processing_status: string; playback_ready: boolean } | null;
    file_url?: string;
    playback_id?: string;
    content_type?: string;
  };
};
export type ChannelMessagesResponse = {
  channel?: ChannelApiRow | null;
  messages?: ChannelMessageRow[];
  package_visibility?: RuntimePackageVisibilityOutcome | null;
  packaging_read_model?: RuntimePackagingReadModel | null;
  notification_items?: unknown[] | null;
  notification_summary_read_model?: unknown | null;
  error?: string;
};
export type ChannelMessageWriteResponse = {
  message?: ChannelMessageRow;
  error?: string;
};
export type ChannelBroadcastWriteResponse = {
  broadcast?: ChannelMessageRow;
  error?: string;
};
export type ChannelTokenPurpose = 'chat_read' | 'chat_write' | 'channel_admin';
export type ChannelTokenResponse = {
  provider?: string;
  provider_user_id?: string;
  provider_channel_id?: string;
  provider_token?: string;
  expires_at?: string;
  ttl_seconds?: number;
  scope_grants?: {
    chat_read?: boolean;
    chat_write?: boolean;
    channel_admin?: boolean;
  };
  provider_sync_status?: string | null;
  provider_sync_updated_at?: string | null;
  provider_error_code?: string | null;
  provider_trace_id?: string | null;
  error?: string | { code?: string; message?: string; request_id?: string };
};
export type ChannelSyncResponse = {
  provider?: string;
  provider_channel_id?: string;
  sync_status?: string;
  sync_diff?: {
    members_added?: number;
    members_removed?: number;
    roles_updated?: number;
    metadata_updated?: boolean;
  };
  provider_sync_updated_at?: string | null;
  provider_trace_id?: string | null;
  authority_version?: number;
  error?: string | { code?: string; message?: string; request_id?: string };
};
export type CoachingMediaUploadUrlResponse = {
  upload_id?: string;
  media_id?: string;
  upload_url?: string;
  upload_url_expires_at?: string;
  file_url?: string;
  lifecycle?: {
    processing_status?: string;
    playback_ready?: boolean;
  };
  error?: string | { code?: string; message?: string; request_id?: string };
};
export type CoachingMediaPlaybackTokenResponse = {
  token?: string;
  token_expires_at?: string;
  playback_id?: string;
  error?: string | { code?: string; message?: string; request_id?: string };
};
// LiveSessionRecord / LiveSessionResponse — now in app/lib/liveSessionTypes.ts
// State management moved to useLiveSession hook.

export type PendingDirectLog = {
  kpiId: string;
  name: string;
  type: DashboardPayload['loggable_kpis'][number]['type'];
};

export type ActiveFlightFx = {
  key: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  arcLift: number;
  anim: Animated.Value;
};

export type MeasuredBox = { x: number; y: number; width: number; height: number };

export type SendLogOptions = {
  kpiType?: DashboardPayload['loggable_kpis'][number]['type'];
  skipSuccessBadge?: boolean;
  skipProjectionFlight?: boolean;
  eventTimestampIso?: string;
};

export type QueuedLogTask = {
  kpiId: string;
  direct?: number;
  options?: SendLogOptions;
};

export type MenuRouteTarget = {
  tab?: 'team' | 'coach' | 'challenge';
  screen?: string;
  target_id?: string;
} | null;

export type Props = {
  onOpenUserMenu?: () => void;
  onOpenInviteCode?: () => void;
  menuRouteTarget?: MenuRouteTarget;
  onMenuRouteTargetConsumed?: () => void;
};
