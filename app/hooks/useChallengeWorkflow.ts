/**
 * useChallengeWorkflow — State-management hook for the challenge domain:
 * challenge list/detail/leaderboard navigation, join/leave, wizard creation,
 * template handling, and all challenge-derived memos.
 *
 * Keeps the orchestrator (KPIDashboardScreen) free of ~500+ lines of challenge
 * plumbing while exposing a clean surface for the render layer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ChallengeApiRow,
  ChallengeFlowItem,
  ChallengeGoalScope,
  ChallengeJoinApiResponse,
  ChallengeKind,
  ChallengeLeaveApiResponse,
  ChallengeListFilter,
  ChallengeMemberListTab,
  ChallengeStateTab,
  ChallengeTemplateListApiResponse,
  ChallengeTemplateRow,
  ChallengeWizardGoalDraft,
  ChallengeWizardStep,
  CoachingPackageGatePresentation,
  DashboardPayload,
  BottomTab,
  RuntimePackageVisibilityOutcome,
} from '../screens/kpi-dashboard/types';

import {
  challengeListFilterMatches,
  deriveChallengeScopedKpis,
  deriveCoachingPackageGatePresentation,
  groupChallengeKpisByType,
  isApiBackedChallenge,
  normalizePackagingReadModelToVisibilityOutcome,
  pickRuntimePackageVisibility,
} from '../screens/kpi-dashboard/helpers';

import { buildDefaultChallengeTemplatesFromKpis } from '../screens/kpi-dashboard/defaultChallengeTemplates';

import { API_URL } from '../lib/supabase';

// ── Injected dependencies ───────────────────────────────────────────

export interface ChallengeWorkflowDeps {
  accessToken: string | null;
  fetchDashboard: () => Promise<void>;
  /** From useRuntimePersona */
  isSoloPersona: boolean;
  effectiveTeamPersonaVariant: string;
  /** KPI surface data derived in orchestrator */
  challengeSurfaceKpis: DashboardPayload['loggable_kpis'];
  challengeKpiGroups: { PC: DashboardPayload['loggable_kpis']; GP: DashboardPayload['loggable_kpis']; VP: DashboardPayload['loggable_kpis'] };
  allSelectableKpis: Array<{ id: string; name: string; type: string }>;
  /** From useTeamRosterManager */
  resolveCurrentTeamContextId: () => string | null;
  teamRosterTeamId: string | null;
  /** Session metadata for scoping */
  sessionUserMeta: { team_id?: string | null };
  sessionAppMeta: { team_id?: string | null };
  activeTab: BottomTab;
  /** Owned by orchestrator because fetchDashboard writes to it */
  challengeApiRows: ChallengeApiRow[] | null;
  challengeApiFetchError: string | null;
  /** Computed in orchestrator to break circular dep with useRuntimePersona */
  challengeListItems: ChallengeFlowItem[];
  challengeHasSponsorSignal: boolean;
}

// ── Public surface ──────────────────────────────────────────────────

