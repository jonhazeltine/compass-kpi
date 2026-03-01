import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import CompassMark from '../assets/brand/compass_mark.svg';
import { useAdminAuthz } from '../contexts/AdminAuthzContext';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';
import {
  LEGACY_ADMIN_COACHING_PATH_BY_ROUTE_KEY,
  canAccessAdminRoute,
  getAdminRouteByKey,
  getAdminRouteByPath,
  type AdminRole,
  type AdminRouteKey,
} from '../lib/adminAuthz';

type CoachRouteKey = 'coachingLibrary' | 'coachingJourneys' | 'coachingCohorts' | 'coachingChannels';
type CoachWorkspaceMode = 'journeys' | 'people';
type SaveState = 'idle' | 'pending' | 'saved' | 'error';
type ChannelSegment = 'all' | 'top_producers' | 'new_agents' | 'sponsor_leads';
type PeoplePanelTab = 'cohorts' | 'channels';
type ChannelType = 'team' | 'challenge' | 'sponsor' | 'cohort' | 'direct';

type CoachSurface = {
  key: CoachWorkspaceMode;
  label: string;
  headline: string;
  summary: string;
};

type LibraryAsset = {
  id: string;
  title: string;
  category: string;
  scope: string;
  duration: string;
};

type LibraryCollection = {
  id: string;
  name: string;
  assetIds: string[];
};

type JourneyTask = {
  id: string;
  title: string;
  assetId: string | null;
};

type JourneyLesson = {
  id: string;
  title: string;
  tasks: JourneyTask[];
};

type JourneyDraft = {
  id: string;
  name: string;
  audience: string;
  lessons: JourneyLesson[];
};

type CohortPerson = {
  id: string;
  name: string;
  subtitle: string;
};

type ChannelApiRow = {
  id: string;
  type: ChannelType;
  name: string;
  team_id: string | null;
  context_id: string | null;
  my_role?: string;
  unread_count?: number;
  created_at?: string;
};

type ChannelMessageApiRow = {
  id: string;
  channel_id: string;
  body: string;
  created_at?: string;
};

type CohortDraft = {
  id: string;
  name: string;
  owner: string;
  program: string;
  memberIds: string[];
};

type DragPayload =
  | { type: 'asset'; assetId: string; sourceCollectionId: string | null }
  | { type: 'journey_task'; sourceJourneyId: string; sourceLessonId: string; taskId: string; assetId: string | null }
  | { type: 'journey_lesson'; sourceJourneyId: string; lessonId: string }
  | { type: 'person'; personId: string }
  | null;

const COACH_ROUTE_KEYS: CoachRouteKey[] = ['coachingLibrary', 'coachingJourneys', 'coachingCohorts', 'coachingChannels'];

const COACH_WORKSPACES: Record<CoachWorkspaceMode, CoachSurface> = {
  journeys: {
    key: 'journeys',
    label: 'Journeys',
    headline: 'Journey Builder',
    summary: 'Build learning paths by dragging content from the library into milestone steps.',
  },
  people: {
    key: 'people',
    label: 'People & Channels',
    headline: 'People & Channels',
    summary: 'Organize members into cohorts and manage communication channels.',
  },
};

const WORKSPACE_ROUTE_KEYS: Record<CoachWorkspaceMode, CoachRouteKey[]> = {
  journeys: ['coachingJourneys', 'coachingLibrary'],
  people: ['coachingCohorts', 'coachingChannels'],
};

const EMPTY_COHORTS: CohortDraft[] = [];
const EMPTY_PEOPLE: CohortPerson[] = [];
const DRAFT_CHANNEL_CONTEXT_ID = 'coach_portal_draft_v1';
const DRAFT_MESSAGE_PREFIX = 'coach_portal_snapshot:';

const DEFAULT_LESSONS: JourneyLesson[] = [
  { id: 'ls-kickoff', title: 'Lesson 1: Kickoff', tasks: [] },
  { id: 'ls-fundamentals', title: 'Lesson 2: Fundamentals', tasks: [] },
  { id: 'ls-application', title: 'Lesson 3: Live Application', tasks: [] },
];

/* ─── Helpers (unchanged business logic) ─── */

function normalizeCoachKey(routeKey: AdminRouteKey | null | undefined): CoachRouteKey | null {
  if (!routeKey) return null;
  if (routeKey === 'coachingUploads') return 'coachingLibrary';
  if (!COACH_ROUTE_KEYS.includes(routeKey as CoachRouteKey)) return null;
  return routeKey as CoachRouteKey;
}

function getCoachRouteKeyFromPath(pathname: string | undefined): CoachRouteKey | null {
  const route = getAdminRouteByPath(pathname);
  return normalizeCoachKey(route?.key);
}

function getWorkspaceModeForRoute(routeKey: CoachRouteKey): CoachWorkspaceMode {
  if (routeKey === 'coachingLibrary' || routeKey === 'coachingJourneys') return 'journeys';
  return 'people';
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

let lessonIdCounter = 0;
function cloneLessons(): JourneyLesson[] {
  return DEFAULT_LESSONS.map((lesson, i) => ({
    ...lesson,
    id: `ls-${Date.now()}-${lessonIdCounter++}-${i}`,
    tasks: [],
  }));
}

/* ─── Category color helpers ─── */
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Lesson Pack': { bg: '#EFF6FF', text: '#1D4ED8' },
  Campaign: { bg: '#FEF3C7', text: '#B45309' },
  Onboarding: { bg: '#F0FDF4', text: '#15803D' },
  Workshop: { bg: '#FDF2F8', text: '#BE185D' },
};
function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? { bg: '#F1F5F9', text: '#475569' };
}

