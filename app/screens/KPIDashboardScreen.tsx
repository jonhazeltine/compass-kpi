import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
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
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Polygon } from 'react-native-svg';
import LottieSlot from '../components/LottieSlot';
import { CommsHub } from '../components/comms';
import type { ChannelRow as CommsChannelRow } from '../components/comms';
import { useBottomNavAnimation } from '../components/comms/useBottomNavAnimation';
import type { LinkedTaskCard, ThreadSendPayload } from '../components/comms/messageLinkedTasks';
import DeveloperToolsModal from '../components/dev/DeveloperToolsModal';
import { KpiIcon } from '../components/kpi';
import UserProfileDrawer from '../components/profile/UserProfileDrawer';
import ReportsTabV2 from '../components/reports/ReportsTabV2';
import { useAuth } from '../contexts/AuthContext';
import { useEntitlements } from '../contexts/EntitlementsContext';
import PaywallModal from '../components/PaywallModal';
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
import {
  previewCampaignAudience,
  sendBroadcastCampaign,
  type BroadcastTarget,
  type BroadcastTaskDraft,
} from '../lib/broadcastCampaignApi';
import type { TargetOption } from '../components/comms/BroadcastComposer';
import { API_URL, DEV_TOOLS_ENABLED } from '../lib/supabase';
import { useLiveSession } from '../hooks/useLiveSession';
import { usePaywallGating } from '../hooks/usePaywallGating';
import { useTeamIdentityEditor } from '../hooks/useTeamIdentityEditor';
import { useAiAssistDrafting } from '../hooks/useAiAssistDrafting';
import { usePipelineCheckin } from '../hooks/usePipelineCheckin';
import { useTeamRosterManager } from '../hooks/useTeamRosterManager';
import { useRuntimePersona } from '../hooks/useRuntimePersona';
import { useChallengeWorkflow } from '../hooks/useChallengeWorkflow';
import { useCoachingWorkflow } from '../hooks/useCoachingWorkflow';
import { useJourneyBuilder } from '../hooks/useJourneyBuilder';
import AiAssistDrawer from '../components/dashboard/AiAssistDrawer';
import KpiAddDrawer from '../components/dashboard/KpiAddDrawer';
import CustomKpiModal from '../components/dashboard/CustomKpiModal';
import PipelineCheckinDrawer from '../components/dashboard/PipelineCheckinDrawer';
import JourneyBuilderDrawer from '../components/coach/JourneyBuilderDrawer';
import LiveSetupSheet from '../components/comms/LiveSetupSheet';
import LiveBroadcastScreen from '../components/comms/LiveBroadcastScreen';
import BottomTabBar from '../components/dashboard/BottomTabBar';
import HudRail from '../components/dashboard/HudRail';
import ChallengeTab from '../components/challenge/ChallengeTab';
import TeamTab from '../components/team/TeamTab';
import CoachTab from '../components/coach/CoachTab';
import HomeTab from '../components/home/HomeTab';
import { createCustomKpi, fetchCustomKpis, updateCustomKpi, type CustomKpiRow } from '../lib/customKpiApi';
import {
  getKpiTypeIconTreatment,
  normalizeKpiIdentifier,
  resolveKpiIcon,
  type KpiAuthoringIconSource,
} from '../lib/kpiIcons';
import { colors, radii } from '../theme/tokens';
import { buildDefaultChallengeTemplatesFromKpis } from './kpi-dashboard/defaultChallengeTemplates';
import { toneForAvatarPreset } from '../lib/profileIdentity';
import type {
  AIAssistHostSurface,
  AIAssistRequestIntent,
  AIAssistShellContext,
  AiSuggestionApiRow,
  AiSuggestionCreateResponse,
  AiSuggestionQueueReadModel,
  AiSuggestionQueueSummary,
  AiSuggestionsListResponse,
  ActiveFlightFx,
  BottomTab,
  ChannelApiRow,
  ChannelBroadcastWriteResponse,
  ChannelCreateResponse,
  ChannelMessageRow,
  ChannelMessageWriteResponse,
  ChannelMessagesResponse,
  ChannelSyncResponse,
  ChannelTokenPurpose,
  ChannelTokenResponse,
  ChannelsListResponse,
  ChallengeMemberListTab,
  ChallengeStateTab,
  ChallengeKind,
  ChallengeGoalScope,
  ChallengeApiLeaderboardRow,
  ChallengeApiRow,
  ChallengeFlowItem,
  ChallengeFlowLeaderboardEntry,
  ChallengeJoinApiResponse,
  ChallengeLeaveApiResponse,
  ChallengeListApiResponse,
  ChallengeListFilter,
  ChallengeTemplateListApiResponse,
  ChallengeTemplateRow,
  ChallengeWizardGoalDraft,
  ChallengeWizardStep,
  ChallengeKpiGroups,
  CoachAssignment,
  CoachAssignmentStatus,
  CoachAssignmentType,
  CoachCohortRow,
  CoachEngagement,
  CoachEngagementStatus,
  CoachEntitlementState,
  CoachProfile,
  CoachSegmentPreset,
  CoachTabScreen,
  CoachWorkflowAssignMode,
  CoachWorkflowSection,
  CoachingChannelScope,
  CoachingJourneyDetailLesson,
  CoachingJourneyDetailMilestone,
  CoachingJourneyDetailResponse,
  CoachingJourneyListItem,
  CoachingJourneyListResponse,
  CoachingLessonProgressWriteResponse,
  CoachingMediaPlaybackTokenResponse,
  CoachingMediaUploadUrlResponse,
  CoachingPackageGatePresentation,
  CoachingPackageGateTone,
  CoachingProgressSummaryResponse,
  CoachingShellContext,
  CoachingShellEntrySource,
  CoachingShellScreen,
  CommsHubPrimaryTab,
  CommsHubScopeFilter,
  CustomKpiDraft,
  DashboardPayload,
  DrawerFilter,
  HomePanelTile,
  HomePanel,
  JourneyBuilderLesson,
  JourneyBuilderSaveState,
  JourneyBuilderTask,
  KpiTileContextBadge,
  KpiTileContextMeta,
  LibraryAsset,
  LibraryCollection,
  LoadState,
  LogOtherFilter,
  LogsReportsSubview,
  MePayload,
  MeasuredBox,
  MenuRouteTarget,
  PendingDirectLog,
  PipelineAnchorNagState,
  PipelineCheckinAnchorTargets,
  PipelineCheckinFieldKey,
  PipelineCheckinReason,
  Props,
  QueuedLogTask,
  RuntimeNotificationDeliveryChannel,
  RuntimeNotificationItem,
  RuntimeNotificationReadState,
  RuntimeNotificationRouteTarget,
  RuntimeNotificationSeverity,
  RuntimeNotificationSummaryReadModel,
  RuntimePackageDisplayRequirements,
  RuntimePackageVisibilityOutcome,
  RuntimePackagingReadModel,
  RuntimeSurfaceState,
  RuntimeSurfaceStateModel,
  Segment,
  SendLogOptions,
  TeamApiMemberSummary,
  TeamDetailResponse,
  TeamDirectoryMember,
  TeamFlowScreen,
  TeamFocusEditorFilter,
  TeamKpiGroups,
  TeamLeaderKpiStatusFilter,
  TeamLogContext,
  TeamLogContextSource,
  TeamMembershipMutationResponse,
  ViewMode,
} from './kpi-dashboard/types';
import {
  KPI_TYPE_SORT_ORDER,
  PC_PRIORITY_SLUG_ORDER,
  GP_BOTTOM_SLUG_GROUP,
  PC_PRIORITY_SLUG_INDEX,
  GP_BOTTOM_SLUG_INDEX,
  HOME_PANEL_ORDER,
  HOME_PANEL_LABELS,
  HOME_PANEL_ICONS,
  GAMEPLAY_MODE_ACTIVE_WIDTH,
  GAMEPLAY_MODE_INACTIVE_WIDTH,
  GAMEPLAY_MODE_GAP,
  GAMEPLAY_MODE_LOOP_CYCLES,
  MODE_RAIL_LOOP_CYCLES,
  MODE_RAIL_MIDDLE_CYCLE,
  PROJECTED_CARD_WINDOWS,
  ACTUAL_CARD_VIEWS,
  GP_LOTTIE_SOURCE,
  VP_LOTTIE_SOURCE,
  PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS,
  PIPELINE_CHECKIN_DISMISS_KEY_PREFIX,
  MAX_KPIS_PER_TYPE,
  UUID_LIKE_RE,
  SELF_PROFILE_DRAWER_ID,
  dashboardAssets,
  feedbackAudioAssets,
  bottomTabIconSvgByKey,
  homePanelPillSvgBg,
  bottomTabIconStyleByKey,
  bottomTabAccessibilityLabel,
  bottomTabDisplayLabel,
} from './kpi-dashboard/constants';
import {
  fmtUsd,
  fmtNum,
  normalizeCoachAssignmentStatus,
  fmtShortMonthDayYear,
  fmtShortMonthDay,
  fmtMonthDayTime,
  getApiErrorMessage,
  mapCommsHttpError,
  normalizeChannelTypeToScope,
  normalizePackagingReadModelToVisibilityOutcome,
  pickRuntimePackageVisibility,
  deriveCoachingPackageGatePresentation,
  normalizeRuntimeNotificationSummary,
  normalizeRuntimeNotificationItems,
  summarizeNotificationRows,
  isPartialReadModelStatus,
  deriveRuntimeSurfaceStateModel,
  challengeBucketFromDates,
  challengeStatusLabelFromBucket,
  challengeDaysLabelFromDates,
  challengeTimeframeLabel,
  challengeModeLabelFromApi,
  resolveChallengeKindFromApi,
  leaderboardFallbackName,
  mapChallengeLeaderboardPreview,
  defaultChallengeFlowItems,
  mapChallengesToFlowItems,
  challengeListFilterMatches,
  isApiBackedChallenge,
  confidenceColor,
  toPointsSpaced,
  yForValue,
  formatUsdAxis,
  kpiTypeTint,
  kpiTypeAccent,
  kpiSortSlug,
  compareKpisForSelectionOrder,
  sortSelectableKpis,
  normalizeManagedKpiIds,
  dedupeKpisById,
  emptyCustomKpiDraft,
  customKpiDraftFromRow,
  derivePlaceholderOverlayBadgesForHomeTile,
  deriveKpiTileContextMeta,
  buildHomePanelTiles,
  rankHomePriorityKpisV1,
  derivePipelineAnchorNagState,
  deriveChallengeSurfaceKpis,
  groupChallengeKpisByType,
  deriveChallengeScopedKpis,
  deriveTeamSurfaceKpis,
  groupTeamKpisByType,
  findPipelineCheckinAnchors,
  readPipelineAnchorCountsFromPayload,
  findActualGciLogKpi,
  renderContextBadgeLabel,
  monthKey,
  monthKeyLocal,
  monthLabel,
  monthLabelFromIsoMonthStart,
  aiAssistIntentForHost,
  formatLogDateHeading,
  formatTodayLabel,
  isoTodayLocal,
  shiftIsoLocalDate,
  eventTimestampIsoForSelectedDay,
  chartFromPayload,
} from './kpi-dashboard/helpers';


function renderKpiIcon(kpi: DashboardPayload['loggable_kpis'][number]) {
  return <KpiIcon kpi={kpi} size={76} backgroundColor="transparent" color={kpiTypeAccent(kpi.type)} />;
}

const isLightColor = (hex: string): boolean => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
};

