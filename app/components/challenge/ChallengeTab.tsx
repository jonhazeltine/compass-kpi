import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KpiIcon } from '../../components/kpi';
import type {
  BottomTab,
  ChallengeApiRow,
  ChallengeFlowItem,
  ChallengeFlowLeaderboardEntry,
  ChallengeGoalScope,
  ChallengeKind,
  ChallengeListFilter,
  ChallengeStateTab,
  ChallengeTemplateRow,
  ChallengeWizardGoalDraft,
  ChallengeWizardStep,
  CoachTabScreen,
  DashboardPayload,
  TeamDirectoryMember,
  ViewMode,
} from '../../screens/kpi-dashboard/types';
import { isApiBackedChallenge, kpiTypeAccent } from '../../screens/kpi-dashboard/helpers';

// ── Re-defined locally (same logic as monolith module-level fn) ──────
function renderKpiIcon(kpi: DashboardPayload['loggable_kpis'][number]) {
  return <KpiIcon kpi={kpi} size={76} backgroundColor="transparent" color={kpiTypeAccent(kpi.type)} />;
}

export interface ChallengeTabProps {
  // From ChallengeWorkflowState
  challengeApiRows: ChallengeApiRow[] | null;
  challengeApiFetchError: string | null;
  challengeFlowScreen: 'explore' | 'list' | 'details' | 'leaderboard';
  challengeListFilter: ChallengeListFilter;
  challengeStateTab: ChallengeStateTab;
  challengeSelectedId: string;
  challengeJoinSubmittingId: string | null;
  challengeLeaveSubmittingId: string | null;
  challengeJoinError: string | null;
  challengeLeaveError: string | null;
  challengePreviewItem: ChallengeFlowItem | null;
  challengeKpiDrillItem: { key: string; label: string; type: string } | null;
  challengeWizardVisible: boolean;
  challengeWizardStep: ChallengeWizardStep;
  challengeWizardSource: 'template' | 'custom';
  challengeWizardType: ChallengeKind;
  challengeWizardName: string;
  challengeWizardDescription: string;
  challengeWizardStartAt: string;
  challengeWizardEndAt: string;
  challengeWizardTemplateId: string | null;
  challengeWizardGoals: ChallengeWizardGoalDraft[];
  challengeWizardInviteUserIds: string[];
  challengeWizardTemplates: ChallengeTemplateRow[];
  challengeWizardLoadingTemplates: boolean;
  challengeWizardTemplateError: string | null;
  challengeWizardSubmitting: boolean;
  challengeWizardError: string | null;
  teamChallengesSegment: 'active' | 'completed';
  challengeListItems: ChallengeFlowItem[];
  challengeHasSponsorSignal: boolean;
  challengeScopedListItems: ChallengeFlowItem[];
  challengeCurrentStateRows: ChallengeFlowItem[];
  challengeListUsingPlaceholderRows: boolean;
  challengeWizardFallbackTemplates: ChallengeTemplateRow[];
  challengeSelected: ChallengeFlowItem;
  challengeScopedKpis: DashboardPayload['loggable_kpis'];
  challengeScopedKpiGroups: { PC: DashboardPayload['loggable_kpis']; GP: DashboardPayload['loggable_kpis']; VP: DashboardPayload['loggable_kpis'] };
  challengeIsCompleted: boolean;
  challengeHasApiBackedDetail: boolean;
  challengeIsPlaceholderOnly: boolean;
  challengeLeaderboardHasRealRows: boolean;
  challengeKpiSummaryCards: Array<{ key: string; label: string; value: number }>;
  // From ChallengeWorkflowActions
  setChallengeFlowScreen: React.Dispatch<React.SetStateAction<'explore' | 'list' | 'details' | 'leaderboard'>>;
  setChallengeListFilter: React.Dispatch<React.SetStateAction<ChallengeListFilter>>;
  setChallengeStateTab: React.Dispatch<React.SetStateAction<ChallengeStateTab>>;
  setChallengeSelectedId: React.Dispatch<React.SetStateAction<string>>;
  setChallengePreviewItem: React.Dispatch<React.SetStateAction<ChallengeFlowItem | null>>;
  setChallengeKpiDrillItem: React.Dispatch<React.SetStateAction<{ key: string; label: string; type: string } | null>>;
  setChallengeWizardVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setChallengeWizardStep: React.Dispatch<React.SetStateAction<ChallengeWizardStep>>;
  setChallengeWizardSource: React.Dispatch<React.SetStateAction<'template' | 'custom'>>;
  setChallengeWizardType: React.Dispatch<React.SetStateAction<ChallengeKind>>;
  setChallengeWizardName: React.Dispatch<React.SetStateAction<string>>;
  setChallengeWizardDescription: React.Dispatch<React.SetStateAction<string>>;
  setChallengeWizardStartAt: React.Dispatch<React.SetStateAction<string>>;
  setChallengeWizardEndAt: React.Dispatch<React.SetStateAction<string>>;
  setChallengeWizardTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
  setChallengeWizardGoals: React.Dispatch<React.SetStateAction<ChallengeWizardGoalDraft[]>>;
  setChallengeWizardInviteUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  setChallengeWizardTemplates: React.Dispatch<React.SetStateAction<ChallengeTemplateRow[]>>;
  setChallengeWizardError: React.Dispatch<React.SetStateAction<string | null>>;
  joinChallenge: (challengeId: string) => Promise<void>;
  leaveChallenge: (challengeId: string) => Promise<void>;
  openChallengeWizard: (requestedKind?: ChallengeKind) => void;
  applyChallengeWizardTemplate: (templateId: string | null) => void;
  submitChallengeWizard: () => Promise<void>;
  buildChallengeWizardGoalDrafts: (sourceRows: Array<{
    kpi_id: string;
    label: string;
    goal_scope_default: ChallengeGoalScope;
    suggested_target: number | null;
    display_order: number;
  }>) => ChallengeWizardGoalDraft[];
  // Orchestrator-computed props
  isSoloPersona: boolean;
  coachTabDefault: CoachTabScreen;
  setCoachTabScreen: React.Dispatch<React.SetStateAction<CoachTabScreen>>;
  setActiveTab: React.Dispatch<React.SetStateAction<BottomTab>>;
  showPaywall: (title: string, message: string, plan: string) => void;
  entitlementNumber: (key: string, fallback: number) => number;
  handleOpenInviteCodeEntry: () => void;
  challengeCreateAllowed: boolean;
  challengeDaysLeft: number;
  challengeLeaderboardPreview: ChallengeFlowLeaderboardEntry[];
  challengeLeaderboardRowsForScreen: ChallengeFlowLeaderboardEntry[];
  challengeLeaderboardHasLowEntry: boolean;
  challengeTeamCumulativeProgressPct: number;
  challengeTileCount: number;
  teamMemberDirectory: TeamDirectoryMember[];
  // KPI tile rendering helpers
  getKpiTileScale: (kpiId: string) => Animated.Value;
  getKpiTileSuccessAnim: (kpiId: string) => Animated.Value;
  runKpiTilePressInFeedback: (kpi: DashboardPayload['loggable_kpis'][number], options?: { surface?: 'home' | 'log' }) => void;
  runKpiTilePressOutFeedback: (kpiId: string) => void;
  confirmedKpiTileIds: Record<string, true>;
  // Additional orchestrator props
  allSelectableKpis: DashboardPayload['loggable_kpis'];
  challengeDetailsSurfaceLabel: string;
  challengeMemberResultsRequiresUpgrade: boolean;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  onTapQuickLog: (
    kpi: DashboardPayload['loggable_kpis'][number],
    options?: {
      skipTapFeedback?: boolean;
      skipOptimisticProjectionLaunch?: boolean;
      sourcePagePoint?: { x: number; y: number } | null;
    }
  ) => Promise<void>;
  renderKnownLimitedDataChip: (label: string) => React.ReactElement | null;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  submitting: boolean;
  submittingKpiId: string | null;
}