async function fetchCoachJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error) message = payload.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function sendCoachJson<T>(path: string, accessToken: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error) message = payload.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export default function CoachPortalScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const { signOut, session } = useAuth();
  const { backendRole, backendRoleLoading, resolvedRoles } = useAdminAuthz();
  const [activeKey, setActiveKey] = useState<CoachRouteKey>(
    () => getCoachRouteKeyFromPath(typeof window !== 'undefined' ? window.location.pathname : undefined) ?? 'coachingLibrary'
  );
  const [notFoundPath, setNotFoundPath] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>([]);

  const [journeys, setJourneys] = useState<JourneyDraft[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState<{ lessonId: string; taskId: string } | null>(null);
  const [cohorts, setCohorts] = useState<CohortDraft[]>(EMPTY_COHORTS);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [newCohortName, setNewCohortName] = useState('');
  const [checkedPeopleIds, setCheckedPeopleIds] = useState<string[]>([]);
  const [channelSegment, setChannelSegment] = useState<ChannelSegment>('all');
  const [peoplePanelTab, setPeoplePanelTab] = useState<PeoplePanelTab>('cohorts');
  const [cohortPeople, setCohortPeople] = useState<CohortPerson[]>(EMPTY_PEOPLE);
  const [channelRows, setChannelRows] = useState<
    Array<{ id: string; c1: string; c2: string; c3: string; c4: string; segment: ChannelSegment; type: ChannelType; context_id: string | null }>
  >([]);
  const [draftChannelId, setDraftChannelId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalLoadError, setPortalLoadError] = useState<string | null>(null);

  const [dragPayload, setDragPayload] = useState<DragPayload>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [hoverLessonId, setHoverLessonId] = useState<string | null>(null);
  const [hoverTaskInsert, setHoverTaskInsert] = useState<{ lessonId: string; index: number } | null>(null);
  const [hoverLessonInsertIndex, setHoverLessonInsertIndex] = useState<number | null>(null);
  const [dropSuccessLessonId, setDropSuccessLessonId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('No unsaved changes.');
  const [dropHint, setDropHint] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'journey' | 'lesson' | 'task'; id: string; parentId?: string; label: string } | null>(null);

  const taskIdRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // Custom pointer-drag system (replaces unreliable HTML5 drag-and-drop)
  const pointerDragRef = useRef<{
    payload: DragPayload;
    label: string;
    startX: number;
    startY: number;
    started: boolean;
    ghostEl: HTMLElement | null;
    lastHoverCheck: number;
  } | null>(null);

  const effectiveRoles = resolvedRoles.length > 0 ? resolvedRoles : (['unknown'] as AdminRole[]);
  const visibleRoutes = useMemo(
    () =>
      COACH_ROUTE_KEYS.map((key) => getAdminRouteByKey(key)).filter((route) => canAccessAdminRoute(effectiveRoles, route)),
    [effectiveRoles]
  );

  const coachCanCompose =
    effectiveRoles.includes('coach') || effectiveRoles.includes('platform_admin') || effectiveRoles.includes('super_admin');
  const teamLeaderCanCompose = effectiveRoles.includes('team_leader') && !coachCanCompose;
  const sponsorOnly = effectiveRoles.includes('challenge_sponsor') && !coachCanCompose && !teamLeaderCanCompose;
  const canComposeDraft = coachCanCompose || teamLeaderCanCompose;
  const composeDeniedReason = sponsorOnly
    ? 'Sponsor access is scoped for visibility only.'
    : 'Current role cannot edit journey drafts on this route.';

  const activeWorkspace = getWorkspaceModeForRoute(activeKey);
  const activeSurface = COACH_WORKSPACES[activeWorkspace];
  const accountInitial = (session?.user?.email?.trim().charAt(0) || backendRole?.trim().charAt(0) || 'A').toUpperCase();
  const accountLabel = session?.user?.email || 'Signed-in account';

  const visibleWorkspaceModes = useMemo(() => {
    const modes: CoachWorkspaceMode[] = [];
    (Object.keys(WORKSPACE_ROUTE_KEYS) as CoachWorkspaceMode[]).forEach((mode) => {
      const hasRoute = WORKSPACE_ROUTE_KEYS[mode].some((key) =>
        canAccessAdminRoute(effectiveRoles, getAdminRouteByKey(key))
      );
      if (hasRoute) modes.push(mode);
    });
    return modes;
  }, [effectiveRoles]);

  const filteredAssets = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (asset) =>
        asset.title.toLowerCase().includes(q) ||
        asset.category.toLowerCase().includes(q) ||
        asset.scope.toLowerCase().includes(q) ||
        asset.duration.toLowerCase().includes(q)
    );
  }, [assets, libraryQuery]);

  const assetsById = useMemo(() => {
    const map = new Map<string, LibraryAsset>();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const filteredAssetIds = useMemo(() => new Set(filteredAssets.map((asset) => asset.id)), [filteredAssets]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null,
    [collections, selectedCollectionId]
  );

  const selectedJourney = useMemo(
    () => journeys.find((journey) => journey.id === selectedJourneyId) ?? journeys[0] ?? null,
    [journeys, selectedJourneyId]
  );

  const selectedCohort = cohorts.find((row) => row.id === selectedCohortId) ?? cohorts[0] ?? null;
  const filteredChannels = channelRows.filter((row) => channelSegment === 'all' || row.segment === channelSegment);
  const selectedGenericRow =
    filteredChannels.find((row) => row.id === selectedRowId) ?? filteredChannels[0] ?? null;

  /* ─── Effects (unchanged) ─── */

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (pointerDragRef.current?.ghostEl) {
        try { document.body.removeChild(pointerDragRef.current.ghostEl); } catch (_) {}
      }
      pointerDragRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dropSuccessLessonId) return;
    const timer = setTimeout(() => setDropSuccessLessonId(null), 1200);
    return () => clearTimeout(timer);
  }, [dropSuccessLessonId]);

  useEffect(() => {
    if (!selectedJourney && journeys.length > 0) {
      setSelectedJourneyId(journeys[0].id);
    }
  }, [journeys, selectedJourney]);

  useEffect(() => {
    if (!selectedCollection && collections.length > 0) {
      setSelectedCollectionId(collections[0].id);
    }
  }, [collections, selectedCollection]);

  useEffect(() => {
    const validIds = new Set(collections.map((collection) => collection.id));
    setExpandedCollectionIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [collections]);

  useEffect(() => {
    setActiveTaskMenu(null);
  }, [selectedJourneyId]);

  useEffect(() => {
    if (!selectedJourney?.lessons.length) return;
    if (!selectedJourney.lessons.some((l) => l.id === selectedLessonId)) {
      setSelectedLessonId(selectedJourney.lessons[0].id);
    }
  }, [selectedJourney, selectedLessonId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const pathname = window.location.pathname;
      const sourceRoute = getAdminRouteByPath(pathname);
      const sourceRouteKey = sourceRoute?.key ?? null;
      const routeKey = normalizeCoachKey(sourceRouteKey);
      const isCoachPath = pathname.startsWith('/coach') || pathname.startsWith('/admin/coaching');
      if (!isCoachPath) { setNotFoundPath(null); return; }
      if (!routeKey) { setNotFoundPath(pathname); return; }
      setNotFoundPath(null);
      if (sourceRouteKey === 'coachingUploads') {
        if (pathname !== '/coach/library') window.history.replaceState({}, '', '/coach/library');
        setActiveKey('coachingLibrary');
        return;
      }
      const route = getAdminRouteByKey(routeKey);
      const legacyPath = LEGACY_ADMIN_COACHING_PATH_BY_ROUTE_KEY[routeKey];
      if (legacyPath && pathname === legacyPath && route.path !== pathname) {
        window.history.replaceState({}, '', route.path);
      }
      setActiveKey((prev) => (prev === routeKey ? prev : routeKey));
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('codex:pathchange', sync as EventListener);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('codex:pathchange', sync as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!visibleRoutes.length) return;
    const activeRoute = getAdminRouteByKey(activeKey);
    if (canAccessAdminRoute(effectiveRoles, activeRoute)) return;
    const fallback = visibleRoutes[0];
    setActiveKey(fallback.key as CoachRouteKey);
    if (typeof window !== 'undefined' && window.location.pathname !== fallback.path) {
      window.history.replaceState({}, '', fallback.path);
    }
  }, [activeKey, effectiveRoles, visibleRoutes]);

  useEffect(() => {
    if (!selectedCohort && cohorts.length > 0) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [cohorts, selectedCohort]);

  const refreshPortalData = async () => {
    if (!session?.access_token) return;
    setPortalLoading(true);
    setPortalLoadError(null);
    try {
      const [channelsPayload, coachesPayload, journeysPayload] = await Promise.all([
        fetchCoachJson<{ channels?: ChannelApiRow[] }>('/api/channels', session.access_token),
        fetchCoachJson<{ coaches?: Array<{ id: string; name: string; specialties?: string[] }> }>(
          '/api/coaching/coaches',
          session.access_token
        ),
        fetchCoachJson<{ journeys?: Array<{ id: string; title: string; description?: string | null }> }>(
          '/api/coaching/journeys',
          session.access_token
        ),
      ]);

      const channels = channelsPayload.channels ?? [];
      const mappedChannels = channels.map((row) => {
        const type = row.type ?? 'team';
        const seg: ChannelSegment =
          type === 'team'
            ? 'top_producers'
            : type === 'cohort'
              ? 'new_agents'
              : type === 'sponsor'
                ? 'sponsor_leads'
                : 'all';
        return {
          id: row.id,
          c1: row.name || 'Untitled channel',
          c2: `${type} scope`,
          c3: String(row.unread_count ?? 0),
          c4: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'recent',
          segment: seg,
          type,
          context_id: row.context_id ?? null,
        };
      });
      setChannelRows(mappedChannels);

      const cohortRows = channels
        .filter((row) => row.type === 'cohort')
        .map((row) => ({
          id: row.id,
          name: row.name || 'Untitled cohort',
          owner: row.my_role === 'admin' ? 'Coach owner' : 'Channel admin',
          program: row.context_id || 'Unassigned',
          memberIds: [],
        }));
      setCohorts(cohortRows);
      const draftChannel = channels.find((row) => row.context_id === DRAFT_CHANNEL_CONTEXT_ID) ?? null;
      setDraftChannelId(draftChannel?.id ?? null);

      const coachPeople = (coachesPayload.coaches ?? []).map((coach) => ({
        id: coach.id,
        name: coach.name,
        subtitle: (coach.specialties ?? []).slice(0, 2).join(' · ') || 'Coach',
      }));
      setCohortPeople(coachPeople);

      const journeys = journeysPayload.journeys ?? [];
      const journeyDetails = await Promise.all(
        journeys.map(async (journey) => {
          const detail = await fetchCoachJson<{
            milestones?: Array<{ id: string; title?: string; lessons?: Array<{ id: string; title: string }> }>;
          }>(`/api/coaching/journeys/${journey.id}`, session.access_token as string);
          const lessons: JourneyLesson[] =
            detail.milestones?.flatMap((milestone) =>
              (milestone.lessons ?? []).map((lesson, idx) => ({
                id: lesson.id,
                title: lesson.title || `${milestone.title ?? 'Lesson'} ${idx + 1}`,
                tasks: [
                  {
                    id: `tk-${lesson.id}`,
                    title: lesson.title || 'Lesson task',
                    assetId: `asset-${lesson.id}`,
                  },
                ],
              }))
            ) ?? [];
          return {
            id: journey.id,
            name: journey.title,
            audience: journey.description?.trim() || 'Team scoped',
            lessons,
          } satisfies JourneyDraft;
        })
      );
      setJourneys(journeyDetails);

      const derivedAssets: LibraryAsset[] = [];
      const derivedCollections: LibraryCollection[] = [];
      for (const journey of journeyDetails) {
        const assetIds: string[] = [];
        for (const lesson of journey.lessons) {
          const assetId = `asset-${lesson.id}`;
          assetIds.push(assetId);
          derivedAssets.push({
            id: assetId,
            title: lesson.title,
            category: 'Lesson Pack',
            scope: journey.name,
            duration: '--',
          });
        }
        derivedCollections.push({
          id: `col-${journey.id}`,
          name: journey.name,
          assetIds,
        });
      }
      setAssets(derivedAssets);
      setCollections(derivedCollections);
      if (journeyDetails.length > 0) {
        setSelectedJourneyId((prev) => prev && journeyDetails.some((j) => j.id === prev) ? prev : journeyDetails[0].id);
        setSelectedLessonId(journeyDetails[0].lessons[0]?.id ?? null);
      }
      if (derivedCollections.length > 0) {
        setSelectedCollectionId((prev) => prev && derivedCollections.some((c) => c.id === prev) ? prev : derivedCollections[0].id);
        setExpandedCollectionIds([derivedCollections[0].id]);
      }

      if (draftChannel?.id) {
        try {
          const draftMessages = await fetchCoachJson<{ messages?: ChannelMessageApiRow[] }>(
            `/api/channels/${draftChannel.id}/messages`,
            session.access_token
          );
          const snapshotBody = [...(draftMessages.messages ?? [])]
            .reverse()
            .map((m) => (typeof m.body === 'string' ? m.body : ''))
            .find((body) => body.startsWith(DRAFT_MESSAGE_PREFIX));
          if (snapshotBody) {
            const raw = snapshotBody.slice(DRAFT_MESSAGE_PREFIX.length);
            const parsed = JSON.parse(raw) as {
              assets?: LibraryAsset[];
              collections?: LibraryCollection[];
              journeys?: JourneyDraft[];
              cohorts?: CohortDraft[];
            };
            if (Array.isArray(parsed.assets)) setAssets(parsed.assets);
            if (Array.isArray(parsed.collections)) setCollections(parsed.collections);
            if (Array.isArray(parsed.journeys)) setJourneys(parsed.journeys);
            if (Array.isArray(parsed.cohorts)) setCohorts(parsed.cohorts);
          }
        } catch {
          // keep baseline API data when snapshot parsing fails
        }
      }

      setSaveState('idle');
      setSaveMessage('Connected to backend coaching endpoints.');
      setDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load coach portal data';
      setPortalLoadError(message);
      setSaveState('error');
      setSaveMessage(message);
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    void refreshPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  /* ─── Navigation (unchanged) ─── */

  const navigate = (nextKey: CoachRouteKey) => {
    const nextRoute = getAdminRouteByKey(nextKey);
    setActiveKey(nextKey);
    setNotFoundPath(null);
    if (typeof window !== 'undefined' && window.location.pathname !== nextRoute.path) {
      window.history.pushState({}, '', nextRoute.path);
      window.dispatchEvent(new Event('codex:pathchange'));
    }
  };

  const navigateWorkspace = (mode: CoachWorkspaceMode) => {
    const currentInMode = WORKSPACE_ROUTE_KEYS[mode].includes(activeKey);
    if (currentInMode) return;
    const nextKey =
      WORKSPACE_ROUTE_KEYS[mode].find((key) => canAccessAdminRoute(effectiveRoles, getAdminRouteByKey(key))) ?? null;
    if (!nextKey) return;
    navigate(nextKey);
  };

  const toggleCollectionExpanded = (collectionId: string) => {
    setExpandedCollectionIds((prev) =>
      prev.includes(collectionId) ? prev.filter((id) => id !== collectionId) : [...prev, collectionId]
    );
  };

  /* ─── Drag & drop logic (unchanged) ─── */

  const persistDraftSnapshot = async () => {
    if (!canComposeDraft) {
      setSaveState('error');
      setSaveMessage(composeDeniedReason);
      return false;
    }
    if (!session?.access_token) {
      setSaveState('error');
      setSaveMessage('Missing session token for save.');
      return false;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaveState('pending');
    setSaveMessage('Saving...');
    try {
      let targetChannelId =
        draftChannelId ?? channelRows.find((row) => row.context_id === DRAFT_CHANNEL_CONTEXT_ID)?.id ?? null;
      if (!targetChannelId) {
        const created = await sendCoachJson<{ channel: ChannelApiRow }>(
          '/api/channels',
          session.access_token,
          {
            type: 'direct',
            name: 'Coach Portal Drafts',
            context_id: DRAFT_CHANNEL_CONTEXT_ID,
          }
        );
        targetChannelId = created.channel.id;
        setChannelRows((prev) => [
          {
            id: created.channel.id,
            c1: created.channel.name || 'Coach Portal Drafts',
            c2: 'direct scope',
            c3: '0',
            c4: created.channel.created_at ? new Date(created.channel.created_at).toLocaleDateString() : 'recent',
            segment: 'all',
            type: created.channel.type,
            context_id: created.channel.context_id ?? null,
          },
          ...prev.filter((row) => row.id !== created.channel.id),
        ]);
        setDraftChannelId(targetChannelId);
      }
      const snapshot = {
        version: 1,
        updated_at: new Date().toISOString(),
        assets,
        collections,
        journeys,
        cohorts,
      };
      await sendCoachJson<{ message: ChannelMessageApiRow }>(
        `/api/channels/${targetChannelId}/messages`,
        session.access_token,
        {
          body: `${DRAFT_MESSAGE_PREFIX}${JSON.stringify(snapshot)}`,
        }
      );
      setSaveState('saved');
      setDirty(false);
      setSaveMessage(`Saved at ${new Date().toLocaleTimeString()}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save draft';
      setSaveState('error');
      setSaveMessage(message);
      return false;
    } finally {
      savingRef.current = false;
    }
  };

  const markDraftChanged = (hint: string) => {
    setDirty(true);
    setDropHint(hint);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistDraftSnapshot();
    }, 800);
  };

  const parseDragPayload = (eventLike?: any): DragPayload => {
    const text = typeof eventLike?.dataTransfer?.getData === 'function' ? eventLike.dataTransfer.getData('text/plain') : '';
    if (text.startsWith('asset:')) {
      const [, assetId, sourceCollectionId] = text.split(':');
      return { type: 'asset', assetId, sourceCollectionId: sourceCollectionId === 'none' ? null : sourceCollectionId };
    }
    if (text.startsWith('journey-task:')) {
      const [, sourceJourneyId, sourceLessonId, taskId, assetId] = text.split(':');
      if (sourceJourneyId && sourceLessonId && taskId) {
        return { type: 'journey_task', sourceJourneyId, sourceLessonId, taskId, assetId: assetId === 'null' ? null : (assetId || null) };
      }
    }
    if (text.startsWith('journey-lesson:')) {
      const [, sourceJourneyId, lessonId] = text.split(':');
      if (sourceJourneyId && lessonId) {
        return { type: 'journey_lesson', sourceJourneyId, lessonId };
      }
    }
    if (text.startsWith('person:')) {
      const [, personId] = text.split(':');
      if (personId) return { type: 'person', personId };
    }
    return dragPayload;
  };

  const handleDragOver = (eventLike: any) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (eventLike?.dataTransfer) {
      eventLike.dataTransfer.dropEffect = canComposeDraft ? 'move' : 'none';
    }
  };

  const clearAllDragState = () => {
    setDragPayload(null);
    setDraggingAssetId(null);
    setDraggingTaskId(null);
    setDraggingLessonId(null);
    setHoverLessonId(null);
    setHoverTaskInsert(null);
    setHoverLessonInsertIndex(null);
  };

  /* ─── Pointer-based drag system ─── */
  const onGrabPointerDown = (e: any, payload: DragPayload, label: string) => {
    if (!canComposeDraft && payload?.type !== 'person') return;
    if (typeof document === 'undefined') return;
    const cx: number = e.clientX ?? e.nativeEvent?.clientX ?? 0;
    const cy: number = e.clientY ?? e.nativeEvent?.clientY ?? 0;
    pointerDragRef.current = { payload, label, startX: cx, startY: cy, started: false, ghostEl: null, lastHoverCheck: 0 };

    const onMove = (me: PointerEvent) => {
      const ref = pointerDragRef.current;
      if (!ref) return;
      const dx = me.clientX - ref.startX;
      const dy = me.clientY - ref.startY;

      // Threshold: only enter drag mode after 5 px of movement
      if (!ref.started) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        ref.started = true;
        setDragPayload(ref.payload);
        if (ref.payload?.type === 'asset') setDraggingAssetId(ref.payload.assetId);
        if (ref.payload?.type === 'journey_lesson') setDraggingLessonId(ref.payload.lessonId);
        if (ref.payload?.type === 'journey_task') setDraggingTaskId(ref.payload.taskId);
        setDropSuccessLessonId(null);
        // Create ghost card (raw DOM for performance — no React re-render per pixel)
        const ghost = document.createElement('div');
        ghost.style.cssText =
          'position:fixed;z-index:9999;pointer-events:none;background:#fff;border:2px solid #2563EB;' +
          'border-radius:8px;padding:8px 14px;box-shadow:0 8px 24px rgba(37,99,235,0.18);' +
          'font-size:13px;font-weight:700;color:#0F172A;max-width:220px;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis;transition:none;';
        ghost.textContent = '⠿  ' + ref.label;
        document.body.appendChild(ghost);
        ref.ghostEl = ghost;
      }

      // Move the ghost card to follow the cursor
      if (ref.ghostEl) {
        ref.ghostEl.style.left = `${me.clientX + 14}px`;
        ref.ghostEl.style.top = `${me.clientY - 18}px`;
      }

      // Throttle hover-target detection to every 40 ms
      const now = Date.now();
      if (now - ref.lastHoverCheck < 40) return;
      ref.lastHoverCheck = now;

      // Lesson reorder: scan ALL lesson cards for a single, unambiguous insertion index
      if (ref.payload?.type === 'journey_lesson') {
        const lessonEls = document.querySelectorAll('[data-drop-lesson]');
        let bestInsert = 0;
        let foundAny = false;
        lessonEls.forEach((el) => {
          const id = (el as HTMLElement).dataset.dropLesson;
          if (!id) return;
          const rect = el.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const lessonIdx = selectedJourney?.lessons.findIndex((l) => l.id === id) ?? -1;
          if (lessonIdx < 0) return;
          foundAny = true;
          if (me.clientY >= midY) bestInsert = lessonIdx + 1;
        });
        setHoverLessonInsertIndex(foundAny ? bestInsert : null);
        setHoverLessonId(null);
        setHoverTaskInsert(null);
      } else {
        // Asset / task / person drag: point-based detection
        const els = document.elementsFromPoint(me.clientX, me.clientY);
        let hovLesson: string | null = null;
        let hovSlot: { lessonId: string; index: number } | null = null;
        for (const el of els) {
          const d = (el as HTMLElement).dataset;
          if (d?.dropTaskSlot) {
            const parts = d.dropTaskSlot.split(':');
            hovSlot = { lessonId: parts[0], index: parseInt(parts[1], 10) };
            hovLesson = parts[0];
            break;
          }
          if (d?.dropLesson) { hovLesson = d.dropLesson; break; }
          if (d?.dropCollection) break;
          if (d?.dropCohort) break;
        }
        setHoverLessonId(hovLesson);
        setHoverTaskInsert(hovSlot);
        setHoverLessonInsertIndex(null);
      }
    };

    const onUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const ref = pointerDragRef.current;
      pointerDragRef.current = null;
      // Remove ghost
      if (ref?.ghostEl) { try { document.body.removeChild(ref.ghostEl); } catch (_) {} }
      if (!ref?.started) { clearAllDragState(); return; }

      const p = ref.payload;

      // Lesson reorder: use same full-scan approach as hover
      if (p?.type === 'journey_lesson') {
        const lessonEls = document.querySelectorAll('[data-drop-lesson]');
        let bestInsert = 0;
        let foundAny = false;
        lessonEls.forEach((el) => {
          const id = (el as HTMLElement).dataset.dropLesson;
          if (!id) return;
          const rect = el.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const lessonIdx = selectedJourney?.lessons.findIndex((l) => l.id === id) ?? -1;
          if (lessonIdx < 0) return;
          foundAny = true;
          if (ue.clientY >= midY) bestInsert = lessonIdx + 1;
        });
        if (foundAny) reorderLessonToSlot(p, bestInsert);
        clearAllDragState();
        return;
      }

      // Asset / task / person drop: point-based detection
      const els = document.elementsFromPoint(ue.clientX, ue.clientY);
      for (const el of els) {
        const d = (el as HTMLElement).dataset;
        if (d?.dropTaskSlot) {
          const parts = d.dropTaskSlot.split(':');
          if (p?.type === 'asset' || p?.type === 'journey_task') {
            addAssetToLesson(p, parts[0], parseInt(parts[1], 10));
            setDropSuccessLessonId(parts[0]);
          }
          break;
        }
        if (d?.dropLesson) {
          if (p?.type === 'asset' || p?.type === 'journey_task') {
            const tc = selectedJourney?.lessons.find((l) => l.id === d.dropLesson)?.tasks.length ?? 0;
            addAssetToLesson(p, d.dropLesson, tc);
            setDropSuccessLessonId(d.dropLesson);
          }
          break;
        }
        if (d?.dropCollection) {
          if (p?.type === 'asset') assignAssetToCollection(d.dropCollection, p);
          break;
        }
        if (d?.dropCohort) {
          if (p?.type === 'person') addPeopleToCohort(d.dropCohort, [p.personId]);
          break;
        }
      }
      clearAllDragState();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const startAssetDrag = (assetId: string, sourceCollectionId: string | null) => {
    if (!canComposeDraft) return;
    setDragPayload({ type: 'asset', assetId, sourceCollectionId });
    setDraggingAssetId(assetId);
    setDraggingTaskId(null);
    setDraggingLessonId(null);
    setDropSuccessLessonId(null);
  };

  const assignAssetToCollection = (collectionId: string, payload: DragPayload) => {
    if (!canComposeDraft || !payload || payload.type !== 'asset') return;
    const targetExists = collections.some((collection) => collection.id === collectionId);
    if (!targetExists) return;
    setCollections((prev) =>
      prev.map((collection) => {
        const filteredIds = collection.assetIds.filter((assetId) => assetId !== payload.assetId);
        if (collection.id !== collectionId) return { ...collection, assetIds: filteredIds };
        return { ...collection, assetIds: [...filteredIds, payload.assetId] };
      })
    );
    setSelectedCollectionId(collectionId);
    markDraftChanged('Asset moved into collection.');
  };

  const addAssetToLesson = (payload: DragPayload, targetLessonId: string, targetIndex: number) => {
    if (!selectedJourney) return;
    if (payload?.type === 'asset') {
      setJourneys((prev) =>
        prev.map((journey) => {
          if (journey.id !== selectedJourney.id) return journey;
          const lessons = journey.lessons.map((lesson) => {
            if (lesson.id !== targetLessonId) return lesson;
            const insertAt = Math.max(0, Math.min(targetIndex, lesson.tasks.length));
            const nextTasks = [...lesson.tasks];
            const assetTitle = assetsById.get(payload.assetId)?.title ?? 'New Task';
            nextTasks.splice(insertAt, 0, { id: `tk-${Date.now()}-${taskIdRef.current++}`, title: assetTitle, assetId: payload.assetId });
            return { ...lesson, tasks: nextTasks };
          });
          return { ...journey, lessons };
        })
      );
      markDraftChanged('Asset added to lesson.');
      return;
    }
    if (payload?.type === 'journey_task') {
      setJourneys((prev) =>
        prev.map((journey) => {
          if (journey.id !== selectedJourney.id || payload.sourceJourneyId !== selectedJourney.id) return journey;
          let movingTask: JourneyTask | null = null;
          const strippedLessons = journey.lessons.map((lesson) => {
            if (lesson.id !== payload.sourceLessonId) return lesson;
            const remainingTasks = lesson.tasks.filter((task) => {
              if (task.id !== payload.taskId) return true;
              movingTask = task;
              return false;
            });
            return { ...lesson, tasks: remainingTasks };
          });
          if (!movingTask) return journey;
          const lessons = strippedLessons.map((lesson) => {
            if (lesson.id !== targetLessonId) return lesson;
            const insertAt = Math.max(0, Math.min(targetIndex, lesson.tasks.length));
            const nextTasks = [...lesson.tasks];
            nextTasks.splice(insertAt, 0, movingTask as JourneyTask);
            return { ...lesson, tasks: nextTasks };
          });
          return { ...journey, lessons };
        })
      );
      markDraftChanged('Task moved.');
    }
  };

  const handleDropToLesson = (eventLike: any, lessonId: string, index: number) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    addAssetToLesson(payload, lessonId, index);
    if (payload?.type === 'asset' || payload?.type === 'journey_task') {
      setDropSuccessLessonId(lessonId);
    }
    clearAllDragState();
  };

  const handleDropToTaskSlot = (eventLike: any, lessonId: string, insertIndex: number) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    if (!payload) return;
    addAssetToLesson(payload, lessonId, insertIndex);
    setDropSuccessLessonId(lessonId);
    clearAllDragState();
  };

  const handleDropToCollection = (eventLike: any, collectionId: string) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    assignAssetToCollection(collectionId, payload);
    clearAllDragState();
  };

  const handleClickDropToCollection = (collectionId: string) => {
    if (!canComposeDraft) return false;
    if (!dragPayload || dragPayload.type !== 'asset') return false;
    assignAssetToCollection(collectionId, dragPayload);
    clearAllDragState();
    return true;
  };

  const handleClickDropToLesson = (lessonId: string, taskCount: number) => {
    if (!canComposeDraft) return false;
    if (!dragPayload || (dragPayload.type !== 'asset' && dragPayload.type !== 'journey_task')) return false;
    addAssetToLesson(dragPayload, lessonId, taskCount);
    setDropSuccessLessonId(lessonId);
    clearAllDragState();
    return true;
  };

  const reorderLessonByDrop = (payload: DragPayload, targetLessonId: string) => {
    if (!selectedJourney || payload?.type !== 'journey_lesson' || payload.sourceJourneyId !== selectedJourney.id) return false;
    const fromIndex = selectedJourney.lessons.findIndex((row) => row.id === payload.lessonId);
    const toIndex = selectedJourney.lessons.findIndex((row) => row.id === targetLessonId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id ? { ...journey, lessons: moveItem(journey.lessons, fromIndex, toIndex) } : journey
      )
    );
    markDraftChanged('Lesson order updated.');
    return true;
  };

  const reorderLessonToSlot = (payload: DragPayload, toSlot: number) => {
    if (!selectedJourney || payload?.type !== 'journey_lesson' || payload.sourceJourneyId !== selectedJourney.id) return false;
    const fromIndex = selectedJourney.lessons.findIndex((row) => row.id === payload.lessonId);
    if (fromIndex < 0) return false;
    // Adjust: inserting after the removed position means the target shifts down by 1
    const toIndex = toSlot > fromIndex ? toSlot - 1 : toSlot;
    if (fromIndex === toIndex) return false;
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id ? { ...journey, lessons: moveItem(journey.lessons, fromIndex, toIndex) } : journey
      )
    );
    markDraftChanged('Lesson order updated.');
    return true;
  };

  const handleDropToLessonCard = (eventLike: any, lessonId: string) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    if (payload?.type !== 'journey_lesson') return;
    if (reorderLessonByDrop(payload, lessonId)) {
      clearAllDragState();
    }
  };

  const handlePointerDropToLesson = (lessonId: string) => {
    if (!canComposeDraft || !dragPayload) return false;
    if (dragPayload.type === 'journey_lesson') {
      const reordered = reorderLessonByDrop(dragPayload, lessonId);
      if (reordered) clearAllDragState();
      return reordered;
    }
    if (dragPayload.type === 'asset' || dragPayload.type === 'journey_task') {
      const taskCount = selectedJourney?.lessons.find((row) => row.id === lessonId)?.tasks.length ?? 0;
      addAssetToLesson(dragPayload, lessonId, taskCount);
      setDropSuccessLessonId(lessonId);
      clearAllDragState();
      return true;
    }
    return false;
  };

  const addPeopleToCohort = (cohortId: string, personIds: string[]) => {
    if (!personIds.length) return;
    setCohorts((prev) =>
      prev.map((cohort) =>
        cohort.id === cohortId
          ? { ...cohort, memberIds: Array.from(new Set([...cohort.memberIds, ...personIds])) }
          : cohort
      )
    );
    markDraftChanged('Cohort membership updated.');
  };

  const handleClickAssignPersonToCohort = (cohortId: string) => {
    if (!canComposeDraft) return false;
    if (!dragPayload || dragPayload.type !== 'person') return false;
    addPeopleToCohort(cohortId, [dragPayload.personId]);
    setDragPayload(null);
    return true;
  };

  const createCohort = async () => {
    if (!canComposeDraft) {
      setSaveState('error');
      setSaveMessage(composeDeniedReason);
      return;
    }
    if (!session?.access_token) {
      setSaveState('error');
      setSaveMessage('Missing session token for cohort create.');
      return;
    }
    const name = newCohortName.trim();
    if (!name) return;
    setSaveState('pending');
    setSaveMessage('Creating cohort...');
    try {
      const created = await sendCoachJson<{ channel: ChannelApiRow }>(
        '/api/channels',
        session.access_token,
        {
          type: 'cohort',
          name,
        }
      );
      const cohort: CohortDraft = {
        id: created.channel.id,
        name: created.channel.name || name,
        owner: 'Coach owner',
        program: created.channel.context_id || 'Unassigned',
        memberIds: [],
      };
      setCohorts((prev) => [cohort, ...prev.filter((row) => row.id !== cohort.id)]);
      setChannelRows((prev) => [
        {
          id: created.channel.id,
          c1: created.channel.name || name,
          c2: 'cohort scope',
          c3: '0',
          c4: created.channel.created_at ? new Date(created.channel.created_at).toLocaleDateString() : 'recent',
          segment: 'new_agents',
          type: created.channel.type,
          context_id: created.channel.context_id ?? null,
        },
        ...prev.filter((row) => row.id !== created.channel.id),
      ]);
      setSelectedCohortId(cohort.id);
      setNewCohortName('');
      setSaveState('saved');
      setSaveMessage(`Cohort created at ${new Date().toLocaleTimeString()}`);
      setDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create cohort';
      setSaveState('error');
      setSaveMessage(message);
    }
  };

  const reorderTask = (lessonId: string, taskId: string, direction: -1 | 1) => {
    if (!canComposeDraft || !selectedJourney) return;
    setJourneys((prev) =>
      prev.map((journey) => {
        if (journey.id !== selectedJourney.id) return journey;
        const lessons = journey.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;
          const fromIndex = lesson.tasks.findIndex((task) => task.id === taskId);
          if (fromIndex < 0) return lesson;
          return { ...lesson, tasks: moveItem(lesson.tasks, fromIndex, fromIndex + direction) };
        });
        return { ...journey, lessons };
      })
    );
    setActiveTaskMenu(null);
    markDraftChanged('Task order updated.');
  };

  const removeTask = (lessonId: string, taskId: string) => {
    if (!canComposeDraft || !selectedJourney) return;
    setJourneys((prev) =>
      prev.map((journey) => {
        if (journey.id !== selectedJourney.id) return journey;
        const lessons = journey.lessons.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, tasks: lesson.tasks.filter((task) => task.id !== taskId) }
            : lesson
        );
        return { ...journey, lessons };
      })
    );
    setActiveTaskMenu(null);
    markDraftChanged('Task removed.');
  };

  const addLesson = () => {
    if (!canComposeDraft || !selectedJourney) return;
    const nextCount = selectedJourney.lessons.length + 1;
    const nextLesson: JourneyLesson = {
      id: `ls-${Date.now()}`,
      title: `Lesson ${nextCount}`,
      tasks: [],
    };
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id ? { ...journey, lessons: [...journey.lessons, nextLesson] } : journey
      )
    );
    setSelectedLessonId(nextLesson.id);
    markDraftChanged('Lesson added.');
  };

  const addTaskToLesson = (targetLessonId?: string) => {
    if (!canComposeDraft || !selectedJourney) return;
    const lessonId = targetLessonId ?? selectedLessonId;
    const lesson = selectedJourney.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const nextTask: JourneyTask = {
      id: `tk-${Date.now()}-${taskIdRef.current++}`,
      title: `Task ${lesson.tasks.length + 1}`,
      assetId: null,
    };
    setJourneys((prev) =>
      prev.map((journey) => {
        if (journey.id !== selectedJourney.id) return journey;
        const lessons = journey.lessons.map((l) =>
          l.id === lessonId ? { ...l, tasks: [...l.tasks, nextTask] } : l
        );
        return { ...journey, lessons };
      })
    );
    markDraftChanged('Task added to lesson.');
  };

  const createJourney = () => {
    if (!canComposeDraft) { setSaveState('error'); setSaveMessage(composeDeniedReason); return; }
    const name = newJourneyName.trim();
    if (!name) { setSaveState('error'); setSaveMessage('Enter a journey name first.'); return; }
    const id = `jr-${Date.now()}`;
    const newJourney: JourneyDraft = { id, name, audience: 'Draft audience', lessons: [] };
    setJourneys((prev) => [newJourney, ...prev]);
    setSelectedJourneyId(id);
    setNewJourneyName('');
    markDraftChanged('New journey created.');
  };

  const deleteJourney = (journeyId: string) => {
    if (!canComposeDraft) return;
    setJourneys((prev) => prev.filter((j) => j.id !== journeyId));
    if (selectedJourneyId === journeyId) {
      setSelectedJourneyId(null);
      setSelectedLessonId(null);
    }
    setConfirmDelete(null);
    markDraftChanged('Journey deleted.');
  };

  const deleteLesson = (lessonId: string) => {
    if (!canComposeDraft || !selectedJourney) return;
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id
          ? { ...journey, lessons: journey.lessons.filter((l) => l.id !== lessonId) }
          : journey
      )
    );
    if (selectedLessonId === lessonId) setSelectedLessonId(null);
    setConfirmDelete(null);
    markDraftChanged('Lesson deleted.');
  };

  const confirmAndDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'journey') deleteJourney(confirmDelete.id);
    else if (confirmDelete.type === 'lesson') deleteLesson(confirmDelete.id);
    else if (confirmDelete.type === 'task' && confirmDelete.parentId) {
      removeTask(confirmDelete.parentId, confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const saveDraft = async () => {
    if (!canComposeDraft) { setSaveState('error'); setSaveMessage(composeDeniedReason); return; }
    if (!selectedJourney) { setSaveState('error'); setSaveMessage('Select a journey first.'); return; }
    if (!dirty) { setSaveState('idle'); setSaveMessage('No unsaved changes.'); return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persistDraftSnapshot();
  };

  /* ════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════ */

  if (!visibleRoutes.length) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>Access Required</Text>
          <Text style={s.emptyBody}>This account does not have coach portal access.</Text>
          <Text style={s.emptyMeta}>Roles: {effectiveRoles.join(', ')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFoundPath) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>Route Not Found</Text>
          <Text style={s.emptyBody}>{notFoundPath}</Text>
          <TouchableOpacity style={s.btnPrimary} onPress={() => navigate(visibleRoutes[0].key as CoachRouteKey)}>
            <Text style={s.btnPrimaryText}>Go to Coach Portal</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      {/* ── Top Navigation Bar ── */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <View style={s.logoBox}><CompassMark width={28} height={28} /></View>
          <View>
            <Text style={s.topBarTitle}>Coach Portal</Text>
            <Text style={s.topBarSub}>{backendRole ? backendRole : 'Loading role...'}</Text>
          </View>
        </View>
        <View style={s.topBarRight}>
          {/* Workspace mode tabs */}
          <View style={s.modeTabs}>
            {visibleWorkspaceModes.map((mode) => {
              const selected = mode === activeWorkspace;
              return (
                <Pressable key={mode} style={[s.modeTab, selected && s.modeTabActive]} onPress={() => navigateWorkspace(mode)}>
                  <Text style={[s.modeTabText, selected && s.modeTabTextActive]}>
                    {mode === 'journeys' ? '📚' : '👥'} {COACH_WORKSPACES[mode].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Account */}
          <View style={s.accountWrap}>
            <Pressable style={[s.avatarBtn, accountMenuOpen && s.avatarBtnOpen]} onPress={() => setAccountMenuOpen((p) => !p)}>
              <Text style={s.avatarBtnText}>{accountInitial}</Text>
            </Pressable>
            {accountMenuOpen ? (
              <View style={s.accountDrop}>
                <Text style={s.accountDropLabel}>{accountLabel}</Text>
                <Text style={s.accountDropRole}>{backendRole ?? 'Role from session'}</Text>
                <TouchableOpacity style={s.accountDropSignOut} onPress={() => { setAccountMenuOpen(false); void signOut(); }}>
                  <Text style={s.accountDropSignOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {portalLoading ? (
        <View style={s.runtimeBanner}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={s.runtimeBannerText}>Loading coach workspace data...</Text>
        </View>
      ) : null}
      {portalLoadError ? (
        <View style={s.runtimeBannerError}>
          <Text style={s.runtimeBannerErrorText}>{portalLoadError}</Text>
          <TouchableOpacity style={s.runtimeRetryBtn} onPress={() => { void refreshPortalData(); }}>
            <Text style={s.runtimeRetryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Main Content Area ── */}
      <View style={s.mainRow}>
        {/* ════ JOURNEYS MODE ════ */}
        {activeWorkspace === 'journeys' ? (
          <>
            {/* ── Library Sidebar ── */}
            <View style={[s.sidebar, isCompact && s.sidebarCompact]}>
              <Text style={s.sidebarTitle}>Content Library</Text>
              <TextInput
                value={libraryQuery}
                onChangeText={setLibraryQuery}
                placeholder="Search content..."
                placeholderTextColor="#94A3B8"
                style={s.sidebarSearch}
              />
              {/* Selected-asset banner: visible when an asset is click-selected and waiting for drop target */}
              {dragPayload?.type === 'asset' && (() => {
                const selAsset = assetsById.get(dragPayload.assetId);
                return (
                  <View style={s.selectedAssetBanner}>
                    <Text style={s.selectedAssetBannerText} numberOfLines={1}>
                      📎 {selAsset?.title ?? 'Asset'} selected — click a lesson to place it
                    </Text>
                    <Pressable onPress={() => { setDragPayload(null); setDraggingAssetId(null); }}>
                      <Text style={s.selectedAssetBannerClose}>✕</Text>
                    </Pressable>
                  </View>
                );
              })()}
              <View style={s.sidebarScroll}>
                {collections.map((collection) => {
                  const expanded = expandedCollectionIds.includes(collection.id);
                  const selected = collection.id === selectedCollectionId;
                  const nestedAssets = collection.assetIds
                    .map((id) => assetsById.get(id))
                    .filter((a): a is LibraryAsset => Boolean(a))
                    .filter((a) => !libraryQuery.trim() || filteredAssetIds.has(a.id));
                  return (
                    <View key={collection.id} style={s.folderGroup}>
                      <Pressable
                        style={[s.folderRow, selected && s.folderRowActive]}
                        onPress={() => { if (!handleClickDropToCollection(collection.id)) { setSelectedCollectionId(collection.id); toggleCollectionExpanded(collection.id); } }}
                        {...({ dataSet: { dropCollection: collection.id } } as any)}
                      >
                        <Text style={s.folderIcon}>{expanded ? '▾' : '▸'}</Text>
                        <Text style={[s.folderName, selected && s.folderNameActive]}>{collection.name}</Text>
                        <View style={s.folderCount}><Text style={s.folderCountText}>{collection.assetIds.length}</Text></View>
                      </Pressable>
                      {expanded ? (
                        <View style={s.assetList}>
                          {nestedAssets.length ? nestedAssets.map((asset) => {
                            const catColor = getCategoryColor(asset.category);
                            const isSelected = draggingAssetId === asset.id;
                            return (
                              <View
                                key={asset.id}
                                style={[s.assetRow, isSelected && s.assetRowDragging, { userSelect: 'none', cursor: 'grab' } as any]}
                                {...({
                                  onPointerDown: (e: any) => onGrabPointerDown(e, { type: 'asset', assetId: asset.id, sourceCollectionId: collection.id }, asset.title),
                                } as any)}
                              >
                                <Text style={s.dragHandle}>{isSelected ? '✓' : '⠿'}</Text>
                                <Pressable
                                  style={s.assetInfo}
                                  onPress={() => {
                                    if (draggingAssetId === asset.id) { clearAllDragState(); }
                                    else startAssetDrag(asset.id, collection.id);
                                  }}
                                >
                                  <Text style={s.assetTitle} numberOfLines={1}>{asset.title}</Text>
                                  <View style={s.assetMeta}>
                                    <View style={[s.categoryBadge, { backgroundColor: catColor.bg }]}>
                                      <Text style={[s.categoryBadgeText, { color: catColor.text }]}>{asset.category}</Text>
                                    </View>
                                    <Text style={s.assetDuration}>{asset.duration}</Text>
                                  </View>
                                </Pressable>
                              </View>
                            );
                          }) : (
                            <Text style={s.emptyHint}>No matching content</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Builder Canvas ── */}
            <ScrollView style={s.canvas} contentContainerStyle={s.canvasInner} showsVerticalScrollIndicator>
              {/* Journey selector */}
              <View style={s.canvasSection}>
                <View style={s.canvasSectionHeader}>
                  <Text style={s.canvasSectionTitle}>Journeys</Text>
                  <Text style={s.canvasSectionCount}>{journeys.length} total</Text>
                </View>
                <View style={s.journeyChips}>
                  {journeys.map((j) => {
                    const sel = j.id === selectedJourney?.id;
                    return (
                      <View key={j.id} style={[s.journeyChip, sel && s.journeyChipActive]}>
                        <Pressable style={s.journeyChipBody} onPress={() => setSelectedJourneyId(j.id)}>
                          <Text style={[s.journeyChipText, sel && s.journeyChipTextActive]}>{j.name}</Text>
                          <Text style={s.journeyChipMeta}>{j.audience} · {j.lessons.length} lessons</Text>
                        </Pressable>
                        {canComposeDraft ? (
                          <Pressable
                            style={s.chipDeleteBtn}
                            onPress={() => setConfirmDelete({ type: 'journey', id: j.id, label: j.name })}
                          >
                            <Text style={s.chipDeleteBtnText}>✕</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {/* Inline + Journey */}
                {canComposeDraft ? (
                  <View style={s.inlineCreateRow}>
                    <TextInput value={newJourneyName} onChangeText={setNewJourneyName} placeholder="New journey name..." placeholderTextColor="#94A3B8" style={s.inlineCreateInput} />
                    <TouchableOpacity style={s.btnSecondary} onPress={createJourney}><Text style={s.btnSecondaryText}>+ Journey</Text></TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {!canComposeDraft ? (
                <View style={s.deniedBanner}>
                  <Text style={s.deniedBannerText}>{composeDeniedReason}</Text>
                </View>
              ) : null}

              {dropHint ? <Text style={s.dropHintText}>{dropHint}</Text> : null}

              {/* Lessons */}
              <View style={s.milestoneList}>
                {/* Inline + Lesson at top of journey + save status */}
                {canComposeDraft && selectedJourney ? (
                  <View style={s.lessonToolbarRow}>
                    <Pressable style={s.inlineAddLessonBtn} onPress={addLesson}>
                      <Text style={s.inlineAddLessonBtnText}>+ Lesson</Text>
                    </Pressable>
                    {saveState === 'pending' ? <Text style={s.autoSaveHint}>Saving...</Text> : null}
                    {saveState === 'saved' ? <Text style={s.autoSaveHint}>✓ Saved</Text> : null}
                    {saveState === 'error' ? <Text style={s.autoSaveError}>{saveMessage}</Text> : null}
                  </View>
                ) : null}
                {selectedJourney?.lessons.map((lesson, lsIndex) => {
                  const isSelected = selectedLessonId === lesson.id;
                  const isHover = hoverLessonId === lesson.id;
                  const isSuccess = dropSuccessLessonId === lesson.id;
                  const isDropTarget = dragPayload?.type === 'asset' || dragPayload?.type === 'journey_task';
                  const isLessonDrag = dragPayload?.type === 'journey_lesson';
                  const isDraggingThis = draggingLessonId === lesson.id;
                  const dragSourceIdx = draggingLessonId ? (selectedJourney?.lessons.findIndex((l) => l.id === draggingLessonId) ?? -1) : -1;
                  const showInsertBefore = hoverLessonInsertIndex === lsIndex && draggingLessonId && lsIndex !== dragSourceIdx && lsIndex !== dragSourceIdx + 1;
                  return (
                    <View key={lesson.id}>
                      {/* Lesson insertion line BEFORE this card */}
                      {showInsertBefore ? <View style={s.lessonInsertLine} /> : null}
                      <View
                        style={[
                          s.milestone,
                          isSelected && s.milestoneSelected,
                          isHover && !isLessonDrag && s.milestoneHover,
                          isSuccess && s.milestoneSuccess,
                          isDropTarget && !isHover && s.milestoneDropReady,
                          isDraggingThis && s.milestoneDragging,
                          { userSelect: 'none', cursor: 'grab' } as any,
                        ]}
                        {...({ dataSet: { dropLesson: lesson.id } } as any)}
                      >
                      {/* Lesson header row — click to select */}
                      <Pressable
                        style={s.milestoneHeaderRow}
                        onPress={() => { if (!handleClickDropToLesson(lesson.id, lesson.tasks.length)) setSelectedLessonId(lesson.id); }}
                      >
                        <Text
                          style={s.grabHandleText}
                          {...({ onPointerDown: (e: any) => { e.stopPropagation(); selectedJourney && onGrabPointerDown(e, { type: 'journey_lesson', sourceJourneyId: selectedJourney.id, lessonId: lesson.id }, lesson.title); } } as any)}
                        >⠿</Text>
                        <View style={s.stepNumber}><Text style={s.stepNumberText}>{lsIndex + 1}</Text></View>
                        <View style={s.kindBadgeLesson}><Text style={s.kindBadgeLessonText}>📘 Lesson</Text></View>
                        <Text style={s.milestoneTitle}>{lesson.title}</Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' } as any}>{lesson.tasks.length} tasks</Text>
                        {canComposeDraft ? (
                          <Pressable
                            style={s.lessonDeleteBtn}
                            onPress={(e: any) => { e.stopPropagation?.(); setConfirmDelete({ type: 'lesson', id: lesson.id, label: lesson.title }); }}
                          >
                            <Text style={s.lessonDeleteBtnText}>✕</Text>
                          </Pressable>
                        ) : null}
                      </Pressable>

                      {/* Task list with drop slots */}
                      <View style={[s.dropZone, isDropTarget && !isHover && s.dropZoneReady, isHover && !isLessonDrag && s.dropZoneHover, isSuccess && s.dropZoneSuccess]}>
                        {lesson.tasks.length === 0 ? (
                          <Pressable
                            onPress={() => handleClickDropToLesson(lesson.id, 0)}
                            {...({ dataSet: { dropTaskSlot: `${lesson.id}:0` } } as any)}
                          >
                            <Text style={[s.dropZoneHint, isDropTarget && s.dropZoneHintActive]}>
                              {isDropTarget ? '⬇ Drop here to add a task' : 'Drag content here or click + Task'}
                            </Text>
                          </Pressable>
                        ) : (
                          <>
                            {lesson.tasks.map((task, idx) => {
                              const asset = task.assetId ? assetsById.get(task.assetId) : null;
                              const catColor = asset ? getCategoryColor(asset.category) : { bg: '#FEF3C7', text: '#B45309' };
                              const isDraggingTask = draggingTaskId === task.id;
                              const showInsertBefore = hoverTaskInsert?.lessonId === lesson.id && hoverTaskInsert?.index === idx;
                              return (
                                <View key={task.id}>
                                  {/* Drop slot BEFORE this task */}
                                  <View
                                    style={[s.blockDropSlot, isDropTarget && s.blockDropSlotExpanded, showInsertBefore && s.blockDropSlotActive]}
                                    {...({ dataSet: { dropTaskSlot: `${lesson.id}:${idx}` } } as any)}
                                  />
                                  {/* Task card — grab handle triggers pointer drag */}
                                  <View
                                    style={[s.blockCard, isDraggingTask && s.blockCardDragging, { userSelect: 'none' } as any]}
                                    {...({ dataSet: { dropTaskSlot: `${lesson.id}:${idx}` } } as any)}
                                  >
                                    <Text
                                      style={[s.blockGrabText, { cursor: 'grab' } as any]}
                                      {...({ onPointerDown: (e: any) => { e.stopPropagation(); selectedJourney && onGrabPointerDown(e, { type: 'journey_task', sourceJourneyId: selectedJourney.id, sourceLessonId: lesson.id, taskId: task.id, assetId: task.assetId }, task.title); } } as any)}
                                    >⠿</Text>
                                    <View style={s.blockIndex}><Text style={s.blockIndexText}>{idx + 1}</Text></View>
                                    <View style={s.blockInfo}>
                                      <Text style={s.blockTitle}>{task.title}</Text>
                                      {asset ? (
                                        <View style={[s.blockCatBadge, { backgroundColor: catColor.bg }]}>
                                          <Text style={[s.blockCatText, { color: catColor.text }]}>{asset.category} · {asset.duration}</Text>
                                        </View>
                                      ) : (
                                        <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>No asset linked</Text>
                                      )}
                                    </View>
                                    <Pressable
                                      style={s.blockRemoveBtn}
                                      onPress={() => setConfirmDelete({ type: 'task', id: task.id, parentId: lesson.id, label: task.title })}
                                    >
                                      <Text style={s.blockRemoveBtnText}>✕</Text>
                                    </Pressable>
                                    <Pressable
                                      style={s.blockMenuBtn}
                                      onPress={() => setActiveTaskMenu((prev) => prev?.taskId === task.id && prev?.lessonId === lesson.id ? null : { lessonId: lesson.id, taskId: task.id })}
                                    >
                                      <Text style={s.blockMenuBtnText}>···</Text>
                                    </Pressable>
                                    {activeTaskMenu?.taskId === task.id && activeTaskMenu?.lessonId === lesson.id ? (
                                      <View style={s.blockPopover}>
                                        <Pressable style={s.blockPopoverItem} onPress={() => reorderTask(lesson.id, task.id, -1)}><Text style={s.blockPopoverText}>↑ Move Up</Text></Pressable>
                                        <Pressable style={s.blockPopoverItem} onPress={() => reorderTask(lesson.id, task.id, 1)}><Text style={s.blockPopoverText}>↓ Move Down</Text></Pressable>
                                        <Pressable style={s.blockPopoverDanger} onPress={() => removeTask(lesson.id, task.id)}><Text style={s.blockPopoverDangerText}>Remove</Text></Pressable>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              );
                            })}
                            {/* Drop slot AFTER last task */}
                            <View
                              style={[s.blockDropSlot, isDropTarget && s.blockDropSlotExpanded, hoverTaskInsert?.lessonId === lesson.id && hoverTaskInsert?.index === lesson.tasks.length && s.blockDropSlotActive]}
                              {...({ dataSet: { dropTaskSlot: `${lesson.id}:${lesson.tasks.length}` } } as any)}
                            />
                          </>
                        )}
                      </View>
                      {/* Inline + Task button */}
                      {canComposeDraft ? (
                        <Pressable style={s.inlineAddTaskBtn} onPress={() => addTaskToLesson(lesson.id)}>
                          <Text style={s.inlineAddTaskBtnText}>+ Task</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  );
                })}
                {/* Lesson insertion line AFTER last card */}
                {(() => {
                  const total = selectedJourney?.lessons.length ?? 0;
                  const srcIdx = draggingLessonId ? (selectedJourney?.lessons.findIndex((l) => l.id === draggingLessonId) ?? -1) : -1;
                  const show = hoverLessonInsertIndex === total && draggingLessonId && total !== srcIdx && total !== srcIdx + 1;
                  return show ? <View style={s.lessonInsertLine} /> : null;
                })()}
              </View>
            </ScrollView>
          </>
        ) : (
          /* ════ PEOPLE MODE ════ */
          <>
            {/* ── People Sidebar ── */}
            <View style={[s.sidebar, isCompact && s.sidebarCompact]}>
              <Text style={s.sidebarTitle}>People</Text>
              <View style={s.sidebarScroll}>
                {cohortPeople.map((person) => {
                  const checked = checkedPeopleIds.includes(person.id);
                  return (
                    <View key={person.id} style={s.personRow}>
                      <Pressable
                        style={[s.checkBox, checked && s.checkBoxChecked]}
                        onPress={() => setCheckedPeopleIds((prev) => prev.includes(person.id) ? prev.filter((id) => id !== person.id) : [...prev, person.id])}
                      >
                        {checked ? <Text style={s.checkMark}>✓</Text> : null}
                      </Pressable>
                      <Pressable
                        style={[s.personCard, { cursor: 'grab' } as any]}
                        onPress={() => setDragPayload({ type: 'person', personId: person.id })}
                        {...({
                          onPointerDown: (e: any) => onGrabPointerDown(e, { type: 'person', personId: person.id }, person.name),
                        } as any)}
                      >
                        <View style={s.personAvatar}><Text style={s.personAvatarText}>{person.name.charAt(0)}</Text></View>
                        <View>
                          <Text style={s.personName}>{person.name}</Text>
                          <Text style={s.personSub}>{person.subtitle}</Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Cohorts / Channels Canvas ── */}
            <ScrollView style={s.canvas} contentContainerStyle={s.canvasInner} showsVerticalScrollIndicator>
              {/* Panel tabs */}
              <View style={s.panelTabs}>
                <Pressable style={[s.panelTab, peoplePanelTab === 'cohorts' && s.panelTabActive]} onPress={() => setPeoplePanelTab('cohorts')}>
                  <Text style={[s.panelTabText, peoplePanelTab === 'cohorts' && s.panelTabTextActive]}>Cohorts</Text>
                </Pressable>
                <Pressable style={[s.panelTab, peoplePanelTab === 'channels' && s.panelTabActive]} onPress={() => setPeoplePanelTab('channels')}>
                  <Text style={[s.panelTabText, peoplePanelTab === 'channels' && s.panelTabTextActive]}>Channels</Text>
                </Pressable>
              </View>

              {peoplePanelTab === 'cohorts' ? (
                <View style={s.cohortContent}>
                  {/* Cohort toolbar */}
                  <View style={s.toolbar}>
                    <TextInput value={newCohortName} onChangeText={setNewCohortName} placeholder="New cohort name..." placeholderTextColor="#94A3B8" style={s.toolbarInput} />
                    <TouchableOpacity style={s.btnSecondary} onPress={createCohort}><Text style={s.btnSecondaryText}>+ Cohort</Text></TouchableOpacity>
                    <TouchableOpacity style={s.btnPrimary} onPress={() => { if (selectedCohort) { addPeopleToCohort(selectedCohort.id, checkedPeopleIds); setCheckedPeopleIds([]); } }}>
                      <Text style={s.btnPrimaryText}>Add Selected</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cohort list */}
                  <View style={s.cohortGrid}>
                    {cohorts.map((cohort) => {
                      const sel = selectedCohort?.id === cohort.id;
                      return (
                        <Pressable
                          key={cohort.id}
                          style={[s.cohortCard, sel && s.cohortCardActive]}
                          onPress={() => { if (!handleClickAssignPersonToCohort(cohort.id)) setSelectedCohortId(cohort.id); }}
                          {...({ dataSet: { dropCohort: cohort.id } } as any)}
                        >
                          <Text style={s.cohortName}>{cohort.name}</Text>
                          <Text style={s.cohortMeta}>{cohort.program}</Text>
                          <View style={s.cohortFooter}>
                            <Text style={s.cohortMembers}>{cohort.memberIds.length} members</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Selected cohort detail */}
                  {selectedCohort ? (
                    <View style={s.cohortDetail}>
                      <Text style={s.cohortDetailTitle}>{selectedCohort.name}</Text>
                      <Text style={s.cohortDetailMeta}>{selectedCohort.program} · {selectedCohort.owner}</Text>
                      {selectedCohort.memberIds.length === 0 ? (
                        <Text style={s.emptyHint}>No members yet. Check people on the left, then click "Add Selected".</Text>
                      ) : (
                        selectedCohort.memberIds.map((memberId) => {
                          const person = cohortPeople.find((p) => p.id === memberId);
                          return (
                            <View key={memberId} style={s.cohortMemberRow}>
                              <View style={s.cohortMemberAvatar}><Text style={s.cohortMemberAvatarText}>{person?.name.charAt(0) ?? '?'}</Text></View>
                              <Text style={s.cohortMemberName}>{person?.name ?? memberId}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              ) : (
                /* Channels panel */
                <View style={s.channelContent}>
                  <View style={s.channelFilters}>
                    {(['all', 'top_producers', 'new_agents', 'sponsor_leads'] as ChannelSegment[]).map((seg) => {
                      const labels: Record<ChannelSegment, string> = { all: 'All', top_producers: 'Top Producers', new_agents: 'New Agents', sponsor_leads: 'Sponsor Leads' };
                      const active = channelSegment === seg;
                      return (
                        <Pressable key={seg} style={[s.filterChip, active && s.filterChipActive]} onPress={() => setChannelSegment(seg)}>
                          <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{labels[seg]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* Channel table */}
                  <View style={s.channelTable}>
                    <View style={s.channelTableHead}>
                      <Text style={[s.thCell, { flex: 2 }]}>Channel</Text>
                      <Text style={[s.thCell, { flex: 1 }]}>Scope</Text>
                      <Text style={[s.thCell, { flex: 0.6 }]}>Members</Text>
                      <Text style={[s.thCell, { flex: 0.6 }]}>Activity</Text>
                    </View>
                    {filteredChannels.map((row) => {
                      const sel = selectedGenericRow?.id === row.id;
                      return (
                        <Pressable key={row.id} style={[s.channelTableRow, sel && s.channelTableRowActive]} onPress={() => setSelectedRowId(row.id)}>
                          <Text style={[s.tdCell, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{row.c1}</Text>
                          <Text style={[s.tdCell, { flex: 1 }]}>{row.c2}</Text>
                          <Text style={[s.tdCell, { flex: 0.6 }]}>{row.c3}</Text>
                          <Text style={[s.tdCell, { flex: 0.6, color: '#64748B' }]}>{row.c4}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {selectedGenericRow ? (
                    <View style={s.channelDetail}>
                      <Text style={s.channelDetailTitle}>{selectedGenericRow.c1}</Text>
                      <Text style={s.channelDetailMeta}>{selectedGenericRow.c2} · {selectedGenericRow.c3} members · Last active {selectedGenericRow.c4}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </View>

      {/* ── Delete confirmation modal ── */}
      {confirmDelete ? (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Delete {confirmDelete.type}?</Text>
            <Text style={s.modalBody}>
              Are you sure you want to delete{' '}
              <Text style={{ fontWeight: '700' }}>"{confirmDelete.label}"</Text>?
              {confirmDelete.type === 'journey'
                ? ' All lessons and tasks in this journey will be removed. Library assets are not affected.'
                : confirmDelete.type === 'lesson'
                ? ' All tasks in this lesson will be removed. Library assets are not affected.'
                : ' The task will be removed from this lesson. The library asset is not affected.'}
            </Text>
            <View style={s.modalActions}>
              <Pressable style={s.modalCancelBtn} onPress={() => setConfirmDelete(null)}>
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalDeleteBtn} onPress={confirmAndDelete}>
                <Text style={s.modalDeleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/* ════════════════════════════════════════════
   STYLES — Clean, professional design system

   Palette:
   - Background:  #F8FAFC (cool gray-50)
   - Sidebar:     #1E293B (slate-800)
   - Cards:       #FFFFFF
   - Primary:     #2563EB (blue-600)
   - Lesson:      #3B82F6 (blue-500)
   - Task:        #F59E0B (amber-500)
   - Success:     #10B981 (emerald-500)
   - Text:        #0F172A (slate-900)
   - Secondary:   #64748B (slate-500)
   ════════════════════════════════════════════ */

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  /* ── Top Bar ── */
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 20,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  topBarSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#0F172A',
  },

  /* ── Account ── */
  accountWrap: {
    position: 'relative',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnOpen: {
    backgroundColor: '#1D4ED8',
  },
  avatarBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  accountDrop: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    minWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 40,
  },
  accountDropLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  accountDropRole: {
    fontSize: 11,
    color: '#64748B',
  },
  accountDropSignOut: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  accountDropSignOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },

  /* ── Main Layout ── */
  mainRow: {
    flex: 1,
    flexDirection: 'row',
  },

  /* ── Sidebar (dark) ── */
  sidebar: {
    width: 300,
    backgroundColor: '#1E293B',
    paddingTop: 16,
    paddingHorizontal: 12,
    gap: 10,
  },
  sidebarCompact: {
    width: '100%' as any,
    maxHeight: 260,
  },
  sidebarTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  sidebarSearch: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#F1F5F9',
  },
  sidebarScroll: {
    flex: 1,
    overflow: 'auto' as any,
  },

  /* ── Selected-asset banner ── */
  selectedAssetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  selectedAssetBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedAssetBannerClose: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 4,
  },

  /* ── Folder tree ── */
  folderGroup: {
    marginBottom: 4,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  folderRowActive: {
    backgroundColor: '#334155',
  },
  folderIcon: {
    color: '#94A3B8',
    fontSize: 12,
    width: 14,
  },
  folderName: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  folderNameActive: {
    color: '#F1F5F9',
  },
  folderCount: {
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  folderCountText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },

  /* ── Asset rows in sidebar ── */
  assetList: {
    paddingLeft: 20,
    gap: 3,
    marginTop: 2,
    marginBottom: 6,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  assetRowDragging: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  assetInfo: {
    flex: 1,
    gap: 2,
  },
  assetTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
  },
  assetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assetDuration: {
    color: '#64748B',
    fontSize: 10,
  },
  dragHandle: {
    color: '#64748B',
    fontSize: 16,
    marginLeft: 6,
    cursor: 'grab' as any,
    userSelect: 'none' as any,
  },

  /* ── Canvas ── */
  canvas: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  canvasInner: {
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },

  /* ── Canvas sections ── */
  canvasSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  canvasSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  canvasSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  canvasSectionCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  /* ── Journey selector chips ── */
  journeyChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  journeyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    minWidth: 180,
  },
  journeyChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  journeyChipBody: {
    flex: 1,
  },
  journeyChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  journeyChipTextActive: {
    color: '#1D4ED8',
  },
  journeyChipMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  chipDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  chipDeleteBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  lessonDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  lessonDeleteBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Toolbar ── */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  toolbarInput: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  toolbarSpacer: {
    flex: 1,
    minWidth: 8,
  },

  /* ── Buttons ── */
  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnPrimaryDisabled: {
    backgroundColor: '#93C5FD',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  btnSecondaryText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  btnOutlineBlue: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#EFF6FF',
  },
  btnOutlineBlueText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  btnOutlineAmber: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFFBEB',
  },
  btnOutlineAmberText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Status indicators ── */
  saveIndicator: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  errorIndicator: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  dropHintText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  deniedBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },
  deniedBannerText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },

  /* ── Milestones ── */
  milestoneList: {
    gap: 12,
  },
  milestone: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  milestoneSelected: {
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  milestoneHover: {
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
  },
  milestoneSuccess: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  milestoneDropReady: {
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFF',
  },
  milestoneDragging: {
    opacity: 0.4,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
  },
  lessonInsertLine: {
    height: 3,
    backgroundColor: '#2563EB',
    borderRadius: 2,
    marginVertical: 4,
  },
  milestoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  milestoneTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* ── Kind badges ── */
  kindBadgeLesson: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindBadgeLessonText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  kindBadgeTask: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindBadgeTaskText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Drop zone ── */
  dropZone: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    minHeight: 52,
    backgroundColor: '#FAFBFC',
  },
  dropZoneHover: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  dropZoneReady: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  dropZoneSuccess: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  dropZoneHint: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  dropZoneHintActive: {
    color: '#2563EB',
    fontWeight: '600',
  },

  /* ── Grab handles ── */
  grabHandle: {
    width: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    cursor: 'grab' as any,
  },
  grabHandleText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
    userSelect: 'none' as any,
    cursor: 'grab' as any,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  /* ── Block drop slots (insertion lines) ── */
  blockDropSlot: {
    height: 4,
    borderRadius: 2,
    marginVertical: 1,
    backgroundColor: 'transparent',
  },
  blockDropSlotExpanded: {
    height: 14,
    marginVertical: 3,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  blockDropSlotActive: {
    height: 14,
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    marginVertical: 3,
  },

  /* ── Block cards inside milestones ── */
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    position: 'relative',
  },
  blockCardDragging: {
    opacity: 0.35,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
  },
  blockGrabHandle: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab' as any,
    marginRight: 2,
  },
  blockGrabText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    userSelect: 'none' as any,
  },
  blockInfo: {
    flex: 1,
  },
  blockIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockIndexText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  blockCatBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  blockCatText: {
    fontSize: 10,
    fontWeight: '600',
  },
  inlineCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  inlineCreateInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  lessonToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  autoSaveHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  autoSaveError: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  inlineAddLessonBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    marginBottom: 8,
  },
  inlineAddLessonBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  inlineAddTaskBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginTop: 6,
  },
  inlineAddTaskBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  blockRemoveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  blockRemoveBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  blockMenuBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  blockMenuBtnText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  blockPopover: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 130,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  blockPopoverItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  blockPopoverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  blockPopoverDanger: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  blockPopoverDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },

  /* ── People mode ── */
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  personCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  personAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '700',
  },
  personName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  personSub: {
    color: '#94A3B8',
    fontSize: 11,
  },

  /* ── Panel tabs ── */
  panelTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
  },
  panelTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  panelTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  panelTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  panelTabTextActive: {
    color: '#0F172A',
  },

  /* ── Cohorts ── */
  cohortContent: {
    gap: 16,
  },
  cohortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cohortCard: {
    minWidth: 200,
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cohortCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  cohortName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cohortMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  cohortFooter: {
    marginTop: 4,
  },
  cohortMembers: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  cohortDetail: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cohortDetailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cohortDetailMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  cohortMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  cohortMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cohortMemberAvatarText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
  },
  cohortMemberName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },

  /* ── Channels ── */
  channelContent: {
    gap: 16,
  },
  channelFilters: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#1D4ED8',
  },
  channelTable: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  channelTableHead: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#64748B',
  },
  channelTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  channelTableRowActive: {
    backgroundColor: '#EFF6FF',
  },
  tdCell: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: '#334155',
  },
  channelDetail: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  channelDetailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  channelDetailMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  runtimeBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runtimeBannerText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  runtimeBannerError: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  runtimeBannerErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
  },
  runtimeRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  runtimeRetryBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* ── Empty/error states ── */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  /* ── Delete confirmation modal ── */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    maxWidth: 380,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalDeleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  modalDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