export interface ChallengeWorkflowState {
  /* pass-through from deps for convenience */
  challengeApiRows: ChallengeApiRow[] | null;
  challengeApiFetchError: string | null;
  /* navigation & filters */
  challengeFlowScreen: 'explore' | 'list' | 'details' | 'leaderboard';
  challengeListFilter: ChallengeListFilter;
  challengeMemberListTab: ChallengeMemberListTab;
  challengeStateTab: ChallengeStateTab;
  challengeSelectedId: string;
  /* join / leave */
  challengeJoinSubmittingId: string | null;
  challengeLeaveSubmittingId: string | null;
  challengeJoinError: string | null;
  challengeLeaveError: string | null;
  /* preview / drill */
  challengePreviewItem: ChallengeFlowItem | null;
  challengeKpiDrillItem: { key: string; label: string; type: string } | null;
  /* wizard */
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
  /* team challenges segment */
  teamChallengesSegment: 'active' | 'completed';
  /* derived */
  challengeListItems: ChallengeFlowItem[];
  challengeHasSponsorSignal: boolean;
  challengeScopedListItems: ChallengeFlowItem[];
  challengeMemberListItems: ChallengeFlowItem[];
  challengeFilteredScopedListItems: ChallengeFlowItem[];
  challengeListItemsForPersona: ChallengeFlowItem[];
  challengeStateRows: { active: ChallengeFlowItem[]; upcoming: ChallengeFlowItem[]; completed: ChallengeFlowItem[] };
  challengeDefaultStateTab: ChallengeStateTab;
  challengeCurrentStateRows: ChallengeFlowItem[];
  challengeSelectedWithinState: ChallengeFlowItem | null;
  challengeParticipantRows: Array<{ rank: number; name: string; pct: number; value: number }>;
  challengeKpiSummaryCards: Array<{ key: string; label: string; value: number }>;
  challengeSelected: ChallengeFlowItem;
  challengeScopedKpis: DashboardPayload['loggable_kpis'];
  challengeScopedKpiGroups: { PC: DashboardPayload['loggable_kpis']; GP: DashboardPayload['loggable_kpis']; VP: DashboardPayload['loggable_kpis'] };
  challengeIsCompleted: boolean;
  challengeHasApiBackedDetail: boolean;
  challengeIsPlaceholderOnly: boolean;
  challengeLeaderboardHasRealRows: boolean;
  challengeCoachingPackageOutcome: RuntimePackageVisibilityOutcome | null;
  challengeCoachingGatePresentation: CoachingPackageGatePresentation;
  challengeCoachingGateBlocksCtas: boolean;
  challengeListUsingPlaceholderRows: boolean;
  challengeWizardFallbackTemplates: ChallengeTemplateRow[];
}

