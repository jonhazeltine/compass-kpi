/**
 * useCoachingWorkflow — Callbacks and effects for the coaching domain:
 * marketplace browse, engagement lifecycle, assignments, cohorts,
 * progress summary, journey list/detail, journey builder CRUD,
 * lesson progress, lesson media, journey invite codes.
 *
 * State declarations remain in the orchestrator to avoid circular
 * dependencies with useRuntimePersona. This hook receives setters as
 * deps and returns bound callbacks + effects.
 */

import { useCallback, useEffect, useMemo } from 'react';
import type {
  BottomTab,
  CoachAssignment,
  CoachCohortRow,
  CoachEngagement,
  CoachEngagementStatus,
  CoachEntitlementState,
  CoachProfile,
  CoachTabScreen,
  CoachingJourneyDetailResponse,
  CoachingJourneyListItem,
  CoachingJourneyListResponse,
  CoachingProgressSummaryResponse,
  CoachingShellScreen,
  ChallengeGoalScope,
  JourneyBuilderLesson,
  JourneyBuilderSaveState,
  LibraryAsset,
  LibraryCollection,
  RuntimeNotificationItem,
  RuntimeNotificationSummaryReadModel,
  RuntimePackageVisibilityOutcome,
} from '../screens/kpi-dashboard/types';

import {
  normalizeCoachAssignmentStatus,
  normalizePackagingReadModelToVisibilityOutcome,
  normalizeRuntimeNotificationItems,
  normalizeRuntimeNotificationSummary,
  pickRuntimePackageVisibility,
  summarizeNotificationRows,
} from '../screens/kpi-dashboard/helpers';

import { API_URL } from '../lib/supabase';

/** Locally defined to match the component-scoped type in KPIDashboardScreen */
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

// ── Injected state setters (owned by orchestrator) ──────────────────

export interface CoachingWorkflowSetters {
  setCoachProfiles: React.Dispatch<React.SetStateAction<CoachProfile[]>>;
  setCoachMarketplaceLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachEngagementStatus: React.Dispatch<React.SetStateAction<CoachEngagementStatus>>;
  setCoachActiveEngagement: React.Dispatch<React.SetStateAction<CoachEngagement | null>>;
  setCoachEntitlementState: React.Dispatch<React.SetStateAction<CoachEntitlementState>>;
  setCoachEngagementLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachTabScreen: React.Dispatch<React.SetStateAction<CoachTabScreen>>;
  setCoachAssignments: React.Dispatch<React.SetStateAction<CoachAssignment[]>>;
  setCoachCohorts: React.Dispatch<React.SetStateAction<CoachCohortRow[]>>;
  setCoachCohortsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachCohortsError: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachInviteCode: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachingClients: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; avatarUrl?: string | null; enrolledJourneyIds: string[]; enrolledJourneyNames?: string[] }>>>;
  setCoachingJourneys: React.Dispatch<React.SetStateAction<CoachingJourneyListItem[] | null>>;
  setCoachingJourneysPackageVisibility: React.Dispatch<React.SetStateAction<RuntimePackageVisibilityOutcome | null>>;
  setCoachingJourneysNotificationItems: React.Dispatch<React.SetStateAction<RuntimeNotificationItem[]>>;
  setCoachingJourneysNotificationSummary: React.Dispatch<React.SetStateAction<RuntimeNotificationSummaryReadModel | null>>;
  setCoachingJourneysLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachingJourneysError: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachingProgressSummary: React.Dispatch<React.SetStateAction<CoachingProgressSummaryResponse | null>>;
  setCoachingProgressNotificationItems: React.Dispatch<React.SetStateAction<RuntimeNotificationItem[]>>;
  setCoachingProgressNotificationSummary: React.Dispatch<React.SetStateAction<RuntimeNotificationSummaryReadModel | null>>;
  setCoachingProgressLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachingProgressError: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachingJourneyDetail: React.Dispatch<React.SetStateAction<CoachingJourneyDetailResponse | null>>;
  setCoachingJourneyDetailLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCoachingJourneyDetailError: React.Dispatch<React.SetStateAction<string | null>>;
  setJourneyInviteCodes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setJourneyInviteLoading: React.Dispatch<React.SetStateAction<string | null>>;
  setJbLessons: React.Dispatch<React.SetStateAction<JourneyBuilderLesson[]>>;
  setJbSaveState: React.Dispatch<React.SetStateAction<JourneyBuilderSaveState>>;
  setJbSaveMessage: React.Dispatch<React.SetStateAction<string>>;
  setJbAssets: React.Dispatch<React.SetStateAction<LibraryAsset[]>>;
  setJbCollections: React.Dispatch<React.SetStateAction<LibraryCollection[]>>;
  setCoachingLessonProgressSubmittingId: React.Dispatch<React.SetStateAction<string | null>>;
  setCoachingLessonProgressError: React.Dispatch<React.SetStateAction<string | null>>;
  setLessonMediaAssets: React.Dispatch<React.SetStateAction<LessonMediaAsset[]>>;
  setLessonMediaLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLessonMediaLessonId: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface CoachingWorkflowDeps {
  accessToken: string | null;
  activeTab: BottomTab;
  coachTabScreen: CoachTabScreen;
  isCoachRuntimeOperator: boolean;
  coachingJourneys: CoachingJourneyListItem[] | null;
  coachingJourneysLoading: boolean;
  coachingProgressSummary: CoachingProgressSummaryResponse | null;
  coachingProgressLoading: boolean;
  coachCohorts: CoachCohortRow[];
  coachCohortsLoading: boolean;
  coachProfiles: CoachProfile[];
  coachMarketplaceLoading: boolean;
  coachingShellScreen: CoachingShellScreen;
  coachingShellContext: { selectedLessonId: string | null };
  journeyInviteCodes: Record<string, string>;
  lessonMediaLessonId: string | null;
  lessonMediaAssets: LessonMediaAsset[];
}