export default function KPIDashboardScreen({
  onOpenUserMenu,
  onOpenInviteCode,
  menuRouteTarget,
  onMenuRouteTargetConsumed,
}: Props) {
  const { session } = useAuth();
  const { tier: entitlementTier, effectivePlan, can: entitlementCan, limit: entitlementLimitFromContext } = useEntitlements();
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
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  // challenge state provided by useChallengeWorkflow (wired below)
  const [challengeApiRows, setChallengeApiRows] = useState<ChallengeApiRow[] | null>(null);
  const [challengeApiFetchError, setChallengeApiFetchError] = useState<string | null>(null);
  const [runtimeMeRole, setRuntimeMeRole] = useState<string | null>(null);
  const [runtimeMeTier, setRuntimeMeTier] = useState<string>('free');
  const [runtimeEntitlements, setRuntimeEntitlements] = useState<Record<string, boolean | number | string | null>>({});
  // ── usePaywallGating ──────────────────────────────────────────────
  const {
    visible: paywallVisible,
    title: paywallTitle,
    message: paywallMessage,
    requiredPlan: paywallRequiredPlan,
    showPaywall,
    hidePaywall,
  } = usePaywallGating();
  // challengeWizard state provided by useChallengeWorkflow (wired below)
  // teamFlowScreen provided by useTeamRosterManager (wired below)
  // teamChallengesSegment provided by useChallengeWorkflow (wired below)
  const [teamLeaderExpandedMemberId, setTeamLeaderExpandedMemberId] = useState<string | null>(null);
  const [teamFocusSelectedKpiIds, setTeamFocusSelectedKpiIds] = useState<string[]>([]);
  const [teamFocusEditorOpen, setTeamFocusEditorOpen] = useState(false);
  const [teamFocusEditorFilter, setTeamFocusEditorFilter] = useState<TeamFocusEditorFilter>('PC');
  const [teamCommsHandoffError, setTeamCommsHandoffError] = useState<string | null>(null);
  // teamProfileMemberId, teamRosterMembers, teamRosterName, teamRosterError, teamRosterTeamId, lastTeamRosterFetchAtRef provided by useTeamRosterManager
  // ── useTeamIdentityEditor ─────────────────────────────────────────
  const {
    avatar: teamIdentityAvatar,
    background: teamIdentityBackground,
    editOpen: teamIdentityEditOpen,
    draftName: teamIdentityDraftName,
    draftAvatar: teamIdentityDraftAvatar,
    draftBackground: teamIdentityDraftBackground,
    avatarCategory: teamIdentityAvatarCategory,
    saveBusy: teamIdentitySaveBusy,
    controlsOpen: teamIdentityControlsOpen,
    setAvatar: setTeamIdentityAvatar,
    setBackground: setTeamIdentityBackground,
    setEditOpen: setTeamIdentityEditOpen,
    setDraftName: setTeamIdentityDraftName,
    setDraftAvatar: setTeamIdentityDraftAvatar,
    setDraftBackground: setTeamIdentityDraftBackground,
    setAvatarCategory: setTeamIdentityAvatarCategory,
    setControlsOpen: setTeamIdentityControlsOpen,
    openEditor: openTeamIdentityEditorFromHook,
    cancelEditor: cancelTeamIdentityEditorFromHook,
    saveEdits: saveTeamIdentityEditsFromHook,
  } = useTeamIdentityEditor(session?.access_token ?? null, null);
  // teamMembershipMutationBusy, teamMembershipMutationNotice, teamInviteCodeBusy, teamInviteCodeNotice provided by useTeamRosterManager
  const [teamLogContext, setTeamLogContext] = useState<TeamLogContext | null>(null);
  const [coachingShellScreen, setCoachingShellScreen] = useState<CoachingShellScreen>('inbox_channels');
  const [coachTabScreen, setCoachTabScreen] = useState<CoachTabScreen>('coach_marketplace');
  const [coachEngagementStatus, setCoachEngagementStatus] = useState<CoachEngagementStatus>('none');
  const [coachEntitlementState, setCoachEntitlementState] = useState<CoachEntitlementState>('allowed');
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([]);
  const [coachGoalsTasksFilter, setCoachGoalsTasksFilter] = useState<CoachAssignmentType | 'all'>('all');
  const [coachProfiles, setCoachProfiles] = useState<CoachProfile[]>([]);
  const [coachMarketplaceLoading, setCoachMarketplaceLoading] = useState(false);
  const [coachActiveEngagement, setCoachActiveEngagement] = useState<CoachEngagement | null>(null);
  const [coachEngagementLoading, setCoachEngagementLoading] = useState(false);
  const [coachSelectedProfile, setCoachSelectedProfile] = useState<CoachProfile | null>(null);
  const coachTabDefault: CoachTabScreen = coachEngagementStatus === 'active' ? 'coach_hub_primary' : 'coach_marketplace';
  /* ── Coach Workflow state ── */
  const [coachWorkflowSection, setCoachWorkflowSection] = useState<CoachWorkflowSection>('journeys');
  const [coachCohorts, setCoachCohorts] = useState<CoachCohortRow[]>([]);
  const [coachCohortsLoading, setCoachCohortsLoading] = useState(false);
  const [coachCohortsError, setCoachCohortsError] = useState<string | null>(null);
  const [coachWorkflowAssignMode, setCoachWorkflowAssignMode] = useState<CoachWorkflowAssignMode>('none');
  const [coachWorkflowAssignJourneyId, setCoachWorkflowAssignJourneyId] = useState<string | null>(null);
  const [coachWorkflowAssignTargetCohortId, setCoachWorkflowAssignTargetCohortId] = useState<string | null>(null);
  const [coachWorkflowAssignTargetUserId, setCoachWorkflowAssignTargetUserId] = useState<string | null>(null);
  const [coachInviteCode, setCoachInviteCode] = useState<string | null>(null);
  const [coachInviteLinkCopied, setCoachInviteLinkCopied] = useState(false);
  const [coachingClients, setCoachingClients] = useState<Array<{ id: string; name: string; avatarUrl?: string | null; enrolledJourneyIds: string[]; enrolledJourneyNames?: string[] }>>([]);
  const [journeyInviteCodes, setJourneyInviteCodes] = useState<Record<string, string>>({});
  const [journeyInviteLoading, setJourneyInviteLoading] = useState<string | null>(null);
  const [journeyInviteCopiedId, setJourneyInviteCopiedId] = useState<string | null>(null);
  const coachSegmentPresets: CoachSegmentPreset[] = useMemo(() => [
    { id: 'seg-kpi', label: 'KPI Completion', rule: 'kpi_completion', status: 'preview', description: 'Members meeting KPI completion thresholds' },
    { id: 'seg-gci', label: 'GCI Direction', rule: 'gci_direction', status: 'preview', description: 'Members trending up/down in GCI performance' },
    { id: 'seg-journey', label: 'Journey Progress', rule: 'journey_progress', status: 'preview', description: 'Members actively progressing through journeys' },
    { id: 'seg-manual', label: 'Manual Segment', rule: 'manual', status: 'preview', description: 'Manually curated audience segment' },
  ], []);
  const [commsHubPrimaryTab, setCommsHubPrimaryTab] = useState<CommsHubPrimaryTab>('all');
  const [commsHubScopeFilter, setCommsHubScopeFilter] = useState<CommsHubScopeFilter>('all');
  const [commsHubSearchQuery, setCommsHubSearchQuery] = useState('');
  const [coachingShellContext, setCoachingShellContext] = useState<CoachingShellContext>({
    source: 'unknown',
    preferredChannelScope: null,
    preferredChannelLabel: null,
    threadTitle: null,
    threadHeaderDisplayName: null,
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
  /* ── Journey Builder state: wired via useJourneyBuilder after fetchCoachingJourneyDetail is defined ── */
  // (jbLessons, jbSaveState, … jbMovingItem are destructured from journeyBuilder below)
  const [coachingLessonProgressSubmittingId, setCoachingLessonProgressSubmittingId] = useState<string | null>(null);
  const [coachingLessonProgressError, setCoachingLessonProgressError] = useState<string | null>(null);
  type LessonMediaAsset = {
    media_id: string;
    filename: string;
    content_type: string;
    category: string;
    processing_status: string;
    playback_ready: boolean;
    playback_id: string | null;
    file_url: string | null;
    provider: string;
  };
  const [lessonMediaAssets, setLessonMediaAssets] = useState<LessonMediaAsset[]>([]);
  const [lessonMediaLoading, setLessonMediaLoading] = useState(false);
  const [lessonMediaLessonId, setLessonMediaLessonId] = useState<string | null>(null);
  const [channelsApiRows, setChannelsApiRows] = useState<ChannelApiRow[] | null>(null);
  const [channelsPackageVisibility, setChannelsPackageVisibility] = useState<RuntimePackageVisibilityOutcome | null>(null);
  const [channelsNotificationItems, setChannelsNotificationItems] = useState<RuntimeNotificationItem[]>([]);
  const [channelsNotificationSummary, setChannelsNotificationSummary] = useState<RuntimeNotificationSummaryReadModel | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null);
  const [channelPreviewById, setChannelPreviewById] = useState<Record<string, string>>({});
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
  const [broadcastTargetScope, setBroadcastTargetScope] = useState<'team' | 'cohort' | 'channel' | 'segment'>('team');
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccessNote, setBroadcastSuccessNote] = useState<string | null>(null);

  // ── Broadcast campaign state (multi-target DM fan-out) ──
  const [campaignTargets, setCampaignTargets] = useState<BroadcastTarget[]>([]);
  const [campaignAudienceCount, setCampaignAudienceCount] = useState<number | null>(null);
  const [campaignAudienceLoading, setCampaignAudienceLoading] = useState(false);
  const [campaignSubmitting, setCampaignSubmitting] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignSuccessNote, setCampaignSuccessNote] = useState<string | null>(null);
  const [broadcastTaskDraft, setBroadcastTaskDraft] = useState<BroadcastTaskDraft | null>(null);
  const campaignAudienceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mediaUploadBusy, setMediaUploadBusy] = useState(false);
  const [mediaUploadStatus, setMediaUploadStatus] = useState<string | null>(null);
  const [latestMediaId, setLatestMediaId] = useState<string | null>(null);
  const [latestMediaFileName, setLatestMediaFileName] = useState<string | null>(null);
  type PendingMediaUpload = {
    fileName: string;
    progress: number;
    mediaId: string | null;
    status: 'picking' | 'uploading' | 'processing' | 'ready' | 'error';
    error?: string;
    uri?: string;
    contentType?: string;
    thumbnailUri?: string;
    sent?: boolean;
  };
  const [pendingMediaUpload, setPendingMediaUpload] = useState<PendingMediaUpload | null>(null);
  const [localMediaPreviewById, setLocalMediaPreviewById] = useState<Record<string, {
    uri?: string;
    thumbnailUri?: string;
    contentType?: string;
  }>>({});
  // Live session — managed by useLiveSession hook
  const live = useLiveSession(session?.access_token);
  const [showLiveSetup, setShowLiveSetup] = useState(false);
  const [showLiveBroadcast, setShowLiveBroadcast] = useState(false);
  const commsClientSessionIdRef = useRef(
    `mobile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  );
  const commsTokenBootstrapRef = useRef<Record<string, { expiresAtMs: number; channelAdmin: boolean }>>({});
  const commsSyncBootstrapRef = useRef<Record<string, number>>({});
  // ── useAiAssistDrafting ───────────────────────────────────────────
  const {
    aiAssistVisible,
    aiAssistContext,
    aiAssistPrompt,
    aiAssistDraftText,
    aiAssistGenerating,
    aiAssistNotice,
    aiSuggestionQueueSubmitting,
    aiSuggestionQueueError,
    aiSuggestionQueueSuccess,
    aiSuggestionRows,
    aiSuggestionQueueSummary,
    aiSuggestionListLoading,
    aiSuggestionListError,
    setAiAssistPrompt,
    setAiAssistDraftText,
    setAiAssistNotice,
    setAiAssistVisible,
    openAiAssistShell,
    generateAiAssistDraft,
    applyAiAssistDraftToHumanInput: applyAiAssistDraftToHumanInputFromHook,
    fetchAiSuggestions,
    queueAiSuggestionForApproval: queueAiSuggestionForApprovalFromHook,
  } = useAiAssistDrafting(session?.access_token ?? null);
  const [addDrawerVisible, setAddDrawerVisible] = useState(false);
  const [logOtherVisible, setLogOtherVisible] = useState(false);
  const [customKpiRows, setCustomKpiRows] = useState<CustomKpiRow[]>([]);
  const [customKpiModalVisible, setCustomKpiModalVisible] = useState(false);
  const [customKpiDraft, setCustomKpiDraft] = useState<CustomKpiDraft>(emptyCustomKpiDraft());
  const [customKpiSaving, setCustomKpiSaving] = useState(false);
  const [customKpiError, setCustomKpiError] = useState<string | null>(null);
  const [customKpiSuccessNote, setCustomKpiSuccessNote] = useState<string | null>(null);
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>('Quick');
  const [logOtherFilter, setLogOtherFilter] = useState<LogOtherFilter>('All');
  const [managedKpiIds, setManagedKpiIds] = useState<string[]>([]);
  const [favoriteKpiIds, setFavoriteKpiIds] = useState<string[]>([]);
  const [pendingDirectLog, setPendingDirectLog] = useState<PendingDirectLog | null>(null);
  const [directValue, setDirectValue] = useState('');
  const [refreshingConfidence, setRefreshingConfidence] = useState(false);
  const [showConfidenceTooltip, setShowConfidenceTooltip] = useState(false);
  const confidenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confidenceAuthAlertShownRef = useRef(false);
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
  // pipeline state provided by usePipelineCheckin (wired after sendLog below)
  const [bottomNavLayoutHeight, setBottomNavLayoutHeight] = useState(0);
  const bottomNavLift = Math.max(8, Math.round(insets.bottom * 0.24));
  const bottomNavPadBottom = Math.max(8, Math.round(insets.bottom * 0.45));
  const contentBottomPad = 132 + Math.max(12, insets.bottom);
  const isCommsThreadMode = coachingShellScreen === 'channel_thread' || coachingShellScreen === 'coach_broadcast_compose' || commsHubPrimaryTab === 'broadcast';
  const bottomNavAnimation = useBottomNavAnimation({
    isThreadMode: isCommsThreadMode,
    navLayoutHeight: bottomNavLayoutHeight,
    navLift: bottomNavLift,
    navPadBottom: bottomNavPadBottom,
  });
  const commsComposerBottomInset = bottomNavAnimation.composerBottomInset;
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
      const [dashRes, meRes, challengesRes, customKpisRes] = await Promise.all([
        fetch(`${API_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/challenges`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch(`${API_URL}/api/custom-kpis`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      const dashBody = await dashRes.json();
      const meBody = (await meRes.json()) as MePayload;

      if (!dashRes.ok) throw new Error(dashBody.error ?? 'Failed to load dashboard');

      const dashPayload = dashBody as DashboardPayload;
      setPayload(dashPayload);
      setRuntimeMeTier(typeof meBody?.tier === 'string' && meBody.tier.trim() ? meBody.tier.trim().toLowerCase() : 'free');
      setRuntimeEntitlements(
        meBody?.entitlements && typeof meBody.entitlements === 'object'
          ? meBody.entitlements
          : {}
      );
      const resolvedMeRole =
        typeof meBody?.role === 'string' && meBody.role.trim().length > 0
          ? meBody.role.toLowerCase()
          : typeof meBody?.user_metadata?.role === 'string' && meBody.user_metadata.role.trim().length > 0
            ? meBody.user_metadata.role.toLowerCase()
            : typeof meBody?.user_metadata?.team_role === 'string' && meBody.user_metadata.team_role.trim().length > 0
              ? meBody.user_metadata.team_role.toLowerCase()
              : Boolean(meBody?.user_metadata?.is_coach)
                ? 'coach'
                : null;
      setRuntimeMeRole(resolvedMeRole);
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
      if (customKpisRes) {
        try {
          const customBody = (await customKpisRes.json()) as { custom_kpis?: CustomKpiRow[]; error?: string };
          if (customKpisRes.ok) {
            setCustomKpiRows(Array.isArray(customBody.custom_kpis) ? customBody.custom_kpis : []);
          } else {
            setCustomKpiRows([]);
          }
        } catch {
          setCustomKpiRows([]);
        }
      } else {
        setCustomKpiRows([]);
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
      setRuntimeMeRole(null);
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [managedKpiIds.length, session?.access_token]);

  React.useEffect(() => {
    if (state === 'loading') void fetchDashboard();
  }, [fetchDashboard, state]);

  // Clear join error on navigation change is handled internally by useChallengeWorkflow

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

  // joinChallenge and leaveChallenge provided by useChallengeWorkflow (wired below)

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
    () => managedKpis.filter((kpi) => kpi.type === segment).slice(0, MAX_KPIS_PER_TYPE),
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
      }).slice(0, MAX_KPIS_PER_TYPE);
    },
    [favoriteKpiIds, gpUnlocked, managedKpiIdSet, managedKpis, payload, vpUnlocked]
  );

  const homePanelTiles = useMemo(() => {
    const panelKpis =
      homePanel === 'Quick'
        ? homeQuickLog
        : managedKpis.filter((kpi) => kpi.type === homePanel).slice(0, MAX_KPIS_PER_TYPE);
    return buildHomePanelTiles(panelKpis, payload ?? null);
  }, [homePanel, homeQuickLog, managedKpis, payload]);
  const todayLocalIso = useMemo(() => isoTodayLocal(), []);
  // pipelineAnchorNag, pipelineCheckinAnchors, pipelineAnchorCounts, actualGciLogKpi provided by usePipelineCheckin
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
    const kpiNameFromRecentById = new Map<string, string>();
    for (const row of payload?.recent_logs ?? []) {
      const id = String(row.kpi_id ?? '');
      if (!id) continue;
      const name = String(row.kpi_name ?? '').trim();
      if (!name) continue;
      if (!kpiNameFromRecentById.has(id)) kpiNameFromRecentById.set(id, name);
    }
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
        name: kpiNameById.get(kpiId) ?? kpiNameFromRecentById.get(kpiId) ?? 'KPI',
        count,
      }))
      .sort((a, b) => b.count - a.count)
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

  // ── usePipelineCheckin ────────────────────────────────────────────
  const {
    pipelineCheckinVisible,
    pipelineCheckinListings,
    pipelineCheckinBuyers,
    pipelineCheckinSubmitting,
    pipelineCheckinReasonPromptVisible,
    pipelineCheckinDecreaseFields,
    pipelineCheckinReason,
    pipelineForceGciEntryField,
    pipelineCloseDateInput,
    pipelineCloseGciInput,
    pipelineLostEncouragement,
    inlinePipelineSubmitting,
    pipelineAnchorNag,
    pipelineCheckinAnchors,
    pipelineAnchorCounts,
    actualGciLogKpi,
    setPipelineCheckinListings,
    setPipelineCheckinBuyers,
    setPipelineCheckinReasonPromptVisible,
    setPipelineCheckinReason,
    setPipelineForceGciEntryField,
    setPipelineCloseDateInput,
    setPipelineCloseGciInput,
    setPipelineLostEncouragement,
    openPipelineCheckinOverlay,
    openPipelineDecreaseCloseFlow,
    dismissPipelineCheckinForToday,
    saveInlinePipelineCounts,
    onSavePipelineCheckin,
    onChoosePipelineDecreaseReason,
    finalizePipelineCheckinSave,
  } = usePipelineCheckin({
    payload,
    state,
    userId: session?.user?.id ?? null,
    accessToken: session?.access_token ?? null,
    pendingDirectLog,
    sendLog,
  });

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

  const renderHudRail = () => (
    <HudRail
      cardMetrics={cardMetrics}
      actualHudCardView={actualHudCardView}
      projectedCardWindowDays={projectedCardWindowDays}
      hudActiveIndex={hudActiveIndex}
      projectedHudAccentFlashAnim={projectedHudAccentFlashAnim}
      projectedHudValuePopAnim={projectedHudValuePopAnim}
      onCycleActualHudCard={() => {
        setActualHudCardView((prev) => {
          const idx = ACTUAL_CARD_VIEWS.indexOf(prev);
          return ACTUAL_CARD_VIEWS[(idx + 1) % ACTUAL_CARD_VIEWS.length] ?? 'actual365';
        });
      }}
      onCycleProjectedCardWindow={() => {
        setProjectedCardWindowDays((prev) => {
          const idx = PROJECTED_CARD_WINDOWS.indexOf(prev);
          return PROJECTED_CARD_WINDOWS[(idx + 1) % PROJECTED_CARD_WINDOWS.length] ?? 360;
        });
      }}
    />
  );

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
            panel === 'Quick'
              ? homeQuickLog
              : managedKpis.filter((kpi) => kpi.type === panel).slice(0, MAX_KPIS_PER_TYPE),
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
      const errorMessage = String(body?.error ?? body?.message ?? '').trim();
      if (!response.ok) {
        const authExpired = response.status === 401 || /invalid|expired.*token/i.test(errorMessage);
        if (authExpired) {
          if (confidenceIntervalRef.current) {
            clearInterval(confidenceIntervalRef.current);
            confidenceIntervalRef.current = null;
          }
          if (!confidenceAuthAlertShownRef.current) {
            confidenceAuthAlertShownRef.current = true;
            Alert.alert('Session expired', 'Please sign in again.');
          }
          return;
        }
        throw new Error(errorMessage || 'Failed to refresh confidence');
      }
      confidenceAuthAlertShownRef.current = false;
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
        Alert.alert(
          'Category limit reached',
          `You can only keep up to ${MAX_KPIS_PER_TYPE} ${kpi.type} KPIs active.`
        );
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

  const ensureManagedKpiForLog = useCallback(
    (kpiId: string) => {
      const target = allSelectableKpis.find((row) => row.id === kpiId);
      if (!target) return;
      setManagedKpiIds((prev) => {
        const nextRaw = [kpiId, ...prev.filter((id) => id !== kpiId)];
        const normalized = normalizeManagedKpiIds(nextRaw, allSelectableKpis);
        setFavoriteKpiIds((prevFav) => {
          const merged = [kpiId, ...prevFav.filter((id) => id !== kpiId)].slice(0, 6);
          const nextFav = merged.filter((id) => normalized.includes(id));
          void saveKpiPreferences(normalized, nextFav);
          return nextFav;
        });
        return normalized;
      });
    },
    [allSelectableKpis]
  );

  const handoffTeamKpiToLog = useCallback(
    (
      kpi: DashboardPayload['loggable_kpis'][number],
      options?: {
        memberId?: string;
        memberName?: string;
        source?: TeamLogContextSource;
      }
    ) => {
      const kpiId = String(kpi.id ?? '');
      if (!kpiId) return;
      ensureManagedKpiForLog(kpiId);
      if (options?.memberId && options?.memberName && options?.source) {
        setTeamLogContext({
          member_id: options.memberId,
          member_name: options.memberName,
          kpi_id: kpiId,
          source: options.source,
        });
      } else {
        setTeamLogContext(null);
      }
      setSegment(kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP' ? kpi.type : 'PC');
      setActiveTab('logs');
      setViewMode('log');
      setLogsReportsSubview('logs');
    },
    [ensureManagedKpiForLog]
  );

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

  const openLogOtherDrawer = () => {
    setLogOtherFilter(segment);
    setLogOtherVisible(true);
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
    if (tab === 'coach') {
      setViewMode('log');
      // Coach-operators always land on primary workflow hub, not marketplace
      setCoachTabScreen(isCoachRuntimeOperator ? 'coach_hub_primary' : coachTabDefault);
      return;
    }
    if (tab === 'challenge') {
      setViewMode('log');
      if (isSoloPersona) {
        setChallengeFlowScreen('list');
      }
      return;
    }
    if (tab === 'logs') {
      setViewMode('log');
      setLogsReportsSubview('reports');
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
      setCoachingShellScreen('inbox_channels');
      setCoachingShellContext({
        source: 'user_tab',
        preferredChannelScope: null,
        preferredChannelLabel: null,
        threadTitle: null,
        threadHeaderDisplayName: null,
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
    if (onOpenUserMenu) {
      onOpenUserMenu();
      return;
    }
    if (selfProfileDrawerMember) {
      setActiveTab('team');
      setViewMode('log');
      setTeamFlowScreen('dashboard');
      setTeamProfileMemberId(selfProfileDrawerMember.id);
      return;
    }
    Alert.alert('Profile unavailable', 'Profile and settings routing is not available in this build context.');
  };

  const handleOpenInviteCodeEntry = () => {
    if (onOpenInviteCode) {
      onOpenInviteCode();
      return;
    }
    Alert.alert('Invite unavailable', 'Invite code routing is not available in this build context.');
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

  const logOtherCatalogKpis = useMemo(() => {
    if (logOtherFilter === 'All') return allSelectableKpis;
    return allSelectableKpis.filter((kpi) => kpi.type === logOtherFilter);
  }, [allSelectableKpis, logOtherFilter]);

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

  const customKpiById = useMemo(
    () => new Map(customKpiRows.map((row) => [String(row.id), row])),
    [customKpiRows]
  );

  const openCreateCustomKpiModal = useCallback(() => {
    setCustomKpiError(null);
    setCustomKpiSuccessNote(null);
    setCustomKpiDraft(emptyCustomKpiDraft());
    setCustomKpiModalVisible(true);
  }, []);

  const openEditCustomKpiModal = useCallback((row: CustomKpiRow) => {
    setCustomKpiError(null);
    setCustomKpiSuccessNote(null);
    setCustomKpiDraft(customKpiDraftFromRow(row));
    setCustomKpiModalVisible(true);
  }, []);

  const submitCustomKpi = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setCustomKpiError('Missing session token.');
      return;
    }
    if (!customKpiDraft.name.trim()) {
      setCustomKpiError('Name is required.');
      return;
    }

    const slug = customKpiDraft.slug.trim() || normalizeKpiIdentifier(customKpiDraft.name);
    if (!slug) {
      setCustomKpiError('Name or slug must contain at least one alphanumeric character.');
      return;
    }

    const payload: {
      name: string;
      slug: string;
      requires_direct_value_input: boolean;
      icon_source?: KpiAuthoringIconSource | null;
      icon_name?: string | null;
    } = {
      name: customKpiDraft.name.trim(),
      slug,
      requires_direct_value_input: customKpiDraft.requiresDirectValueInput,
    };

    if (customKpiDraft.iconSource === 'brand_asset') {
      if (!customKpiDraft.iconName?.trim()) {
        setCustomKpiError('Pick a brand asset icon.');
        return;
      }
      payload.icon_source = 'brand_asset';
      payload.icon_name = customKpiDraft.iconName.trim();
    } else if (customKpiDraft.iconSource === 'vector_icon') {
      if (!customKpiDraft.iconName?.trim()) {
        setCustomKpiError('Pick a library icon.');
        return;
      }
      payload.icon_source = 'vector_icon';
      payload.icon_name = customKpiDraft.iconName.trim();
    }

    setCustomKpiSaving(true);
    setCustomKpiError(null);
    try {
      if (customKpiDraft.id) {
        await updateCustomKpi(token, customKpiDraft.id, payload);
        setCustomKpiSuccessNote('Custom KPI updated.');
      } else {
        await createCustomKpi(token, payload);
        setCustomKpiSuccessNote('Custom KPI created.');
      }
      await fetchDashboard();
      setCustomKpiModalVisible(false);
      setAddDrawerVisible(true);
    } catch (error) {
      setCustomKpiError(error instanceof Error ? error.message : 'Failed to save custom KPI.');
    } finally {
      setCustomKpiSaving(false);
    }
  }, [customKpiDraft, fetchDashboard, session?.access_token]);

  // openPipelineCheckinOverlay, openPipelineDecreaseCloseFlow, dismissPipelineCheckinForToday provided by usePipelineCheckin

  // persistPipelineCountsMetadata, saveInlinePipelineCounts provided by usePipelineCheckin

  // finalizePipelineCheckinSave, onSavePipelineCheckin, onChoosePipelineDecreaseReason provided by usePipelineCheckin

  const renderChallengeKpiSection = (
    type: 'PC' | 'GP' | 'VP',
    title: string,
    kpis: DashboardPayload['loggable_kpis'],
    options?: {
      hideTypePill?: boolean;
      trailingControl?: React.ReactNode;
      compactIcons?: boolean;
    }
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
      <View style={[styles.challengeSectionCard, options?.compactIcons && styles.challengeSectionCardCompact]}>
        <View style={[styles.challengeSectionHeader, options?.compactIcons && styles.challengeSectionHeaderCompact]}>
          <View style={[styles.challengeSectionHeaderCopy, options?.compactIcons && styles.challengeSectionHeaderCopyCompact]}>
            <View style={styles.challengeSectionTitleRow}>
              <Text style={[styles.challengeSectionTitle, options?.compactIcons && styles.challengeSectionTitleCompact]}>{title}</Text>
              <Text style={[styles.challengeSectionCount, options?.compactIcons && styles.challengeSectionCountCompact]}>{typeCountLabel}</Text>
            </View>
            <Text style={[styles.challengeSectionSub, options?.compactIcons && styles.challengeSectionSubCompact]}>{sectionSub}</Text>
          </View>
          {options?.trailingControl ?? (
            options?.hideTypePill ? null : (
              <View style={[styles.challengeSectionTypePill, { backgroundColor: kpiTypeTint(type) }]}>
                <Text style={[styles.challengeSectionTypePillText, { color: kpiTypeAccent(type) }]}>{type}</Text>
              </View>
            )
          )}
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
          <View style={[styles.gridWrap, styles.challengeGridWrap, options?.compactIcons && styles.challengeGridWrapCompact]}>
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
                  style={[
                    styles.gridItem,
                    styles.challengeGridItem,
                    options?.compactIcons && styles.challengeGridItemCompact,
                    submitting && submittingKpiId === kpi.id && styles.disabled,
                  ]}
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
                      {!options?.compactIcons ? <View style={styles.challengeTilePlate} /> : null}
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
                    <Text
                      style={[
                        styles.gridLabel,
                        !options?.compactIcons && styles.challengeGridLabel,
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

  // ── useTeamRosterManager ──────────────────────────────────────────
  const {
    teamFlowScreen,
    teamRosterMembers,
    teamRosterName,
    teamRosterError,
    teamRosterTeamId,
    teamProfileMemberId,
    teamMembershipMutationBusy,
    teamMembershipMutationNotice,
    teamInviteCodeBusy,
    teamInviteCodeNotice,
    teamInviteCodeValue,
    teamRuntimeCandidateIds,
    teamRuntimeId,
    setTeamFlowScreen,
    setTeamRosterMembers,
    setTeamRosterName,
    setTeamRosterError,
    setTeamRosterTeamId,
    setTeamProfileMemberId,
    setTeamMembershipMutationBusy,
    setTeamMembershipMutationNotice,
    setTeamInviteCodeBusy,
    setTeamInviteCodeNotice,
    setTeamInviteCodeValue,
    fetchTeamRoster,
    resolveCurrentTeamContextId,
    removeTeamMember: removeTeamMemberFromHook,
    leaveCurrentTeam: leaveCurrentTeamFromHook,
    createTeamInviteCode: createTeamInviteCodeFromHook,
    lastTeamRosterFetchAtRef,
  } = useTeamRosterManager({
    accessToken: session?.access_token ?? null,
    sessionUserId: session?.user?.id ?? null,
    sessionUserMeta,
    sessionAppMeta,
    teamIdentitySetAvatar: setTeamIdentityAvatar,
    teamIdentitySetBackground: setTeamIdentityBackground,
    teamIdentitySetControlsOpen: setTeamIdentityControlsOpen,
    teamIdentityControlsOpen,
    channelsApiRows: channelsApiRows ?? [],
    challengeListItems,
    fetchDashboard,
  });

  const challengeHasSponsorSignal =
    Array.isArray(challengeApiRows) &&
    challengeApiRows.some(
      (row) =>
        String(row.challenge_kind ?? '').toLowerCase() === 'sponsored' ||
        Object.prototype.hasOwnProperty.call(row, 'sponsored_challenge_id') ||
        Object.prototype.hasOwnProperty.call(row, 'sponsor_id')
    );
  // ── useRuntimePersona ─────────────────────────────────────────────
  const {
    teamPersonaVariant,
    runtimeRoleSignals,
    isCoachRuntimeOperator,
    isChallengeSponsorRuntime,
    currentUserTeamRoleFromRoster,
    inferredTeamMembershipFromChallenges,
    hasExplicitTeamRole,
    hasExplicitSoloRole,
    isSoloPersona,
    bottomTabOrder,
    effectiveTeamPersonaVariant,
    isTeamLeaderCreatorParticipant,
    entitlementValueByKey,
    entitlementFlag,
    entitlementNumber,
  } = useRuntimePersona({
    sessionUserMeta,
    sessionAppMeta,
    runtimeMeRole,
    runtimeEntitlements,
    sessionUserId: session?.user?.id ?? null,
    entitlementCan,
    entitlementLimitFromContext,
    coachProfiles,
    coachActiveEngagementCoachId: coachActiveEngagement?.coach_id ?? null,
    teamRosterMembers,
    challengeListItems,
  });
  const challengeCreateAllowed = entitlementFlag('can_start_challenges', true);
  const canCreateCustomKpis = entitlementFlag('can_create_custom_kpis', false);
  // ── useChallengeWorkflow ──────────────────────────────────────────
  const {
    challengeFlowScreen,
    challengeListFilter,
    challengeMemberListTab,
    challengeStateTab,
    challengeSelectedId,
    challengeJoinSubmittingId,
    challengeLeaveSubmittingId,
    challengeJoinError,
    challengeLeaveError,
    challengePreviewItem,
    challengeKpiDrillItem,
    challengeWizardVisible,
    challengeWizardStep,
    challengeWizardSource,
    challengeWizardType,
    challengeWizardName,
    challengeWizardDescription,
    challengeWizardStartAt,
    challengeWizardEndAt,
    challengeWizardTemplateId,
    challengeWizardGoals,
    challengeWizardInviteUserIds,
    challengeWizardTemplates,
    challengeWizardLoadingTemplates,
    challengeWizardTemplateError,
    challengeWizardSubmitting,
    challengeWizardError,
    teamChallengesSegment,
    challengeScopedListItems,
    challengeMemberListItems,
    challengeFilteredScopedListItems,
    challengeListItemsForPersona,
    challengeStateRows,
    challengeDefaultStateTab,
    challengeCurrentStateRows,
    challengeSelectedWithinState,
    challengeParticipantRows,
    challengeKpiSummaryCards,
    challengeSelected,
    challengeScopedKpis,
    challengeScopedKpiGroups,
    challengeIsCompleted,
    challengeHasApiBackedDetail,
    challengeIsPlaceholderOnly,
    challengeLeaderboardHasRealRows,
    challengeCoachingPackageOutcome,
    challengeCoachingGatePresentation,
    challengeCoachingGateBlocksCtas,
    challengeListUsingPlaceholderRows,
    challengeWizardFallbackTemplates,
    setChallengeFlowScreen,
    setChallengeListFilter,
    setChallengeMemberListTab,
    setChallengeStateTab,
    setChallengeSelectedId,
    setChallengePreviewItem,
    setChallengeKpiDrillItem,
    setChallengeWizardVisible,
    setChallengeWizardStep,
    setChallengeWizardSource,
    setChallengeWizardType,
    setChallengeWizardName,
    setChallengeWizardDescription,
    setChallengeWizardStartAt,
    setChallengeWizardEndAt,
    setChallengeWizardTemplateId,
    setChallengeWizardGoals,
    setChallengeWizardInviteUserIds,
    setChallengeWizardTemplates,
    setChallengeWizardError,
    setTeamChallengesSegment,
    joinChallenge,
    leaveChallenge,
    openChallengeWizard,
    applyChallengeWizardTemplate,
    submitChallengeWizard,
    buildChallengeWizardGoalDrafts,
  } = useChallengeWorkflow(
    {
      accessToken: session?.access_token ?? null,
      fetchDashboard,
      isSoloPersona,
      effectiveTeamPersonaVariant,
      challengeSurfaceKpis,
      challengeKpiGroups,
      allSelectableKpis,
      resolveCurrentTeamContextId,
      teamRosterTeamId,
      sessionUserMeta: sessionUserMeta as { team_id?: string | null },
      sessionAppMeta: sessionAppMeta as { team_id?: string | null },
      activeTab,
      challengeApiRows,
      challengeApiFetchError,
      challengeListItems,
      challengeHasSponsorSignal,
    },
    setActiveTab,
  );

  const teamMemberDirectory = useMemo<TeamDirectoryMember[]>(() => {
    if (!Array.isArray(teamRosterMembers) || teamRosterMembers.length === 0) return [];
    const sortedRosterRows = [...teamRosterMembers].sort((a, b) => {
      const aIsLeader = String(a.role ?? '').toLowerCase().includes('lead');
      const bIsLeader = String(b.role ?? '').toLowerCase().includes('lead');
      if (aIsLeader !== bIsLeader) return aIsLeader ? -1 : 1;
      return String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''));
    });
    const avatarTones = ['#e8dfcc', '#f1cb66', '#dfc2a4', '#d3e2f8', '#cde8d7', '#e9d6f0'] as const;
    return sortedRosterRows.map((member, idx) => {
      const userId = String(member.user_id ?? '').trim();
      const name = String(member.full_name ?? '').trim() || `Team Member ${idx + 1}`;
      const roleRaw = String(member.role ?? '').toLowerCase();
      const roleLabel = roleRaw.includes('lead') ? 'Team Lead' : 'Member';
      const displayEmail = member.email ? String(member.email) : 'Email unavailable';
      const avatarUrlRaw = String(member.avatar_url ?? '').trim();
      const avatarPresetId = String(member.avatar_preset_id ?? '').trim() || null;
      const dialSuffix = String((1000 + idx * 17) % 9000).padStart(4, '0');
      return {
        id: userId || `team-member-${idx + 1}`,
        userId: userId || null,
        name,
        roleLabel,
        metric: '0%',
        sub: displayEmail,
        avatarTone: toneForAvatarPreset(avatarPresetId, avatarTones[idx % avatarTones.length]),
        avatarPresetId,
        avatarUrl: /^https?:\/\//i.test(avatarUrlRaw) ? avatarUrlRaw : null,
        email: displayEmail,
        phone: `(000) 000-${dialSuffix}`,
        coachingGoals: [],
        kpiGoals: [],
        cohorts: [],
        journeys: [],
        onboardingKpiGoals: {},
        profileKpiGoals: {},
      };
    });
  }, [teamRosterMembers]);
  const selfProfileDrawerMember = useMemo<TeamDirectoryMember | null>(() => {
    const sessionUserId = String(session?.user?.id ?? '').trim();
    if (!sessionUserId) return null;
    const rosterMatch = teamMemberDirectory.find((member) => String(member.userId ?? '').trim() === sessionUserId);
    if (rosterMatch) return rosterMatch;
    const fullName =
      String(
        session?.user?.user_metadata?.full_name ??
          session?.user?.user_metadata?.name ??
          session?.user?.user_metadata?.first_name ??
          ''
      ).trim() || 'Your Profile';
    const avatarPresetId =
      String(session?.user?.user_metadata?.avatar_preset_id ?? '').trim() || null;
    const avatarUrl =
      typeof session?.user?.user_metadata?.avatar_url === 'string' &&
      /^https?:\/\//i.test(session.user.user_metadata.avatar_url)
        ? session.user.user_metadata.avatar_url
        : null;
    const roleLabel =
      currentUserTeamRoleFromRoster === 'leader'
        ? 'Team Lead'
        : teamPersonaVariant === 'leader'
          ? 'Team Lead'
          : 'Member';
    return {
      id: SELF_PROFILE_DRAWER_ID,
      userId: sessionUserId,
      name: fullName,
      metric: '0%',
      sub: String(session?.user?.email ?? '').trim() || 'Email unavailable',
      roleLabel,
      avatarTone: toneForAvatarPreset(avatarPresetId, '#dbeafe'),
      avatarPresetId,
      avatarUrl,
      email: String(session?.user?.email ?? '').trim() || 'Email unavailable',
      phone: '(000) 000-0000',
      coachingGoals: [],
      kpiGoals: [],
      cohorts: [],
      journeys: [],
      onboardingKpiGoals: {},
      profileKpiGoals: {},
    };
  }, [currentUserTeamRoleFromRoster, session?.user?.email, session?.user?.id, session?.user?.user_metadata, teamMemberDirectory, teamPersonaVariant]);
  // challengeSelected, challengeScopedKpis, challengeScopedKpiGroups, and
  // challenge state-sync effects provided by useChallengeWorkflow (wired below)
  useEffect(() => {
    if (!menuRouteTarget) return;
    if (menuRouteTarget.tab === 'team') {
      setActiveTab('team');
      setViewMode('log');
      setTeamFlowScreen('dashboard');
      if (menuRouteTarget.screen === 'profile_drawer') {
        setTeamProfileMemberId(String(menuRouteTarget.target_id ?? SELF_PROFILE_DRAWER_ID));
      }
    } else if (menuRouteTarget.tab === 'coach') {
      setActiveTab('coach');
      setViewMode('log');
      if (menuRouteTarget.screen === 'inbox_channels') {
        setCoachingShellScreen('inbox_channels');
      } else if (coachEngagementStatus === 'active') {
        setCoachTabScreen('coach_hub_primary');
      } else {
        setCoachTabScreen('coach_marketplace');
      }
    } else if (menuRouteTarget.tab === 'challenge') {
      setActiveTab('challenge');
      setViewMode('log');
      if (menuRouteTarget.target_id) {
        setChallengeSelectedId(menuRouteTarget.target_id);
        setChallengeFlowScreen('details');
      } else {
        setChallengeFlowScreen('list');
      }
    }
    if (onMenuRouteTargetConsumed) {
      onMenuRouteTargetConsumed();
    }
  }, [menuRouteTarget, coachEngagementStatus, onMenuRouteTargetConsumed]);
  // challengeIsCompleted, challengeHasApiBackedDetail, challengeIsPlaceholderOnly,
  // challengeLeaderboardHasRealRows, challengeCoachingPackageOutcome,
  // challengeCoachingGatePresentation, challengeCoachingGateBlocksCtas
  // provided by useChallengeWorkflow (wired below)
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
  const unreadMessagesCount = useMemo(() => {
    const summaryUnread = Number(channelsNotificationSummary?.unread_count ?? NaN);
    if (Number.isFinite(summaryUnread) && summaryUnread > 0) return Math.max(0, Math.round(summaryUnread));
    if (Array.isArray(channelsApiRows) && channelsApiRows.length > 0) {
      return channelsApiRows.reduce((sum, row) => sum + Math.max(0, Number(row.unread_count ?? 0)), 0);
    }
    return fallbackChannelsNotificationRows.reduce(
      (sum, row) => (String(row.read_state ?? 'unknown').toLowerCase() === 'read' ? sum : sum + 1),
      0
    );
  }, [channelsApiRows, channelsNotificationSummary?.unread_count, fallbackChannelsNotificationRows]);
  const unreadMessagesBadgeLabel =
    unreadMessagesCount > 99 ? '99+' : unreadMessagesCount > 0 ? String(unreadMessagesCount) : null;
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
  const challengeTargetNumeric = useMemo(() => {
    const raw = String(challengeSelected?.targetValueLabel ?? '');
    const numeric = Number(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [challengeSelected?.targetValueLabel]);
  // Team cumulative contribution:
  // prefer aggregate logs / (target * participants), fallback to aggregate member progress, then current user progress.
  const challengeTeamCumulativeProgressPct = useMemo(() => {
    if (challengeLeaderboardPreview.length > 0) {
      const totalContribution = challengeLeaderboardPreview.reduce((sum, entry) => sum + Math.max(0, Number(entry.value) || 0), 0);
      const denominator =
        challengeTargetNumeric && (challengeSelected?.participants ?? 0) > 0
          ? challengeTargetNumeric * (challengeSelected?.participants ?? 0)
          : null;
      if (denominator && denominator > 0) {
        return Math.min(100, Math.round((totalContribution / denominator) * 100));
      }
      return Math.min(
        100,
        Math.round(challengeLeaderboardPreview.reduce((sum, entry) => sum + Math.max(0, entry.pct), 0))
      );
    }
    return challengeSelected?.progressPct ?? 0;
  }, [
    challengeLeaderboardPreview,
    challengeSelected?.participants,
    challengeSelected?.progressPct,
    challengeTargetNumeric,
  ]);
  // challengeListUsingPlaceholderRows provided by useChallengeWorkflow (wired above)
  const challengeDetailsSurfaceLabel =
    effectiveTeamPersonaVariant === 'member'
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
    effectiveTeamPersonaVariant === 'member' && challengeIsCompleted && !challengeSelected?.joined;
  const openCoachingShell = useCallback((screen: CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => {
    const resolvedScreen: CoachingShellScreen = screen === 'inbox' ? 'inbox_channels' : screen;
    setCoachingShellScreen(resolvedScreen);
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
              {unreadCount > 0 ? (
                <View style={styles.coachingNotificationCountBadge}>
                  <Text style={styles.coachingNotificationCountBadgeText}>{unreadCount}</Text>
                </View>
              ) : null}
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
                      {hasRoute ? (
                        <View style={styles.coachingNotificationRowMetaLine}>
                          <Text style={styles.coachingNotificationRowLink}>Open</Text>
                        </View>
                      ) : null}
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

  const renderRuntimeStateBanner = useCallback((_model: RuntimeSurfaceStateModel, _opts?: { compact?: boolean }) => {
    // Dev-only debug panel — hidden in production
    return null;
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

  const applyAiAssistDraftToHumanInput = useCallback(() => {
    applyAiAssistDraftToHumanInputFromHook({
      setChannelMessageDraft,
      setBroadcastDraft,
    });
  }, [applyAiAssistDraftToHumanInputFromHook, setChannelMessageDraft, setBroadcastDraft]);

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

  // fetchAiSuggestions is provided by useAiAssistDrafting
  // fetchTeamRoster provided by useTeamRosterManager (wired below)

  const queueAiSuggestionForApproval = useCallback(async () => {
    await queueAiSuggestionForApprovalFromHook({ buildScope: buildAiSuggestionScopeForCurrentContext });
  }, [queueAiSuggestionForApprovalFromHook, buildAiSuggestionScopeForCurrentContext]);
  // useEffect for auto-fetch on aiAssistVisible is handled by useAiAssistDrafting

  // ── useCoachingWorkflow ───────────────────────────────────────────
  const {
    fetchCoachMarketplace,
    fetchCoachEngagement,
    createCoachEngagement,
    fetchCoachAssignments,
    fetchCoachingJourneys,
    fetchJourneyInviteCode,
    fetchCoachCohorts,
    fetchCoachingProgressSummary,
    fetchLessonMedia,
  } = useCoachingWorkflow(
    {
      accessToken: session?.access_token ?? null,
      activeTab,
      coachTabScreen,
      isCoachRuntimeOperator,
      coachingJourneys,
      coachingJourneysLoading,
      coachingProgressSummary,
      coachingProgressLoading,
      coachCohorts,
      coachCohortsLoading,
      coachProfiles,
      coachMarketplaceLoading,
      coachingShellScreen,
      coachingShellContext: { selectedLessonId: coachingShellContext.selectedLessonId ?? null },
      journeyInviteCodes,
      lessonMediaLessonId,
      lessonMediaAssets,
    },
    {
      setCoachProfiles,
      setCoachMarketplaceLoading,
      setCoachEngagementStatus,
      setCoachActiveEngagement,
      setCoachEntitlementState,
      setCoachEngagementLoading,
      setCoachTabScreen,
      setCoachAssignments,
      setCoachCohorts,
      setCoachCohortsLoading,
      setCoachCohortsError,
      setCoachInviteCode,
      setCoachingClients,
      setCoachingJourneys,
      setCoachingJourneysPackageVisibility,
      setCoachingJourneysNotificationItems,
      setCoachingJourneysNotificationSummary,
      setCoachingJourneysLoading,
      setCoachingJourneysError,
      setCoachingProgressSummary,
      setCoachingProgressNotificationItems,
      setCoachingProgressNotificationSummary,
      setCoachingProgressLoading,
      setCoachingProgressError,
      setCoachingJourneyDetail,
      setCoachingJourneyDetailLoading,
      setCoachingJourneyDetailError,
      setJourneyInviteCodes,
      setJourneyInviteLoading,
      setCoachingLessonProgressSubmittingId,
      setCoachingLessonProgressError,
      setLessonMediaAssets,
      setLessonMediaLoading,
      setLessonMediaLessonId,
    },
  );

  // ── Coaching callbacks that remain in the monolith ───────────────
  // (fetchCoachingJourneyDetail, journey builder, submitCoachingLessonProgress)
  // These use fetchCoachingJourneys / fetchCoachingProgressSummary from the hook above.

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

  /* ── useJourneyBuilder ───────────────────────────────────────────── */
  const {
    jbLessons,
    jbSaveState,
    jbSaveMessage,
    jbAssets,
    jbCollections,
    jbShowAssetLibrary,
    jbActiveTaskMenu,
    jbConfirmDelete,
    jbNewLessonTitle: _jbNewLessonTitle,
    jbNewTaskTitle,
    jbAddingTaskToLessonId,
    jbEditingLessonId,
    jbEditingLessonTitle,
    jbEditingTaskKey,
    jbEditingTaskTitle,
    jbMovingItem,
    jbAssetsById,
    setJbLessons,
    setJbSaveState,
    setJbSaveMessage,
    setJbAssets,
    setJbCollections,
    setJbShowAssetLibrary,
    setJbActiveTaskMenu,
    setJbConfirmDelete,
    setJbNewLessonTitle,
    setJbNewTaskTitle,
    setJbAddingTaskToLessonId,
    setJbEditingLessonId,
    setJbEditingLessonTitle,
    setJbEditingTaskKey,
    setJbEditingTaskTitle,
    setJbMovingItem,
    jbAddLesson,
    jbAddTask,
    jbAddAssetAsTask,
    jbRemoveTask,
    jbDeleteLesson,
    jbReorderLessons,
    jbReorderTasks,
    jbRenameLesson,
    jbRenameTask,
    jbFetchAssetLibrary,
  } = useJourneyBuilder({
    accessToken: session?.access_token ?? null,
    coachingJourneyDetail,
    fetchCoachingJourneyDetail,
  });

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

  const ensureStreamChannelToken = useCallback(
    async (channelId: string, tokenPurpose: ChannelTokenPurpose) => {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sign in is required to continue messaging (401).');
      }
      const cacheKey = `${channelId}:${tokenPurpose}`;
      const cached = commsTokenBootstrapRef.current[cacheKey];
      const now = Date.now();
      if (cached && cached.expiresAtMs - now > 30_000) {
        return { channelAdmin: cached.channelAdmin };
      }
      const response = await fetch(`${API_URL}/api/channels/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_id: channelId,
          token_purpose: tokenPurpose,
          client_session_id: commsClientSessionIdRef.current,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ChannelTokenResponse;
      if (!response.ok) {
        const fallback = `Channel token request failed (${response.status})`;
        throw new Error(mapCommsHttpError(response.status, getApiErrorMessage(payload, fallback)));
      }
      const expiresAtMs = payload.expires_at ? Date.parse(String(payload.expires_at)) : NaN;
      const ttlMs = Number(payload.ttl_seconds ?? 0) * 1000;
      const effectiveExpiry =
        Number.isFinite(expiresAtMs) && expiresAtMs > 0
          ? expiresAtMs
          : now + (ttlMs > 0 ? ttlMs : 10 * 60 * 1000);
      const channelAdmin = Boolean(payload.scope_grants?.channel_admin);
      commsTokenBootstrapRef.current[cacheKey] = {
        expiresAtMs: effectiveExpiry,
        channelAdmin,
      };
      return { channelAdmin };
    },
    [session?.access_token]
  );

  const ensureStreamChannelSync = useCallback(
    async (channelId: string) => {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sign in is required to continue messaging (401).');
      }
      const lastSyncedAt = commsSyncBootstrapRef.current[channelId] ?? 0;
      if (Date.now() - lastSyncedAt < 60_000) return;
      const response = await fetch(`${API_URL}/api/channels/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel_id: channelId,
          sync_reason: 'manual_reconcile',
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ChannelSyncResponse;
      if (!response.ok) {
        const fallback = `Channel sync request failed (${response.status})`;
        throw new Error(mapCommsHttpError(response.status, getApiErrorMessage(payload, fallback)));
      }
      commsSyncBootstrapRef.current[channelId] = Date.now();
    },
    [session?.access_token]
  );

  const bootstrapCommsStreamForSurface = useCallback(
    async (channelId: string, surface: 'thread' | 'broadcast') => {
      if (!channelId) return;
      if (Array.isArray(channelsApiRows)) {
        const accessible = channelsApiRows.some((row) => String(row.id) === String(channelId));
        if (!accessible) {
          throw new Error('Select an available channel in your current scope before messaging.');
        }
      }
      const tokenPurpose: ChannelTokenPurpose = surface === 'broadcast' ? 'channel_admin' : 'chat_write';
      const tokenResult = await ensureStreamChannelToken(channelId, tokenPurpose);
      const shouldSync = surface === 'broadcast' || tokenResult.channelAdmin;
      if (!shouldSync) return;
      await ensureStreamChannelSync(channelId);
    },
    [channelsApiRows, ensureStreamChannelSync, ensureStreamChannelToken]
  );

  const fetchChannels = useCallback(async (): Promise<ChannelApiRow[]> => {
    const token = session?.access_token;
    if (!token) {
      setChannelsError('Sign in is required to view channels.');
      setChannelsApiRows([]);
      setChannelsPackageVisibility(null);
      setChannelsNotificationItems([]);
      setChannelsNotificationSummary(null);
      return [];
    }
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const response = await fetch(`${API_URL}/api/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as ChannelsListResponse;
      if (!response.ok) {
        const fallback = `Channels request failed (${response.status})`;
        setChannelsError(
          mapCommsHttpError(response.status, getApiErrorMessage(body, fallback))
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
        return [];
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
      return rows;
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Failed to load channels');
      setChannelsApiRows([]);
      setChannelsPackageVisibility(null);
      setChannelsNotificationItems([]);
      setChannelsNotificationSummary(null);
      return [];
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
        await bootstrapCommsStreamForSurface(channelId, 'thread');
        const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(channelId)}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => ({}))) as ChannelMessagesResponse;
        if (!response.ok) {
          const fallback = `Channel messages request failed (${response.status})`;
          setChannelMessagesError(
            mapCommsHttpError(response.status, getApiErrorMessage(body, fallback))
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
        const messageRows = Array.isArray(body.messages) ? body.messages : [];
        setChannelMessages(messageRows);
        if (messageRows.length > 0) {
          const last = messageRows[messageRows.length - 1];
          const preview = String(last.body ?? '')
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.length > 0) ?? 'New message';
          setChannelPreviewById((prev) => ({
            ...prev,
            [String(channelId)]: preview.slice(0, 120),
          }));
        }
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
    [bootstrapCommsStreamForSurface, fetchChannels, selectedChannelId, selectedChannelName, session?.access_token]
  );

  useEffect(() => {
    if (!selectedChannelId) return;
    const hasPendingVideo =
      Boolean(pendingMediaUpload?.mediaId) ||
      (channelMessages ?? []).some((row) => {
        const status = String(row.media_attachment?.lifecycle?.processing_status ?? '');
        const contentType = String(row.media_attachment?.content_type ?? '');
        return contentType.startsWith('video/') && ['queued_for_upload', 'uploaded', 'processing'].includes(status);
      });
    if (!hasPendingVideo) return;
    const interval = setInterval(() => {
      void fetchChannelMessages(selectedChannelId, { markSeen: false });
    }, 3000);
    return () => clearInterval(interval);
  }, [channelMessages, fetchChannelMessages, pendingMediaUpload?.mediaId, selectedChannelId]);

  const sendChannelMessage = useCallback(
    async (
      channelId: string,
      options?: {
        bodyOverride?: string;
        messageType?: 'message' | 'media_attachment';
        mediaAttachment?: { media_id: string; caption?: string };
        messageKind?: 'text' | 'personal_task' | 'coach_task';
        taskAction?: 'create' | 'update' | 'complete';
        taskCardDraft?: ThreadSendPayload['task_card_draft'];
      }
    ) => {
      const token = session?.access_token;
      const bodyText = String(options?.bodyOverride ?? channelMessageDraft).trim();
      const messageType = options?.messageType ?? 'message';
      if (!token) {
        setChannelMessageSubmitError('Sign in is required to send messages.');
        return false;
      }
      if (!channelId) {
        setChannelMessageSubmitError('Select a channel before sending.');
        return false;
      }
      const isTaskMessage = Boolean(options?.taskAction || options?.taskCardDraft || (options?.messageKind && options.messageKind !== 'text'));
      if (messageType === 'message' && !bodyText && !isTaskMessage) {
        setChannelMessageSubmitError('Message body is required.');
        return false;
      }
      if (messageType === 'media_attachment' && !options?.mediaAttachment?.media_id) {
        setChannelMessageSubmitError('Select media before sending attachment.');
        return false;
      }
      setChannelMessageSubmitting(true);
      setChannelMessageSubmitError(null);
      try {
        await bootstrapCommsStreamForSurface(channelId, 'thread');
        const requestBody =
          messageType === 'media_attachment'
            ? {
                message_type: 'media_attachment' as const,
                body: bodyText || 'Media attachment',
                media_attachment: {
                  media_id: options?.mediaAttachment?.media_id,
                  caption: options?.mediaAttachment?.caption ?? undefined,
                },
              }
            : {
                ...(bodyText ? { body: bodyText } : {}),
                ...(options?.messageKind ? { message_kind: options.messageKind } : {}),
                ...(options?.taskAction ? { task_action: options.taskAction } : {}),
                ...(options?.taskCardDraft ? { task_card_draft: options.taskCardDraft } : {}),
              };
        const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(channelId)}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        const payload = (await response.json().catch(() => ({}))) as ChannelMessageWriteResponse;
        if (!response.ok) {
          const fallback = `Send failed (${response.status})`;
          setChannelMessageSubmitError(
            mapCommsHttpError(response.status, getApiErrorMessage(payload, fallback))
          );
          return false;
        }
        setChannelMessageDraft('');
        await fetchChannelMessages(channelId, { markSeen: false });
        return true;
      } catch (err) {
        setChannelMessageSubmitError(err instanceof Error ? err.message : 'Failed to send message');
        return false;
      } finally {
        setChannelMessageSubmitting(false);
      }
    },
    [bootstrapCommsStreamForSurface, channelMessageDraft, fetchChannelMessages, session?.access_token]
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
        await bootstrapCommsStreamForSurface(channelId, 'broadcast');
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
          const fallback = `Broadcast failed (${response.status})`;
          setBroadcastError(
            mapCommsHttpError(response.status, getApiErrorMessage(payload, fallback))
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
    [bootstrapCommsStreamForSurface, broadcastDraft, fetchChannelMessages, fetchChannels, session?.access_token]
  );

  // ── Broadcast campaign: debounced audience preview ──
  useEffect(() => {
    if (campaignTargets.length === 0) {
      setCampaignAudienceCount(null);
      setCampaignAudienceLoading(false);
      return;
    }
    const token = session?.access_token;
    if (!token) return;
    setCampaignAudienceLoading(true);
    if (campaignAudienceTimer.current) clearTimeout(campaignAudienceTimer.current);
    campaignAudienceTimer.current = setTimeout(async () => {
      try {
        const result = await previewCampaignAudience(campaignTargets, token);
        if (result.ok) {
          setCampaignAudienceCount(result.data.total_unique_recipients ?? 0);
        } else {
          setCampaignAudienceCount(null);
        }
      } catch {
        setCampaignAudienceCount(null);
      } finally {
        setCampaignAudienceLoading(false);
      }
    }, 500);
    return () => {
      if (campaignAudienceTimer.current) clearTimeout(campaignAudienceTimer.current);
    };
  }, [campaignTargets, session?.access_token]);

  // ── Broadcast campaign: send (detects content type from pending media/task/text) ──
  const executeBroadcastCampaign = useCallback(async () => {
    const token = session?.access_token;
    if (!token) { setCampaignError('Sign in is required.'); return; }
    if (campaignTargets.length === 0) { setCampaignError('Select at least one target audience.'); return; }

    // Determine content type from current state
    const hasMedia = pendingMediaUpload?.status === 'ready' && pendingMediaUpload.mediaId;
    const hasTask = broadcastTaskDraft !== null;
    const hasText = channelMessageDraft.trim().length > 0;

    if (!hasMedia && !hasTask && !hasText) {
      setCampaignError('Add a message, media, or task to broadcast.');
      return;
    }

    setCampaignSubmitting(true);
    setCampaignError(null);
    setCampaignSuccessNote(null);

    try {
      const idempotency_key = `campaign_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      let payload: Parameters<typeof sendBroadcastCampaign>[0];
      if (hasTask && broadcastTaskDraft) {
        payload = {
          content_type: 'task',
          targets: campaignTargets,
          task_draft: broadcastTaskDraft,
          body: channelMessageDraft.trim() || undefined,
          idempotency_key,
        };
      } else if (hasMedia && pendingMediaUpload?.mediaId) {
        payload = {
          content_type: 'video',
          targets: campaignTargets,
          media_id: pendingMediaUpload.mediaId,
          body: channelMessageDraft.trim() || undefined,
          idempotency_key,
        };
      } else {
        payload = {
          content_type: 'message',
          targets: campaignTargets,
          body: channelMessageDraft.trim(),
          idempotency_key,
        };
      }

      const result = await sendBroadcastCampaign(payload, token);

      if (!result.ok) {
        setCampaignError(result.data.error ?? `Campaign failed (${result.status})`);
        return;
      }

      const c = result.data.campaign;
      const delivered = c?.delivered ?? 0;
      const failed = c?.failed ?? 0;
      const contentLabel = hasTask ? 'Task broadcast' : hasMedia ? 'Media broadcast' : 'Broadcast';
      const note = failed > 0
        ? `${contentLabel} sent to ${delivered} recipient${delivered !== 1 ? 's' : ''} (${failed} failed).`
        : `${contentLabel} sent to ${delivered} recipient${delivered !== 1 ? 's' : ''}.`;
      setCampaignSuccessNote(note);

      // Clear state after successful send
      setChannelMessageDraft('');
      if (hasMedia) {
        setPendingMediaUpload((prev) => (prev ? { ...prev, sent: true } : null));
        setLatestMediaId(null);
        setLatestMediaFileName(null);
      }
      if (hasTask) {
        setBroadcastTaskDraft(null);
      }
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : 'Campaign failed');
    } finally {
      setCampaignSubmitting(false);
    }
  }, [session?.access_token, campaignTargets, channelMessageDraft, pendingMediaUpload, broadcastTaskDraft]);

  const requestMediaUploadUrl = useCallback(
    async (channelId: string | null) => {
      const token = session?.access_token;
      if (!token) {
        setMediaUploadStatus('Sign in is required for media upload (401).');
        return;
      }
      if (!channelId) {
        setMediaUploadStatus('Open a channel thread before requesting media upload.');
        return;
      }
      const contextLessonId = coachingShellContext.selectedLessonId;
      const contextJourneyId = coachingShellContext.selectedJourneyId;
      if (!contextLessonId && !contextJourneyId) {
        setMediaUploadStatus('Media upload needs a coaching lesson/journey context. Open from a coaching-linked thread.');
        return;
      }
      setMediaUploadBusy(true);
      setMediaUploadStatus('Requesting Mux upload URL…');
      try {
        const idempotencyKey = `media_upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const filename = `channel-upload-${Date.now()}.mp4`;
        const response = await fetch(`${API_URL}/api/coaching/media/upload-url`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lesson_id: contextLessonId ?? undefined,
            journey_id: contextLessonId ? undefined : contextJourneyId ?? undefined,
            channel_id: channelId,
            filename,
            content_type: 'video/mp4',
            content_length_bytes: 2_500_000,
            idempotency_key: idempotencyKey,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as CoachingMediaUploadUrlResponse;
        if (!response.ok) {
          const fallback = `Media upload-url request failed (${response.status})`;
          setMediaUploadStatus(mapCommsHttpError(response.status, getApiErrorMessage(payload, fallback)));
          return;
        }
        const mediaId = String(payload.media_id ?? '').trim();
        if (!mediaId) {
          setMediaUploadStatus('Upload URL response missing media id.');
          return;
        }
        setLatestMediaId(mediaId);
        setLatestMediaFileName(filename);
        setMediaUploadStatus(`Upload URL ready for ${filename}. Media id: ${mediaId}`);
      } catch (err) {
        setMediaUploadStatus(err instanceof Error ? err.message : 'Media upload URL request failed.');
      } finally {
        setMediaUploadBusy(false);
      }
    },
    [coachingShellContext.selectedJourneyId, coachingShellContext.selectedLessonId, session?.access_token]
  );

  const sendLatestMediaAttachment = useCallback(
    async (channelId: string | null) => {
      if (!channelId) {
        setMediaUploadStatus('Select a channel before sending media attachment.');
        return false;
      }
      if (!latestMediaId) {
        setMediaUploadStatus('Request upload URL first to create a media attachment id.');
        return false;
      }
      const sent = await sendChannelMessage(channelId, {
        messageType: 'media_attachment',
        bodyOverride: latestMediaFileName ? `Media: ${latestMediaFileName}` : 'Media attachment',
        mediaAttachment: {
          media_id: latestMediaId,
          caption: latestMediaFileName ?? undefined,
        },
      });
      if (sent) {
        setMediaUploadStatus(`Attachment sent to thread with media id ${latestMediaId}.`);
        setPendingMediaUpload((prev) => (prev ? { ...prev, sent: true } : null));
        setLatestMediaId(null);
        setLatestMediaFileName(null);
      }
      return sent;
    },
    [latestMediaFileName, latestMediaId, sendChannelMessage]
  );

  const resolveMediaPlaybackUrl = useCallback(
    async (mediaId: string) => {
      const token = session?.access_token;
      if (!token || !mediaId) return null;
      try {
        const response = await fetch(`${API_URL}/api/coaching/media/playback-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_id: mediaId,
            viewer_context: 'member',
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as { token?: string; playback_id?: string };
        if (!response.ok || !payload.playback_id) return null;
        return payload.token
          ? `https://stream.mux.com/${payload.playback_id}.m3u8?token=${encodeURIComponent(payload.token)}`
          : `https://stream.mux.com/${payload.playback_id}.m3u8`;
      } catch {
        return null;
      }
    },
    [session?.access_token]
  );

  /** Real file-picker → upload URL → PUT to Mux → mark ready */
  const handlePickMediaFile = useCallback(
    async (channelId: string | null, file: { name: string; type: string; size: number; uri: string }) => {
      const token = session?.access_token;
      let thumbnailUri = file.type.startsWith('image/') ? file.uri : undefined;
      if (file.type.startsWith('video/')) {
        try {
          const thumbnail = await VideoThumbnails.getThumbnailAsync(file.uri, {
            time: 0,
          });
          thumbnailUri = thumbnail.uri;
        } catch {
          thumbnailUri = undefined;
        }
      }
      if (!token) {
        setPendingMediaUpload({
          fileName: file.name,
          progress: 0,
          mediaId: null,
          status: 'error',
          error: 'Sign in required.',
          uri: file.uri,
          contentType: file.type,
          thumbnailUri,
        });
        return;
      }
      const isBroadcastMode = !channelId && commsHubPrimaryTab === 'broadcast';
      if (!channelId && !isBroadcastMode) {
        setPendingMediaUpload({
          fileName: file.name,
          progress: 0,
          mediaId: null,
          status: 'error',
          error: 'Select a channel first.',
          uri: file.uri,
          contentType: file.type,
          thumbnailUri,
        });
        return;
      }

      // Resolve file size — expo-image-picker may return 0; estimate from blob if needed
      let fileSize = file.size;
      if (!fileSize || fileSize <= 0) {
        try {
          const sizeRes = await fetch(file.uri);
          const sizeBlob = await sizeRes.blob();
          fileSize = sizeBlob.size || 1;
        } catch {
          fileSize = 1; // fallback — backend just needs > 0
        }
      }

      setPendingMediaUpload({
        fileName: file.name,
        progress: 0,
        mediaId: null,
        status: 'uploading',
        uri: file.uri,
        contentType: file.type,
        thumbnailUri,
      });
      setMediaUploadBusy(true);
      try {
        // 1) Get upload URL from backend
        const idempotencyKey = `media_upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const contextLessonId = coachingShellContext.selectedLessonId;
        const contextJourneyId = coachingShellContext.selectedJourneyId;
        const urlRes = await fetch(`${API_URL}/api/coaching/media/upload-url`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lesson_id: isBroadcastMode ? undefined : (contextLessonId ?? undefined),
            journey_id: isBroadcastMode ? undefined : (contextLessonId ? undefined : contextJourneyId ?? undefined),
            channel_id: channelId || undefined,
            broadcast_context: isBroadcastMode || undefined,
            filename: file.name,
            content_type: file.type || 'application/octet-stream',
            content_length_bytes: fileSize,
            idempotency_key: idempotencyKey,
          }),
        });
        const urlPayload = (await urlRes.json().catch(() => ({}))) as CoachingMediaUploadUrlResponse;
        if (!urlRes.ok || !urlPayload.media_id || !urlPayload.upload_url) {
          const msg = getApiErrorMessage(urlPayload, `Upload URL request failed (${urlRes.status})`);
          setPendingMediaUpload((p) => p ? { ...p, status: 'error', error: msg } : null);
          return;
        }
        const mediaId = String(urlPayload.media_id);
        setPendingMediaUpload((p) => p ? { ...p, mediaId, progress: 0.1 } : null);
        setLocalMediaPreviewById((prev) => ({
          ...prev,
          [mediaId]: {
            uri: file.uri,
            thumbnailUri,
            contentType: file.type,
          },
        }));

        // 2) Upload the file to provider's upload URL (Supabase Storage for images, Mux for videos)
        const isImageUpload = (file.type || '').startsWith('image/');
        const blob = await fetch(file.uri).then((r) => r.blob());
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', urlPayload.upload_url!);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          if (isImageUpload) xhr.setRequestHeader('x-upsert', 'true');
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = 0.1 + 0.85 * (e.loaded / e.total);
              setPendingMediaUpload((p) => p ? { ...p, progress: pct } : null);
            }
          };
          xhr.onload = () => { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)); };
          xhr.onerror = () => reject(new Error('Upload network error'));
          xhr.send(blob);
        });

        // 3) Mark ready
        setLatestMediaId(mediaId);
        setLatestMediaFileName(file.name);
        setPendingMediaUpload({
          fileName: file.name,
          progress: 1,
          mediaId,
          status: 'ready',
          uri: file.uri,
          contentType: file.type,
          thumbnailUri,
          sent: false,
        });
        setMediaUploadStatus(`Uploaded ${file.name}. Media id: ${mediaId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setPendingMediaUpload((p) => p ? { ...p, status: 'error', error: msg } : null);
      } finally {
        setMediaUploadBusy(false);
      }
    },
    [commsHubPrimaryTab, coachingShellContext.selectedJourneyId, coachingShellContext.selectedLessonId, session?.access_token]
  );

  // ── Live broadcast: auto-transition setup → broadcast when credentials arrive ──
  useEffect(() => {
    if (showLiveSetup && live.streamKey && live.rtmpUrl && !live.busy) {
      setShowLiveSetup(false);
      setShowLiveBroadcast(true);
    }
  }, [showLiveSetup, live.streamKey, live.rtmpUrl, live.busy]);

  const handleEndBroadcast = useCallback(async () => {
    await live.endSession();
    setShowLiveBroadcast(false);
  }, [live]);

  const openDirectThreadForMember = useCallback(
    async ({
      targetUserId,
      memberName,
      source,
      closeTeamProfile,
    }: {
      targetUserId: string;
      memberName: string;
      source: CoachingShellEntrySource;
      closeTeamProfile?: boolean;
    }) => {
      const normalizeName = (value: string | null | undefined) =>
        String(value ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      const memberNameKey = normalizeName(memberName);
      const directChannelMatch = (channelsApiRows ?? []).find((row) => {
        const type = String(row.type ?? '').toLowerCase();
        if (type !== 'direct' && type !== 'dm') return false;
        if (String(row.context_id ?? '') === String(targetUserId)) return true;
        const channelNameKey = normalizeName(row.name);
        return Boolean(channelNameKey) && (channelNameKey.includes(memberNameKey) || memberNameKey.includes(channelNameKey));
      });

      let targetChannelId = directChannelMatch ? String(directChannelMatch.id ?? '') : '';
      let targetChannelName = directChannelMatch ? String(directChannelMatch.name ?? `${memberName} DM`) : '';
      if (!targetChannelId) {
        const token = session?.access_token;
        if (!token) throw new Error('Sign in is required to start a direct message (401).');
        const myDisplayName =
          String(
            session?.user?.user_metadata?.full_name ??
            session?.user?.user_metadata?.name ??
            session?.user?.user_metadata?.first_name ??
            session?.user?.email?.split('@')[0] ??
            'You'
          ).trim() || 'You';
        const directChannelName = `${myDisplayName} / ${memberName}`;
        const createResponse = await fetch(`${API_URL}/api/channels`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'direct',
            name: directChannelName,
            context_id: targetUserId,
            member_user_ids: [targetUserId],
          }),
        });
        const createPayload = (await createResponse.json().catch(() => ({}))) as ChannelCreateResponse;
        if (!createResponse.ok) {
          const fallback = `Direct message channel create failed (${createResponse.status})`;
          throw new Error(mapCommsHttpError(createResponse.status, getApiErrorMessage(createPayload, fallback)));
        }
        targetChannelId = String(createPayload.channel?.id ?? '');
        targetChannelName = String(createPayload.channel?.name ?? directChannelName);
        if (!targetChannelId) throw new Error('Direct message channel create response missing id');
        await fetchChannels();
      }

      if (closeTeamProfile) setTeamProfileMemberId(null);
      setActiveTab('comms');
      setCommsHubPrimaryTab('dms');
      setCommsHubSearchQuery('');
      setCommsHubScopeFilter('all');
      setBroadcastError(null);
      setBroadcastSuccessNote(null);
      setChannelMessageSubmitError(null);
      setChannelsError(null);
      setSelectedChannelId(targetChannelId);
      setSelectedChannelName(targetChannelName);
      setChannelMessages(null);
      setChannelMessageDraft('');
      openCoachingShell('channel_thread', {
        source,
        preferredChannelScope: 'community',
        preferredChannelLabel: targetChannelName,
        threadTitle: targetChannelName,
        threadHeaderDisplayName: null,
        threadSub: `Direct message with ${memberName}.`,
        broadcastAudienceLabel: null,
        broadcastRoleAllowed: false,
      });
      void fetchChannelMessages(targetChannelId);
    },
    [
      channelsApiRows,
      fetchChannelMessages,
      fetchChannels,
      openCoachingShell,
      session?.access_token,
      session?.user?.email,
      session?.user?.user_metadata?.first_name,
      session?.user?.user_metadata?.full_name,
      session?.user?.user_metadata?.name,
    ]
  );

  const resolveTeamMemberUserId = useCallback(
    async (member: Pick<TeamDirectoryMember, 'name' | 'email' | 'userId'>): Promise<string | null> => {
      const existingId = String(member.userId ?? '').trim();
      if (existingId) return existingId;
      const normalizeValue = (value: string | null | undefined) =>
        String(value ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      const memberNameKey = normalizeValue(member.name);
      const memberEmailKey = String(member.email ?? '').trim().toLowerCase();

      const localMatch = teamRosterMembers.find((row) => {
        const rowId = String(row.user_id ?? '').trim();
        if (!rowId) return false;
        const rowNameKey = normalizeValue(row.full_name);
        const rowEmailKey = String(row.email ?? '').trim().toLowerCase();
        if (memberEmailKey && rowEmailKey && memberEmailKey === rowEmailKey) return true;
        return Boolean(memberNameKey) && rowNameKey === memberNameKey;
      });
      if (localMatch?.user_id) return String(localMatch.user_id);

      const token = session?.access_token;
      if (!token || teamRuntimeCandidateIds.length === 0) return null;

      try {
        for (const candidateTeamId of teamRuntimeCandidateIds) {
          const response = await fetch(`${API_URL}/teams/${encodeURIComponent(candidateTeamId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const body = (await response.json().catch(() => ({}))) as TeamDetailResponse;
          if (!response.ok) continue;

          const fetchedMembers = (Array.isArray(body.members) ? body.members : []).filter(
            (row): row is TeamApiMemberSummary =>
              typeof row?.user_id === 'string' && String(row.user_id).trim().length > 0
          );
          if (fetchedMembers.length > 0) {
            const resolvedTeamId = String(body.team?.id ?? candidateTeamId).trim();
            setTeamRosterMembers(fetchedMembers);
            setTeamRosterName(body.team?.name ? String(body.team.name) : null);
            setTeamIdentityAvatar(String(body.team?.identity_avatar ?? '🛡️').trim() || '🛡️');
            setTeamIdentityBackground(String(body.team?.identity_background ?? '#dff0da').trim() || '#dff0da');
            setTeamRosterTeamId(resolvedTeamId || candidateTeamId);
            setTeamRosterError(null);
          }

          const fetchedMatch = fetchedMembers.find((row) => {
            const rowNameKey = normalizeValue(row.full_name);
            const rowEmailKey = String(row.email ?? '').trim().toLowerCase();
            if (memberEmailKey && rowEmailKey && memberEmailKey === rowEmailKey) return true;
            return Boolean(memberNameKey) && rowNameKey === memberNameKey;
          });
          if (fetchedMatch?.user_id && UUID_LIKE_RE.test(String(fetchedMatch.user_id))) {
            return String(fetchedMatch.user_id);
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    [session?.access_token, teamRosterMembers, teamRuntimeCandidateIds]
  );

  // resolveCurrentTeamContextId provided by useTeamRosterManager (wired below)

  // challengeWizardFallbackTemplates, buildChallengeWizardGoalDrafts, fetchChallengeTemplates,
  // openChallengeWizard, applyChallengeWizardTemplate, submitChallengeWizard
  // provided by useChallengeWorkflow (wired below)

  // createTeamInviteCode: uses hook-provided setters; preserves monolith's
  // success Alert.alert('Team invite code created', ...) that the hook omits.
  const createTeamInviteCode = useCallback(async () => {
    const token = session?.access_token;
    const teamId = resolveCurrentTeamContextId();
    if (!token) {
      Alert.alert('Sign in required', 'Sign in is required to create a team invite link.');
      return;
    }
    if (!teamId) {
      Alert.alert('Team unavailable', 'Team context is unavailable. Refresh and try again.');
      return;
    }
    setTeamInviteCodeBusy(true);
    setTeamInviteCodeNotice(null);
    try {
      const response = await fetch(`${API_URL}/teams/${encodeURIComponent(teamId)}/invite-codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const responsePayload = (await response.json().catch(() => ({}))) as {
        error?: string;
        invite_code?: { code?: string | null; expires_at?: string | null } | null;
      };
      if (!response.ok) {
        const fallback = `Create invite code failed (${response.status})`;
        const message = getApiErrorMessage(responsePayload, fallback);
        setTeamInviteCodeNotice(message);
        Alert.alert('Unable to create invite link', message);
        return;
      }
      const code = String(responsePayload.invite_code?.code ?? '').trim();
      if (!code) {
        const message = 'Invite code response did not include a code.';
        setTeamInviteCodeNotice(message);
        Alert.alert('Invite link unavailable', message);
        return;
      }
      const expiresLabel = fmtShortMonthDayYear(responsePayload.invite_code?.expires_at ?? null);
      const success = expiresLabel ? `Team invite code: ${code} (expires ${expiresLabel})` : `Team invite code: ${code}`;
      setTeamInviteCodeValue(code);
      setTeamInviteCodeNotice(success);
      Alert.alert('Team invite code created', success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create team invite code';
      setTeamInviteCodeNotice(message);
      Alert.alert('Unable to create invite link', message);
    } finally {
      setTeamInviteCodeBusy(false);
    }
  }, [resolveCurrentTeamContextId, session?.access_token, setTeamInviteCodeBusy, setTeamInviteCodeNotice, setTeamInviteCodeValue]);

  // leaveCurrentTeam: uses hook-provided setters; preserves monolith's
  // setActiveTab('challenge') + setChallengeFlowScreen('list') on success.
  const leaveCurrentTeam = useCallback(async () => {
    const token = session?.access_token;
    const teamId = resolveCurrentTeamContextId();
    if (!token) {
      Alert.alert('Sign in required', 'Sign in is required to leave your team.');
      return;
    }
    if (!teamId) {
      Alert.alert('Team unavailable', 'Team context is unavailable. Refresh and try again.');
      return;
    }
    setTeamMembershipMutationBusy(true);
    setTeamMembershipMutationNotice(null);
    try {
      const response = await fetch(`${API_URL}/teams/${encodeURIComponent(teamId)}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const leavePayload = (await response.json().catch(() => ({}))) as TeamMembershipMutationResponse;
      if (!response.ok) {
        const fallback = `Leave team failed (${response.status})`;
        const message = getApiErrorMessage(leavePayload, fallback);
        setTeamMembershipMutationNotice(message);
        Alert.alert('Unable to leave team', message);
        return;
      }
      const challengeRowsRemoved = Math.max(0, Number(leavePayload.cleanup?.challenge_participants_removed ?? 0));
      const channelRowsRemoved = Math.max(0, Number(leavePayload.cleanup?.channel_memberships_removed ?? 0));
      const note = leavePayload.warning?.custom_kpi_visibility_note ?? 'Team-only KPI access may be lost based on your plan.';
      const successText = `You left the team. Removed ${challengeRowsRemoved} team challenge enrollment(s) and ${channelRowsRemoved} team channel membership(s). ${note}`;
      setTeamMembershipMutationNotice(successText);
      setTeamIdentityControlsOpen(false);
      setTeamProfileMemberId(null);
      await Promise.all([fetchDashboard(), fetchTeamRoster()]);
      setActiveTab('challenge');
      setChallengeFlowScreen('list');
      Alert.alert('Left team', successText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave team';
      setTeamMembershipMutationNotice(message);
      Alert.alert('Unable to leave team', message);
    } finally {
      setTeamMembershipMutationBusy(false);
    }
  }, [fetchDashboard, fetchTeamRoster, resolveCurrentTeamContextId, session?.access_token, setTeamIdentityControlsOpen, setTeamMembershipMutationBusy, setTeamMembershipMutationNotice, setTeamProfileMemberId]);

  const removeTeamMember = useCallback(
    async (targetUserId: string, targetName: string) => {
      await removeTeamMemberFromHook(targetUserId, targetName);
    },
    [removeTeamMemberFromHook],
  );

  // comms-tab coaching journeys and coach hub bootstrap effects
  // are handled internally by useCoachingWorkflow (wired below)

  useEffect(() => {
    if (state !== 'ready') return;
    if (!session?.access_token) return;
    if (Array.isArray(channelsApiRows) || channelsLoading) return;
    void fetchChannels();
  }, [channelsApiRows, channelsLoading, fetchChannels, session?.access_token, state]);

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
    if (activeTab !== 'team') return;
    if (Array.isArray(channelsApiRows)) return;
    if (channelsLoading) return;
    void fetchChannels();
  }, [activeTab, channelsApiRows, channelsLoading, fetchChannels]);

  useEffect(() => {
    if (activeTab !== 'team' && activeTab !== 'comms') return;
    if (teamRuntimeCandidateIds.length === 0) return;
    const rosterTeamStillCandidate =
      !!teamRosterTeamId && teamRuntimeCandidateIds.includes(String(teamRosterTeamId));
    const staleMs = Date.now() - lastTeamRosterFetchAtRef.current;
    if (rosterTeamStillCandidate && (teamRosterMembers.length > 0 || teamRosterError) && staleMs < 15000) return;
    void fetchTeamRoster();
  }, [activeTab, fetchTeamRoster, teamRosterError, teamRosterMembers.length, teamRosterTeamId, teamRuntimeCandidateIds]);

  useEffect(() => {
    if (activeTab !== 'team' && activeTab !== 'comms') return;
    if (teamRuntimeCandidateIds.length === 0) return;
    const interval = setInterval(() => {
      void fetchTeamRoster();
    }, 20000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTeamRoster, teamRuntimeCandidateIds.length]);

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
    if (!selectedChannelId) return;
    if (!Array.isArray(channelsApiRows)) return;
    const stillAccessible = channelsApiRows.some((row) => String(row.id) === String(selectedChannelId));
    if (stillAccessible) return;
    setSelectedChannelId(null);
    setSelectedChannelName(null);
    setBroadcastError('Select an available channel before sending a broadcast.');
  }, [activeTab, channelsApiRows, selectedChannelId]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (coachingShellScreen !== 'channel_thread') return;
    if (!selectedChannelId) return;
    void fetchChannelMessages(selectedChannelId);
  }, [activeTab, coachingShellScreen, fetchChannelMessages, selectedChannelId]);

  useEffect(() => {
    if (activeTab !== 'comms') return;
    if (coachingShellScreen !== 'coach_broadcast_compose') return;
    if (!selectedChannelId) return;
    void bootstrapCommsStreamForSurface(selectedChannelId, 'broadcast').catch((err) => {
      setBroadcastError(err instanceof Error ? err.message : 'Failed to prepare broadcast channel');
    });
  }, [activeTab, bootstrapCommsStreamForSurface, coachingShellScreen, selectedChannelId]);

  const forcedQuickLogIdsBySegment = useMemo(() => {
    const bySegment: Record<Segment, string[]> = { PC: [], GP: [], VP: [] };
    const addIds = (kpis: DashboardPayload['loggable_kpis']) => {
      for (const kpi of kpis) {
        if (kpi.type !== 'PC' && kpi.type !== 'GP' && kpi.type !== 'VP') continue;
        const id = String(kpi.id);
        if (!bySegment[kpi.type].includes(id)) bySegment[kpi.type].push(id);
      }
    };
    addIds(teamSurfaceKpis.filter((kpi) => teamFocusSelectedKpiIds.includes(String(kpi.id))));
    addIds(challengeScopedKpis);
    return bySegment;
  }, [challengeScopedKpis, teamFocusSelectedKpiIds, teamSurfaceKpis]);

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
  const teamLogContextKpi = teamLogContext?.kpi_id
    ? allSelectableKpis.find((row) => String(row.id) === String(teamLogContext.kpi_id)) ?? null
    : null;
  const teamLogContextMember = teamLogContext
    ? teamMemberDirectory.find((row) => row.id === teamLogContext.member_id) ?? null
    : null;
  const teamLogContextKpiType =
    teamLogContextKpi && (teamLogContextKpi.type === 'PC' || teamLogContextKpi.type === 'GP' || teamLogContextKpi.type === 'VP')
      ? teamLogContextKpi.type
      : null;
  const parseMemberMetricPercent = (value: string | null | undefined) => {
    const parsed = Number(String(value ?? '').replace('%', '').trim());
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  };
  const teamLogActualPercent = parseMemberMetricPercent(teamLogContextMember?.metric);
  const onboardingGoal =
    teamLogContextMember && teamLogContextKpiType ? teamLogContextMember.onboardingKpiGoals?.[teamLogContextKpiType] ?? null : null;
  const profileGoal =
    teamLogContextMember && teamLogContextKpiType ? teamLogContextMember.profileKpiGoals?.[teamLogContextKpiType] ?? null : null;
  const teamLogGoalValue = onboardingGoal ?? profileGoal ?? null;
  const teamLogGoalSourceLabel = onboardingGoal != null ? 'onboarding goal' : profileGoal != null ? 'profile goal' : 'fallback target';
  const sevenDayCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const teamLogLast7Rows =
    teamLogContextKpi == null
      ? []
      : recentLogEntries.filter((row) => {
          if (String(row.kpi_id) !== String(teamLogContextKpi.id)) return false;
          const timestamp = new Date(row.event_timestamp).getTime();
          return Number.isFinite(timestamp) && timestamp >= sevenDayCutoffMs;
        });
  const teamLogLast7Summary = {
    count: teamLogLast7Rows.length,
    points: teamLogLast7Rows.reduce((sum, row) => sum + Math.max(0, Number(row.points_generated ?? 0)), 0),
  };
  const teamLogPeriodLabel = selectedLogDate === isoTodayLocal() ? 'Today' : formatLogDateHeading(selectedLogDate);
  const teamLogProgressRatio =
    teamLogActualPercent != null && teamLogGoalValue != null && teamLogGoalValue > 0
      ? Math.max(0, Math.min(1, teamLogActualPercent / teamLogGoalValue))
      : null;
  const showUniversalAvatarTrigger = !(
    activeTab === 'comms' &&
    (coachingShellScreen === 'channel_thread' || coachingShellScreen === 'coach_broadcast_compose')
  );
  return (
    <View
      ref={(node) => {
        screenRootRef.current = node;
      }}
      style={styles.screenRoot}
    >
      <ScrollView
        style={activeTab === 'comms' ? { display: 'none' } : undefined}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomPad },
          activeTab === 'comms' ? styles.contentComms : null,
        ]}
        scrollEnabled={activeTab === 'comms' ? false : !isHomeGameplaySurface}
        bounces={activeTab === 'comms' ? false : !isHomeGameplaySurface}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={activeTab === 'comms' ? false : !isHomeGameplaySurface}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'home' ? (
          <View style={styles.homeHeaderRow}>
            <View>
              <Text style={styles.hello}>Hi, {greetingFirstName}</Text>
              <Text style={styles.welcomeBack}>Welcome back</Text>
            </View>
          </View>
        ) : null}
        {activeTab === 'coach' || activeTab === 'challenge' ? (
          <View style={styles.challengeSurfaceWrap}>
            {/* ── Coach Tab IA Routing ── */}
            {activeTab === 'coach' ? (
              <CoachTab
                coachTabScreen={coachTabScreen}
                coachTabDefault={coachTabDefault}
                coachEngagementStatus={coachEngagementStatus}
                coachEntitlementState={coachEntitlementState}
                coachAssignments={coachAssignments}
                coachGoalsTasksFilter={coachGoalsTasksFilter}
                coachProfiles={coachProfiles}
                coachMarketplaceLoading={coachMarketplaceLoading}
                coachActiveEngagement={coachActiveEngagement}
                coachEngagementLoading={coachEngagementLoading}
                coachCohorts={coachCohorts}
                coachCohortsLoading={coachCohortsLoading}
                coachCohortsError={coachCohortsError}
                coachWorkflowSection={coachWorkflowSection}
                coachWorkflowAssignMode={coachWorkflowAssignMode}
                coachWorkflowAssignJourneyId={coachWorkflowAssignJourneyId}
                coachWorkflowAssignTargetCohortId={coachWorkflowAssignTargetCohortId}
                coachWorkflowAssignTargetUserId={coachWorkflowAssignTargetUserId}
                coachInviteLinkCopied={coachInviteLinkCopied}
                coachSegmentPresets={coachSegmentPresets}
                setCoachTabScreen={setCoachTabScreen}
                setCoachGoalsTasksFilter={setCoachGoalsTasksFilter}
                setCoachSelectedProfile={setCoachSelectedProfile}
                setCoachWorkflowSection={setCoachWorkflowSection}
                setCoachWorkflowAssignMode={setCoachWorkflowAssignMode}
                setCoachWorkflowAssignJourneyId={setCoachWorkflowAssignJourneyId}
                setCoachWorkflowAssignTargetCohortId={setCoachWorkflowAssignTargetCohortId}
                setCoachWorkflowAssignTargetUserId={setCoachWorkflowAssignTargetUserId}
                setCoachInviteLinkCopied={setCoachInviteLinkCopied}
                openCoachingShell={openCoachingShell}
                setActiveTab={setActiveTab}
                session={session}
                isCoachRuntimeOperator={isCoachRuntimeOperator}
                coachingClients={coachingClients}
                coachingJourneys={coachingJourneys}
                coachingJourneysLoading={coachingJourneysLoading}
                createCoachEngagement={createCoachEngagement}
                fetchCoachMarketplace={fetchCoachMarketplace}
              />
            ) : null}
            {/* ── Challenges sub-screen (original challenge surface) ── */}
            {activeTab === 'challenge' ? (
              <ChallengeTab
                challengeApiRows={challengeApiRows}
                challengeApiFetchError={challengeApiFetchError}
                challengeFlowScreen={challengeFlowScreen}
                challengeListFilter={challengeListFilter}
                challengeStateTab={challengeStateTab}
                challengeSelectedId={challengeSelectedId}
                challengeJoinSubmittingId={challengeJoinSubmittingId}
                challengeLeaveSubmittingId={challengeLeaveSubmittingId}
                challengeJoinError={challengeJoinError}
                challengeLeaveError={challengeLeaveError}
                challengePreviewItem={challengePreviewItem}
                challengeKpiDrillItem={challengeKpiDrillItem}
                challengeWizardVisible={challengeWizardVisible}
                challengeWizardStep={challengeWizardStep}
                challengeWizardSource={challengeWizardSource}
                challengeWizardType={challengeWizardType}
                challengeWizardName={challengeWizardName}
                challengeWizardDescription={challengeWizardDescription}
                challengeWizardStartAt={challengeWizardStartAt}
                challengeWizardEndAt={challengeWizardEndAt}
                challengeWizardTemplateId={challengeWizardTemplateId}
                challengeWizardGoals={challengeWizardGoals}
                challengeWizardInviteUserIds={challengeWizardInviteUserIds}
                challengeWizardTemplates={challengeWizardTemplates}
                challengeWizardLoadingTemplates={challengeWizardLoadingTemplates}
                challengeWizardTemplateError={challengeWizardTemplateError}
                challengeWizardSubmitting={challengeWizardSubmitting}
                challengeWizardError={challengeWizardError}
                teamChallengesSegment={teamChallengesSegment}
                challengeListItems={challengeListItems}
                challengeHasSponsorSignal={challengeHasSponsorSignal}
                challengeScopedListItems={challengeScopedListItems}
                challengeCurrentStateRows={challengeCurrentStateRows}
                challengeListUsingPlaceholderRows={challengeListUsingPlaceholderRows}
                challengeWizardFallbackTemplates={challengeWizardFallbackTemplates}
                challengeSelected={challengeSelected}
                challengeScopedKpis={challengeScopedKpis}
                challengeScopedKpiGroups={challengeScopedKpiGroups}
                challengeIsCompleted={challengeIsCompleted}
                challengeHasApiBackedDetail={challengeHasApiBackedDetail}
                challengeIsPlaceholderOnly={challengeIsPlaceholderOnly}
                challengeLeaderboardHasRealRows={challengeLeaderboardHasRealRows}
                challengeKpiSummaryCards={challengeKpiSummaryCards}
                setChallengeFlowScreen={setChallengeFlowScreen}
                setChallengeListFilter={setChallengeListFilter}
                setChallengeStateTab={setChallengeStateTab}
                setChallengeSelectedId={setChallengeSelectedId}
                setChallengePreviewItem={setChallengePreviewItem}
                setChallengeKpiDrillItem={setChallengeKpiDrillItem}
                setChallengeWizardVisible={setChallengeWizardVisible}
                setChallengeWizardStep={setChallengeWizardStep}
                setChallengeWizardSource={setChallengeWizardSource}
                setChallengeWizardType={setChallengeWizardType}
                setChallengeWizardName={setChallengeWizardName}
                setChallengeWizardDescription={setChallengeWizardDescription}
                setChallengeWizardStartAt={setChallengeWizardStartAt}
                setChallengeWizardEndAt={setChallengeWizardEndAt}
                setChallengeWizardTemplateId={setChallengeWizardTemplateId}
                setChallengeWizardGoals={setChallengeWizardGoals}
                setChallengeWizardInviteUserIds={setChallengeWizardInviteUserIds}
                setChallengeWizardTemplates={setChallengeWizardTemplates}
                setChallengeWizardError={setChallengeWizardError}
                joinChallenge={joinChallenge}
                leaveChallenge={leaveChallenge}
                openChallengeWizard={openChallengeWizard}
                applyChallengeWizardTemplate={applyChallengeWizardTemplate}
                submitChallengeWizard={submitChallengeWizard}
                buildChallengeWizardGoalDrafts={buildChallengeWizardGoalDrafts}
                isSoloPersona={isSoloPersona}
                coachTabDefault={coachTabDefault}
                setCoachTabScreen={setCoachTabScreen}
                setActiveTab={setActiveTab}
                showPaywall={showPaywall}
                entitlementNumber={entitlementNumber}
                handleOpenInviteCodeEntry={handleOpenInviteCodeEntry}
                challengeCreateAllowed={challengeCreateAllowed}
                challengeDaysLeft={challengeDaysLeft}
                challengeLeaderboardPreview={challengeLeaderboardPreview}
                challengeLeaderboardRowsForScreen={challengeLeaderboardRowsForScreen}
                challengeLeaderboardHasLowEntry={challengeLeaderboardHasLowEntry}
                challengeTeamCumulativeProgressPct={challengeTeamCumulativeProgressPct}
                challengeTileCount={challengeTileCount}
                teamMemberDirectory={teamMemberDirectory}
                getKpiTileScale={getKpiTileScale}
                getKpiTileSuccessAnim={getKpiTileSuccessAnim}
                runKpiTilePressInFeedback={runKpiTilePressInFeedback}
                runKpiTilePressOutFeedback={runKpiTilePressOutFeedback}
                confirmedKpiTileIds={confirmedKpiTileIds}
                allSelectableKpis={allSelectableKpis}
                challengeDetailsSurfaceLabel={challengeDetailsSurfaceLabel}
                challengeMemberResultsRequiresUpgrade={challengeMemberResultsRequiresUpgrade}
                gpUnlocked={gpUnlocked}
                vpUnlocked={vpUnlocked}
                onTapQuickLog={onTapQuickLog}
                renderKnownLimitedDataChip={renderKnownLimitedDataChip}
                setViewMode={setViewMode}
                submitting={submitting}
                submittingKpiId={submittingKpiId}
              />
            ) : null}
          </View>
        ) : activeTab === 'team' ? (
          <TeamTab
            session={session}
            teamIdentityAvatar={teamIdentityAvatar}
            teamIdentityBackground={teamIdentityBackground}
            teamIdentityEditOpen={teamIdentityEditOpen}
            teamIdentityDraftName={teamIdentityDraftName}
            teamIdentityDraftAvatar={teamIdentityDraftAvatar}
            teamIdentityDraftBackground={teamIdentityDraftBackground}
            teamIdentityAvatarCategory={teamIdentityAvatarCategory}
            teamIdentitySaveBusy={teamIdentitySaveBusy}
            teamIdentityControlsOpen={teamIdentityControlsOpen}
            setTeamIdentityAvatarCategory={setTeamIdentityAvatarCategory}
            setTeamIdentityControlsOpen={setTeamIdentityControlsOpen}
            setTeamIdentityDraftAvatar={setTeamIdentityDraftAvatar}
            setTeamIdentityDraftBackground={setTeamIdentityDraftBackground}
            setTeamIdentityDraftName={setTeamIdentityDraftName}
            openTeamIdentityEditorFromHook={openTeamIdentityEditorFromHook}
            cancelTeamIdentityEditorFromHook={cancelTeamIdentityEditorFromHook}
            saveTeamIdentityEditsFromHook={saveTeamIdentityEditsFromHook}
            teamFlowScreen={teamFlowScreen}
            teamRosterName={teamRosterName}
            teamProfileMemberId={teamProfileMemberId}
            teamMemberDirectory={teamMemberDirectory}
            teamSurfaceKpis={teamSurfaceKpis}
            teamLeaderExpandedMemberId={teamLeaderExpandedMemberId}
            teamChallengesSegment={teamChallengesSegment}
            teamFocusSelectedKpiIds={teamFocusSelectedKpiIds}
            teamFocusEditorOpen={teamFocusEditorOpen}
            teamFocusEditorFilter={teamFocusEditorFilter}
            teamCommsHandoffError={teamCommsHandoffError}
            teamMembershipMutationBusy={teamMembershipMutationBusy}
            teamMembershipMutationNotice={teamMembershipMutationNotice}
            teamInviteCodeBusy={teamInviteCodeBusy}
            teamInviteCodeNotice={teamInviteCodeNotice}
            teamTileCount={teamTileCount}
            setTeamFlowScreen={setTeamFlowScreen}
            setTeamProfileMemberId={setTeamProfileMemberId}
            setTeamRosterMembers={setTeamRosterMembers}
            setTeamRosterName={setTeamRosterName}
            setTeamLeaderExpandedMemberId={setTeamLeaderExpandedMemberId}
            setTeamChallengesSegment={setTeamChallengesSegment}
            setTeamFocusSelectedKpiIds={setTeamFocusSelectedKpiIds}
            setTeamFocusEditorOpen={setTeamFocusEditorOpen}
            setTeamFocusEditorFilter={setTeamFocusEditorFilter}
            setTeamCommsHandoffError={setTeamCommsHandoffError}
            challengeListItems={challengeListItems}
            challengeScopedListItems={challengeScopedListItems}
            challengePreviewItem={challengePreviewItem}
            challengeKpiGroups={challengeKpiGroups}
            challengeJoinSubmittingId={challengeJoinSubmittingId}
            setChallengeFlowScreen={setChallengeFlowScreen}
            setChallengePreviewItem={setChallengePreviewItem}
            setChallengeSelectedId={setChallengeSelectedId}
            joinChallenge={joinChallenge}
            channelsApiRows={channelsApiRows}
            fetchChannels={fetchChannels}
            fetchChannelMessages={fetchChannelMessages}
            setCommsHubPrimaryTab={setCommsHubPrimaryTab}
            setCommsHubScopeFilter={setCommsHubScopeFilter}
            setCommsHubSearchQuery={setCommsHubSearchQuery}
            setSelectedChannelId={setSelectedChannelId}
            setSelectedChannelName={setSelectedChannelName}
            setChannelMessageSubmitError={setChannelMessageSubmitError}
            setChannelsError={setChannelsError}
            setBroadcastError={setBroadcastError}
            coachingShellContext={coachingShellContext}
            openCoachingShell={openCoachingShell}
            setActiveTab={setActiveTab}
            setViewMode={setViewMode}
            removeTeamMember={removeTeamMember}
            leaveCurrentTeam={leaveCurrentTeam}
            createTeamInviteCode={createTeamInviteCode}
            resolveCurrentTeamContextId={resolveCurrentTeamContextId}
            resolveTeamMemberUserId={resolveTeamMemberUserId}
            openDirectThreadForMember={openDirectThreadForMember}
            selfProfileDrawerMember={selfProfileDrawerMember}
            allSelectableKpis={allSelectableKpis}
            managedKpiIds={managedKpiIds}
            favoriteKpiIds={favoriteKpiIds}
            effectiveTeamPersonaVariant={effectiveTeamPersonaVariant}
            pipelineAnchorCounts={pipelineAnchorCounts}
            renderChallengeKpiSection={renderChallengeKpiSection}
            renderKnownLimitedDataChip={renderKnownLimitedDataChip}
            cardMetrics={cardMetrics}
          />
        ) : activeTab === 'comms' ? null : (
          <HomeTab
            viewMode={viewMode}
            renderHudRail={renderHudRail}
            setHomeVisualViewportWidth={setHomeVisualViewportWidth}
            setHomeGridViewportWidth={setHomeGridViewportWidth}
            visualPageWidth={visualPageWidth}
            gridPageWidth={gridPageWidth}
            homePanelLoopItems={homePanelLoopItems}
            visualTranslateX={visualTranslateX}
            gridTranslateX={gridTranslateX}
            homePanel={homePanel}
            renderChartVisualPanel={renderChartVisualPanel}
            renderHomeVisualPlaceholder={renderHomeVisualPlaceholder}
            renderHomeGridPanel={renderHomeGridPanel}
            renderGameplayHeader={renderGameplayHeader}
            homeRuntimeStateModel={homeRuntimeStateModel}
            renderRuntimeStateBanner={renderRuntimeStateBanner}
            renderCoachingPackageGateBanner={renderCoachingPackageGateBanner}
            homeNotificationRows={homeNotificationRows}
            renderCoachingNotificationSurface={renderCoachingNotificationSurface}
            openCoachingShell={openCoachingShell}
            logsReportsSubview={logsReportsSubview}
            setLogsReportsSubview={setLogsReportsSubview}
            teamLogContext={teamLogContext}
            teamLogContextKpi={teamLogContextKpi}
            teamLogContextMember={teamLogContextMember}
            teamLogPeriodLabel={teamLogPeriodLabel}
            teamLogGoalValue={teamLogGoalValue}
            teamLogProgressRatio={teamLogProgressRatio}
            teamLogActualPercent={teamLogActualPercent}
            teamLogGoalSourceLabel={teamLogGoalSourceLabel}
            teamLogLast7Summary={teamLogLast7Summary}
            selectedLogDate={selectedLogDate}
            canGoBackwardDate={canGoBackwardDate}
            canGoForwardDate={canGoForwardDate}
            setSelectedLogDateIso={setSelectedLogDateIso}
            inlinePipelineSubmitting={inlinePipelineSubmitting}
            openPipelineDecreaseCloseFlow={openPipelineDecreaseCloseFlow}
            pipelineCheckinListings={pipelineCheckinListings}
            setPipelineCheckinListings={setPipelineCheckinListings}
            pipelineCheckinBuyers={pipelineCheckinBuyers}
            setPipelineCheckinBuyers={setPipelineCheckinBuyers}
            saveInlinePipelineCounts={saveInlinePipelineCounts}
            todaysLogRows={todaysLogRows}
            quickLogKpis={quickLogKpis}
            submitting={submitting}
            submittingKpiId={submittingKpiId}
            onTapQuickLog={onTapQuickLog}
            getKpiTileScale={getKpiTileScale}
            getKpiTileSuccessAnim={getKpiTileSuccessAnim}
            kpiTileCircleRefById={kpiTileCircleRefById}
            confirmedKpiTileIds={confirmedKpiTileIds}
            renderKpiIcon={renderKpiIcon}
            runKpiTilePressInFeedback={runKpiTilePressInFeedback}
            runKpiTilePressOutFeedback={runKpiTilePressOutFeedback}
            removeManagedKpi={removeManagedKpi}
            openLogOtherDrawer={openLogOtherDrawer}
            gpUnlocked={gpUnlocked}
            vpUnlocked={vpUnlocked}
            segment={segment}
            setSegment={setSegment}
            payload={payload}
            recentLogEntries={recentLogEntries}
            deleteLoggedEntry={deleteLoggedEntry}
            challengeApiRows={challengeApiRows}
            runtimeMeRole={runtimeMeRole}
          />
        )}
      </ScrollView>

      {activeTab === 'comms' ? (
        <View style={[styles.coachingShellWrap, styles.coachingShellWrapComms]}>
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
            const roleCanOpenBroadcast =
              isCoachRuntimeOperator || (effectiveTeamPersonaVariant === 'leader' && !isChallengeSponsorRuntime);
            const commsPersonaVariant: 'coach' | 'team_leader' | 'sponsor' | 'member' | 'solo' = isCoachRuntimeOperator
              ? 'coach'
              : isChallengeSponsorRuntime
                ? 'sponsor'
                : effectiveTeamPersonaVariant === 'leader'
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
            const effectiveCommsScopeFilter: CommsHubScopeFilter =
              commsHubScopeFilter === 'global' && !isCoachRuntimeOperator ? 'all' : commsHubScopeFilter;
            const scopeFilterMatch = (row: ChannelApiRow) => {
              const scope = normalizeChannelTypeToScope(row.type);
              if (effectiveCommsScopeFilter === 'all') return true;
              if (effectiveCommsScopeFilter === 'team') return scope === 'team';
              if (effectiveCommsScopeFilter === 'cohort') return scope === 'cohort';
              if (effectiveCommsScopeFilter === 'global') return scope === 'community';
              return true;
            };
            const searchNeedle = commsHubSearchQuery.trim().toLowerCase();
            const normalizedSelfName = String(resolvedDisplayName ?? '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ' ')
              .trim();
            const normalizeName = (value: string | null | undefined) =>
              String(value ?? '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
            const deriveDmNameFromChannel = (rawName: string) => {
              const segments = String(rawName ?? '')
                .split(/[/|,&]/)
                .map((segment) => segment.trim())
                .filter(Boolean);
              if (segments.length === 0) return 'Direct message';
              const nonSelf = segments.find((segment) => {
                const key = normalizeName(segment);
                if (!key) return false;
                if (!normalizedSelfName) return true;
                return key !== normalizedSelfName && !normalizedSelfName.includes(key);
              });
              return nonSelf ?? segments[0] ?? 'Direct message';
            };
            const resolveDmDirectoryMemberFromRow = (row: ChannelApiRow | null | undefined) => {
              if (!row) return null;
              const type = String(row.type ?? '').toLowerCase();
              if (type !== 'direct' && type !== 'dm') return null;
              const contextId = String(row.context_id ?? '').trim();
              if (contextId) {
                const contextMatch = teamMemberDirectory.find((member) => {
                  const memberUserId = String(member.userId ?? '').trim();
                  return memberUserId.length > 0 && memberUserId === contextId;
                });
                if (contextMatch) return contextMatch;
              }
              const channelNameKey = normalizeName(row.name);
              if (!channelNameKey) return null;
              return (
                teamMemberDirectory.find((member) => {
                  const memberNameKey = normalizeName(member.name);
                  return Boolean(memberNameKey) && (
                    channelNameKey.includes(memberNameKey) ||
                    memberNameKey.includes(channelNameKey)
                  );
                }) ?? null
              );
            };
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
            const broadcastTargetOptions: Array<'team' | 'cohort' | 'channel' | 'segment'> = isCoachRuntimeOperator
              ? ['team', 'cohort', 'channel', 'segment']
              : effectiveTeamPersonaVariant === 'leader' && !isChallengeSponsorRuntime
                ? ['team', 'cohort', 'channel']
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
                if (effectiveBroadcastTargetScope === 'segment') return false;
                return true;
              })
              .filter(searchMatch);
            const primaryTabRows =
              commsHubPrimaryTab === 'dms'
                ? scopeFilteredDmRows
                : commsHubPrimaryTab === 'channels'
                  ? scopeFilteredChannelRows
                  : filteredChannelApiRows;
            const sortByReadAndActivity = (a: ChannelApiRow, b: ChannelApiRow) => {
              const unreadDelta = Number(b.unread_count ?? 0) - Number(a.unread_count ?? 0);
              if (unreadDelta !== 0) return unreadDelta;
              const aTime = new Date(String(a.last_seen_at ?? a.created_at ?? 0)).getTime();
              const bTime = new Date(String(b.last_seen_at ?? b.created_at ?? 0)).getTime();
              return bTime - aTime;
            };
            const sortedPrimaryTabRows = [...primaryTabRows].sort(sortByReadAndActivity);
            const sortedBroadcastCandidateRows = [...broadcastCandidateRows].sort(sortByReadAndActivity);
            const searchPlaceholder =
              commsHubPrimaryTab === 'channels'
                ? effectiveCommsScopeFilter === 'all'
                  ? 'Search channels...'
                  : `Search ${effectiveCommsScopeFilter} channels...`
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
            const selectedChannelType = String(selectedChannelRow?.type ?? '').toLowerCase();
            const selectedChannelScope = normalizeChannelTypeToScope(selectedChannelRow?.type) ?? 'community';
            const selectedDmDirectoryMember = resolveDmDirectoryMemberFromRow(selectedChannelRow);
            const selectedChannelDisplayName =
              selectedDmDirectoryMember != null
                ? selectedDmDirectoryMember.name
                : selectedChannelScope === 'team' && coachingShellContext.threadHeaderDisplayName
                  ? coachingShellContext.threadHeaderDisplayName
                  : selectedChannelType === 'direct' || selectedChannelType === 'dm'
                    ? deriveDmNameFromChannel(selectedChannelResolvedName ?? '')
                    : selectedChannelResolvedName;
            const headerAvatarKind: 'dm' | 'team' | 'channel' =
              selectedDmDirectoryMember != null ? 'dm' : selectedChannelScope === 'team' ? 'team' : 'channel';
            const headerAvatarLabel =
              selectedDmDirectoryMember != null
                ? selectedDmDirectoryMember.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : headerAvatarKind === 'team'
                  ? teamIdentityAvatar
                  : String(selectedChannelResolvedName ?? 'CH')
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'CH';
            const headerAvatarTone =
              selectedDmDirectoryMember?.avatarTone ??
              (headerAvatarKind === 'team' ? teamIdentityBackground : '#e9edf5');
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
              !isCoachRuntimeOperator &&
              coachEntitlementState !== 'allowed' &&
              (shellPackageGatePresentation.tone === 'gated' || shellPackageGatePresentation.tone === 'blocked');
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
            const isCommsScreen =
              coachingShellScreen === 'inbox' ||
              coachingShellScreen === 'inbox_channels' ||
              coachingShellScreen === 'channel_thread' ||
              coachingShellScreen === 'coach_broadcast_compose';
            const isCoachingContentScreen =
              coachingShellScreen === 'coaching_journeys' ||
              coachingShellScreen === 'coaching_journey_detail' ||
              coachingShellScreen === 'coaching_lesson_detail';
            const deriveAvatarLabel = (rawName: string | null | undefined, fallback: string) => {
              const name = String(rawName ?? '').trim();
              if (!name) return fallback;
              const hasEmojiGlyph = /[\u{1F300}-\u{1FAFF}]/u.test(name);
              if (hasEmojiGlyph) {
                const emojiMatch = name.match(/[\u{1F300}-\u{1FAFF}]/u);
                if (emojiMatch?.[0]) return emojiMatch[0];
              }
              const initials = name
                .split(/\s+/)
                .map((part) => part[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              return initials || fallback;
            };
            const avatarToneForScope = (scope: string) => {
              if (scope === 'team') return '#dff0da';
              if (scope === 'challenge') return '#ede9fe';
              if (scope === 'sponsor') return '#fef3c7';
              if (scope === 'cohort') return '#d1fae5';
              if (scope === 'dm') return '#e7eaf1';
              return '#eef2f8';
            };

            const commsChannelRows: CommsChannelRow[] = sortedPrimaryTabRows.map((row) => {
              const channelType = String(row.type ?? '').toLowerCase();
              const isDirect = channelType === 'direct' || channelType === 'dm';
              const scope = isDirect ? 'dm' : normalizeChannelTypeToScope(row.type) ?? 'community';
              const rowTeamId = String(row.team_id ?? '').trim();
              const hasCurrentTeamContext =
                scope === 'team' &&
                rowTeamId.length > 0 &&
                String(teamRuntimeId ?? '').trim().length > 0 &&
                rowTeamId === String(teamRuntimeId ?? '').trim();
              const dmMember = isDirect ? resolveDmDirectoryMemberFromRow(row) : null;
              const backendDmName = isDirect ? String(row.dm_display_name ?? '').trim() : '';
              const teamDisplayName = String(teamRosterName ?? '').trim() || String(teamIdentityDraftName ?? '').trim();
              const resolvedName = isDirect
                ? backendDmName || dmMember?.name || deriveDmNameFromChannel(row.name)
                : scope === 'team' && hasCurrentTeamContext
                  ? teamDisplayName || row.name
                : row.name;
              const runtimePreview = channelPreviewById[String(row.id)] ?? null;
              const backendPreview = String(row.last_message_preview ?? '').trim() || null;
              const snippet = runtimePreview ?? backendPreview ?? (isDirect ? `${dmMember?.roleLabel ?? 'Member'} · Direct message` : null);
              const backendAvatarUrlRaw = String(row.avatar_url ?? '').trim();
              const backendAvatarUrl = /^https?:\/\//i.test(backendAvatarUrlRaw) ? backendAvatarUrlRaw : null;
              const backendAvatarLabel = String(row.avatar_label ?? '').trim() || null;
              const backendAvatarTone = String(row.avatar_tone ?? '').trim() || null;
              const avatarUrl = isDirect ? (backendAvatarUrl ?? dmMember?.avatarUrl ?? null) : backendAvatarUrl;
              const avatarLabel = isDirect
                ? backendAvatarLabel ?? deriveAvatarLabel(dmMember?.name ?? resolvedName, 'DM')
                : scope === 'team' && hasCurrentTeamContext
                  ? backendAvatarLabel ?? (String(teamIdentityAvatar ?? '').trim() || deriveAvatarLabel(resolvedName, 'TM'))
                  : backendAvatarLabel ?? deriveAvatarLabel(resolvedName, scope === 'cohort' ? 'CO' : 'CH');
              const avatarTone = isDirect
                ? backendAvatarTone ?? dmMember?.avatarTone ?? avatarToneForScope(scope)
                : scope === 'team' && hasCurrentTeamContext
                  ? backendAvatarTone ?? (String(teamIdentityBackground ?? '').trim() || avatarToneForScope(scope))
                  : backendAvatarTone ?? avatarToneForScope(scope);
              return {
                id: String(row.id),
                name: resolvedName,
                type: row.type ?? null,
                scope,
                avatar_url: avatarUrl,
                avatar_label: avatarLabel,
                avatar_tone: avatarTone,
                unread_count: row.unread_count ?? null,
                member_count: null,
                my_role: row.my_role ?? null,
                last_seen_at: row.last_seen_at ?? null,
                last_message_at: row.last_message_at ?? null,
                created_at: row.created_at ?? null,
                snippet,
              };
            });
            const commsRosterDmRows = teamMemberDirectory
              .filter((member) => Boolean(member.userId))
              .map((member) => ({
                id: String(member.userId),
                name: member.name,
                role: member.roleLabel,
                avatar_url: member.avatarUrl,
                avatar_label: deriveAvatarLabel(member.name, 'DM'),
                avatar_tone: member.avatarTone,
              }));
            const teamBroadcastLabel =
              String(teamRosterName ?? '').trim() ||
              String(teamIdentityDraftName ?? '').trim() ||
              'your team';
            const scopedBroadcastCandidate =
              effectiveBroadcastTargetScope === 'team'
                ? sortedBroadcastCandidateRows.find((row) => normalizeChannelTypeToScope(row.type) === 'team')
                : effectiveBroadcastTargetScope === 'cohort'
                  ? sortedBroadcastCandidateRows.find((row) => normalizeChannelTypeToScope(row.type) === 'cohort')
                  : sortedBroadcastCandidateRows[0] ?? null;
            const resolvedBroadcastAudienceLabel =
              effectiveBroadcastTargetScope === 'team'
                ? teamBroadcastLabel
                : scopedBroadcastCandidate?.name ??
                  coachingShellContext.broadcastAudienceLabel ??
                  (effectiveBroadcastTargetScope === 'cohort'
                    ? 'selected cohort'
                    : effectiveBroadcastTargetScope === 'channel'
                      ? 'selected channel'
                      : 'selected segment');

            return (
              <>
                {isCommsScreen ? (
                  <CommsHub
                    screen={coachingShellScreen as 'inbox' | 'inbox_channels' | 'channel_thread' | 'coach_broadcast_compose'}
                    primaryTab={commsHubPrimaryTab}
                    scopeFilter={effectiveCommsScopeFilter}
                    searchQuery={commsHubSearchQuery}
                    onChangePrimaryTab={(tab) => {
                      setCommsHubPrimaryTab(tab);
                      if (tab === 'all') {
                        openCoachingShell('inbox', {
                          source: 'user_tab',
                          preferredChannelScope: null,
                          preferredChannelLabel: null,
                          threadTitle: null,
                          threadSub: null,
                          broadcastAudienceLabel: null,
                          broadcastRoleAllowed: false,
                        });
                      } else if (tab === 'channels' || tab === 'dms') {
                        openCoachingShell('inbox_channels', {
                          source: 'user_tab',
                          preferredChannelScope: null,
                          preferredChannelLabel: null,
                          threadTitle: null,
                          threadSub: null,
                          broadcastAudienceLabel: null,
                          broadcastRoleAllowed: false,
                        });
                      } else if (tab === 'broadcast' && roleCanOpenBroadcast) {
                        // Keep broadcast within the same messages shell for channels-parity UX.
                        openCoachingShell('inbox_channels', {
                          source: 'user_tab',
                          preferredChannelScope: null,
                          preferredChannelLabel: null,
                          threadTitle: null,
                          threadSub: null,
                          broadcastAudienceLabel: resolvedBroadcastAudienceLabel,
                          broadcastRoleAllowed: roleCanOpenBroadcast,
                        });
                      }
                    }}
                    onChangeScopeFilter={setCommsHubScopeFilter}
                    onChangeSearchQuery={setCommsHubSearchQuery}
                    onOpenChannel={(chId, chName, scope) => {
                      setSelectedChannelId(chId);
                      setSelectedChannelName(chName);
                      setChannelMessages(null);
                      setChannelMessageDraft('');
                      setChannelMessageSubmitError(null);
                      setBroadcastError(null);
                      setBroadcastSuccessNote(null);
                      openCoachingShell('channel_thread', {
                        preferredChannelScope: scope as any,
                        preferredChannelLabel: chName,
                        threadTitle: chName,
                        threadSub: `Messages in ${chName}.`,
                        broadcastAudienceLabel:
                          scope === 'team' && roleCanOpenBroadcast
                            ? chName
                            : coachingShellContext.broadcastAudienceLabel,
                        broadcastRoleAllowed: scope === 'team' ? roleCanOpenBroadcast : false,
                      });
                    }}
                    onOpenDm={(dmId, dmName) => {
                      void openDirectThreadForMember({
                        targetUserId: dmId,
                        memberName: dmName,
                        source: 'user_tab',
                      }).catch((err) => {
                        setSelectedChannelId(null);
                        setSelectedChannelName(null);
                        setChannelsError(err instanceof Error ? err.message : `Unable to open direct thread with ${dmName}.`);
                      });
                    }}
                    onOpenBroadcast={() => {
                      if (!roleCanOpenBroadcast) return; // safety: member/sponsor/solo cannot reach broadcast
                      setCommsHubPrimaryTab('broadcast');
                      openCoachingShell('inbox_channels', {
                        source: 'user_tab',
                        preferredChannelScope: null,
                        preferredChannelLabel: null,
                        threadTitle: null,
                        threadSub: null,
                        broadcastAudienceLabel: resolvedBroadcastAudienceLabel,
                        broadcastRoleAllowed: roleCanOpenBroadcast,
                      });
                    }}
                    onOpenChannelsCta={() => openCoachingShell('inbox_channels', {
                      source: 'user_tab',
                      preferredChannelScope: null,
                      preferredChannelLabel: null,
                      threadTitle: null,
                      threadSub: null,
                      broadcastAudienceLabel: null,
                      broadcastRoleAllowed: false,
                    })}
                    onBack={() => {
                      const source = coachingShellContext.source;
                      if (source === 'team_leader_dashboard' || source === 'team_member_dashboard') {
                        setActiveTab('team');
                        setTeamFlowScreen('dashboard');
                        return;
                      }
                      openCoachingShell('inbox_channels', {
                        source: 'user_tab',
                        preferredChannelScope: null,
                        preferredChannelLabel: null,
                        threadTitle: null,
                        threadSub: null,
                        broadcastAudienceLabel: null,
                        broadcastRoleAllowed: false,
                      });
                    }}
                    headerAvatarLabel={headerAvatarLabel}
                    headerAvatarTone={headerAvatarTone}
                    headerAvatarKind={headerAvatarKind}
                    onPressHeaderAvatar={
                      selectedDmDirectoryMember
                        ? () => {
                            setTeamFlowScreen('dashboard');
                            setTeamProfileMemberId(selectedDmDirectoryMember.id);
                            setActiveTab('team');
                            setViewMode('log');
                          }
                        : null
                    }
                    personaVariant={commsPersonaVariant}
                    roleCanBroadcast={roleCanOpenBroadcast}
                    channels={commsChannelRows}
                    channelsLoading={channelsLoading}
                    channelsError={channelsError}
                    onRetryChannels={() => void fetchChannels()}
                    fallbackChannels={channelRows.map((r) => ({
                      scope: r.scope,
                      label: r.label,
                      context: r.context,
                      avatar_label:
                        r.scope === 'team'
                          ? String(teamIdentityAvatar ?? '').trim() || 'TM'
                          : deriveAvatarLabel(r.label, r.scope === 'cohort' ? 'CO' : 'CH'),
                      avatar_tone: r.scope === 'team'
                        ? String(teamIdentityBackground ?? '').trim() || avatarToneForScope(r.scope)
                        : avatarToneForScope(r.scope),
                    }))}
                    fallbackDms={commsRosterDmRows}
                    useFallback={fallbackChannelRowsVisible}
                    selectedChannelId={selectedChannelResolvedId}
                    selectedChannelName={selectedChannelDisplayName}
                    messages={Array.isArray(channelMessages) ? channelMessages : []}
                    messagesLoading={channelMessagesLoading}
                    messagesError={channelMessagesError}
                    currentUserId={session?.user?.id ?? null}
                    messageDraft={channelMessageDraft}
                    onChangeMessageDraft={(text) => {
                      setChannelMessageDraft(text);
                      if (channelMessageSubmitError) setChannelMessageSubmitError(null);
                    }}
                    messageSubmitting={channelMessageSubmitting}
                    messageSubmitError={channelMessageSubmitError}
                    onSendMessage={(payload) => {
                      if (selectedChannelResolvedId) {
                        void sendChannelMessage(selectedChannelResolvedId, {
                          bodyOverride: payload.body,
                          messageType: payload.message_type,
                          mediaAttachment: payload.media_attachment,
                          messageKind: payload.message_kind,
                          taskAction: payload.task_action,
                          taskCardDraft: payload.task_card_draft,
                        });
                      }
                    }}
                    onRefreshMessages={() => {
                      if (selectedChannelResolvedId) void fetchChannelMessages(selectedChannelResolvedId);
                    }}
                    onOpenAiAssist={(host) =>
                      openAiAssistShell(
                        {
                          host: host as any,
                          title: host === 'channel_thread' ? 'AI Reply Draft (Approval-First)' : 'AI Broadcast Draft (Approval-First)',
                          sub: 'Draft only. Human send is required.',
                          targetLabel:
                            host === 'coach_broadcast_compose'
                              ? resolvedBroadcastAudienceLabel
                              : (selectedChannelResolvedName ?? contextualThreadTitle),
                          approvedInsertOnly: true,
                        },
                        {
                          prompt: host === 'channel_thread'
                            ? `Draft a reply for ${selectedChannelResolvedName ?? contextualThreadTitle} that is supportive and action-oriented.`
                            : `Draft a team coaching broadcast for ${resolvedBroadcastAudienceLabel} with a clear next action.`,
                          draft: host === 'channel_thread' ? channelMessageDraft : broadcastDraft,
                        }
                      )
                    }
                    onSendLatestMediaAttachment={() => void sendLatestMediaAttachment(selectedChannelResolvedId)}
                    resolveMediaPlaybackUrl={resolveMediaPlaybackUrl}
                    pendingMediaUpload={pendingMediaUpload}
                    localMediaPreviewById={localMediaPreviewById}
                    onPickMediaFile={(file) => void handlePickMediaFile(selectedChannelResolvedId, file)}
                    onCancelMediaUpload={() => {
                      if (pendingMediaUpload?.mediaId) {
                        setLocalMediaPreviewById((prev) => {
                          const next = { ...prev };
                          delete next[pendingMediaUpload.mediaId!];
                          return next;
                        });
                      }
                      setPendingMediaUpload(null);
                      setLatestMediaId(null);
                      setLatestMediaFileName(null);
                      setMediaUploadStatus(null);
                    }}
                    mediaUploadBusy={mediaUploadBusy}
                    mediaUploadStatus={mediaUploadStatus}
                    liveSessionBusy={live.busy}
                    liveSessionStatus={live.statusMessage}
                    canHostLiveSession={
                      isCoachRuntimeOperator || (effectiveTeamPersonaVariant === 'leader' && !isChallengeSponsorRuntime)
                    }
                    liveCallerRole={live.callerRole}
                    livePlaybackUrl={live.playbackUrl}
                    liveStreamKey={live.streamKey}
                    liveProviderMode={live.providerMode}
                    liveSessionRecord={live.session}
                    onGoLive={() => setShowLiveSetup(true)}
                    onRefreshLiveSession={() => void live.refreshSession()}
                    onEndLiveSession={() => void live.endSession()}
                    onPublishReplay={() => void live.publishReplay()}
                    replayBusy={live.replayBusy}
                    replayPublished={live.replayPublished}
                    composerBottomInset={commsComposerBottomInset}
                    broadcastDraft={broadcastDraft}
                    onChangeBroadcastDraft={setBroadcastDraft}
                    broadcastTargetScope={effectiveBroadcastTargetScope}
                    broadcastTargetOptions={broadcastTargetOptions}
                    onChangeBroadcastTarget={setBroadcastTargetScope}
                    broadcastSubmitting={broadcastSubmitting}
                    broadcastError={broadcastError}
                    broadcastSuccessNote={broadcastSuccessNote}
                    broadcastAudienceLabel={resolvedBroadcastAudienceLabel}
                    onSendBroadcast={() => {
                      const targetId = scopedBroadcastCandidate?.id ?? null;
                      if (!targetId) {
                        setBroadcastError(
                          effectiveBroadcastTargetScope === 'team'
                            ? 'No team broadcast channel is available. Contact admin to restore team messaging.'
                            : effectiveBroadcastTargetScope === 'cohort'
                              ? 'No cohort broadcast channel is available for this scope.'
                              : 'No broadcast destination is available for this scope.'
                        );
                        return;
                      }
                      void sendChannelBroadcast(String(targetId));
                    }}
                    broadcastCampaignProps={{
                      availableTargets: [
                        // Channels (non-direct)
                        ...allChannelApiRows
                          .filter((row) => String(row.type ?? '').toLowerCase() !== 'direct')
                          .map((row): TargetOption => ({
                            scope_type: 'channel',
                            scope_id: String(row.id),
                            label: String(row.name ?? row.id),
                          })),
                        // Team (if available)
                        ...(teamRosterTeamId
                          ? [{ scope_type: 'team' as const, scope_id: teamRosterTeamId, label: teamRosterName ?? 'My Team' }]
                          : []),
                        // Cohorts
                        ...coachCohorts.map((c): TargetOption => ({
                          scope_type: 'cohort',
                          scope_id: c.id,
                          label: c.name,
                        })),
                      ],
                      selectedTargets: campaignTargets,
                      onChangeTargets: setCampaignTargets,
                      audienceCount: campaignAudienceCount,
                      audienceLoading: campaignAudienceLoading,
                      submitting: campaignSubmitting,
                      error: campaignError,
                      successNote: campaignSuccessNote,
                    }}
                    onSendBroadcastCampaign={executeBroadcastCampaign}
                    broadcastCampaignSubmitting={campaignSubmitting}
                    broadcastTaskDraft={broadcastTaskDraft}
                    onSetBroadcastTaskDraft={setBroadcastTaskDraft}
                    gateBlocksActions={shellPackageGateBlocksActions}
                    fmtTime={fmtMonthDayTime}
                    fmtDate={fmtShortMonthDay}
                  />
                ) : null}
                {!isCommsScreen ? (
                <View style={styles.coachingShellCard}>
                  {/* Comms chrome — hidden for coaching content screens (journey/lesson) */}
                  {!isCoachingContentScreen && (
                  <View>
                  <View style={styles.coachingShellTopRow}>
                    <Text style={styles.coachingShellTitle}>Comms Hub</Text>
                    <View style={styles.coachingShellBadge}>
                      <Text style={styles.coachingShellBadgeText}>{commsPersonaBadgeLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.coachingShellSub}>{commsPersonaSummary}</Text>
                  <View style={styles.commsHubTabRow}>
                    {([
                      { key: 'all' as const, label: 'All' },
                      { key: 'channels' as const, label: 'Channels' },
                      { key: 'dms' as const, label: 'DMs' },
                      ...(roleCanOpenBroadcast ? [{ key: 'broadcast' as const, label: 'Broadcast' }] : []),
                    ] as const).map((tab) => (
                      <TouchableOpacity
                        key={`comms-tab-${tab.key}`}
                        style={[
                          styles.commsHubTabBtn,
                          commsHubPrimaryTab === tab.key ? styles.commsHubTabBtnActive : null,
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
                            styles.commsHubTabBtnText,
                            commsHubPrimaryTab === tab.key ? styles.commsHubTabBtnTextActive : null,
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {commsHubPrimaryTab === 'channels' ? (
                    <View style={styles.commsHubFilterRow}>
                      {([
                        { key: 'all' as const, label: 'All Types' },
                        { key: 'team' as const, label: 'Team' },
                        { key: 'cohort' as const, label: 'Cohort' },
                        ...(isCoachRuntimeOperator ? [{ key: 'global' as const, label: 'Global' }] : []),
                      ] as const).map((filter) => (
                        <TouchableOpacity
                          key={`comms-scope-${filter.key}`}
                          style={[
                            styles.commsHubFilterBtn,
                            effectiveCommsScopeFilter === filter.key ? styles.commsHubFilterBtnActive : null,
                          ]}
                          onPress={() => setCommsHubScopeFilter(filter.key)}
                        >
                          <Text
                            style={[
                              styles.commsHubFilterBtnText,
                              effectiveCommsScopeFilter === filter.key ? styles.commsHubFilterBtnTextActive : null,
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.commsHubSearchWrap}>
                    <Text style={styles.commsHubSearchIcon}>⌕</Text>
                    <TextInput
                      value={commsHubSearchQuery}
                      onChangeText={setCommsHubSearchQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor="#9aa3b0"
                      style={styles.coachingShellSearchInput}
                    />
                  </View>
                  </View>
                  )}
                  {!isCoachingContentScreen && (
                  <>
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
                      ) : sortedPrimaryTabRows.length > 0 ? (
                        sortedPrimaryTabRows.map((row) => {
                          const rowScope = normalizeChannelTypeToScope(row.type) ?? 'community';
                          const isSelected = String(row.id) === String(selectedChannelResolvedId ?? '');
                          const typeLabel = String(row.type ?? 'channel');
                          const scopeLabel =
                            rowScope === 'community'
                              ? 'Community'
                              : rowScope === 'challenge'
                                ? 'Challenge'
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
                                <View style={styles.commsChannelRowTitleWrap}>
                                  <Text numberOfLines={1} style={styles.coachingShellListTitle}>{row.name}</Text>
                                  {Number(row.unread_count ?? 0) > 0 ? (
                                    <View style={styles.commsUnreadBadge}>
                                      <Text style={styles.commsUnreadBadgeText}>{Math.max(0, Number(row.unread_count ?? 0))}</Text>
                                    </View>
                                  ) : null}
                                </View>
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
                                <Text numberOfLines={1} style={styles.coachingShellListSubText}>{lastActivityPreview}</Text>
                              </View>
                              <Text style={styles.coachingShellListChevron}>›</Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : fallbackChannelRowsVisible ? (
                        commsHubPrimaryTab === 'dms'
                          ? commsRosterDmRows.map((member) => (
                              <TouchableOpacity
                                key={member.id}
                                style={[styles.coachingShellListRow, shellPackageGateBlocksActions ? styles.disabled : null]}
                                disabled={shellPackageGateBlocksActions}
                                onPress={() =>
                                  shellPackageGateBlocksActions
                                    ? undefined
                                    : void openDirectThreadForMember({
                                        targetUserId: member.id,
                                        memberName: member.name,
                                        source: 'user_tab',
                                      }).catch((err) => {
                                        setSelectedChannelId(null);
                                        setSelectedChannelName(null);
                                        setChannelsError(err instanceof Error ? err.message : `Unable to open direct thread with ${member.name}.`);
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
                                  <View style={styles.commsChannelRowTitleWrap}>
                                    <Text style={styles.coachingShellListTitle}>{row.label}</Text>
                                  </View>
                                  <Text numberOfLines={1} style={styles.coachingShellListSubText}>{row.context}</Text>
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
                          {channelMessages.map((message, index) => {
                            const isMine = String(message.sender_user_id ?? '') === String(session?.user?.id ?? '');
                            const isBroadcast = String(message.message_type ?? '') === 'broadcast';
                            const previous = index > 0 ? channelMessages[index - 1] : null;
                            const startsGroup =
                              !previous || String(previous.sender_user_id ?? '') !== String(message.sender_user_id ?? '');
                            const metaLabel = startsGroup
                              ? `${isBroadcast ? 'Broadcast' : 'Message'} • ${fmtMonthDayTime(message.created_at ?? null)}`
                              : fmtMonthDayTime(message.created_at ?? null);
                            return (
                              <View
                                key={`channel-message-${message.id}`}
                                style={[
                                  styles.coachingThreadMessageBubble,
                                  isMine ? styles.coachingThreadMessageBubbleMine : null,
                                  startsGroup ? styles.coachingThreadMessageBubbleStart : styles.coachingThreadMessageBubbleFollow,
                                ]}
                              >
                                <Text style={[styles.coachingThreadMessageMeta, !startsGroup ? styles.coachingThreadMessageMetaFollow : null]}>
                                  {metaLabel}
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
                        <View style={styles.commsComposerActionRow}>
                          <TouchableOpacity
                            style={[styles.commsComposerGhostBtn, channelMessageSubmitting ? styles.disabled : null]}
                            disabled={channelMessageSubmitting}
                            onPress={() => {
                              if (selectedChannelResolvedId) {
                                void fetchChannelMessages(selectedChannelResolvedId);
                              }
                            }}
                          >
                            <Text style={styles.commsComposerGhostBtnText}>Refresh</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.commsComposerSendBtn,
                              (!selectedChannelResolvedId || channelMessageSubmitting || shellPackageGateBlocksActions)
                                ? styles.disabled
                                : null,
                            ]}
                            disabled={!selectedChannelResolvedId || channelMessageSubmitting || shellPackageGateBlocksActions}
                            onPress={() => {
                              if (selectedChannelResolvedId) void sendChannelMessage(selectedChannelResolvedId);
                            }}
                          >
                            <Text style={styles.commsComposerSendBtnText}>
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
                          <View style={styles.commsHubTabRow}>
                            {broadcastTargetOptions.map((target) => (
                              <TouchableOpacity
                                key={`broadcast-target-${target}`}
                                style={[
                                  styles.commsHubFilterBtn,
                                  effectiveBroadcastTargetScope === target ? styles.commsHubFilterBtnActive : null,
                                ]}
                                onPress={() => {
                                  setBroadcastTargetScope(target);
                                  setBroadcastError(null);
                                  setBroadcastSuccessNote(null);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.commsHubFilterBtnText,
                                    effectiveBroadcastTargetScope === target ? styles.commsHubFilterBtnTextActive : null,
                                  ]}
                                >
                                  {target === 'team'
                                    ? 'Team'
                                    : target === 'cohort'
                                      ? 'Cohort'
                                      : target === 'segment'
                                        ? 'Segment'
                                        : 'Channel'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {effectiveBroadcastTargetScope === 'segment' ? (
                            <View style={styles.coachingJourneyEmptyCard}>
                              <Text style={styles.coachingJourneyEmptyTitle}>Segment broadcasts are coach-only</Text>
                              <Text style={styles.coachingJourneyEmptySub}>
                                Segments are broadcast targets and do not appear in channel lists.
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.coachingShellList}>
                            {effectiveBroadcastTargetScope !== 'segment' && sortedBroadcastCandidateRows.length > 0 ? (
                              sortedBroadcastCandidateRows.slice(0, 8).map((row) => {
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
                                      <View style={styles.commsChannelRowTitleWrap}>
                                        <Text style={styles.coachingShellListTitle}>{row.name}</Text>
                                        {Number(row.unread_count ?? 0) > 0 ? (
                                          <View style={styles.commsUnreadBadge}>
                                            <Text style={styles.commsUnreadBadgeText}>{Math.max(0, Number(row.unread_count ?? 0))}</Text>
                                          </View>
                                        ) : null}
                                      </View>
                                      <Text numberOfLines={1} style={styles.coachingShellListSubText}>
                                        {scope} • {String(row.type ?? 'channel')}
                                      </Text>
                                    </View>
                                    <Text style={styles.coachingShellListChevron}>›</Text>
                                  </TouchableOpacity>
                                );
                              })
                            ) : (
                              <View style={styles.coachingJourneyEmptyCard}>
                                <Text style={styles.coachingJourneyEmptyTitle}>
                                  {effectiveBroadcastTargetScope === 'segment'
                                    ? 'Select a non-segment target to route by channel'
                                    : 'No destination channels found'}
                                </Text>
                                <Text style={styles.coachingJourneyEmptySub}>
                                  {effectiveBroadcastTargetScope === 'segment'
                                    ? 'Team, cohort, and channel targets use channel destinations.'
                                    : 'No channels match this target scope for your current role.'}
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
                      <View style={styles.commsComposerActionRow}>
                        <TouchableOpacity
                          style={[styles.commsComposerGhostBtn, channelsLoading ? styles.disabled : null]}
                          disabled={channelsLoading}
                          onPress={() => void fetchChannels()}
                        >
                          <Text style={styles.commsComposerGhostBtnText}>Refresh Channels</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.commsComposerSendBtn,
                            (!roleCanOpenBroadcast || !selectedChannelResolvedId || broadcastSubmitting || shellPackageGateBlocksActions)
                              ? styles.disabled
                              : null,
                          ]}
                          disabled={!roleCanOpenBroadcast || !selectedChannelResolvedId || broadcastSubmitting || shellPackageGateBlocksActions}
                          onPress={() => {
                            if (selectedChannelResolvedId) void sendChannelBroadcast(selectedChannelResolvedId);
                          }}
                        >
                          <Text style={styles.commsComposerSendBtnText}>
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
                  </>
                  )}
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
                      {isSoloPersona ? (
                        <TouchableOpacity style={styles.inviteCodeEntryBtn} onPress={handleOpenInviteCodeEntry}>
                          <Text style={styles.inviteCodeEntryBtnText}>Enter Invite Code</Text>
                        </TouchableOpacity>
                      ) : null}
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
                                  {isCoachRuntimeOperator && String(journey.created_by ?? '') === String(session?.user?.id ?? '') ? (
                                    <TouchableOpacity
                                      style={{
                                        marginTop: 8,
                                        flexDirection: 'row' as const,
                                        alignItems: 'center' as const,
                                        alignSelf: 'flex-start' as const,
                                        backgroundColor: journeyInviteCopiedId === String(journey.id) ? '#dcfce7' : '#eef2ff',
                                        borderRadius: 6,
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                      }}
                                      onPress={async () => {
                                        const jid = String(journey.id);
                                        const existingCode = journeyInviteCodes[jid];
                                        const code = existingCode || await fetchJourneyInviteCode(jid);
                                        if (code) {
                                          const link = `compass.app/journey/${code}`;
                                          setJourneyInviteCopiedId(jid);
                                          setTimeout(() => setJourneyInviteCopiedId(null), 2200);
                                          void Alert.alert('Journey Invite Link', link, [{ text: 'OK' }]);
                                        }
                                      }}
                                    >
                                      <Text style={{
                                        fontSize: 11,
                                        fontWeight: '600' as const,
                                        color: journeyInviteCopiedId === String(journey.id) ? '#16a34a' : '#4338ca',
                                      }}>
                                        {journeyInviteLoading === String(journey.id)
                                          ? 'Loading…'
                                          : journeyInviteCopiedId === String(journey.id)
                                            ? 'Link Ready'
                                            : 'Share Invite'}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
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

                          {/* ── Enrolled members list ── */}
                          {(() => {
                            const journeyTitle = coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? '';
                            const journeyId = selectedJourneyId ?? '';
                            const enrolledMembers = teamMemberDirectory.filter(
                              (m) => m.journeys.some((j) => j === journeyTitle || j === journeyId)
                            );
                            return (
                              <View style={styles.cwfJourneyMembersWrap}>
                                <View style={styles.cwfJourneyMembersHeader}>
                                  <Text style={styles.cwfJourneyMembersTitle}>
                                    Members {enrolledMembers.length > 0 ? `(${enrolledMembers.length})` : ''}
                                  </Text>
                                  {enrolledMembers.length > 0 && isCoachRuntimeOperator && (
                                    <TouchableOpacity
                                      style={styles.cwfJourneyMembersBroadcastBtn}
                                      onPress={() => {
                                        openCoachingShell('coach_broadcast_compose', {
                                          broadcastAudienceLabel: `${journeyTitle} enrollees`,
                                          broadcastRoleAllowed: true,
                                        });
                                      }}
                                    >
                                      <Text style={styles.cwfJourneyMembersBroadcastText}>Broadcast</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                                {enrolledMembers.length === 0 ? (
                                  <Text style={styles.cwfEmpty}>No enrolled members found for this journey.</Text>
                                ) : (
                                  enrolledMembers.slice(0, 20).map((member) => (
                                    <TouchableOpacity
                                      key={member.id}
                                      style={styles.cwfJourneyMemberRow}
                                      onPress={() => setTeamProfileMemberId(member.id)}
                                    >
                                      <View style={[styles.cwfJourneyMemberAvatar, { backgroundColor: member.avatarTone || '#e8f0fe' }]}>
                                        <Text style={styles.cwfJourneyMemberAvatarText}>
                                          {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </Text>
                                      </View>
                                      <View style={styles.cwfJourneyMemberInfo}>
                                        <Text style={styles.cwfJourneyMemberName} numberOfLines={1}>{member.name}</Text>
                                        <Text style={styles.cwfJourneyMemberRole} numberOfLines={1}>{member.roleLabel || 'Member'}</Text>
                                      </View>
                                      <Text style={styles.cwfJourneyMemberChevron}>›</Text>
                                    </TouchableOpacity>
                                  ))
                                )}
                              </View>
                            );
                          })()}

                          {/* ── Journey Builder (extracted component) ── */}
                          <JourneyBuilderDrawer
                            selectedJourneyId={selectedJourneyId ?? null}
                            selectedLessonId={selectedLessonId ?? null}
                            selectedJourneyTitle={coachingJourneyDetail?.journey?.title ?? selectedJourneyTitle ?? null}
                            coachingShellContext={coachingShellContext}
                            milestoneRows={milestoneRows}
                            isCoachRuntimeOperator={isCoachRuntimeOperator}
                            shellPackageGateBlocksActions={shellPackageGateBlocksActions}
                            jbLessons={jbLessons}
                            jbSaveState={jbSaveState}
                            jbSaveMessage={jbSaveMessage}
                            jbAssets={jbAssets}
                            jbCollections={jbCollections}
                            jbShowAssetLibrary={jbShowAssetLibrary}
                            jbActiveTaskMenu={jbActiveTaskMenu}
                            jbConfirmDelete={jbConfirmDelete}
                            jbNewLessonTitle={_jbNewLessonTitle}
                            jbNewTaskTitle={jbNewTaskTitle}
                            jbAddingTaskToLessonId={jbAddingTaskToLessonId}
                            jbEditingLessonId={jbEditingLessonId}
                            jbEditingLessonTitle={jbEditingLessonTitle}
                            jbEditingTaskKey={jbEditingTaskKey}
                            jbEditingTaskTitle={jbEditingTaskTitle}
                            jbMovingItem={jbMovingItem}
                            jbAssetsById={jbAssetsById}
                            setJbShowAssetLibrary={setJbShowAssetLibrary}
                            setJbConfirmDelete={setJbConfirmDelete}
                            setJbNewTaskTitle={setJbNewTaskTitle}
                            setJbAddingTaskToLessonId={setJbAddingTaskToLessonId}
                            setJbEditingLessonId={setJbEditingLessonId}
                            setJbEditingLessonTitle={setJbEditingLessonTitle}
                            setJbEditingTaskKey={setJbEditingTaskKey}
                            setJbEditingTaskTitle={setJbEditingTaskTitle}
                            setJbMovingItem={setJbMovingItem}
                            jbAddLesson={jbAddLesson}
                            jbAddTask={jbAddTask}
                            jbAddAssetAsTask={jbAddAssetAsTask}
                            jbDeleteLesson={jbDeleteLesson}
                            jbRemoveTask={jbRemoveTask}
                            jbReorderLessons={jbReorderLessons}
                            jbReorderTasks={jbReorderTasks}
                            jbRenameLesson={jbRenameLesson}
                            jbRenameTask={jbRenameTask}
                            openCoachingShell={openCoachingShell}
                          />


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
                            {/* ── Lesson Media ── */}
                            {lessonMediaLoading ? (
                              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="#64748B" />
                                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Loading media…</Text>
                              </View>
                            ) : lessonMediaAssets.length > 0 ? (
                              <View style={{ marginTop: 12, gap: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 2 }}>
                                  Lesson Media ({lessonMediaAssets.length})
                                </Text>
                                {lessonMediaAssets.map((media) => (
                                  <View
                                    key={media.media_id}
                                    style={{
                                      backgroundColor: '#F8FAFC',
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: '#E2E8F0',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {/* Inline image preview */}
                                    {media.file_url && media.content_type.startsWith('image/') ? (
                                      <Image
                                        source={{ uri: media.file_url }}
                                        style={{ width: '100%' as any, aspectRatio: 16 / 9, backgroundColor: '#F1F5F9' }}
                                        resizeMode="cover"
                                      />
                                    ) : null}
                                    {/* Video placeholder */}
                                    {media.content_type.startsWith('video/') ? (
                                      <View
                                        style={{
                                          width: '100%' as any,
                                          aspectRatio: 16 / 9,
                                          backgroundColor: '#1E293B',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Text style={{ fontSize: 32 }}>
                                          {media.playback_ready ? '▶' : media.processing_status === 'failed' ? '✗' : '⏳'}
                                        </Text>
                                        <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>
                                          {media.playback_ready
                                            ? 'Video ready'
                                            : media.processing_status === 'failed'
                                              ? 'Processing failed'
                                              : 'Processing…'}
                                        </Text>
                                      </View>
                                    ) : null}
                                    <View style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#334155' }} numberOfLines={1}>
                                        {media.filename || 'Media'}
                                      </Text>
                                      <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                        {media.category} · {media.processing_status}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            ) : null}
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
                ) : null}

              </>
            );
          })()}
        </View>
      ) : null}

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

      {showUniversalAvatarTrigger ? (
        <View style={styles.avatarGlobalWrap}>
          <TouchableOpacity
            style={styles.avatarBtn}
            accessibilityRole="button"
            accessibilityLabel="Open profile and settings"
            onPress={handleOpenProfileFromAvatar}
          >
            <Text style={styles.avatarText}>{profileInitials}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BottomTabBar
        activeTab={activeTab}
        bottomTabOrder={bottomTabOrder}
        bottomNavPadBottom={bottomNavPadBottom}
        bottomNavLift={bottomNavLift}
        bottomNavAnimation={bottomNavAnimation}
        modeLanePulseAnim={modeLanePulseAnim}
        bottomTabTheme={bottomTabTheme}
        unreadMessagesBadgeLabel={unreadMessagesBadgeLabel}
        onBottomTabPress={onBottomTabPress}
        onLayout={(height) => setBottomNavLayoutHeight(height)}
        onDevToolsOpen={() => setDevToolsVisible(true)}
      />

      <PaywallModal
        visible={paywallVisible}
        title={paywallTitle}
        message={paywallMessage}
        currentTier={runtimeMeTier || entitlementTier || 'free'}
        requiredPlan={paywallRequiredPlan}
        onClose={() => hidePaywall()}
        onUpgrade={() => {
          hidePaywall();
          Alert.alert('Upgrade flow', 'Billing checkout wiring is active via /api/billing/checkout-session.');
        }}
      />
      <DeveloperToolsModal
        visible={devToolsVisible}
        onClose={() => setDevToolsVisible(false)}
      />

      <AiAssistDrawer
        aiAssistVisible={aiAssistVisible}
        setAiAssistVisible={setAiAssistVisible}
        aiAssistContext={aiAssistContext}
        aiAssistPrompt={aiAssistPrompt}
        setAiAssistPrompt={setAiAssistPrompt}
        aiAssistDraftText={aiAssistDraftText}
        setAiAssistDraftText={setAiAssistDraftText}
        aiAssistGenerating={aiAssistGenerating}
        aiAssistNotice={aiAssistNotice}
        setAiAssistNotice={setAiAssistNotice}
        aiSuggestionQueueSubmitting={aiSuggestionQueueSubmitting}
        aiSuggestionQueueError={aiSuggestionQueueError}
        aiSuggestionQueueSuccess={aiSuggestionQueueSuccess}
        aiSuggestionRows={aiSuggestionRows}
        aiSuggestionQueueSummary={aiSuggestionQueueSummary}
        aiSuggestionListLoading={aiSuggestionListLoading}
        aiSuggestionListError={aiSuggestionListError}
        generateAiAssistDraft={generateAiAssistDraft}
        applyAiAssistDraftToHumanInput={applyAiAssistDraftToHumanInput}
        queueAiSuggestionForApproval={queueAiSuggestionForApproval}
      />

      <Modal visible={logOtherVisible} transparent animationType="fade" onRequestClose={() => setLogOtherVisible(false)}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerCard}>
            <Text style={styles.drawerTitle}>Log Other KPI</Text>
            <Text style={styles.drawerUnlockedHint}>
              Select any KPI to log for {selectedLogDate === isoTodayLocal() ? 'today' : formatLogDateHeading(selectedLogDate)}.
            </Text>
            <View style={styles.drawerFilterRow}>
              {(['All', 'PC', 'GP', 'VP'] as const).map((filter) => (
                <TouchableOpacity
                  key={`log-other-filter-${filter}`}
                  style={[styles.drawerFilterChip, logOtherFilter === filter && styles.drawerFilterChipActive]}
                  onPress={() => setLogOtherFilter(filter)}
                >
                  <Text style={[styles.drawerFilterChipText, logOtherFilter === filter && styles.drawerFilterChipTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView style={styles.drawerGridScroll} contentContainerStyle={styles.drawerList}>
              {logOtherCatalogKpis.map((kpi) => {
                const locked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
                return (
                  <TouchableOpacity
                    key={`log-other-${kpi.id}`}
                    style={[styles.drawerListRow, locked && styles.disabled]}
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
                      setSegment(kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP' ? kpi.type : 'PC');
                      setLogOtherVisible(false);
                      void onTapQuickLog(kpi, { skipTapFeedback: true });
                    }}
                  >
                    <View style={[styles.drawerListIconWrap, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                      <View style={styles.drawerListIconInner}>{renderKpiIcon(kpi)}</View>
                    </View>
                    <View style={styles.drawerListMain}>
                      <View style={styles.drawerListTitleRow}>
                        <Text numberOfLines={1} style={styles.drawerListLabel}>{kpi.name}</Text>
                        <View style={[styles.drawerTypeBadge, { backgroundColor: kpiTypeTint(kpi.type) }]}>
                          <Text style={[styles.drawerTypeBadgeText, { color: kpiTypeAccent(kpi.type) }]}>{kpi.type}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.drawerListMeta}>
                        {formatDrawerKpiMeta(kpi)}
                      </Text>
                    </View>
                    <View style={styles.drawerActionCol}>
                      <View style={[styles.drawerActionPill, styles.drawerActionAdd]}>
                        <Text style={styles.drawerActionText}>Log</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.drawerClose} onPress={() => setLogOtherVisible(false)}>
              <Text style={styles.drawerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <KpiAddDrawer
        addDrawerVisible={addDrawerVisible}
        setAddDrawerVisible={setAddDrawerVisible}
        drawerFilter={drawerFilter}
        setDrawerFilter={setDrawerFilter}
        drawerCatalogKpis={drawerCatalogKpis}
        managedKpiIdSet={managedKpiIdSet}
        favoriteKpiIds={favoriteKpiIds}
        customKpiById={customKpiById}
        selectedCountsByType={selectedCountsByType}
        gpUnlocked={gpUnlocked}
        vpUnlocked={vpUnlocked}
        canCreateCustomKpis={canCreateCustomKpis}
        formatDrawerKpiMeta={formatDrawerKpiMeta}
        toggleManagedKpi={toggleManagedKpi}
        toggleFavoriteKpi={toggleFavoriteKpi}
        openCreateCustomKpiModal={openCreateCustomKpiModal}
        openEditCustomKpiModal={openEditCustomKpiModal}
      />

      <CustomKpiModal
        customKpiModalVisible={customKpiModalVisible}
        setCustomKpiModalVisible={setCustomKpiModalVisible}
        customKpiDraft={customKpiDraft}
        setCustomKpiDraft={setCustomKpiDraft}
        customKpiSaving={customKpiSaving}
        customKpiError={customKpiError}
        customKpiSuccessNote={customKpiSuccessNote}
        submitCustomKpi={submitCustomKpi}
      />

      <PipelineCheckinDrawer
        pipelineCheckinVisible={pipelineCheckinVisible}
        pipelineCheckinListings={pipelineCheckinListings}
        pipelineCheckinBuyers={pipelineCheckinBuyers}
        pipelineCheckinSubmitting={pipelineCheckinSubmitting}
        pipelineCheckinReasonPromptVisible={pipelineCheckinReasonPromptVisible}
        pipelineCheckinDecreaseFields={pipelineCheckinDecreaseFields}
        pipelineCheckinReason={pipelineCheckinReason}
        pipelineForceGciEntryField={pipelineForceGciEntryField}
        pipelineCloseDateInput={pipelineCloseDateInput}
        pipelineCloseGciInput={pipelineCloseGciInput}
        pipelineLostEncouragement={pipelineLostEncouragement}
        setPipelineCheckinListings={setPipelineCheckinListings}
        setPipelineCheckinBuyers={setPipelineCheckinBuyers}
        setPipelineCloseDateInput={setPipelineCloseDateInput}
        setPipelineCloseGciInput={setPipelineCloseGciInput}
        dismissPipelineCheckinForToday={dismissPipelineCheckinForToday}
        onSavePipelineCheckin={onSavePipelineCheckin}
        onChoosePipelineDecreaseReason={onChoosePipelineDecreaseReason}
        finalizePipelineCheckinSave={finalizePipelineCheckinSave}
      />

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

      {/* ── Live broadcast modals ── */}
      <LiveSetupSheet
        visible={showLiveSetup}
        channelName={selectedChannelName ?? 'this channel'}
        providerMode={live.providerMode}
        busy={live.busy}
        onConfirm={() => {
          if (selectedChannelId) void live.startSession(selectedChannelId);
        }}
        onCancel={() => setShowLiveSetup(false)}
      />
      <LiveBroadcastScreen
        visible={showLiveBroadcast}
        streamKey={live.streamKey}
        rtmpUrl={live.rtmpUrl}
        providerMode={live.providerMode}
        channelName={selectedChannelName ?? ''}
        busy={live.busy}
        onEnd={() => void handleEndBroadcast()}
      />
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
  contentComms: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
  challengeSurfaceWrap: {
    gap: 12,
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
  coachingShellWrap: {
    gap: 12,
  },
  coachingShellWrapComms: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
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
  commsHubTabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  commsHubTabBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7e0ee',
    backgroundColor: '#fff',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commsHubTabBtnActive: {
    borderColor: '#1f5fe2',
    backgroundColor: '#1f5fe2',
  },
  commsHubTabBtnText: {
    color: '#55647a',
    fontSize: 11,
    fontWeight: '800',
  },
  commsHubTabBtnTextActive: {
    color: '#fff',
  },
  commsHubFilterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  commsHubFilterBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe3f0',
    backgroundColor: '#f8fbff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commsHubFilterBtnActive: {
    borderColor: '#2a4f9f',
    backgroundColor: '#eaf1ff',
  },
  commsHubFilterBtnText: {
    color: '#51627b',
    fontSize: 10,
    fontWeight: '700',
  },
  commsHubFilterBtnTextActive: {
    color: '#2a4f9f',
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
    gap: 1,
  },
  commsChannelRowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachingShellListTitle: {
    color: '#404858',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  commsUnreadBadge: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commsUnreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  coachingShellListSubText: {
    color: '#6f7e93',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  coachingShellSearchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#2f3442',
    fontSize: 12,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  commsHubSearchWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe5ef',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  commsHubSearchIcon: {
    color: '#7b889a',
    fontSize: 12,
    fontWeight: '700',
  },
  coachingShellChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
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
    borderRadius: 12,
    backgroundColor: '#f6f8fc',
    borderWidth: 1,
    borderColor: '#e2e8f2',
    padding: 12,
    gap: 10,
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
  coachingShellInputGhostText: {
    color: '#9aa3b0',
    fontSize: 11,
  },
  coachingThreadMessagesList: {
    gap: 5,
    maxHeight: 260,
  },
  coachingThreadMessageBubble: {
    borderRadius: 14,
    backgroundColor: '#f4f6fa',
    borderWidth: 1,
    borderColor: '#e1e7f0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
    alignSelf: 'flex-start',
    maxWidth: '86%',
  },
  coachingThreadMessageBubbleMine: {
    backgroundColor: '#edf4ff',
    borderColor: '#cfe0ff',
    alignSelf: 'flex-end',
  },
  coachingThreadMessageBubbleStart: {
    marginTop: 4,
  },
  coachingThreadMessageBubbleFollow: {
    marginTop: 1,
  },
  coachingThreadMessageMeta: {
    color: '#6d7b91',
    fontSize: 10,
    fontWeight: '700',
  },
  coachingThreadMessageMetaFollow: {
    fontSize: 9,
    color: '#8b96a8',
    fontWeight: '600',
  },
  coachingThreadMessageBody: {
    color: '#384456',
    fontSize: 12,
    lineHeight: 17,
  },
  coachingThreadComposerWrap: {
    gap: 9,
  },
  coachingThreadComposerInput: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dfe5ef',
    backgroundColor: '#fff',
    color: '#2f3442',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  coachingThreadComposerInputTall: {
    minHeight: 94,
  },
  commsComposerActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commsComposerGhostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e0ee',
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commsComposerGhostBtnText: {
    color: '#55647a',
    fontSize: 11,
    fontWeight: '800',
  },
  commsComposerSendBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f5fe2',
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commsComposerSendBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
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
  challengeSectionCardCompact: {
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 7,
  },
  challengeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeSectionHeaderCompact: {
    gap: 6,
  },
  challengeSectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  challengeSectionHeaderCopyCompact: {
    gap: 3,
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
  challengeSectionTitleCompact: {
    fontSize: 13,
  },
  challengeSectionCount: {
    color: '#7a879a',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeSectionCountCompact: {
    fontSize: 10,
  },
  challengeSectionSub: {
    color: '#798496',
    fontSize: 11,
    lineHeight: 14,
  },
  challengeSectionSubCompact: {
    fontSize: 10,
    lineHeight: 12,
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
  challengeGridWrapCompact: {
    rowGap: 6,
    justifyContent: 'space-between',
    columnGap: 0,
  },
  challengeGridItem: {
    gap: 4,
  },
  challengeGridItemCompact: {
    gap: 2,
    width: '24%',
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
  gameplayHeader: {
    gap: 4,
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
  modeRailContent: {
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
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
  boostInactive: {
    opacity: 0.55,
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
  avatarGlobalWrap: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 1600,
    elevation: 20,
  },
  avatarText: {
    color: '#1f5fe2',
    fontSize: 12,
    fontWeight: '700',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
    paddingBottom: 0,
  },
  gridItem: {
    width: '24%',
    alignItems: 'center',
    gap: 2,
  },
  gridTileAnimatedWrap: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  gridCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridCircleWrap: {
    width: 80,
    height: 80,
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
  fxProjectile: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 40,
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
  // ── Coach Tab Styles ──
  cwfEmpty: {
    fontSize: 13,
    color: '#888',
    paddingVertical: 16,
    textAlign: 'center' as const,
  },
  cwfJourneyMembersWrap: {
    marginTop: 16,
    marginBottom: 8,
  },
  cwfJourneyMembersHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  cwfJourneyMembersTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1a1a2e',
  },
  cwfJourneyMembersBroadcastBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#fef0e1',
  },
  cwfJourneyMembersBroadcastText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#c46200',
  },
  cwfJourneyMemberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  cwfJourneyMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
  },
  cwfJourneyMemberAvatarText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  cwfJourneyMemberInfo: {
    flex: 1,
  },
  cwfJourneyMemberName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  cwfJourneyMemberRole: {
    fontSize: 12,
    color: '#888',
  },
  cwfJourneyMemberChevron: {
    fontSize: 18,
    color: '#ccc',
    marginLeft: 4,
  },
  /* ── Journey Builder styles ── */
  /* jbReorder ▲/▼ styles removed – replaced by JbGrip tap-to-pick/drop component */
  inviteCodeEntryBtn: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#b8c9eb',
    backgroundColor: '#f5f9ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteCodeEntryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#355ca8',
  },
});