export interface ChallengeWorkflowActions {
  setChallengeFlowScreen: React.Dispatch<React.SetStateAction<'explore' | 'list' | 'details' | 'leaderboard'>>;
  setChallengeListFilter: React.Dispatch<React.SetStateAction<ChallengeListFilter>>;
  setChallengeMemberListTab: React.Dispatch<React.SetStateAction<ChallengeMemberListTab>>;
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
  setTeamChallengesSegment: React.Dispatch<React.SetStateAction<'active' | 'completed'>>;
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
  /** Expose for orchestrator's submitChallengeWizard post-success navigation */
  setActiveTabFromChallenge: (tab: BottomTab) => void;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useChallengeWorkflow(
  deps: ChallengeWorkflowDeps,
  /** Called post-wizard-submit so the orchestrator can switch tabs */
  setActiveTab: (tab: BottomTab) => void,
): ChallengeWorkflowState & ChallengeWorkflowActions {
  const {
    accessToken,
    fetchDashboard,
    isSoloPersona,
    effectiveTeamPersonaVariant,
    challengeSurfaceKpis,
    challengeKpiGroups,
    allSelectableKpis,
    resolveCurrentTeamContextId,
    teamRosterTeamId,
    sessionUserMeta,
    sessionAppMeta,
    activeTab,
    challengeApiRows,
    challengeApiFetchError,
    challengeListItems,
    challengeHasSponsorSignal,
  } = deps;

  // ── State ───────────────────────────────────────────────────────

  const [challengeFlowScreen, setChallengeFlowScreen] = useState<'explore' | 'list' | 'details' | 'leaderboard'>('list');
  const [challengeListFilter, setChallengeListFilter] = useState<ChallengeListFilter>('all');
  const [challengeMemberListTab, setChallengeMemberListTab] = useState<ChallengeMemberListTab>('all');
  const [challengeStateTab, setChallengeStateTab] = useState<ChallengeStateTab>('active');
  const [challengeSelectedId, setChallengeSelectedId] = useState<string>('challenge-30-day-listing');
  const [challengeJoinSubmittingId, setChallengeJoinSubmittingId] = useState<string | null>(null);
  const [challengeLeaveSubmittingId, setChallengeLeaveSubmittingId] = useState<string | null>(null);
  const [challengeJoinError, setChallengeJoinError] = useState<string | null>(null);
  const [challengeLeaveError, setChallengeLeaveError] = useState<string | null>(null);
  const [challengePreviewItem, setChallengePreviewItem] = useState<ChallengeFlowItem | null>(null);
  const [challengeKpiDrillItem, setChallengeKpiDrillItem] = useState<{ key: string; label: string; type: string } | null>(null);
  const [challengeWizardVisible, setChallengeWizardVisible] = useState(false);
  const [challengeWizardStep, setChallengeWizardStep] = useState<ChallengeWizardStep>('source');
  const [challengeWizardSource, setChallengeWizardSource] = useState<'template' | 'custom'>('template');
  const [challengeWizardType, setChallengeWizardType] = useState<ChallengeKind>('team');
  const [challengeWizardName, setChallengeWizardName] = useState('');
  const [challengeWizardDescription, setChallengeWizardDescription] = useState('');
  const [challengeWizardStartAt, setChallengeWizardStartAt] = useState('');
  const [challengeWizardEndAt, setChallengeWizardEndAt] = useState('');
  const [challengeWizardTemplateId, setChallengeWizardTemplateId] = useState<string | null>(null);
  const [challengeWizardGoals, setChallengeWizardGoals] = useState<ChallengeWizardGoalDraft[]>([]);
  const [challengeWizardInviteUserIds, setChallengeWizardInviteUserIds] = useState<string[]>([]);
  const [challengeWizardTemplates, setChallengeWizardTemplates] = useState<ChallengeTemplateRow[]>([]);
  const [challengeWizardLoadingTemplates, setChallengeWizardLoadingTemplates] = useState(false);
  const [challengeWizardTemplateError, setChallengeWizardTemplateError] = useState<string | null>(null);
  const [challengeWizardSubmitting, setChallengeWizardSubmitting] = useState(false);
  const [challengeWizardError, setChallengeWizardError] = useState<string | null>(null);
  const [teamChallengesSegment, setTeamChallengesSegment] = useState<'active' | 'completed'>('active');

  // ── Derived memos ─────────────────────────────────────────────

  // challengeListItems and challengeHasSponsorSignal come from deps (orchestrator)
  // to break circular dependency with useRuntimePersona.

  const challengeScopedListItems = useMemo(() => {
    const resolvedTeamId = String(teamRosterTeamId ?? sessionUserMeta.team_id ?? sessionAppMeta.team_id ?? '').trim();
    return challengeListItems.filter((item) => {
      if (item.challengeKind !== 'team') return true;
      if (isSoloPersona) return false;
      if (!resolvedTeamId) return false;
      return String(item.raw?.team_id ?? '').trim() === resolvedTeamId;
    });
  }, [challengeListItems, isSoloPersona, sessionAppMeta.team_id, sessionUserMeta.team_id, teamRosterTeamId]);

  const challengeMemberListItems = useMemo(
    () =>
      challengeScopedListItems.filter((item) =>
        challengeMemberListTab === 'all' ? true : item.bucket === 'completed',
      ),
    [challengeMemberListTab, challengeScopedListItems],
  );

  const challengeFilteredScopedListItems = useMemo(
    () => challengeScopedListItems.filter((item) => challengeListFilterMatches(item, challengeListFilter)),
    [challengeListFilter, challengeScopedListItems],
  );

  const challengeListItemsForPersona =
    effectiveTeamPersonaVariant === 'member' ? challengeMemberListItems : challengeFilteredScopedListItems;

  const challengeStateRows = useMemo(
    () => ({
      active: challengeListItemsForPersona.filter((item) => item.bucket === 'active'),
      upcoming: challengeListItemsForPersona.filter((item) => item.bucket === 'upcoming'),
      completed: challengeListItemsForPersona.filter((item) => item.bucket === 'completed'),
    }),
    [challengeListItemsForPersona],
  );

  const challengeDefaultStateTab = useMemo<ChallengeStateTab>(() => {
    if (challengeStateRows.active.length > 0) return 'active';
    if (challengeStateRows.upcoming.length > 0) return 'upcoming';
    return 'completed';
  }, [challengeStateRows.active.length, challengeStateRows.completed.length, challengeStateRows.upcoming.length]);

  const challengeCurrentStateRows = challengeStateRows[challengeStateTab];

  const challengeSelectedWithinState =
    challengeCurrentStateRows.find((item) => item.id === challengeSelectedId) ?? challengeCurrentStateRows[0] ?? null;

  const challengeParticipantRows = useMemo(() => {
    const source = challengeSelectedWithinState?.leaderboardPreview ?? [];
    if (source.length > 0) return source;
    const fallbackCount = Math.max(1, Math.min(3, Number(challengeSelectedWithinState?.participants ?? 0)));
    return Array.from({ length: fallbackCount }).map((_, idx) => ({
      rank: idx + 1,
      name: idx === 0 ? 'Member ba3a' : `Member ${String(idx + 1).padStart(2, '0')}`,
      pct: 0,
      value: 0,
    }));
  }, [challengeSelectedWithinState?.leaderboardPreview, challengeSelectedWithinState?.participants]);

  const challengeKpiSummaryCards = useMemo(
    () => [
      { key: 'PC', label: 'Projection', value: challengeKpiGroups.PC.length },
      { key: 'GP', label: 'Growth', value: challengeKpiGroups.GP.length },
      { key: 'VP', label: 'Vitality', value: challengeKpiGroups.VP.length },
    ],
    [challengeKpiGroups.GP.length, challengeKpiGroups.PC.length, challengeKpiGroups.VP.length],
  );

  const challengeSelected =
    challengeListItems.find((item) => item.id === challengeSelectedId) ?? challengeListItems[0];

  const challengeScopedKpis = useMemo(
    () => deriveChallengeScopedKpis(challengeSelected, challengeSurfaceKpis),
    [challengeSelected, challengeSurfaceKpis],
  );

  const challengeScopedKpiGroups = useMemo(
    () => groupChallengeKpisByType(challengeScopedKpis),
    [challengeScopedKpis],
  );

  const challengeIsCompleted = challengeSelected?.bucket === 'completed';
  const challengeHasApiBackedDetail = isApiBackedChallenge(challengeSelected);
  const challengeIsPlaceholderOnly = !challengeHasApiBackedDetail;
  const challengeLeaderboardHasRealRows = (challengeSelected?.leaderboardPreview?.length ?? 0) > 0;

  const challengeCoachingPackageOutcome = useMemo(
    () =>
      pickRuntimePackageVisibility(
        normalizePackagingReadModelToVisibilityOutcome(challengeSelected?.raw?.packaging_read_model ?? null),
        challengeSelected?.raw?.package_visibility ?? null,
      ),
    [challengeSelected?.raw?.package_visibility, challengeSelected?.raw?.packaging_read_model],
  );

  const challengeCoachingGatePresentation = useMemo(
    () =>
      deriveCoachingPackageGatePresentation(
        'Challenge coaching and updates',
        challengeCoachingPackageOutcome,
      ),
    [challengeCoachingPackageOutcome],
  );

  const challengeCoachingGateBlocksCtas =
    challengeCoachingGatePresentation.tone === 'gated' || challengeCoachingGatePresentation.tone === 'blocked';

  const challengeListUsingPlaceholderRows = !Array.isArray(challengeApiRows) || challengeApiRows.length === 0;

  // ── Wizard helpers ────────────────────────────────────────────

  const challengeWizardFallbackTemplates = useMemo(
    () => buildDefaultChallengeTemplatesFromKpis(allSelectableKpis),
    [allSelectableKpis],
  );

  const buildChallengeWizardGoalDrafts = useCallback(
    (
      sourceRows: Array<{
        kpi_id: string;
        label: string;
        goal_scope_default: ChallengeGoalScope;
        suggested_target: number | null;
        display_order: number;
      }>,
    ): ChallengeWizardGoalDraft[] => {
      const byId = new Map(allSelectableKpis.map((kpi) => [String(kpi.id), kpi] as const));
      const normalized = sourceRows
        .map((row, idx) => {
          const kpi = byId.get(String(row.kpi_id));
          if (!kpi) return null;
          return {
            kpi_id: String(kpi.id),
            label: String(row.label || kpi.name),
            goal_scope: row.goal_scope_default === 'individual' ? 'individual' : 'team',
            goal_target:
              row.suggested_target == null || !Number.isFinite(Number(row.suggested_target))
                ? ''
                : String(Math.max(0, Number(row.suggested_target))),
            display_order:
              Number.isInteger(row.display_order) && row.display_order >= 0 ? row.display_order : idx,
          } as ChallengeWizardGoalDraft;
        })
        .filter((row): row is ChallengeWizardGoalDraft => Boolean(row))
        .sort((a, b) => a.display_order - b.display_order);
      if (normalized.length > 0) return normalized;
      return allSelectableKpis.slice(0, 4).map((kpi, idx) => ({
        kpi_id: String(kpi.id),
        label: String(kpi.name),
        goal_scope: kpi.type === 'PC' ? 'team' : 'individual',
        goal_target: '',
        display_order: idx,
      }));
    },
    [allSelectableKpis],
  );

  // ── Callbacks ─────────────────────────────────────────────────

  const joinChallenge = useCallback(
    async (challengeId: string) => {
      if (!accessToken) {
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
            Authorization: `Bearer ${accessToken}`,
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
    [accessToken, fetchDashboard],
  );

  const leaveChallenge = useCallback(
    async (challengeId: string) => {
      if (!accessToken) {
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
            Authorization: `Bearer ${accessToken}`,
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
    [accessToken, fetchDashboard],
  );

  const fetchChallengeTemplates = useCallback(async () => {
    if (!accessToken) return;
    setChallengeWizardLoadingTemplates(true);
    setChallengeWizardTemplateError(null);
    try {
      const response = await fetch(`${API_URL}/challenge-templates`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => ({}))) as ChallengeTemplateListApiResponse;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Template fetch failed (${response.status})`);
      }
      const templates = Array.isArray(payload?.templates) ? payload.templates : [];
      const normalized: ChallengeTemplateRow[] = templates
        .map((row, idx) => ({
          id: String(row.id ?? `template-${idx + 1}`),
          title: String(row.title ?? 'Challenge Template'),
          description: String(row.description ?? ''),
          suggested_duration_days: Math.max(1, Number(row.suggested_duration_days ?? 14) || 14),
          duration_weeks: typeof (row as Record<string, unknown>).duration_weeks === 'number' ? Number((row as Record<string, unknown>).duration_weeks) : null,
          phase_count: typeof (row as Record<string, unknown>).phase_count === 'number' ? Number((row as Record<string, unknown>).phase_count) : 0,
          default_challenge_name: typeof (row as Record<string, unknown>).default_challenge_name === 'string' ? String((row as Record<string, unknown>).default_challenge_name) : null,
          kpi_defaults: Array.isArray(row.kpi_defaults)
            ? row.kpi_defaults.map((goal, goalIdx) => {
                const goalScopeDefault: ChallengeGoalScope =
                  goal.goal_scope_default === 'individual' ? 'individual' : 'team';
                return {
                  kpi_id: String(goal.kpi_id ?? ''),
                  label: String(goal.label ?? `KPI ${goalIdx + 1}`),
                  goal_scope_default: goalScopeDefault,
                  suggested_target:
                    typeof goal.suggested_target === 'number' && Number.isFinite(goal.suggested_target)
                      ? goal.suggested_target
                      : null,
                  display_order: Number.isInteger(goal.display_order) ? goal.display_order : goalIdx,
                };
              })
            : [],
        }))
        .filter((row): row is ChallengeTemplateRow => Boolean(row.id && row.title));
      if (normalized.length > 0) {
        setChallengeWizardTemplates(normalized);
        return;
      }
      setChallengeWizardTemplates(challengeWizardFallbackTemplates);
      setChallengeWizardTemplateError('Live templates unavailable; using fallback catalog.');
    } catch (err) {
      setChallengeWizardTemplates(challengeWizardFallbackTemplates);
      setChallengeWizardTemplateError(err instanceof Error ? err.message : 'Template catalog unavailable.');
    } finally {
      setChallengeWizardLoadingTemplates(false);
    }
  }, [accessToken, challengeWizardFallbackTemplates]);

  const openChallengeWizard = useCallback(
    (requestedKind?: ChallengeKind) => {
      const now = new Date();
      const defaultType = isSoloPersona
        ? 'mini'
        : requestedKind === 'mini' || requestedKind === 'team'
          ? requestedKind
          : 'team';
      const defaultTemplates = challengeWizardTemplates.length > 0 ? challengeWizardTemplates : challengeWizardFallbackTemplates;
      const firstTemplate = defaultTemplates[0] ?? null;
      const startIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const durationDays = Math.max(1, Number(firstTemplate?.suggested_duration_days ?? (defaultType === 'mini' ? 14 : 21)));
      const endIso = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setChallengeWizardError(null);
      setChallengeWizardTemplateError(null);
      setChallengeWizardStep('source');
      setChallengeWizardSource('template');
      setChallengeWizardType(defaultType);
      setChallengeWizardName(
        firstTemplate?.default_challenge_name?.trim() || firstTemplate?.title || (defaultType === 'team' ? 'Team Challenge' : 'Mini Challenge'),
      );
      setChallengeWizardDescription('');
      setChallengeWizardStartAt(startIso);
      setChallengeWizardEndAt(endIso);
      setChallengeWizardTemplateId(firstTemplate?.id ?? null);
      setChallengeWizardGoals(
        buildChallengeWizardGoalDrafts(firstTemplate?.kpi_defaults ?? challengeWizardFallbackTemplates[0]?.kpi_defaults ?? []),
      );
      setChallengeWizardInviteUserIds([]);
      setChallengeWizardVisible(true);
    },
    [buildChallengeWizardGoalDrafts, challengeWizardFallbackTemplates, challengeWizardTemplates, isSoloPersona],
  );

  const applyChallengeWizardTemplate = useCallback(
    (templateId: string | null) => {
      if (!templateId) return;
      const template =
        challengeWizardTemplates.find((row) => row.id === templateId) ??
        challengeWizardFallbackTemplates.find((row) => row.id === templateId) ??
        null;
      if (!template) return;
      setChallengeWizardTemplateId(template.id);
      setChallengeWizardGoals(buildChallengeWizardGoalDrafts(template.kpi_defaults));
      const prefillName = template.default_challenge_name?.trim() || template.title;
      if (prefillName) setChallengeWizardName(prefillName);
      if (!challengeWizardDescription.trim()) {
        setChallengeWizardDescription(template.description);
      }
      const startRaw = challengeWizardStartAt.trim();
      if (startRaw) {
        const parsedStart = new Date(`${startRaw}T00:00:00.000Z`);
        if (!Number.isNaN(parsedStart.getTime())) {
          const nextEnd = new Date(parsedStart.getTime() + Math.max(1, template.suggested_duration_days) * 24 * 60 * 60 * 1000);
          setChallengeWizardEndAt(nextEnd.toISOString().slice(0, 10));
        }
      }
    },
    [buildChallengeWizardGoalDrafts, challengeWizardDescription, challengeWizardFallbackTemplates, challengeWizardStartAt, challengeWizardTemplates],
  );

  const submitChallengeWizard = useCallback(async () => {
    if (!accessToken) {
      setChallengeWizardError('Missing session token.');
      return;
    }
    const mode: 'team' | 'solo' = challengeWizardType === 'team' ? 'team' : 'solo';
    const teamId = resolveCurrentTeamContextId();
    if (mode === 'team' && !teamId) {
      setChallengeWizardError('Team context unavailable. Refresh and retry.');
      return;
    }
    const name = challengeWizardName.trim();
    if (!name) {
      setChallengeWizardError('Challenge name is required.');
      return;
    }
    const startDate = new Date(`${challengeWizardStartAt.trim()}T00:00:00.000Z`);
    const endDate = new Date(`${challengeWizardEndAt.trim()}T23:59:59.000Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      setChallengeWizardError('Set valid start/end dates. End date must be later than start date.');
      return;
    }
    const normalizedGoals = challengeWizardGoals
      .map((goal, idx) => ({
        kpi_id: String(goal.kpi_id ?? '').trim(),
        goal_scope: goal.goal_scope === 'individual' ? 'individual' : 'team',
        goal_target: goal.goal_target.trim().length > 0 ? Number(goal.goal_target) : null,
        display_order: idx,
      }))
      .filter((goal) => goal.kpi_id.length > 0);
    if (normalizedGoals.length === 0) {
      setChallengeWizardError('Select at least one KPI goal.');
      return;
    }
    if (normalizedGoals.some((goal) => goal.goal_target != null && (!Number.isFinite(goal.goal_target) || Number(goal.goal_target) < 0))) {
      setChallengeWizardError('Goal targets must be numeric values greater than or equal to 0.');
      return;
    }
    if (challengeWizardType === 'mini' && challengeWizardInviteUserIds.length > 3) {
      setChallengeWizardError('Mini challenges can include up to 3 invited participants.');
      return;
    }
    setChallengeWizardSubmitting(true);
    setChallengeWizardError(null);
    try {
      const response = await fetch(`${API_URL}/challenges`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify((() => {
          // Build phases payload from goals with phase_order
          const goalsWithPhase = challengeWizardGoals.filter((g) => g.phase_order != null);
          const hasPhases = goalsWithPhase.length > 0;
          const phaseOrderSet = new Set(goalsWithPhase.map((g) => g.phase_order!));
          // Look up template phases for names/timing
          const templatePhases = (challengeWizardTemplates.length > 0 ? challengeWizardTemplates : challengeWizardFallbackTemplates)
            .find((t) => t.id === challengeWizardTemplateId)
            ?.phases ?? (challengeWizardFallbackTemplates.find((t) => t.id === challengeWizardTemplateId) as any)?.phases ?? [];
          const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

          const phases = hasPhases
            ? Array.from(phaseOrderSet).sort().map((order) => {
                const templatePhase = Array.isArray(templatePhases) ? templatePhases.find((p: any) => p.phase_order === order) : undefined;
                const phaseName = templatePhase?.phase_name ?? `Phase ${order}`;
                const startsAtWeek = templatePhase?.starts_at_week ?? 0;
                const phaseStartMs = startDate.getTime() + startsAtWeek * 7 * 86400000;
                return {
                  phase_order: order,
                  phase_name: phaseName,
                  starts_at: new Date(phaseStartMs).toISOString(),
                  kpi_goals: goalsWithPhase
                    .filter((g) => g.phase_order === order)
                    .map((g, idx) => ({
                      kpi_id: String(g.kpi_id).trim(),
                      goal_scope: g.goal_scope === 'individual' ? 'individual' : 'team',
                      goal_target: g.goal_target.trim().length > 0 ? Number(g.goal_target) : null,
                      display_order: idx,
                    })),
                };
              })
            : undefined;

          return {
            name,
            description: challengeWizardDescription.trim() || undefined,
            mode,
            challenge_kind: challengeWizardType === 'team' ? 'team' : 'mini',
            team_id: mode === 'team' ? teamId : undefined,
            start_at: startDate.toISOString(),
            end_at: endDate.toISOString(),
            template_id: challengeWizardSource === 'template' ? challengeWizardTemplateId ?? undefined : undefined,
            kpi_goals: hasPhases ? [] : normalizedGoals,
            phases,
            invite_user_ids: mode === 'solo' ? challengeWizardInviteUserIds.slice(0, 3) : [],
            late_join_includes_history: mode === 'team',
          };
        })()),
      });
      const respPayload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(respPayload?.error ?? `Create challenge failed (${response.status})`);
      }
      setChallengeWizardVisible(false);
      setChallengeFlowScreen('list');
      setChallengeStateTab('active');
      setChallengeListFilter(challengeWizardType === 'team' ? 'team' : 'mini');
      setActiveTab('challenge');
      await fetchDashboard();
    } catch (err) {
      setChallengeWizardError(err instanceof Error ? err.message : 'Failed to create challenge');
    } finally {
      setChallengeWizardSubmitting(false);
    }
  }, [
    accessToken,
    challengeWizardDescription,
    challengeWizardEndAt,
    challengeWizardGoals,
    challengeWizardInviteUserIds,
    challengeWizardName,
    challengeWizardSource,
    challengeWizardStartAt,
    challengeWizardTemplateId,
    challengeWizardType,
    fetchDashboard,
    resolveCurrentTeamContextId,
    setActiveTab,
  ]);

  // ── Effects ───────────────────────────────────────────────────

  // Clear join error on navigation change
  useEffect(() => {
    setChallengeJoinError(null);
  }, [challengeFlowScreen, challengeSelectedId]);

  // Solo persona filter guard
  useEffect(() => {
    if (isSoloPersona && challengeListFilter === 'team') {
      setChallengeListFilter('all');
    }
  }, [challengeListFilter, isSoloPersona]);

  // State tab auto-sync when current tab is empty
  useEffect(() => {
    if (challengeStateRows[challengeStateTab].length > 0) return;
    if (challengeDefaultStateTab !== challengeStateTab) setChallengeStateTab(challengeDefaultStateTab);
  }, [challengeDefaultStateTab, challengeStateRows, challengeStateTab]);

  // Selected id auto-sync within current state tab
  useEffect(() => {
    if (challengeCurrentStateRows.length === 0) return;
    const selectedInState = challengeCurrentStateRows.some((item) => item.id === challengeSelectedId);
    if (!selectedInState) {
      setChallengeSelectedId(challengeCurrentStateRows[0].id);
    }
  }, [challengeCurrentStateRows, challengeSelectedId]);

  // Redirect explore screen when challenge tab is active
  useEffect(() => {
    if (activeTab !== 'challenge') return;
    if (challengeFlowScreen === 'explore') {
      setChallengeFlowScreen('list');
    }
  }, [activeTab, challengeFlowScreen]);

  // Wizard template fetch on open
  useEffect(() => {
    if (!challengeWizardVisible) return;
    void fetchChallengeTemplates();
  }, [challengeWizardVisible, fetchChallengeTemplates]);

  // ── Return ────────────────────────────────────────────────────

  return {
    // state
    challengeFlowScreen,
    challengeListFilter,
    challengeMemberListTab,
    challengeStateTab,
    challengeSelectedId,
    challengeApiRows,
    challengeApiFetchError,
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
    // derived
    challengeListItems,
    challengeHasSponsorSignal,
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
    // setters
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
    // callbacks
    joinChallenge,
    leaveChallenge,
    openChallengeWizard,
    applyChallengeWizardTemplate,
    submitChallengeWizard,
    buildChallengeWizardGoalDrafts,
    setActiveTabFromChallenge: setActiveTab,
  };
}