export default function ChallengeTab({
  challengeApiRows,
  challengeApiFetchError,
  challengeFlowScreen,
  challengeListFilter,
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
  challengeListItems,
  challengeHasSponsorSignal,
  challengeScopedListItems,
  challengeCurrentStateRows,
  challengeListUsingPlaceholderRows,
  challengeWizardFallbackTemplates,
  challengeSelected,
  challengeScopedKpis,
  challengeScopedKpiGroups,
  challengeIsCompleted,
  challengeHasApiBackedDetail,
  challengeIsPlaceholderOnly,
  challengeLeaderboardHasRealRows,
  challengeKpiSummaryCards,
  setChallengeFlowScreen,
  setChallengeListFilter,
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
  joinChallenge,
  leaveChallenge,
  openChallengeWizard,
  applyChallengeWizardTemplate,
  submitChallengeWizard,
  buildChallengeWizardGoalDrafts,
  isSoloPersona,
  coachTabDefault,
  setCoachTabScreen,
  setActiveTab,
  showPaywall,
  entitlementNumber,
  handleOpenInviteCodeEntry,
  challengeCreateAllowed,
  challengeDaysLeft,
  challengeLeaderboardPreview,
  challengeLeaderboardRowsForScreen,
  challengeLeaderboardHasLowEntry,
  challengeTeamCumulativeProgressPct,
  challengeTileCount,
  teamMemberDirectory,
  getKpiTileScale,
  getKpiTileSuccessAnim,
  runKpiTilePressInFeedback,
  runKpiTilePressOutFeedback,
  confirmedKpiTileIds,
  allSelectableKpis,
  challengeDetailsSurfaceLabel,
  challengeMemberResultsRequiresUpgrade,
  gpUnlocked,
  vpUnlocked,
  onTapQuickLog,
  renderKnownLimitedDataChip,
  setViewMode,
  submitting,
  submittingKpiId,
}: ChallengeTabProps) {
  return (
<>
    {!isSoloPersona ? (
      <TouchableOpacity
        style={styles.coachChallengesBackBtn}
        onPress={() => {
          setCoachTabScreen(coachTabDefault);
          setActiveTab('coach');
        }}
      >
        <Text style={styles.coachChallengesBackText}>← Back to Coach</Text>
      </TouchableOpacity>
    ) : null}
              {!isSoloPersona ? (
  <View style={styles.teamChallengeTopTabsRow}>
    <TouchableOpacity style={styles.teamChallengeTopTab} onPress={() => setActiveTab('team')}>
      <Text style={styles.teamChallengeTopTabText}>Team</Text>
    </TouchableOpacity>
    <View style={[styles.teamChallengeTopTab, styles.teamChallengeTopTabActive]}>
      <Text style={[styles.teamChallengeTopTabText, styles.teamChallengeTopTabTextActive]}>Challenges</Text>
    </View>
  </View>
              ) : null}
              {challengeFlowScreen === 'explore' ? (
  <View style={styles.challengeExploreShell}>
    <View style={styles.challengeExploreHero}>
      <Text style={styles.challengeExploreEyebrow}>CHALLENGE MODE</Text>
      <Text style={styles.challengeExploreTitle}>Find Your Next Challenge</Text>
      <Text style={styles.challengeExploreSub}>
        Join sponsored and community challenges now. Start your own challenge in seconds.
      </Text>
      <TouchableOpacity
        style={styles.challengeExploreStartBtn}
        onPress={() => {
          if (!challengeCreateAllowed) {
            showPaywall('Challenge hosting locked', 'Upgrade to start challenges and invite your network.', 'pro');
            return;
          }
          openChallengeWizard('mini');
        }}
      >
        <Text style={styles.challengeExploreStartBtnText}>Start a Challenge</Text>
      </TouchableOpacity>
      {isSoloPersona ? (
        <TouchableOpacity style={styles.inviteCodeEntryBtn} onPress={handleOpenInviteCodeEntry}>
          <Text style={styles.inviteCodeEntryBtnText}>Enter Invite Code</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.challengeExploreLimitText}>
        Invite cap: {Math.max(0, entitlementNumber('challenge_invite_limit', 3))}
      </Text>
    </View>
    <View style={styles.challengeExploreSection}>
      <Text style={styles.challengeExploreSectionTitle}>Browse Available Challenges</Text>
      {challengeScopedListItems.slice(0, 6).map((item) => (
        <TouchableOpacity
          key={`explore-${item.id}`}
          style={styles.challengeListItemCard}
          activeOpacity={0.75}
          onPress={() => setChallengePreviewItem(item)}
        >
          <View style={styles.challengeListItemTopRow}>
            <Text numberOfLines={1} style={styles.challengeListItemTitle}>{item.title}</Text>
            <Text style={styles.challengeListItemMetaText}>{item.daysLabel}</Text>
          </View>
          <Text numberOfLines={1} style={styles.challengeListItemSub}>{item.subtitle}</Text>
          <View style={styles.challengeListItemProgressTrack}>
            <View style={[styles.challengeListItemProgressFill, { width: `${Math.min(100, Math.max(0, item.progressPct))}%` }]} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  </View>
              ) : challengeFlowScreen === 'list' ? (
  <>
    <View style={styles.challengeListShell}>
      {/* ── Hero Card (replaces old header) ── */}
      <View style={styles.challengeHeroCard}>
        <View style={styles.challengeHeroAccent} />
        <View style={styles.challengeHeroBody}>
          <View style={styles.challengeHeroTopRow}>
            <Text style={styles.challengeHeroEyebrow}>
              {challengeStateTab === 'active' ? '🏆 Active Challenges' : challengeStateTab === 'upcoming' ? '📅 Upcoming' : '✅ Completed'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.challengeHeroCount}>{challengeCurrentStateRows.length}</Text>
              {isSoloPersona ? (
                <TouchableOpacity
                  style={styles.challengeListCreateBtn}
                  onPress={handleOpenInviteCodeEntry}
                >
                  <Text style={styles.challengeListCreateBtnText}>Code</Text>
                </TouchableOpacity>
              ) : null}
              {challengeCreateAllowed ? (
                <TouchableOpacity
                  style={styles.challengeListCreateBtn}
                  onPress={() => {
                    openChallengeWizard(isSoloPersona ? 'mini' : 'team');
                  }}
                >
                  <Text style={styles.challengeListCreateBtnText}>Create</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Text style={styles.challengeHeroTitle}>
            {challengeStateTab === 'active'
              ? 'Compete, track, and win'
              : challengeStateTab === 'upcoming'
                ? 'Coming up next'
                : 'Completed challenge results'}
          </Text>
          <Text style={styles.challengeHeroSub}>
            {challengeStateTab === 'active'
              ? 'Tap a challenge to preview or open your progress.'
              : challengeStateTab === 'upcoming'
                ? 'Preview upcoming challenges and join early.'
                : 'Review completed challenge results and rankings.'}
          </Text>
        </View>
      </View>
      <View style={styles.challengeMemberSegmentRow}>
        {([
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
        ] as const).map((tab) => {
          const active = challengeStateTab === tab.key;
          return (
            <TouchableOpacity
              key={`challenge-state-tab-${tab.key}`}
              style={[styles.challengeMemberSegmentPill, active && styles.challengeMemberSegmentPillActive]}
              onPress={() => setChallengeStateTab(tab.key)}
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
      {challengeApiFetchError
        ? renderKnownLimitedDataChip('live challenge list unavailable')
        : challengeListUsingPlaceholderRows
          ? renderKnownLimitedDataChip('preview rows only')
          : null}

      <View style={styles.challengeListFilterRow}>
        {([
          { key: 'all', label: 'All' },
          ...(!isSoloPersona ? ([{ key: 'team', label: 'Team' }] as const) : []),
          { key: 'mini', label: 'Mini' },
          { key: 'sponsored', label: 'Sponsored' },
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
      {challengeListFilter === 'sponsored' && !challengeHasSponsorSignal
        ? renderKnownLimitedDataChip('sponsor flag coverage')
        : null}

      <View style={styles.challengeListCardStack}>
        {/* ── Simplified Challenge Cards ── */}
        {challengeCurrentStateRows.length > 0 ? (
          challengeCurrentStateRows.map((item) => (
            <TouchableOpacity
              key={`challenge-card-${item.id}`}
              style={[
                styles.challengeListItemCard,
                item.challengeKind === 'sponsored' && styles.challengeListItemCardSponsored,
              ]}
              activeOpacity={0.7}
              onPress={() => {
                if (item.joined) {
                  setChallengeSelectedId(item.id);
                  setChallengeFlowScreen('details');
                } else {
                  setChallengePreviewItem(item);
                }
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
              <Text numberOfLines={1} style={styles.challengeListItemSub}>{item.subtitle}</Text>
              {item.challengeKind === 'sponsored' ? (
                <View style={styles.challengeSponsoredMetaRow}>
                  <Text style={styles.challengeSponsoredMetaLabel}>Sponsored</Text>
                  <Text style={styles.challengeSponsoredMetaSub}>Featured challenge card</Text>
                </View>
              ) : null}
              <View style={styles.challengeListItemMetaRow}>
                <Text style={styles.challengeListItemMetaText}>{item.timeframe}</Text>
                <Text style={styles.challengeListItemMetaText}>{item.daysLabel}</Text>
              </View>
              <View style={styles.challengeListItemProgressTrack}>
                <View style={[styles.challengeListItemProgressFill, { width: `${Math.min(100, Math.max(0, item.progressPct))}%` }]} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.challengeListEmptyFilterCard}>
            <Text style={styles.challengeListEmptyFilterTitle}>No challenges in this state</Text>
            <Text style={styles.challengeListEmptyFilterSub}>
              {challengeStateTab === 'active'
                ? 'No active challenges are available right now.'
                : challengeStateTab === 'upcoming'
                  ? 'No upcoming challenges are scheduled for this account.'
                  : 'No completed challenge rows are available yet.'}
            </Text>
          </View>
        )}
      </View>
    </View>

    {/* ── Challenge Preview Bottom Drawer ── */}
    <Modal
      visible={challengePreviewItem !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setChallengePreviewItem(null)}
    >
      <Pressable style={styles.challengeDrawerBackdrop} onPress={() => setChallengePreviewItem(null)}>
        <Pressable style={styles.challengeDrawerSheet} onPress={() => {}}>
          <View style={styles.challengeDrawerHandle} />
          {challengePreviewItem ? (
            <>
              <Text style={styles.challengeDrawerTitle}>{challengePreviewItem.title}</Text>
              <Text style={styles.challengeDrawerSub}>{challengePreviewItem.subtitle}</Text>
              <View style={styles.challengeDrawerMetaRow}>
                <Text style={styles.challengeDrawerMetaText}>📅 {challengePreviewItem.timeframe}</Text>
                <Text style={styles.challengeDrawerMetaText}>{challengePreviewItem.daysLabel}</Text>
              </View>
              <View style={styles.challengeDrawerDivider} />
              <Text style={styles.challengeDrawerSectionTitle}>KPIs Tracked</Text>
              <View style={styles.challengeDrawerKpiRow}>
                {challengeKpiSummaryCards.map((card) => (
                  <View key={`drawer-kpi-${card.key}`} style={styles.challengeDrawerKpiChip}>
                    <Text style={styles.challengeDrawerKpiValue}>{card.value}</Text>
                    <Text style={styles.challengeDrawerKpiLabel}>{card.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.challengeDrawerDivider} />
              <View style={styles.challengeDrawerFootRow}>
                <Text style={styles.challengeDrawerFootMeta}>
                  {challengePreviewItem.participants} participant{challengePreviewItem.participants === 1 ? '' : 's'} · {challengePreviewItem.challengeModeLabel}
                </Text>
              </View>
              {(() => {
                const canJoin =
                  isApiBackedChallenge(challengePreviewItem) &&
                  !challengePreviewItem.joined &&
                  challengePreviewItem.bucket !== 'completed';
                const isSubmitting = challengeJoinSubmittingId === challengePreviewItem.id;
                return canJoin ? (
                  <TouchableOpacity
                    style={[styles.challengeDrawerJoinBtn, isSubmitting && styles.disabled]}
                    disabled={isSubmitting}
                    onPress={() => {
                      void joinChallenge(challengePreviewItem.id);
                      setChallengePreviewItem(null);
                    }}
                  >
                    <Text style={styles.challengeDrawerJoinBtnText}>{isSubmitting ? 'Joining…' : 'Join Challenge'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.challengeDrawerViewBtn}
                    onPress={() => {
                      setChallengeSelectedId(challengePreviewItem.id);
                      setChallengeFlowScreen('details');
                      setChallengePreviewItem(null);
                    }}
                  >
                    <Text style={styles.challengeDrawerViewBtnText}>View Details</Text>
                  </TouchableOpacity>
                );
              })()}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>

    {/* V1 wizard removed — replaced by full-screen ChallengeWizard in wizard/ */}
    {false ? (
      <Modal
        visible={false}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <Pressable
          style={styles.challengeMemberCreateModalBackdrop}
          onPress={() => {
            if (challengeWizardSubmitting) return;
            setChallengeWizardVisible(false);
          }}
        >
          <Pressable style={styles.challengeMemberCreateModalCard} onPress={() => {}}>
            {(() => {
              const stepOrder: ChallengeWizardStep[] = ['source', 'basics', 'kpis', 'audience', 'review'];
              const stepIndex = stepOrder.indexOf(challengeWizardStep);
              const isFirst = stepIndex <= 0;
              const isLast = stepIndex >= stepOrder.length - 1;
              const stepLabel = `${Math.max(1, stepIndex + 1)} / ${stepOrder.length}`;
              const currentTemplate =
                challengeWizardTemplates.find((row) => row.id === challengeWizardTemplateId) ??
                challengeWizardFallbackTemplates.find((row) => row.id === challengeWizardTemplateId) ??
                null;
              const moveStep = (direction: 'back' | 'next') => {
                if (challengeWizardSubmitting) return;
                if (direction === 'back') {
                  if (isFirst) {
                    setChallengeWizardVisible(false);
                    return;
                  }
                  setChallengeWizardStep(stepOrder[Math.max(0, stepIndex - 1)]);
                  return;
                }
                if (challengeWizardStep === 'source') {
                  if (challengeWizardSource === 'template' && !challengeWizardTemplateId) {
                    setChallengeWizardError('Choose a template or switch to Custom.');
                    return;
                  }
                  if (challengeWizardSource === 'template' && challengeWizardTemplateId) {
                    applyChallengeWizardTemplate(challengeWizardTemplateId);
                  }
                }
                if (challengeWizardStep === 'kpis' && challengeWizardGoals.length === 0) {
                  setChallengeWizardError('Add at least one KPI goal.');
                  return;
                }
                if (challengeWizardStep === 'audience' && challengeWizardType === 'mini' && challengeWizardInviteUserIds.length > 3) {
                  setChallengeWizardError('Mini challenges can include up to 3 invited participants.');
                  return;
                }
                if (isLast) {
                  void submitChallengeWizard();
                  return;
                }
                setChallengeWizardError(null);
                setChallengeWizardStep(stepOrder[Math.min(stepOrder.length - 1, stepIndex + 1)]);
              };
              return (
                <>
                  <View style={styles.challengeWizardHeaderRow}>
                    <Text style={styles.challengeMemberCreateModalTitle}>Challenge Setup Wizard</Text>
                    <Text style={styles.challengeWizardStepPill}>{stepLabel}</Text>
                  </View>
                  <Text style={styles.challengeWizardSub}>
                    {challengeWizardType === 'team'
                      ? 'Team challenge setup: one active + one upcoming, no date overlap.'
                      : 'Mini challenge setup: invite up to 3 participants.'}
                  </Text>

                  {challengeWizardStep === 'source' ? (
                    <View style={styles.challengeWizardSection}>
                      <Text style={styles.challengeWizardSectionTitle}>1) Choose Source</Text>
                      <View style={styles.challengeMemberCreateModeGrid}>
                        {([
                          { key: 'template', label: 'Template', icon: '🧩' },
                          { key: 'custom', label: 'Custom', icon: '✍️' },
                        ] as const).map((option) => {
                          const active = challengeWizardSource === option.key;
                          return (
                            <TouchableOpacity
                              key={`wizard-source-${option.key}`}
                              style={[
                                styles.challengeMemberCreateModeCard,
                                active && styles.challengeMemberCreateModeCardActive,
                              ]}
                              onPress={() => {
                                setChallengeWizardSource(option.key);
                                if (option.key === 'custom') {
                                  setChallengeWizardTemplateId(null);
                                  setChallengeWizardGoals(
                                    buildChallengeWizardGoalDrafts(
                                      allSelectableKpis.slice(0, 4).map((kpi, idx) => ({
                                        kpi_id: String(kpi.id),
                                        label: String(kpi.name),
                                        goal_scope_default: kpi.type === 'PC' ? 'team' : 'individual',
                                        suggested_target: null,
                                        display_order: idx,
                                      }))
                                    )
                                  );
                                }
                              }}
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
                      <View style={styles.challengeWizardTypeRow}>
                        {([
                          ...(isSoloPersona ? ([] as const) : ([{ key: 'team', label: 'Team' }] as const)),
                          { key: 'mini', label: 'Mini' },
                        ] as const).map((option) => {
                          const active = challengeWizardType === option.key;
                          return (
                            <TouchableOpacity
                              key={`wizard-kind-${option.key}`}
                              style={[styles.challengeWizardTypeChip, active && styles.challengeWizardTypeChipActive]}
                              onPress={() => {
                                if (isSoloPersona && option.key === 'team') return;
                                setChallengeWizardType(option.key);
                              }}
                            >
                              <Text style={[styles.challengeWizardTypeChipText, active && styles.challengeWizardTypeChipTextActive]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {challengeWizardSource === 'template' ? (
                        <View style={styles.challengeWizardTemplateStack}>
                          {challengeWizardLoadingTemplates ? (
                            <ActivityIndicator size="small" color="#2f6bff" />
                          ) : (
                            (challengeWizardTemplates.length > 0 ? challengeWizardTemplates : challengeWizardFallbackTemplates).map((template) => {
                              const active = challengeWizardTemplateId === template.id;
                              return (
                                <TouchableOpacity
                                  key={`wizard-template-${template.id}`}
                                  style={[styles.challengeWizardTemplateCard, active && styles.challengeWizardTemplateCardActive]}
                                  onPress={() => setChallengeWizardTemplateId(template.id)}
                                >
                                  <Text style={styles.challengeWizardTemplateTitle}>{template.title}</Text>
                                  {template.description ? <Text style={styles.challengeWizardTemplateSub}>{template.description}</Text> : null}
                                  <Text style={styles.challengeWizardTemplateHint}>
                                    {`${template.suggested_duration_days} day${template.suggested_duration_days === 1 ? '' : 's'}`}
                                    {template.phase_count > 0 ? ` · ${template.phase_count} phase${template.phase_count !== 1 ? 's' : ''}` : ''}
                                    {template.kpi_defaults.length > 0 ? ` · ${template.kpi_defaults.slice(0, 4).map((k) => k.label).join(', ')}` : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {challengeWizardStep === 'basics' ? (
                    <View style={styles.challengeWizardSection}>
                      <Text style={styles.challengeWizardSectionTitle}>2) Basics</Text>
                      <TextInput
                        value={challengeWizardName}
                        onChangeText={setChallengeWizardName}
                        placeholder="Challenge name"
                        placeholderTextColor="#8ba0c3"
                        style={styles.challengeWizardInput}
                      />
                      <TextInput
                        value={challengeWizardDescription}
                        onChangeText={setChallengeWizardDescription}
                        placeholder="Description (optional)"
                        placeholderTextColor="#8ba0c3"
                        style={[styles.challengeWizardInput, styles.challengeWizardInputMultiline]}
                        multiline
                      />
                      <View style={styles.challengeWizardDateRow}>
                        <TextInput
                          value={challengeWizardStartAt}
                          onChangeText={setChallengeWizardStartAt}
                          placeholder="Start (YYYY-MM-DD)"
                          placeholderTextColor="#8ba0c3"
                          style={[styles.challengeWizardInput, styles.challengeWizardDateInput]}
                          autoCapitalize="none"
                        />
                        <TextInput
                          value={challengeWizardEndAt}
                          onChangeText={setChallengeWizardEndAt}
                          placeholder="End (YYYY-MM-DD)"
                          placeholderTextColor="#8ba0c3"
                          style={[styles.challengeWizardInput, styles.challengeWizardDateInput]}
                          autoCapitalize="none"
                        />
                      </View>
                      <Text style={styles.challengeWizardHint}>
                        Team challenges must not overlap existing team challenge dates.
                      </Text>
                    </View>
                  ) : null}

                  {challengeWizardStep === 'kpis' ? (
                    <View style={styles.challengeWizardSection}>
                      <Text style={styles.challengeWizardSectionTitle}>3) KPI Goals</Text>
                      <Text style={styles.challengeWizardHint}>Set per-KPI scope and optional target values.</Text>
                      <ScrollView style={styles.challengeWizardGoalScroll} contentContainerStyle={styles.challengeWizardGoalStack}>
                        {challengeWizardGoals.map((goal, idx) => (
                          <View key={`wizard-goal-${goal.kpi_id}-${idx}`} style={styles.challengeWizardGoalRow}>
                            <View style={styles.challengeWizardGoalCopy}>
                              <Text style={styles.challengeWizardGoalLabel}>{goal.label}</Text>
                              <Text style={styles.challengeWizardGoalSub}>KPI goal #{idx + 1}</Text>
                            </View>
                            <View style={styles.challengeWizardGoalControls}>
                              <TouchableOpacity
                                style={[
                                  styles.challengeWizardGoalScopeChip,
                                  goal.goal_scope === 'team' && styles.challengeWizardGoalScopeChipActive,
                                ]}
                                onPress={() =>
                                  setChallengeWizardGoals((prev) =>
                                    prev.map((row, rowIdx) =>
                                      rowIdx === idx ? { ...row, goal_scope: 'team' } : row
                                    )
                                  )
                                }
                              >
                                <Text
                                  style={[
                                    styles.challengeWizardGoalScopeChipText,
                                    goal.goal_scope === 'team' && styles.challengeWizardGoalScopeChipTextActive,
                                  ]}
                                >
                                  Team
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.challengeWizardGoalScopeChip,
                                  goal.goal_scope === 'individual' && styles.challengeWizardGoalScopeChipActive,
                                ]}
                                onPress={() =>
                                  setChallengeWizardGoals((prev) =>
                                    prev.map((row, rowIdx) =>
                                      rowIdx === idx ? { ...row, goal_scope: 'individual' } : row
                                    )
                                  )
                                }
                              >
                                <Text
                                  style={[
                                    styles.challengeWizardGoalScopeChipText,
                                    goal.goal_scope === 'individual' && styles.challengeWizardGoalScopeChipTextActive,
                                  ]}
                                >
                                  Individual
                                </Text>
                              </TouchableOpacity>
                              <TextInput
                                value={goal.goal_target}
                                onChangeText={(value) =>
                                  setChallengeWizardGoals((prev) =>
                                    prev.map((row, rowIdx) =>
                                      rowIdx === idx ? { ...row, goal_target: value.replace(/[^0-9.]/g, '') } : row
                                    )
                                  )
                                }
                                placeholder="Target"
                                placeholderTextColor="#8ba0c3"
                                keyboardType="numeric"
                                style={styles.challengeWizardGoalTargetInput}
                              />
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {challengeWizardStep === 'audience' ? (
                    <View style={styles.challengeWizardSection}>
                      <Text style={styles.challengeWizardSectionTitle}>4) Audience</Text>
                      {challengeWizardType === 'team' ? (
                        <View style={styles.challengeWizardAudienceCard}>
                          <Text style={styles.challengeWizardAudienceTitle}>Team-wide enrollment path</Text>
                          <Text style={styles.challengeWizardAudienceSub}>
                            Team members can join from Team Challenges. One active and one upcoming slot are enforced.
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.challengeWizardHint}>
                            Select up to 3 invitees. Mini challenge can still launch without invites.
                          </Text>
                          <View style={styles.challengeWizardAudienceList}>
                            {teamMemberDirectory.slice(0, 8).map((member) => {
                              const userId = String(member.userId ?? '').trim();
                              const active = userId.length > 0 && challengeWizardInviteUserIds.includes(userId);
                              return (
                                <TouchableOpacity
                                  key={`wizard-audience-${member.id}`}
                                  style={[styles.challengeWizardAudienceRow, active && styles.challengeWizardAudienceRowActive]}
                                  onPress={() => {
                                    if (!userId) return;
                                    setChallengeWizardInviteUserIds((prev) => {
                                      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
                                      if (prev.length >= 3) return prev;
                                      return [...prev, userId];
                                    });
                                  }}
                                >
                                  <Text style={styles.challengeWizardAudienceRowName}>{member.name}</Text>
                                  <Text style={styles.challengeWizardAudienceRowState}>{active ? 'Invited' : 'Invite'}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      )}
                    </View>
                  ) : null}

                  {challengeWizardStep === 'review' ? (
                    <View style={styles.challengeWizardSection}>
                      <Text style={styles.challengeWizardSectionTitle}>5) Review & Launch</Text>
                      <View style={styles.challengeWizardReviewCard}>
                        <Text style={styles.challengeWizardReviewTitle}>{challengeWizardName || 'Untitled challenge'}</Text>
                        <Text style={styles.challengeWizardReviewSub}>
                          {challengeWizardType === 'team' ? 'Team Challenge' : 'Mini Challenge'} · {challengeWizardStartAt} to {challengeWizardEndAt}
                        </Text>
                        <Text style={styles.challengeWizardReviewMeta}>
                          Source: {challengeWizardSource === 'template' ? (currentTemplate?.title ?? 'Template') : 'Custom'}
                        </Text>
                        <Text style={styles.challengeWizardReviewMeta}>
                          KPI goals: {challengeWizardGoals.length} ({challengeWizardGoals.filter((row) => row.goal_scope === 'team').length} team / {challengeWizardGoals.filter((row) => row.goal_scope === 'individual').length} individual)
                        </Text>
                        {challengeWizardType === 'mini' ? (
                          <Text style={styles.challengeWizardReviewMeta}>
                            Invites: {challengeWizardInviteUserIds.length} / 3
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {challengeWizardTemplateError ? (
                    <Text style={styles.challengeWizardInfoText}>{challengeWizardTemplateError}</Text>
                  ) : null}
                  {challengeWizardError ? (
                    <Text style={styles.challengeWizardErrorText}>{challengeWizardError}</Text>
                  ) : null}

                  <View style={styles.challengeWizardFooterRow}>
                    <TouchableOpacity
                      style={styles.challengeWizardFooterSecondaryBtn}
                      onPress={() => moveStep('back')}
                      disabled={challengeWizardSubmitting}
                    >
                      <Text style={styles.challengeWizardFooterSecondaryBtnText}>{isFirst ? 'Close' : 'Back'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.challengeWizardFooterPrimaryBtn, challengeWizardSubmitting && styles.disabled]}
                      onPress={() => moveStep('next')}
                      disabled={challengeWizardSubmitting}
                    >
                      <Text style={styles.challengeWizardFooterPrimaryBtnText}>
                        {challengeWizardSubmitting ? 'Saving…' : isLast ? 'Launch Challenge' : 'Continue'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
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
          onPress={() => setChallengeFlowScreen(isSoloPersona ? 'explore' : 'list')}
        >
          <Text style={styles.challengeDetailsIconBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.challengeDetailsNavTitle}>
          {challengeDetailsSurfaceLabel}
        </Text>
        <View style={styles.challengeDetailsNavSpacer} />
      </View>

      <View style={styles.challengeDetailsTitleBlock}>
        <Text style={styles.challengeDetailsTitle}>{challengeSelected.title}</Text>
        <Text style={styles.challengeDetailsSubtitle}>
          {challengeSelected.subtitle}
        </Text>
      </View>

      {/* ── Leaderboard Hero Card ── */}
      <TouchableOpacity
        style={styles.cdLbHeroCard}
        activeOpacity={0.92}
        onPress={() => setChallengeFlowScreen('leaderboard')}
      >
        <View style={styles.cdLbHeroAccent} />
        <View style={styles.cdLbHeroHeader}>
          <Text style={styles.cdLbHeroTitle}>
            {challengeIsCompleted ? '🏆 Results & Standings' : '🏆 Leaderboard'}
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
        {challengeLeaderboardHasRealRows ? (
          <>
            {(() => {
              const top3 = challengeLeaderboardPreview.slice(0, 3);
              const medalData: Record<number, { emoji: string; bgColor: string; ringColor: string; size: number; isFirst: boolean }> = {
                1: { emoji: '🥇', bgColor: '#4361c2', ringColor: '#c8d6f0', size: 50, isFirst: true },
                2: { emoji: '🥈', bgColor: '#647ba3', ringColor: '#dce3f0', size: 40, isFirst: false },
                3: { emoji: '🥉', bgColor: '#8a93a6', ringColor: '#e4e9f0', size: 36, isFirst: false },
              };
              // Always show all 3 slots — placeholder if no data yet
              const podiumSlots: Array<{ rank: number; entry: (typeof top3)[0] | undefined }> = [
                { rank: 2, entry: top3.find(e => e.rank === 2) },
                { rank: 1, entry: top3.find(e => e.rank === 1) },
                { rank: 3, entry: top3.find(e => e.rank === 3) },
              ];
              return (
                <View style={styles.cdLbHeroTop3}>
                  {podiumSlots.map(({ rank, entry }) => {
                    const m = medalData[rank] ?? { emoji: `#${rank}`, bgColor: '#4361c2', ringColor: '#dce3f0', size: 36, isFirst: false };
                    if (!entry) {
                      return (
                        <View key={`cdlb-empty-${rank}`} style={[styles.cdLbHeroTopCard, m.isFirst && styles.cdLbHeroTopCardFirst, { opacity: 0.3 }]}>
                          <Text style={styles.cdLbHeroMedal}>{m.emoji}</Text>
                          <View style={[styles.cdLbHeroAvatar, { width: m.size, height: m.size, borderRadius: m.size / 2, backgroundColor: '#c5cde0', borderColor: m.ringColor }]}>
                            <Text style={[styles.cdLbHeroAvatarText, m.isFirst && styles.cdLbHeroAvatarTextFirst]}>—</Text>
                          </View>
                          <Text style={styles.cdLbHeroName}>Open</Text>
                          <Text style={styles.cdLbHeroPct}>–%</Text>
                        </View>
                      );
                    }
                    return (
                      <View key={`cdlb-top-${entry.rank}`} style={[styles.cdLbHeroTopCard, m.isFirst && styles.cdLbHeroTopCardFirst]}>
                        <Text style={styles.cdLbHeroMedal}>{m.emoji}</Text>
                        <View style={[styles.cdLbHeroAvatar, { width: m.size, height: m.size, borderRadius: m.size / 2, backgroundColor: m.bgColor, borderColor: m.ringColor }]}>
                          <Text style={[styles.cdLbHeroAvatarText, m.isFirst && styles.cdLbHeroAvatarTextFirst]}>
                            {entry.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={styles.cdLbHeroName}>{entry.name.split(' ')[0]}</Text>
                        <Text style={[styles.cdLbHeroPct, m.isFirst && styles.cdLbHeroPctFirst]}>{entry.pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
            <View style={styles.cdLbHeroRows}>
              {challengeLeaderboardPreview.map((entry) => (
                <View key={`cdlb-row-${entry.rank}`} style={[
                  styles.cdLbHeroRow,
                  entry.rank === 1 && styles.cdLbHeroRowGold,
                  entry.rank === 2 && styles.cdLbHeroRowSilver,
                  entry.rank === 3 && styles.cdLbHeroRowBronze,
                ]}>
                  <Text style={styles.cdLbHeroRowRank}>{String(entry.rank).padStart(2, '0')}</Text>
                  <Text numberOfLines={1} style={styles.cdLbHeroRowName}>{entry.name}</Text>
                  <Text style={styles.cdLbHeroRowVal}>{entry.value} logs</Text>
                  <Text style={styles.cdLbHeroRowPct}>{entry.pct}%</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.cdLbHeroEmpty}>
            <Text style={styles.cdLbHeroEmptyTitle}>
              {challengeIsCompleted ? 'Results loading' : 'Leaderboard populates after activity starts'}
            </Text>
            <Text style={styles.cdLbHeroEmptySub}>
              {challengeIsCompleted
                ? 'Final standings are still being calculated.'
                : 'Join and log challenge activity to appear on the leaderboard.'}
            </Text>
          </View>
        )}
        <Text style={styles.cdLbHeroHint}>Tap to open full leaderboard →</Text>
      </TouchableOpacity>

      {/* ── Goals Section ── */}
      <View style={styles.cdGoalsSection}>
        <View style={styles.cdGoalsSectionTitleRow}>
          <Text style={styles.cdGoalsSectionTitle}>Goals</Text>
        </View>
        {/* Team Goals */}
        <View style={styles.cdGoalsGroupHeader}>
          <Text style={styles.cdGoalsGroupTitle}>Team Goals</Text>
          <Text style={styles.cdGoalsGroupMeta}>cumulative team contribution</Text>
        </View>
        {challengeScopedKpiGroups.PC.length > 0 ? (
          challengeScopedKpiGroups.PC.map((kpi) => (
            <TouchableOpacity
              key={`cdgoal-team-${kpi.id}`}
              style={styles.cdGoalKpiRow}
              activeOpacity={0.75}
              onPress={() => setChallengeKpiDrillItem({ key: kpi.id, label: String(kpi.name ?? kpi.id), type: kpi.type })}
            >
              <View style={styles.cdGoalKpiLeft}>
                <View style={[styles.cdGoalKpiTypeBadge, styles.cdGoalKpiTypeBadgeTeam]}>
                  <Text style={styles.cdGoalKpiTypeBadgeText}>{kpi.type}</Text>
                </View>
                <Text numberOfLines={1} style={styles.cdGoalKpiName}>{kpi.name}</Text>
              </View>
              <View style={styles.cdGoalKpiRight}>
                <Text style={styles.cdGoalKpiPct}>{challengeTeamCumulativeProgressPct}%</Text>
                <View style={styles.cdGoalKpiTrack}>
                  <View style={[styles.cdGoalKpiFill, styles.cdGoalKpiFillTeam, { width: `${Math.min(100, challengeTeamCumulativeProgressPct)}%` as `${number}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.cdGoalsEmptyRow}>
            <Text style={styles.cdGoalsEmptyText}>No team goal KPIs available for this challenge.</Text>
          </View>
        )}

        {/* Individual Goals */}
        <View style={[styles.cdGoalsGroupHeader, styles.cdGoalsGroupHeaderIndividual]}>
          <Text style={styles.cdGoalsGroupTitle}>Individual Goals</Text>
          <Text style={styles.cdGoalsGroupMeta}>your progress only</Text>
        </View>
        {(challengeScopedKpiGroups.GP.length > 0 || challengeScopedKpiGroups.VP.length > 0) ? (
          [...challengeScopedKpiGroups.GP, ...challengeScopedKpiGroups.VP].map((kpi) => (
            <TouchableOpacity
              key={`cdgoal-ind-${kpi.id}`}
              style={styles.cdGoalKpiRow}
              activeOpacity={0.75}
              onPress={() => setChallengeKpiDrillItem({ key: kpi.id, label: String(kpi.name ?? kpi.id), type: kpi.type })}
            >
              <View style={styles.cdGoalKpiLeft}>
                <View style={[styles.cdGoalKpiTypeBadge, styles.cdGoalKpiTypeBadgeIndividual]}>
                  <Text style={styles.cdGoalKpiTypeBadgeText}>{kpi.type}</Text>
                </View>
                <Text numberOfLines={1} style={styles.cdGoalKpiName}>{kpi.name}</Text>
              </View>
              <View style={styles.cdGoalKpiRight}>
                <Text style={styles.cdGoalKpiPct}>{challengeSelected.progressPct}%</Text>
                <View style={styles.cdGoalKpiTrack}>
                  <View style={[styles.cdGoalKpiFill, styles.cdGoalKpiFillIndividual, { width: `${Math.min(100, challengeSelected.progressPct)}%` as `${number}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.cdGoalsEmptyRow}>
            <Text style={styles.cdGoalsEmptyText}>No individual goal KPIs available.</Text>
          </View>
        )}
      </View>

      {/* Compact meta row */}
      <View style={styles.cdMetaCompact}>
        <Text style={styles.cdMetaCompactText}>{challengeSelected.timeframe}</Text>
        <Text style={styles.cdMetaCompactDot}>·</Text>
        <Text style={styles.cdMetaCompactText}>
          {challengeSelected.bucket === 'active' ? `${challengeDaysLeft} days left` : challengeSelected.daysLabel}
        </Text>
        <Text style={styles.cdMetaCompactDot}>·</Text>
        <Text style={styles.cdMetaCompactText}>{challengeSelected.participants} participants</Text>
      </View>

      {(() => {
        const isJoinSubmitting = challengeJoinSubmittingId === challengeSelected.id;
        const canJoinLiveChallenge =
          challengeHasApiBackedDetail && !challengeSelected.joined && challengeSelected.bucket !== 'completed';
        const challengeMutationError =
          challengeJoinError ??
          challengeLeaveError ??
          (!challengeHasApiBackedDetail && !challengeSelected.joined && !challengeIsCompleted
            ? 'This challenge is placeholder-only right now. Pull to refresh and choose a live challenge to join.'
            : null);
        if (!canJoinLiveChallenge && !challengeMutationError) return null;
        return (
          <View style={styles.challengeDetailsCtaBlock}>
            {canJoinLiveChallenge ? (
              <TouchableOpacity
                style={[
                  styles.challengeDetailsPrimaryCta,
                  (isJoinSubmitting || !challengeHasApiBackedDetail) && styles.disabled,
                ]}
                onPress={() => {
                  if (!challengeHasApiBackedDetail) return;
                  void joinChallenge(challengeSelected.id);
                }}
                disabled={isJoinSubmitting || !challengeHasApiBackedDetail}
              >
                <Text style={styles.challengeDetailsPrimaryCtaText}>
                  {isJoinSubmitting ? 'Joining…' : 'Join Challenge'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!challengeMutationError && challengeIsPlaceholderOnly && !challengeSelected.joined
              ? renderKnownLimitedDataChip('join disabled on preview rows')
              : null}
            {challengeMutationError ? (
              <Text style={styles.challengeJoinErrorText}>{challengeMutationError}</Text>
            ) : null}
          </View>
        );
      })()}

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
        {(() => {
          const allChallengeKpis = [
            ...challengeScopedKpiGroups.PC,
            ...(gpUnlocked ? challengeScopedKpiGroups.GP : []),
            ...(vpUnlocked ? challengeScopedKpiGroups.VP : []),
          ].slice(0, 6);
          if (allChallengeKpis.length === 0) return null;
          return (
            <View style={[styles.challengeSectionCard, styles.challengeSectionCardCompact]}>
              <View style={styles.challengeKpisCardHeader}>
                <Text style={styles.challengeLoggingHeaderTitle}>Challenge KPIs</Text>
              </View>
              <View style={[styles.gridWrap, styles.challengeGridWrapCompact]}>
                {allChallengeKpis.map((kpi) => {
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
                      key={`challenge-combined-${kpi.id}`}
                      style={[
                        styles.gridItem,
                        styles.challengeGridItemCompact,
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
                                transform: [
                                  { translateY: successTranslateY },
                                  { scale: successScale },
                                ],
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
            </View>
          );
        })()}
      </View>
    )}

    {/* ── Leave Challenge (very bottom) ── */}
    {challengeHasApiBackedDetail && challengeSelected.joined && !challengeIsCompleted ? (
      <TouchableOpacity
        style={[
          styles.challengeDetailsSecondaryCta,
          { marginTop: 8, marginHorizontal: 20, marginBottom: 20 },
          challengeLeaveSubmittingId === challengeSelected.id && styles.disabled,
        ]}
        onPress={() => {
          if (
            challengeJoinSubmittingId === challengeSelected.id ||
            challengeLeaveSubmittingId === challengeSelected.id
          ) return;
          Alert.alert(
            'Leave Challenge',
            'Are you sure you want to leave this challenge? Your participation progress will no longer be tracked.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () => { void leaveChallenge(challengeSelected.id); },
              },
            ]
          );
        }}
        disabled={
          challengeJoinSubmittingId === challengeSelected.id ||
          challengeLeaveSubmittingId === challengeSelected.id
        }
      >
        <Text style={styles.challengeDetailsSecondaryCtaText}>
          {challengeLeaveSubmittingId === challengeSelected.id ? 'Leaving…' : 'Leave Challenge'}
        </Text>
      </TouchableOpacity>
    ) : null}

    {/* ── KPI Contribution Drill-In Sheet ── */}
    <Modal
      visible={challengeKpiDrillItem !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setChallengeKpiDrillItem(null)}
    >
      <Pressable style={styles.challengeDrawerBackdrop} onPress={() => setChallengeKpiDrillItem(null)}>
        <Pressable style={styles.challengeDrawerSheet} onPress={() => {}}>
          <View style={styles.challengeDrawerHandle} />
          {challengeKpiDrillItem ? (
            <>
              <View style={styles.cdDrillHeader}>
                <View style={[styles.cdGoalKpiTypeBadge,
                  challengeKpiDrillItem.type === 'PC' ? styles.cdGoalKpiTypeBadgeTeam : styles.cdGoalKpiTypeBadgeIndividual,
                ]}>
                  <Text style={styles.cdGoalKpiTypeBadgeText}>{challengeKpiDrillItem.type}</Text>
                </View>
                <Text style={styles.cdDrillTitle} numberOfLines={2}>{challengeKpiDrillItem.label}</Text>
              </View>
              <Text style={styles.cdDrillSub}>Participant contribution breakdown</Text>
              <View style={styles.challengeDrawerDivider} />
              {challengeLeaderboardPreview.length > 0 ? (
                challengeLeaderboardPreview.map((entry) => (
                  <View key={`cddrill-${entry.rank}`} style={styles.cdDrillRow}>
                    <Text style={styles.cdDrillRowRank}>#{entry.rank}</Text>
                    <Text numberOfLines={1} style={styles.cdDrillRowName}>{entry.name}</Text>
                    <View style={styles.cdDrillBarWrap}>
                      <View style={styles.cdDrillBarTrack}>
                        <View style={[styles.cdDrillBarFill, { width: `${Math.min(100, entry.pct)}%` as `${number}%` }]} />
                      </View>
                      <Text style={styles.cdDrillRowPct}>{entry.pct}%</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.cdDrillEmpty}>
                  <Text style={styles.cdDrillEmptyText}>No participant data available yet for this KPI.</Text>
                  <Text style={styles.cdDrillEmptySub}>Data will appear once participants join and log challenge activity.</Text>
                </View>
              )}
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  </>
              )}
</>
  );
}

const styles = StyleSheet.create({
  cdDrillBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4361c2',
  },
  cdDrillBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e8edf5',
    overflow: 'hidden',
  },
  cdDrillBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  cdDrillEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  cdDrillEmptySub: {
    fontSize: 12,
    color: '#8a93a6',
    textAlign: 'center',
  },
  cdDrillEmptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7790',
    textAlign: 'center',
  },
  cdDrillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cdDrillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f5fb',
  },
  cdDrillRowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1a2540',
  },
  cdDrillRowPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4361c2',
    width: 34,
    textAlign: 'right',
  },
  cdDrillRowRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a93a6',
    width: 28,
  },
  cdDrillSub: {
    fontSize: 13,
    color: '#6b7790',
    marginBottom: 8,
  },
  cdDrillTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2540',
  },
  cdGoalKpiFill: {
    height: '100%',
    borderRadius: 999,
  },
  cdGoalKpiFillIndividual: {
    backgroundColor: '#57d36a',
  },
  cdGoalKpiFillTeam: {
    backgroundColor: '#4361c2',
  },
  cdGoalKpiLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  cdGoalKpiName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1a2540',
  },
  cdGoalKpiPct: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a2540',
  },
  cdGoalKpiRight: {
    alignItems: 'flex-end',
    gap: 4,
    width: 90,
  },
  cdGoalKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f5fb',
  },
  cdGoalKpiTrack: {
    width: 90,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e8edf5',
    overflow: 'hidden',
  },
  cdGoalKpiTypeBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  cdGoalKpiTypeBadgeIndividual: {
    backgroundColor: '#e8f5ed',
  },
  cdGoalKpiTypeBadgeTeam: {
    backgroundColor: '#e6edfa',
  },
  cdGoalKpiTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a2540',
    textTransform: 'uppercase',
  },
  cdGoalsEmptyRow: {
    padding: 14,
    alignItems: 'center',
  },
  cdGoalsEmptyText: {
    fontSize: 12,
    color: '#8a93a6',
    textAlign: 'center',
  },
  cdGoalsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f6f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f8',
  },
  cdGoalsGroupHeaderIndividual: {
    borderTopWidth: 1,
    borderTopColor: '#eef1f8',
    backgroundColor: '#f8f7ff',
  },
  cdGoalsGroupMeta: {
    fontSize: 11,
    color: '#8a93a6',
    fontWeight: '500',
  },
  cdGoalsGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a2540',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cdGoalsSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce3f0',
    backgroundColor: '#fff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cdGoalsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a2540',
    letterSpacing: 0.3,
  },
  cdGoalsSectionTitleRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f8',
    backgroundColor: '#f4f7fd',
  },
  cdLbHeroAccent: {
    height: 5,
    backgroundColor: '#4361c2',
  },
  cdLbHeroAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#c8d6f0',
    shadowColor: '#1f355f',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cdLbHeroAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  cdLbHeroAvatarTextFirst: {
    fontSize: 18,
  },
  cdLbHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c8d6f0',
    backgroundColor: '#fff',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1f355f',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cdLbHeroEmpty: {
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  cdLbHeroEmptySub: {
    fontSize: 12,
    color: '#8a93a6',
    textAlign: 'center',
  },
  cdLbHeroEmptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7790',
    textAlign: 'center',
  },
  cdLbHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#f0f4ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2eaf8',
  },
  cdLbHeroHint: {
    fontSize: 12,
    color: '#4361c2',
    textAlign: 'center',
    paddingVertical: 10,
    fontWeight: '600',
    backgroundColor: '#f0f4ff',
    borderTopWidth: 1,
    borderTopColor: '#e2eaf8',
  },
  cdLbHeroMedal: {
    fontSize: 24,
    lineHeight: 30,
  },
  cdLbHeroName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a2540',
    textAlign: 'center',
    maxWidth: 80,
  },
  cdLbHeroPct: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4361c2',
  },
  cdLbHeroPctFirst: {
    fontSize: 17,
    color: '#4361c2',
    fontWeight: '900',
  },
  cdLbHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f3fa',
  },
  cdLbHeroRowBronze: {
    borderLeftWidth: 3,
    borderLeftColor: '#8a93a6',
    paddingLeft: 8,
  },
  cdLbHeroRowGold: {
    borderLeftWidth: 3,
    borderLeftColor: '#4361c2',
    paddingLeft: 8,
  },
  cdLbHeroRowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1a2540',
  },
  cdLbHeroRowPct: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4361c2',
    width: 38,
    textAlign: 'right',
  },
  cdLbHeroRowRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a93a6',
    width: 24,
  },
  cdLbHeroRowSilver: {
    borderLeftWidth: 3,
    borderLeftColor: '#647ba3',
    paddingLeft: 8,
  },
  cdLbHeroRowVal: {
    fontSize: 12,
    color: '#6b7790',
    marginRight: 4,
  },
  cdLbHeroRows: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: '#eef1f8',
  },
  cdLbHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a2540',
  },
  cdLbHeroTop3: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    gap: 4,
  },
  cdLbHeroTopCard: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  cdLbHeroTopCardFirst: {
    marginBottom: 12,
  },
  cdMetaCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  cdMetaCompactDot: {
    fontSize: 12,
    color: '#b0b8ca',
  },
  cdMetaCompactText: {
    fontSize: 12,
    color: '#6b7790',
    fontWeight: '500',
  },
  challengeDetailsCtaBlock: {
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
  challengeDetailsLeaderboardRank: {
    color: '#8a6207',
    fontSize: 10,
    fontWeight: '800',
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
  challengeDetailsLeaderboardRowRank: {
    width: 18,
    color: '#7a8799',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeDetailsLeaderboardVal: {
    color: '#7a8799',
    fontSize: 9,
    fontWeight: '700',
  },
  challengeDetailsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDetailsNavSpacer: {
    minWidth: 64,
  },
  challengeDetailsNavTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#2f3442',
    fontSize: 15,
    fontWeight: '800',
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
  challengeDetailsShell: {
    gap: 12,
  },
  challengeDetailsStatusPill: {
    borderRadius: 999,
    backgroundColor: '#eef8ef',
    borderWidth: 1,
    borderColor: '#d2e9d3',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  challengeDetailsStatusPillCompleted: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e0e4ea',
  },
  challengeDetailsStatusPillText: {
    color: '#2e8a49',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeDetailsStatusPillTextCompleted: {
    color: '#596579',
  },
  challengeDetailsStatusPillTextUpcoming: {
    color: '#2d63e1',
  },
  challengeDetailsStatusPillUpcoming: {
    backgroundColor: '#eef4ff',
    borderColor: '#d8e5ff',
  },
  challengeDetailsSubtitle: {
    color: '#707c8f',
    fontSize: 12,
    lineHeight: 17,
  },
  challengeDetailsTitle: {
    color: '#2f3442',
    fontSize: 20,
    fontWeight: '800',
  },
  challengeDetailsTitleBlock: {
    gap: 4,
  },
  challengeDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 28, 44, 0.45)',
    justifyContent: 'flex-end',
  },
  challengeDrawerDivider: {
    height: 1,
    backgroundColor: '#e8edf5',
  },
  challengeDrawerFootMeta: {
    color: '#7b8697',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDrawerFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeDrawerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d1d8e4',
    marginBottom: 6,
  },
  challengeDrawerJoinBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#1f5fe2',
    paddingVertical: 14,
    alignItems: 'center',
  },
  challengeDrawerJoinBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  challengeDrawerKpiChip: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#f4f7fd',
    borderWidth: 1,
    borderColor: '#e1eaf5',
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  challengeDrawerKpiLabel: {
    color: '#7b8697',
    fontSize: 10,
    fontWeight: '600',
  },
  challengeDrawerKpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeDrawerKpiValue: {
    color: '#2f3442',
    fontSize: 16,
    fontWeight: '800',
  },
  challengeDrawerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDrawerMetaText: {
    color: '#7b8697',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDrawerSectionTitle: {
    color: '#3d4e6a',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  challengeDrawerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 10,
    shadowColor: '#0d1b33',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  challengeDrawerSub: {
    color: '#5b6d8e',
    fontSize: 13,
    lineHeight: 18,
  },
  challengeDrawerTitle: {
    color: '#1e2a47',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeDrawerViewBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4dff3',
    backgroundColor: '#f8fbff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  challengeDrawerViewBtnText: {
    color: '#35557f',
    fontSize: 14,
    fontWeight: '800',
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
  challengeEmptyText: {
    color: '#6f7888',
    fontSize: 13,
    lineHeight: 19,
  },
  challengeEmptyTitle: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeExploreEyebrow: {
    fontSize: 12,
    letterSpacing: 0.8,
    color: '#4c70b6',
    fontWeight: '700',
  },
  challengeExploreHero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c8d7f6',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  challengeExploreLimitText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#65789e',
  },
  challengeExploreSection: {
    gap: 10,
  },
  challengeExploreSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3954',
  },
  challengeExploreShell: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  challengeExploreStartBtn: {
    marginTop: 14,
    borderRadius: 14,
    minHeight: 46,
    backgroundColor: '#2f5fd0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeExploreStartBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  challengeExploreSub: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#4d6285',
  },
  challengeExploreTitle: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#17223a',
  },
  challengeGridItemCompact: {
    gap: 2,
    width: '24%',
  },
  challengeGridTileAnimatedWrap: {
    paddingTop: 1,
  },
  challengeGridWrapCompact: {
    rowGap: 6,
    justifyContent: 'space-between',
    columnGap: 0,
  },
  challengeHeroAccent: {
    height: 6,
    backgroundColor: '#4361c2',
  },
  challengeHeroBody: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  challengeHeroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c8d6f0',
    shadowColor: '#1f355f',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  challengeHeroCount: {
    color: '#4361c2',
    fontSize: 20,
    fontWeight: '900',
  },
  challengeHeroEyebrow: {
    color: '#3d5ab5',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  challengeHeroSub: {
    color: '#5b6d8e',
    fontSize: 12,
    lineHeight: 17,
  },
  challengeHeroTitle: {
    color: '#1e2a47',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  challengeHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  challengeJoinErrorText: {
    color: '#b91c1c',
    fontSize: 11,
    lineHeight: 14,
  },
  challengeKpisCardHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f8',
  },
  challengeLeaderboardEmptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#fbfcff',
    padding: 10,
    gap: 5,
  },
  challengeLeaderboardEmptySub: {
    color: '#748296',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeLeaderboardEmptyTitle: {
    color: '#415063',
    fontSize: 12,
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
  challengeLeaderboardScreenRows: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 6,
    gap: 4,
  },
  challengeLeaderboardScreenSub: {
    color: '#748296',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeLeaderboardScreenTitle: {
    color: '#2f3442',
    fontSize: 17,
    fontWeight: '800',
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
  challengeListCardStack: {
    gap: 10,
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
  challengeListEmptyFilterCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  challengeListEmptyFilterSub: {
    color: '#728094',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeListEmptyFilterTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
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
  challengeListFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeListItemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    padding: 10,
    gap: 8,
  },
  challengeListItemCardSponsored: {
    backgroundColor: '#f6fbff',
    borderColor: '#cfe2ff',
    paddingVertical: 12,
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
  challengeListItemProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#57d36a',
  },
  challengeListItemProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e8edf5',
    overflow: 'hidden',
  },
  challengeListItemSub: {
    color: '#728094',
    fontSize: 11,
    lineHeight: 15,
  },
  challengeListItemTitle: {
    flex: 1,
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeListItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  challengeListStatusActive: {
    backgroundColor: '#eef8ef',
    borderColor: '#d2e9d3',
  },
  challengeListStatusActiveText: {
    color: '#2e8a49',
  },
  challengeListStatusCompleted: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e0e4ea',
  },
  challengeListStatusCompletedText: {
    color: '#596579',
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
  challengeListStatusUpcoming: {
    backgroundColor: '#eef4ff',
    borderColor: '#d8e5ff',
  },
  challengeListStatusUpcomingText: {
    color: '#2d63e1',
  },
  challengeLoggingHeaderTitle: {
    color: '#2f3442',
    fontSize: 13,
    fontWeight: '800',
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
  challengeMemberCreateModeGrid: {
    flexDirection: 'row',
    gap: 10,
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
  challengeMemberSegmentRow: {
    marginTop: 8,
    flexDirection: 'row',
    backgroundColor: '#eceff4',
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  challengeMemberUpgradeBenefitCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeMemberUpgradeBenefitCopy: {
    flex: 1,
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
  challengeMemberUpgradeBenefitSub: {
    color: '#8a94a3',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  challengeMemberUpgradeBenefitTitle: {
    color: '#384252',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeMemberUpgradeBenefits: {
    gap: 8,
  },
  challengeMemberUpgradeChallengeCard: {
    borderRadius: 12,
    backgroundColor: '#eef0f4',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeMemberUpgradeChallengeCopy: {
    flex: 1,
    gap: 1,
  },
  challengeMemberUpgradeChallengeGoal: {
    color: '#576274',
    fontSize: 10,
    lineHeight: 13,
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
  challengeMemberUpgradeChallengeSub: {
    color: '#8a93a3',
    fontSize: 11,
  },
  challengeMemberUpgradeChallengeTitle: {
    color: '#36404f',
    fontSize: 13,
    fontWeight: '800',
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
  challengeMemberUpgradeLock: {
    fontSize: 14,
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
  challengeMemberUpgradeSectionLabel: {
    color: '#6a7381',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  challengeMemberUpgradeShell: {
    gap: 12,
    paddingTop: 2,
  },
  challengeMemberUpgradeSub: {
    color: '#7f8998',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  challengeMemberUpgradeTitle: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
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
  challengeSectionsWrap: {
    gap: 10,
  },
  challengeSponsoredMetaLabel: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c8d9ff',
    backgroundColor: '#ecf3ff',
    color: '#2f62de',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  challengeSponsoredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeSponsoredMetaSub: {
    color: '#6680a4',
    fontSize: 10,
    fontWeight: '600',
  },
  challengeWizardAudienceCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dae7f4',
    backgroundColor: '#f6fbff',
    padding: 10,
    gap: 4,
  },
  challengeWizardAudienceList: {
    gap: 8,
    maxHeight: 160,
  },
  challengeWizardAudienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  challengeWizardAudienceRowActive: {
    borderColor: '#bfd4fa',
    backgroundColor: '#edf4ff',
  },
  challengeWizardAudienceRowName: {
    color: '#2d3850',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeWizardAudienceRowState: {
    color: '#2b5fda',
    fontSize: 10,
    fontWeight: '800',
  },
  challengeWizardAudienceSub: {
    color: '#6f8098',
    fontSize: 10,
    lineHeight: 14,
  },
  challengeWizardAudienceTitle: {
    color: '#2d3750',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeWizardDateInput: {
    flex: 1,
  },
  challengeWizardDateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeWizardErrorText: {
    color: '#c13d3d',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  challengeWizardFooterPrimaryBtn: {
    flex: 1.4,
    borderRadius: 10,
    backgroundColor: '#2a62de',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  challengeWizardFooterPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeWizardFooterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  challengeWizardFooterSecondaryBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e2f0',
    backgroundColor: '#f7f9fd',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  challengeWizardFooterSecondaryBtnText: {
    color: '#5d6f88',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeWizardGoalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeWizardGoalCopy: {
    gap: 2,
  },
  challengeWizardGoalLabel: {
    color: '#2a3447',
    fontSize: 12,
    fontWeight: '700',
  },
  challengeWizardGoalRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3eaf5',
    backgroundColor: '#fbfdff',
    padding: 8,
    gap: 7,
  },
  challengeWizardGoalScopeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dde6f4',
    backgroundColor: '#f7f9fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  challengeWizardGoalScopeChipActive: {
    borderColor: '#2c63de',
    backgroundColor: '#eaf1ff',
  },
  challengeWizardGoalScopeChipText: {
    color: '#6d7e95',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeWizardGoalScopeChipTextActive: {
    color: '#1f57d8',
  },
  challengeWizardGoalScroll: {
    maxHeight: 210,
  },
  challengeWizardGoalStack: {
    gap: 8,
    paddingBottom: 6,
  },
  challengeWizardGoalSub: {
    color: '#7b8798',
    fontSize: 10,
  },
  challengeWizardGoalTargetInput: {
    width: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce6f4',
    backgroundColor: '#fff',
    color: '#25334a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    textAlign: 'center',
  },
  challengeWizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeWizardHint: {
    color: '#74849b',
    fontSize: 10,
    lineHeight: 14,
  },
  challengeWizardInfoText: {
    color: '#8b5f14',
    fontSize: 10,
    lineHeight: 14,
  },
  challengeWizardInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe5f3',
    backgroundColor: '#f8fbff',
    color: '#233146',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  challengeWizardInputMultiline: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  challengeWizardReviewCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce6f4',
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 5,
  },
  challengeWizardReviewMeta: {
    color: '#70829a',
    fontSize: 10,
    lineHeight: 14,
  },
  challengeWizardReviewSub: {
    color: '#5f738f',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeWizardReviewTitle: {
    color: '#2a3448',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeWizardSection: {
    gap: 8,
  },
  challengeWizardSectionTitle: {
    color: '#283346',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeWizardStepPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8e4fb',
    backgroundColor: '#eef4ff',
    color: '#2b62de',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  challengeWizardSub: {
    color: '#6f7f95',
    fontSize: 11,
    lineHeight: 16,
  },
  challengeWizardTemplateCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4eaf4',
    backgroundColor: '#f9fbff',
    padding: 10,
    gap: 3,
  },
  challengeWizardTemplateCardActive: {
    borderColor: '#c7d8fb',
    backgroundColor: '#eef4ff',
  },
  challengeWizardTemplateHint: {
    color: '#5a6f90',
    fontSize: 10,
    fontWeight: '700',
  },
  challengeWizardTemplateStack: {
    maxHeight: 180,
    gap: 8,
  },
  challengeWizardTemplateSub: {
    color: '#6f8098',
    fontSize: 10,
    lineHeight: 14,
  },
  challengeWizardTemplateTitle: {
    color: '#2b3548',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeWizardTypeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9e4f5',
    backgroundColor: '#f7f9fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  challengeWizardTypeChipActive: {
    borderColor: '#265fe0',
    backgroundColor: '#eaf1ff',
  },
  challengeWizardTypeChipText: {
    color: '#66788f',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeWizardTypeChipTextActive: {
    color: '#1f57d8',
  },
  challengeWizardTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coachChallengesBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  coachChallengesBackText: {
    color: '#3366cc',
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.55,
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
  gridCircleConfirmed: {
    borderColor: 'rgba(31, 95, 226, 0.28)',
    backgroundColor: 'rgba(31, 95, 226, 0.045)',
    shadowColor: '#1f5fe2',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  gridCircleWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItem: {
    width: '24%',
    alignItems: 'center',
    gap: 2,
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
  gridSuccessCoinHighlight: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 4,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  gridSuccessCoinInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ffd45a',
    borderWidth: 1,
    borderColor: '#efc43d',
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
  gridTileAnimatedWrap: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
    paddingBottom: 0,
  },
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
  teamChallengeTopTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7e0ef',
    borderRadius: 999,
    backgroundColor: '#f7f9fd',
    paddingVertical: 9,
    alignItems: 'center',
  },
  teamChallengeTopTabActive: {
    backgroundColor: '#2f67da',
    borderColor: '#2f67da',
  },
  teamChallengeTopTabText: {
    color: '#57709a',
    fontSize: 13,
    fontWeight: '800',
  },
  teamChallengeTopTabTextActive: {
    color: '#fff',
  },
  teamChallengeTopTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingRight: 56,
  },
});