// ── Hook ────────────────────────────────────────────────────────────

export function useCoachingWorkflow(
  deps: CoachingWorkflowDeps,
  setters: CoachingWorkflowSetters,
) {
  const {
    accessToken,
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
    coachingShellContext,
    journeyInviteCodes,
    lessonMediaLessonId,
    lessonMediaAssets,
  } = deps;

  // ── Callbacks ─────────────────────────────────────────────────

  const fetchCoachMarketplace = useCallback(async () => {
    if (!accessToken) { setters.setCoachProfiles([]); return; }
    setters.setCoachMarketplaceLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/coaching/coaches`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const body = await response.json() as { coaches: CoachProfile[] };
        setters.setCoachProfiles(body.coaches ?? []);
      } else {
        setters.setCoachProfiles([]);
      }
    } catch {
      setters.setCoachProfiles([]);
    } finally {
      setters.setCoachMarketplaceLoading(false);
    }
  }, [accessToken, setters]);

  const fetchCoachEngagement = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/coaching/engagements/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const body = await response.json() as {
          engagements: CoachEngagement[];
          engagement_status: CoachEngagementStatus;
          active_engagement: CoachEngagement | null;
        };
        setters.setCoachEngagementStatus(body.engagement_status);
        setters.setCoachActiveEngagement(body.active_engagement);
        if (body.active_engagement) {
          setters.setCoachEntitlementState(body.active_engagement.entitlement_state);
        }
        if (body.engagement_status === 'active' && !isCoachRuntimeOperator) {
          setters.setCoachTabScreen('coach_hub_primary');
        }
      }
    } catch {
      // silent — defaults remain
    }
  }, [accessToken, isCoachRuntimeOperator, setters]);

  const createCoachEngagement = useCallback(async (coachId: string) => {
    if (!accessToken) return;
    setters.setCoachEngagementLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/coaching/engagements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_id: coachId }),
      });
      if (response.ok) {
        const body = await response.json() as { engagement: CoachEngagement };
        setters.setCoachActiveEngagement(body.engagement);
        setters.setCoachEngagementStatus(body.engagement.status === 'active' ? 'active' : 'pending');
        setters.setCoachEntitlementState(body.engagement.entitlement_state);
        if (body.engagement.status === 'active') {
          setters.setCoachTabScreen('coach_hub_primary');
        }
      }
    } catch {
      // silent
    } finally {
      setters.setCoachEngagementLoading(false);
    }
  }, [accessToken, setters]);

  const fetchCoachAssignments = useCallback(async () => {
    if (!accessToken) { setters.setCoachAssignments([]); return; }
    try {
      const response = await fetch(`${API_URL}/api/coaching/assignments/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const body = await response.json() as { assignments: CoachAssignment[] };
        const normalized = Array.isArray(body.assignments)
          ? body.assignments.map((assignment) => ({
              ...assignment,
              status: normalizeCoachAssignmentStatus(assignment.status),
            }))
          : [];
        setters.setCoachAssignments(normalized);
      } else {
        setters.setCoachAssignments([]);
      }
    } catch {
      setters.setCoachAssignments([]);
    }
  }, [accessToken, setters]);

  const fetchCoachingJourneys = useCallback(async () => {
    if (!accessToken) {
      setters.setCoachingJourneysError('Sign in is required to view coaching journeys.');
      setters.setCoachingJourneys([]);
      setters.setCoachingJourneysPackageVisibility(null);
      setters.setCoachingJourneysNotificationItems([]);
      setters.setCoachingJourneysNotificationSummary(null);
      return;
    }
    setters.setCoachingJourneysLoading(true);
    setters.setCoachingJourneysError(null);
    try {
      const response = await fetch(`${API_URL}/api/coaching/journeys`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as CoachingJourneyListResponse;
      if (!response.ok) {
        setters.setCoachingJourneysError(
          response.status === 403
            ? 'Permission denied for coaching journeys in this scope (403).'
            : String(body.error ?? `Journeys request failed (${response.status})`)
        );
        setters.setCoachingJourneys([]);
        setters.setCoachingJourneysPackageVisibility(
          pickRuntimePackageVisibility(
            normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
            body.package_visibility ?? null
          )
        );
        setters.setCoachingJourneysNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys'));
        setters.setCoachingJourneysNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys'), {
              sourceLabel: 'coaching_journeys:error',
            })
        );
        return;
      }
      const normalizedJourneyNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'coaching_journeys');
      setters.setCoachingJourneys(Array.isArray(body.journeys) ? body.journeys : []);
      setters.setCoachingJourneysPackageVisibility(
        pickRuntimePackageVisibility(
          normalizePackagingReadModelToVisibilityOutcome(body.packaging_read_model ?? null),
          body.package_visibility ?? null
        )
      );
      setters.setCoachingJourneysNotificationItems(normalizedJourneyNotifications);
      setters.setCoachingJourneysNotificationSummary(
        normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
          summarizeNotificationRows(normalizedJourneyNotifications, {
            sourceLabel: 'coaching_journeys',
          })
      );
    } catch (err) {
      setters.setCoachingJourneysError(err instanceof Error ? err.message : 'Failed to load coaching journeys');
      setters.setCoachingJourneys([]);
      setters.setCoachingJourneysPackageVisibility(null);
      setters.setCoachingJourneysNotificationItems([]);
      setters.setCoachingJourneysNotificationSummary(null);
    } finally {
      setters.setCoachingJourneysLoading(false);
    }
  }, [accessToken, setters]);

  const fetchJourneyInviteCode = useCallback(async (journeyId: string) => {
    if (journeyInviteCodes[journeyId]) return journeyInviteCodes[journeyId];
    if (!accessToken) return null;
    setters.setJourneyInviteLoading(journeyId);
    try {
      const response = await fetch(`${API_URL}/api/coaching/journeys/${journeyId}/invite-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) return null;
      const body = await response.json() as { invite_code?: { code?: string } | string };
      const raw = body.invite_code;
      const code = typeof raw === 'string' ? raw : String((raw as { code?: string })?.code ?? '');
      if (code) {
        setters.setJourneyInviteCodes((prev) => ({ ...prev, [journeyId]: code }));
      }
      return code;
    } catch {
      return null;
    } finally {
      setters.setJourneyInviteLoading(null);
    }
  }, [accessToken, journeyInviteCodes, setters]);

  const fetchCoachCohorts = useCallback(async () => {
    if (!accessToken) { setters.setCoachCohorts([]); return; }
    setters.setCoachCohortsLoading(true);
    setters.setCoachCohortsError(null);
    try {
      const response = await fetch(`${API_URL}/api/coaching/cohorts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.ok) {
        const body = await response.json() as { cohorts: CoachCohortRow[] };
        setters.setCoachCohorts(body.cohorts ?? []);
      } else {
        setters.setCoachCohortsError('Could not load cohorts.');
      }
    } catch {
      setters.setCoachCohortsError('Network error loading cohorts.');
    } finally {
      setters.setCoachCohortsLoading(false);
    }
  }, [accessToken, setters]);

  const fetchCoachingProgressSummary = useCallback(async () => {
    if (!accessToken) {
      setters.setCoachingProgressError('Sign in is required to view coaching progress.');
      setters.setCoachingProgressSummary(null);
      setters.setCoachingProgressNotificationItems([]);
      setters.setCoachingProgressNotificationSummary(null);
      return;
    }
    setters.setCoachingProgressLoading(true);
    setters.setCoachingProgressError(null);
    try {
      const response = await fetch(`${API_URL}/api/coaching/progress`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as CoachingProgressSummaryResponse;
      if (!response.ok) {
        setters.setCoachingProgressError(
          response.status === 403
            ? 'Permission denied for coaching progress in this scope (403).'
            : String(body.error ?? `Progress request failed (${response.status})`)
        );
        setters.setCoachingProgressSummary(null);
        setters.setCoachingProgressNotificationItems(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress'));
        setters.setCoachingProgressNotificationSummary(
          normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
            summarizeNotificationRows(normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress'), {
              sourceLabel: 'coaching_progress:error',
            })
        );
        return;
      }
      const normalizedProgressNotifications = normalizeRuntimeNotificationItems(body.notification_items, 'coaching_progress');
      setters.setCoachingProgressSummary(body);
      setters.setCoachingProgressNotificationItems(normalizedProgressNotifications);
      setters.setCoachingProgressNotificationSummary(
        normalizeRuntimeNotificationSummary(body.notification_summary_read_model) ??
          summarizeNotificationRows(normalizedProgressNotifications, {
            sourceLabel: 'coaching_progress',
          })
      );
    } catch (err) {
      setters.setCoachingProgressError(err instanceof Error ? err.message : 'Failed to load coaching progress');
      setters.setCoachingProgressSummary(null);
      setters.setCoachingProgressNotificationItems([]);
      setters.setCoachingProgressNotificationSummary(null);
    } finally {
      setters.setCoachingProgressLoading(false);
    }
  }, [accessToken, setters]);

  const fetchLessonMedia = useCallback(
    async (lessonId: string) => {
      if (!accessToken) return;
      if (lessonMediaLessonId === lessonId && lessonMediaAssets.length > 0) return;
      setters.setLessonMediaLoading(true);
      setters.setLessonMediaLessonId(lessonId);
      try {
        const resp = await fetch(`${API_URL}/api/coaching/lessons/${encodeURIComponent(lessonId)}/media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) {
          setters.setLessonMediaAssets([]);
          return;
        }
        const payload = (await resp.json()) as { media?: LessonMediaAsset[] };
        setters.setLessonMediaAssets(payload.media ?? []);
      } catch {
        setters.setLessonMediaAssets([]);
      } finally {
        setters.setLessonMediaLoading(false);
      }
    },
    [accessToken, lessonMediaLessonId, lessonMediaAssets.length, setters],
  );

  // ── Effects ───────────────────────────────────────────────────

  // Load marketplace + engagement state when coach tab becomes active
  useEffect(() => {
    if (activeTab === 'coach') {
      void fetchCoachEngagement();
      if (coachTabScreen === 'coach_marketplace') {
        void fetchCoachMarketplace();
      }
      if (isCoachRuntimeOperator && accessToken) {
        void (async () => {
          try {
            const resp = await fetch(`${API_URL}/api/invites/my-codes?invite_type=coach`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (resp.ok) {
              const data = (await resp.json()) as { codes?: Array<{ code?: string }> };
              const code = data.codes?.[0]?.code;
              if (code) setters.setCoachInviteCode(code);
            }
          } catch { /* silent */ }
        })();
        void (async () => {
          try {
            const resp = await fetch(`${API_URL}/api/coaching/my-clients`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (resp.ok) {
              const data = (await resp.json()) as { clients?: Array<{ id: string; name: string; avatarUrl?: string | null; enrolledJourneyIds: string[]; enrolledJourneyNames?: string[] }> };
              if (data.clients) setters.setCoachingClients(data.clients);
            }
          } catch { /* silent */ }
        })();
      }
    }
  }, [activeTab, coachTabScreen, fetchCoachMarketplace, fetchCoachEngagement, isCoachRuntimeOperator, accessToken, setters]);

  // Auto-redirect coach operator away from marketplace
  useEffect(() => {
    if (activeTab !== 'coach') return;
    if (!isCoachRuntimeOperator) return;
    if (coachTabScreen !== 'coach_marketplace') return;
    setters.setCoachTabScreen('coach_hub_primary');
  }, [activeTab, coachTabScreen, isCoachRuntimeOperator, setters]);

  // Load assignments when goals/tasks screen becomes active
  useEffect(() => {
    if (activeTab === 'coach' && coachTabScreen === 'coach_goals_tasks') {
      void fetchCoachAssignments();
    }
  }, [activeTab, coachTabScreen, fetchCoachAssignments]);

  // Coach Workflow data bootstrap
  useEffect(() => {
    if (activeTab !== 'coach') return;
    if (coachTabScreen === 'coach_hub_primary' || coachTabScreen === 'coach_marketplace') {
      if (!coachingJourneys && !coachingJourneysLoading) void fetchCoachingJourneys();
    }
    if (coachTabScreen !== 'coach_hub_primary') return;
    if (!isCoachRuntimeOperator) return;
    if (coachCohorts.length === 0 && !coachCohortsLoading) void fetchCoachCohorts();
    if (coachProfiles.length === 0 && !coachMarketplaceLoading) void fetchCoachMarketplace();
  }, [
    activeTab, coachTabScreen, isCoachRuntimeOperator,
    coachingJourneys, coachingJourneysLoading, fetchCoachingJourneys,
    coachCohorts.length, coachCohortsLoading, fetchCoachCohorts,
    coachProfiles.length, coachMarketplaceLoading, fetchCoachMarketplace,
  ]);

  // Auto-fetch lesson media when lesson detail is opened
  useEffect(() => {
    if (coachingShellScreen !== 'coaching_lesson_detail') return;
    const lid = coachingShellContext.selectedLessonId;
    if (!lid) return;
    if (lessonMediaLessonId === lid) return;
    void fetchLessonMedia(lid);
  }, [coachingShellScreen, coachingShellContext.selectedLessonId, lessonMediaLessonId, fetchLessonMedia]);

  // Coaching journey fetch when comms tab navigates to journeys
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

  // ── Return ────────────────────────────────────────────────────

  return {
    fetchCoachMarketplace,
    fetchCoachEngagement,
    createCoachEngagement,
    fetchCoachAssignments,
    fetchCoachingJourneys,
    fetchJourneyInviteCode,
    fetchCoachCohorts,
    fetchCoachingProgressSummary,
    fetchLessonMedia,
  };
}
