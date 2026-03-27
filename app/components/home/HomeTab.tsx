import React from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ViewMode, LogsReportsSubview, HomePanel, DashboardPayload, Segment, TeamLogContext, RuntimeNotificationItem, RuntimeSurfaceStateModel, RuntimeNotificationSummaryReadModel, ChallengeApiRow, CoachingShellContext, CoachingShellScreen } from '../../screens/kpi-dashboard/types';
import ReportsTabV2 from '../reports/ReportsTabV2';
import { fmtNum, formatLogDateHeading, isoTodayLocal, shiftIsoLocalDate, kpiTypeAccent, summarizeNotificationRows } from '../../screens/kpi-dashboard/helpers';
import { dashboardAssets } from '../../screens/kpi-dashboard/constants';
import { colors } from '../../theme/tokens';

export interface HomeTabProps {
  viewMode: ViewMode;

  // Home view props
  renderHudRail: () => React.ReactNode;
  setHomeVisualViewportWidth: (w: number) => void;
  setHomeGridViewportWidth: (w: number) => void;
  visualPageWidth: number;
  gridPageWidth: number;
  homePanelLoopItems: Array<{ panel: HomePanel; cycleIdx: number }>;
  visualTranslateX: Animated.AnimatedNode;
  gridTranslateX: Animated.AnimatedNode;
  homePanel: HomePanel;
  renderChartVisualPanel: (options?: { attachLiveChartRefs?: boolean }) => React.ReactNode;
  renderHomeVisualPlaceholder: (kind: 'GP' | 'VP') => React.ReactNode;
  renderHomeGridPanel: (panel: HomePanel, options?: { attachLiveTileRefs?: boolean }) => React.ReactNode;
  renderGameplayHeader: () => React.ReactNode;
  homeRuntimeStateModel: RuntimeSurfaceStateModel;
  renderRuntimeStateBanner: (model: RuntimeSurfaceStateModel, opts?: { compact?: boolean }) => React.ReactNode;
  renderCoachingPackageGateBanner: (surfaceLabel: string, outcome?: null, opts?: { compact?: boolean }) => React.ReactNode;
  homeNotificationRows: RuntimeNotificationItem[];
  renderCoachingNotificationSurface: (
    title: string,
    items: RuntimeNotificationItem[],
    summary?: RuntimeNotificationSummaryReadModel | null,
    opts?: { compact?: boolean; maxRows?: number; mode?: 'banner' | 'list' | 'thread'; emptyHint?: string }
  ) => React.ReactNode;
  openCoachingShell: (screen: CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => void;

  // Log view props
  logsReportsSubview: LogsReportsSubview;
  setLogsReportsSubview: React.Dispatch<React.SetStateAction<LogsReportsSubview>>;
  teamLogContext: TeamLogContext | null;
  teamLogContextKpi: DashboardPayload['loggable_kpis'][number] | null;
  teamLogContextMember: { name?: string | null } | null;
  teamLogPeriodLabel: string;
  teamLogGoalValue: number | null;
  teamLogProgressRatio: number | null;
  teamLogActualPercent: number | null;
  teamLogGoalSourceLabel: string;
  teamLogLast7Summary: { count: number; points: number };
  selectedLogDate: string;
  canGoBackwardDate: boolean;
  canGoForwardDate: boolean;
  setSelectedLogDateIso: React.Dispatch<React.SetStateAction<string | null>>;
  inlinePipelineSubmitting: boolean;
  openPipelineDecreaseCloseFlow: (field: 'listings' | 'buyers') => void;
  pipelineCheckinListings: number;
  setPipelineCheckinListings: React.Dispatch<React.SetStateAction<number>>;
  pipelineCheckinBuyers: number;
  setPipelineCheckinBuyers: React.Dispatch<React.SetStateAction<number>>;
  saveInlinePipelineCounts: () => Promise<void>;
  todaysLogRows: Array<{ kpiId: string; name: string; count: number }>;
  quickLogKpis: DashboardPayload['loggable_kpis'];
  submitting: boolean;
  submittingKpiId: string | null;
  onTapQuickLog: (kpi: DashboardPayload['loggable_kpis'][number], opts?: { skipTapFeedback?: boolean }) => Promise<void>;
  getKpiTileScale: (kpiId: string) => Animated.Value;
  getKpiTileSuccessAnim: (kpiId: string) => Animated.Value;
  kpiTileCircleRefById: React.MutableRefObject<Record<string, View | null>>;
  confirmedKpiTileIds: Record<string, true>;
  renderKpiIcon: (kpi: DashboardPayload['loggable_kpis'][number]) => React.ReactNode;
  runKpiTilePressInFeedback: (kpi: DashboardPayload['loggable_kpis'][number], options?: { surface?: 'home' | 'log' }) => void;
  runKpiTilePressOutFeedback: (kpiId: string) => void;
  removeManagedKpi: (kpiId: string) => void;
  openLogOtherDrawer: () => void;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
  segment: Segment;
  setSegment: React.Dispatch<React.SetStateAction<Segment>>;
  payload: DashboardPayload | null;
  recentLogEntries: Array<{
    id: string;
    kpi_name?: string;
    event_timestamp: string;
  }>;
  deleteLoggedEntry: (logId: string) => Promise<void>;
  challengeApiRows: ChallengeApiRow[] | null;
  runtimeMeRole: string | null;
}

export default function HomeTab({
  viewMode,
  renderHudRail,
  setHomeVisualViewportWidth,
  setHomeGridViewportWidth,
  visualPageWidth,
  gridPageWidth,
  homePanelLoopItems,
  visualTranslateX,
  gridTranslateX,
  homePanel,
  renderChartVisualPanel,
  renderHomeVisualPlaceholder,
  renderHomeGridPanel,
  renderGameplayHeader,
  homeRuntimeStateModel,
  renderRuntimeStateBanner,
  renderCoachingPackageGateBanner,
  homeNotificationRows,
  renderCoachingNotificationSurface,
  openCoachingShell,
  logsReportsSubview,
  setLogsReportsSubview,
  teamLogContext,
  teamLogContextKpi,
  teamLogContextMember,
  teamLogPeriodLabel,
  teamLogGoalValue,
  teamLogProgressRatio,
  teamLogActualPercent,
  teamLogGoalSourceLabel,
  teamLogLast7Summary,
  selectedLogDate,
  canGoBackwardDate,
  canGoForwardDate,
  setSelectedLogDateIso,
  inlinePipelineSubmitting,
  openPipelineDecreaseCloseFlow,
  pipelineCheckinListings,
  setPipelineCheckinListings,
  pipelineCheckinBuyers,
  setPipelineCheckinBuyers,
  saveInlinePipelineCounts,
  todaysLogRows,
  quickLogKpis,
  submitting,
  submittingKpiId,
  onTapQuickLog,
  getKpiTileScale,
  getKpiTileSuccessAnim,
  kpiTileCircleRefById,
  confirmedKpiTileIds,
  renderKpiIcon,
  runKpiTilePressInFeedback,
  runKpiTilePressOutFeedback,
  removeManagedKpi,
  openLogOtherDrawer,
  gpUnlocked,
  vpUnlocked,
  segment,
  setSegment,
  payload,
  recentLogEntries,
  deleteLoggedEntry,
  challengeApiRows,
  runtimeMeRole,
}: HomeTabProps) {
  if (viewMode === 'home') {
    return (
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
    );
  }

  return (
<>
  <View style={styles.activityHeroCard}>
    <View style={styles.activityHeroTopRow}>
      <Text style={styles.activityHeroEyebrow}>Activity / Logs & History</Text>
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
  </View>

  {logsReportsSubview === 'logs' ? (
    <>
  {teamLogContextKpi ? (
    <View style={styles.teamLogContextBanner}>
      <Text style={styles.teamLogContextBannerEyebrow}>Team handoff</Text>
      <Text style={styles.teamLogContextBannerText}>
        👥 {teamLogContextMember?.name ?? teamLogContext?.member_name ?? 'Member'} • {teamLogContextKpi.name} • {teamLogPeriodLabel}
      </Text>
      <Text style={styles.teamLogContextBannerMeta}>
        source={teamLogContext?.source ?? 'team_leader_member_detail'} • member_id={teamLogContext?.member_id ?? 'n/a'} • kpi_id={teamLogContextKpi.id}
      </Text>
      {teamLogGoalValue != null && teamLogProgressRatio != null ? (
        <View style={styles.teamLogProgressCard}>
          <View style={styles.teamLogProgressTopRow}>
            <Text style={styles.teamLogProgressTitle}>KPI progress context</Text>
            <Text style={styles.teamLogProgressValue}>
              {fmtNum(teamLogActualPercent ?? 0)} / {fmtNum(teamLogGoalValue)}
            </Text>
          </View>
          <View style={styles.teamLogProgressTrack}>
            <View style={[styles.teamLogProgressFill, { width: `${Math.round(teamLogProgressRatio * 100)}%` }]} />
          </View>
          <Text style={styles.teamLogProgressMeta}>
            Using {teamLogGoalSourceLabel}. {Math.round(teamLogProgressRatio * 100)}% of goal.
          </Text>
        </View>
      ) : (
        <View style={styles.teamLogFallbackCard}>
          <Text style={styles.teamLogFallbackTitle}>7-day KPI summary fallback</Text>
          <Text style={styles.teamLogFallbackMeta}>
            {fmtNum(teamLogLast7Summary.count)} logs • {fmtNum(teamLogLast7Summary.points)} points (last 7 days)
          </Text>
          <Text style={styles.teamLogFallbackMeta}>Fallback target: set in onboarding/profile to unlock progress meter.</Text>
        </View>
      )}
    </View>
  ) : null}
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
        Update pending listings and buyers under contract directly from this card.
      </Text>
    </View>
    <View style={styles.activityPipelineInlineRow}>
      <View style={styles.activityPipelineInlineField}>
        <Text style={styles.activityPipelineInlineLabel}>Pending listings</Text>
        <View style={styles.activityPipelineInlineStepper}>
          <TouchableOpacity
            style={styles.activityPipelineInlineStepBtn}
            disabled={inlinePipelineSubmitting}
            onPress={() => openPipelineDecreaseCloseFlow('listings')}
          >
            <Text style={styles.activityPipelineInlineStepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.activityPipelineInlineValue}>{fmtNum(pipelineCheckinListings)}</Text>
          <TouchableOpacity
            style={styles.activityPipelineInlineStepBtn}
            disabled={inlinePipelineSubmitting}
            onPress={() => setPipelineCheckinListings((v) => Math.max(0, v + 1))}
          >
            <Text style={styles.activityPipelineInlineStepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.activityPipelineInlineField}>
        <Text style={styles.activityPipelineInlineLabel}>Buyers under contract</Text>
        <View style={styles.activityPipelineInlineStepper}>
          <TouchableOpacity
            style={styles.activityPipelineInlineStepBtn}
            disabled={inlinePipelineSubmitting}
            onPress={() => openPipelineDecreaseCloseFlow('buyers')}
          >
            <Text style={styles.activityPipelineInlineStepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.activityPipelineInlineValue}>{fmtNum(pipelineCheckinBuyers)}</Text>
          <TouchableOpacity
            style={styles.activityPipelineInlineStepBtn}
            disabled={inlinePipelineSubmitting}
            onPress={() => setPipelineCheckinBuyers((v) => Math.max(0, v + 1))}
          >
            <Text style={styles.activityPipelineInlineStepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    <TouchableOpacity
      style={[styles.activityPipelineCta, inlinePipelineSubmitting && styles.disabled]}
      onPress={() => void saveInlinePipelineCounts()}
      disabled={inlinePipelineSubmitting}
    >
      <Text style={styles.activityPipelineCtaText}>
        {inlinePipelineSubmitting ? 'Saving…' : 'Save pipeline'}
      </Text>
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
      <TouchableOpacity style={styles.addNewBtn} onPress={openLogOtherDrawer}>
        <Text style={styles.addNewBtnText}>⊕ Log Other</Text>
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
        {quickLogKpis.map((kpi) => {
          const successAnim = getKpiTileSuccessAnim(kpi.id);
          const isTeamContextTarget = teamLogContext?.kpi_id === String(kpi.id);
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
                      isTeamContextTarget && styles.gridCircleTeamContext,
                    ]}
                  >
                    {renderKpiIcon(kpi)}
                  </View>
                  {isTeamContextTarget ? (
                    <View pointerEvents="none" style={styles.gridContextBadgeStack}>
                      <View style={styles.gridContextBadge}>
                        <Text style={styles.gridContextBadgeText}>👥</Text>
                      </View>
                    </View>
                  ) : null}
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
    <Text style={styles.hiWork}>Great work</Text>
    <View style={styles.greenBanner}>
      <Text style={styles.greenBannerText}>
        🎉 You have made a total of {fmtNum(payload?.activity.total_logs ?? 0)} logs so far today.
      </Text>
    </View>
  </View>
    </>
  ) : (
    <ReportsTabV2
      payload={payload}
      challengeApiRows={challengeApiRows}
      runtimeMeUserId={runtimeMeRole}
    />
  )}
</>
  );
}

const styles = StyleSheet.create({
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
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
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
  teamLogContextBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e4ff',
    backgroundColor: '#eef4ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  teamLogContextBannerEyebrow: {
    color: '#34518c',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  teamLogContextBannerText: {
    color: '#2f4779',
    fontSize: 12,
    fontWeight: '700',
  },
  teamLogContextBannerMeta: {
    color: '#4f628c',
    fontSize: 10,
    fontWeight: '600',
  },
  teamLogProgressCard: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfe1ff',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  teamLogProgressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  teamLogProgressTitle: {
    color: '#334872',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamLogProgressValue: {
    color: '#2f4779',
    fontSize: 12,
    fontWeight: '700',
  },
  teamLogProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e8efff',
    overflow: 'hidden',
  },
  teamLogProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2f7dff',
  },
  teamLogProgressMeta: {
    color: '#4f628c',
    fontSize: 11,
    fontWeight: '600',
  },
  teamLogFallbackCard: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e2f2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  teamLogFallbackTitle: {
    color: '#334872',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamLogFallbackMeta: {
    color: '#4f628c',
    fontSize: 11,
    fontWeight: '600',
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
  activityPipelineInlineRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  activityPipelineInlineField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f2',
    borderRadius: 10,
    backgroundColor: '#f8fbff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  activityPipelineInlineLabel: {
    color: '#5f6a7d',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  activityPipelineInlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityPipelineInlineStepBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8e2f2',
    backgroundColor: '#eef5ff',
  },
  activityPipelineInlineStepBtnText: {
    color: '#1f5fe2',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  activityPipelineInlineValue: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
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
  gridCircleConfirmed: {
    borderColor: 'rgba(31, 95, 226, 0.28)',
    backgroundColor: 'rgba(31, 95, 226, 0.045)',
    shadowColor: '#1f5fe2',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  gridCircleTeamContext: {
    borderColor: 'rgba(31, 95, 226, 0.5)',
    backgroundColor: 'rgba(31, 95, 226, 0.08)',
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
  disabled: {
    opacity: 0.55,
  },
});
