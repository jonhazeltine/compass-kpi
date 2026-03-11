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
type ContentScope = 'my' | 'team' | 'all_allowed';

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
  ownershipScope?: 'mine' | 'team' | 'global';
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
  member_count?: number;
  last_message_at?: string | null;
  ownership_scope?: 'mine' | 'team' | 'global';
};

type LibraryAssetsPayload = {
  assets?: Array<{
    id: string;
    title?: string;
    category?: string;
    scope?: string;
    duration?: string;
    ownership_scope?: 'mine' | 'team' | 'global';
  }>;
  collections?: Array<{
    id: string;
    name?: string;
    ownership_scope?: 'mine' | 'team' | 'global';
    asset_ids?: string[];
  }>;
};

type JourneySummaryApiRow = {
  id: string;
  title: string;
  description?: string | null;
  team_id?: string | null;
  ownership_scope?: 'mine' | 'team' | 'global';
  created_by?: string | null;
};

type JourneyDetailApiRow = {
  milestones?: Array<{
    id: string;
    title?: string;
    sort_order?: number;
    lessons?: Array<{
      id: string;
      title: string;
      body?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }>;
  }>;
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
const SEED_JOURNEY_PREVIEW_LIMIT = 6;

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

/** Return persona-tuned labels for coach portal workspaces. */
function personaWorkspaceLabel(
  mode: CoachWorkspaceMode,
  roles: AdminRole[]
): { label: string; headline: string } {
  const isTeamLeader = roles.includes('team_leader') && !roles.includes('coach');
  const isSponsor =
    roles.includes('challenge_sponsor') && !roles.includes('coach') && !roles.includes('team_leader');
  if (mode === 'journeys') {
    if (isTeamLeader) return { label: 'Programs', headline: 'Team Program Builder' };
    if (isSponsor) return { label: 'Campaign Content', headline: 'Sponsored Content' };
    return COACH_WORKSPACES.journeys;
  }
  if (isTeamLeader) return { label: 'Team & Channels', headline: 'Team & Channels' };
  if (isSponsor) return { label: 'Audience & Channels', headline: 'Audience & Channels' };
  return COACH_WORKSPACES.people;
}

const WORKSPACE_ROUTE_KEYS: Record<CoachWorkspaceMode, CoachRouteKey[]> = {
  journeys: ['coachingJourneys', 'coachingLibrary'],
  people: ['coachingCohorts', 'coachingChannels'],
};

const EMPTY_COHORTS: CohortDraft[] = [];
const EMPTY_PEOPLE: CohortPerson[] = [];
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

function isSeedPlaceholderJourney(name: string): boolean {
  const value = name.trim().toLowerCase();
  return value.includes('seed sample coaching') || value.includes('(seed-') || value.includes('seed-m6-');
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

async function sendCoachJson<T>(
  path: string,
  accessToken: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
  options?: { elevatedEdit?: boolean }
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.elevatedEdit ? { 'x-coach-elevated-edit': 'true' } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
  const [contentScope, setContentScope] = useState<ContentScope>('all_allowed');
  const [superAdminElevatedEdit, setSuperAdminElevatedEdit] = useState(false);
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
  const [journeyQuery, setJourneyQuery] = useState('');
  const [journeyPickerOpen, setJourneyPickerOpen] = useState(false);
  const [seedPurgeConfirmOpen, setSeedPurgeConfirmOpen] = useState(false);
  const [seedPurgePending, setSeedPurgePending] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTaskMenu, setActiveTaskMenu] = useState<{ lessonId: string; taskId: string } | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState('');
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [cohorts, setCohorts] = useState<CohortDraft[]>(EMPTY_COHORTS);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [newCohortName, setNewCohortName] = useState('');
  const [checkedPeopleIds, setCheckedPeopleIds] = useState<string[]>([]);
  const [channelSegment, setChannelSegment] = useState<ChannelSegment>('all');
  const [peoplePanelTab, setPeoplePanelTab] = useState<PeoplePanelTab>('cohorts');
  const [cohortQuery, setCohortQuery] = useState('');
  const [cohortPeople, setCohortPeople] = useState<CohortPerson[]>(EMPTY_PEOPLE);
  const [channelRows, setChannelRows] = useState<
    Array<{ id: string; c1: string; c2: string; c3: string; c4: string; segment: ChannelSegment; type: ChannelType; context_id: string | null }>
  >([]);
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
  const [saveMessage, setSaveMessage] = useState('No unsaved changes.');
  const [dropHint, setDropHint] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'journey' | 'lesson' | 'task'; id: string; parentId?: string; label: string } | null>(null);

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

  const hasSuperAdminRole = effectiveRoles.includes('super_admin');
  const coachCanCompose =
    effectiveRoles.includes('coach') ||
    effectiveRoles.includes('platform_admin') ||
    (hasSuperAdminRole && superAdminElevatedEdit);
  const teamLeaderCanCompose = effectiveRoles.includes('team_leader') && !coachCanCompose;
  const sponsorOnly = effectiveRoles.includes('challenge_sponsor') && !coachCanCompose && !teamLeaderCanCompose;
  const canComposeDraft = coachCanCompose || teamLeaderCanCompose;
  const scopeLabel = contentScope === 'my' ? 'My' : contentScope === 'team' ? 'Team' : 'All allowed';
  const composeDeniedReason = sponsorOnly
    ? 'Sponsor access is scoped for visibility only.'
    : hasSuperAdminRole && !superAdminElevatedEdit
      ? 'Super admin is view-only by default. Enable Elevated Edit to author changes.'
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
  const filteredJourneys = useMemo(() => {
    const query = journeyQuery.trim().toLowerCase();
    if (!query) return journeys;
    return journeys.filter((journey) => journey.name.toLowerCase().includes(query));
  }, [journeys, journeyQuery]);
  const filteredCohorts = useMemo(() => {
    const visibleCohorts = cohorts.filter((cohort) => !cohort.name.toLowerCase().startsWith('checkpoint'));
    const query = cohortQuery.trim().toLowerCase();
    if (!query) return visibleCohorts;
    return visibleCohorts.filter((cohort) => cohort.name.toLowerCase().includes(query));
  }, [cohorts, cohortQuery]);
  const seedPlaceholderJourneys = useMemo(
    () => journeys.filter((journey) => isSeedPlaceholderJourney(journey.name)),
    [journeys]
  );

  const selectedCohort = cohorts.find((row) => row.id === selectedCohortId) ?? cohorts[0] ?? null;
  const filteredChannels = channelRows.filter((row) => channelSegment === 'all' || row.segment === channelSegment);
  const selectedGenericRow =
    filteredChannels.find((row) => row.id === selectedRowId) ?? filteredChannels[0] ?? null;

  /* ─── Effects (unchanged) ─── */

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
      const scopedQuery = `?scope=${contentScope}`;
      const [channelsPayload, cohortsPayload, coachesPayload, journeysPayload, libraryPayload] = await Promise.all([
        fetchCoachJson<{ channels?: ChannelApiRow[] }>(`/api/coaching/channels${scopedQuery}`, session.access_token),
        fetchCoachJson<{
          cohorts?: Array<{ id: string; name: string; member_user_ids?: string[]; leaders_count?: number; members_count?: number }>;
        }>(`/api/coaching/cohorts${scopedQuery}`, session.access_token),
        fetchCoachJson<{ coaches?: Array<{ id: string; name: string; specialties?: string[] }> }>(
          '/api/coaching/coaches',
          session.access_token
        ),
        fetchCoachJson<{ journeys?: JourneySummaryApiRow[] }>(
          `/api/coaching/journeys${scopedQuery}`,
          session.access_token
        ),
        fetchCoachJson<LibraryAssetsPayload>(
          `/api/coaching/library/assets${scopedQuery}`,
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
          c2: `${type} scope${row.ownership_scope ? ` • ${row.ownership_scope}` : ''}`,
          c3: String(row.member_count ?? 0),
          c4: row.last_message_at ? new Date(row.last_message_at).toLocaleDateString() : 'recent',
          segment: seg,
          type,
          context_id: row.context_id ?? null,
        };
      });
      setChannelRows(mappedChannels);

      const cohortRows = (cohortsPayload.cohorts ?? [])
        .map((row) => ({
          id: row.id,
          name: row.name || 'Untitled cohort',
          owner: row.leaders_count && row.leaders_count > 0 ? 'Team leader' : 'Coach owner',
          program: `Team cohort • ${contentScope === 'all_allowed' ? 'all allowed' : contentScope}`,
          memberIds: row.member_user_ids ?? [],
        }))
        .filter((row) => !row.name.toLowerCase().startsWith('checkpoint'));
      setCohorts(cohortRows);

      const knownCohortMembers = Array.from(
        new Set(cohortRows.flatMap((cohort) => cohort.memberIds).filter(Boolean))
      );
      const coachPeopleBase = (coachesPayload.coaches ?? []).map((coach) => ({
        id: coach.id,
        name: coach.name,
        subtitle: (coach.specialties ?? []).slice(0, 2).join(' · ') || 'Coach',
      }));
      const mergedPeople = new Map<string, CohortPerson>();
      for (const person of coachPeopleBase) mergedPeople.set(person.id, person);
      for (const memberId of knownCohortMembers) {
        if (!mergedPeople.has(memberId)) {
          mergedPeople.set(memberId, { id: memberId, name: memberId.slice(0, 8), subtitle: 'Team member' });
        }
      }
      setCohortPeople(Array.from(mergedPeople.values()));

      const journeys = journeysPayload.journeys ?? [];
      const journeyDetails = await Promise.all(
        journeys.map(async (journey) => {
          const detail = await fetchCoachJson<JourneyDetailApiRow>(
            `/api/coaching/journeys/${journey.id}`,
            session.access_token
          );
          const lessons: JourneyLesson[] = (detail.milestones ?? [])
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((milestone, idx) => ({
              id: milestone.id,
              title: milestone.title || `Lesson ${idx + 1}`,
              tasks: (milestone.lessons ?? [])
                .filter((task) => task.is_active !== false)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((task) => ({
                  id: task.id,
                  title: task.title,
                  assetId: task.id,
                })),
            }));
          return {
            id: journey.id,
            name: journey.title,
            audience: `${journey.ownership_scope === 'mine' ? 'Mine' : journey.ownership_scope === 'team' ? 'Team' : 'Global'} • ${journey.description?.trim() || 'Team scoped'}`,
            lessons,
          } satisfies JourneyDraft;
        })
      );
      setJourneys(journeyDetails);
      const libraryAssets = (libraryPayload.assets ?? []).map((asset) => ({
        id: asset.id,
        title: asset.title || `Asset ${asset.id.slice(0, 8)}`,
        category: asset.category || 'Resource',
        scope: asset.scope || (asset.ownership_scope === 'mine' ? 'Mine' : asset.ownership_scope === 'team' ? 'Team' : 'Global'),
        duration: asset.duration || '-',
      }));
      const libraryCollections = (libraryPayload.collections ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name || 'Collection',
        assetIds: collection.asset_ids ?? [],
        ownershipScope: collection.ownership_scope,
      }));
      setAssets(libraryAssets);
      setCollections(libraryCollections);
      if (journeyDetails.length > 0) {
        setSelectedJourneyId((prev) => prev && journeyDetails.some((j) => j.id === prev) ? prev : journeyDetails[0].id);
        setSelectedLessonId(journeyDetails[0].lessons[0]?.id ?? null);
      } else {
        setSelectedJourneyId(null);
        setSelectedLessonId(null);
      }
      if (libraryCollections.length > 0) {
        setSelectedCollectionId((prev) =>
          prev && libraryCollections.some((collection) => collection.id === prev)
            ? prev
            : libraryCollections[0].id
        );
        setExpandedCollectionIds((prev) => {
          const valid = prev.filter((id) => libraryCollections.some((collection) => collection.id === id));
          return valid.length ? valid : [libraryCollections[0].id];
        });
      } else {
        setSelectedCollectionId('');
        setExpandedCollectionIds([]);
      }

      setSaveState('idle');
      setSaveMessage(`Connected to backend coaching endpoints (${scopeLabel} scope).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load coach portal data';
      setPortalLoadError(message);
      setSaveState('error');
      setSaveMessage(message);
    } finally {
      setPortalLoading(false);
    }
  };

  const runMutation = async (pendingLabel: string, successLabel: string, action: () => Promise<void>) => {
    setSaveState('pending');
    setSaveMessage(pendingLabel);
    try {
      await action();
      setSaveState('saved');
      setSaveMessage(`${successLabel} at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setSaveState('error');
      setSaveMessage(message);
      throw error;
    }
  };

  const sendCoachMutation = async <T,>(
    path: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>
  ): Promise<T> => {
    if (!session?.access_token) {
      throw new Error('Missing access token');
    }
    return sendCoachJson<T>(path, session.access_token, method, body, {
      elevatedEdit: superAdminElevatedEdit,
    });
  };

  useEffect(() => {
    void refreshPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentScope, session?.access_token]);

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

  const markDraftChanged = (hint: string) => {
    setDropHint(hint);
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

  const addAssetToLesson = async (payload: DragPayload, targetLessonId: string, targetIndex: number) => {
    if (!selectedJourney || !session?.access_token || !payload) return;
    if (payload.type === 'asset') {
      const targetLesson = selectedJourney.lessons.find((lesson) => lesson.id === targetLessonId);
      if (!targetLesson) return;
      const insertAt = Math.max(0, Math.min(targetIndex, targetLesson.tasks.length));
      const assetTitle = assetsById.get(payload.assetId)?.title ?? 'New Task';
      await runMutation('Adding task...', 'Task added', async () => {
        await sendCoachMutation<{ task: { id: string } }>(
          `/api/coaching/journeys/${selectedJourney.id}/lessons/${targetLessonId}/tasks`,
          'POST',
          {
            title: assetTitle,
            body: payload.assetId ? `asset:${payload.assetId}` : undefined,
            sort_order: insertAt,
          }
        );
        await refreshPortalData();
      });
      markDraftChanged('Asset added to lesson.');
      return;
    }

    if (payload.type !== 'journey_task' || payload.sourceJourneyId !== selectedJourney.id) return;
    const sourceLesson = selectedJourney.lessons.find((lesson) => lesson.id === payload.sourceLessonId);
    const targetLesson = selectedJourney.lessons.find((lesson) => lesson.id === targetLessonId);
    const movingTask = sourceLesson?.tasks.find((task) => task.id === payload.taskId) ?? null;
    if (!sourceLesson || !targetLesson || !movingTask) return;
    const insertAt = Math.max(0, Math.min(targetIndex, targetLesson.tasks.length));
    await runMutation('Moving task...', 'Task moved', async () => {
      if (payload.sourceLessonId === targetLessonId) {
        const fromIndex = targetLesson.tasks.findIndex((task) => task.id === payload.taskId);
        if (fromIndex < 0) return;
        const reorderedTaskIds = moveItem(targetLesson.tasks, fromIndex, insertAt).map((task) => task.id);
        await sendCoachMutation(
          `/api/coaching/journeys/${selectedJourney.id}/lessons/${targetLessonId}/tasks/reorder`,
          'POST',
          { task_ids: reorderedTaskIds }
        );
      } else {
        const created = await sendCoachMutation<{ task: { id: string } }>(
          `/api/coaching/journeys/${selectedJourney.id}/lessons/${targetLessonId}/tasks`,
          'POST',
          {
            title: movingTask.title,
            body: movingTask.assetId ? `asset:${movingTask.assetId}` : undefined,
            sort_order: insertAt,
          }
        );
        await sendCoachMutation(
          `/api/coaching/journeys/${selectedJourney.id}/lessons/${payload.sourceLessonId}/tasks/${payload.taskId}`,
          'DELETE'
        );
        const sourceTaskIds = sourceLesson.tasks.filter((task) => task.id !== payload.taskId).map((task) => task.id);
        if (sourceTaskIds.length > 0) {
          await sendCoachMutation(
            `/api/coaching/journeys/${selectedJourney.id}/lessons/${payload.sourceLessonId}/tasks/reorder`,
            'POST',
            { task_ids: sourceTaskIds }
          );
        }
        const targetTaskIds = targetLesson.tasks.map((task) => task.id);
        targetTaskIds.splice(insertAt, 0, created.task.id);
        await sendCoachMutation(
          `/api/coaching/journeys/${selectedJourney.id}/lessons/${targetLessonId}/tasks/reorder`,
          'POST',
          { task_ids: targetTaskIds }
        );
      }
      await refreshPortalData();
    });
    markDraftChanged('Task moved.');
  };

  const handleDropToLesson = (eventLike: any, lessonId: string, index: number) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    void addAssetToLesson(payload, lessonId, index);
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
    void addAssetToLesson(payload, lessonId, insertIndex);
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
    void addAssetToLesson(dragPayload, lessonId, taskCount);
    setDropSuccessLessonId(lessonId);
    clearAllDragState();
    return true;
  };

  const reorderLessonByDrop = (payload: DragPayload, targetLessonId: string) => {
    if (!selectedJourney || payload?.type !== 'journey_lesson' || payload.sourceJourneyId !== selectedJourney.id) return false;
    if (!session?.access_token) return false;
    const fromIndex = selectedJourney.lessons.findIndex((row) => row.id === payload.lessonId);
    const toIndex = selectedJourney.lessons.findIndex((row) => row.id === targetLessonId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
    const reorderedLessonIds = moveItem(selectedJourney.lessons, fromIndex, toIndex).map((lesson) => lesson.id);
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id ? { ...journey, lessons: moveItem(journey.lessons, fromIndex, toIndex) } : journey
      )
    );
    void runMutation('Saving lesson order...', 'Lesson order updated', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/reorder`,
        'POST',
        { lesson_ids: reorderedLessonIds }
      );
      await refreshPortalData();
    }).catch(() => {
      void refreshPortalData();
    });
    markDraftChanged('Lesson order updated.');
    return true;
  };

  const reorderLessonToSlot = (payload: DragPayload, toSlot: number) => {
    if (!selectedJourney || payload?.type !== 'journey_lesson' || payload.sourceJourneyId !== selectedJourney.id) return false;
    if (!session?.access_token) return false;
    const fromIndex = selectedJourney.lessons.findIndex((row) => row.id === payload.lessonId);
    if (fromIndex < 0) return false;
    // Adjust: inserting after the removed position means the target shifts down by 1
    const toIndex = toSlot > fromIndex ? toSlot - 1 : toSlot;
    if (fromIndex === toIndex) return false;
    const reorderedLessonIds = moveItem(selectedJourney.lessons, fromIndex, toIndex).map((lesson) => lesson.id);
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id ? { ...journey, lessons: moveItem(journey.lessons, fromIndex, toIndex) } : journey
      )
    );
    void runMutation('Saving lesson order...', 'Lesson order updated', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/reorder`,
        'POST',
        { lesson_ids: reorderedLessonIds }
      );
      await refreshPortalData();
    }).catch(() => {
      void refreshPortalData();
    });
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
      void addAssetToLesson(dragPayload, lessonId, taskCount);
      setDropSuccessLessonId(lessonId);
      clearAllDragState();
      return true;
    }
    return false;
  };

  const addPeopleToCohort = async (cohortId: string, personIds: string[]) => {
    if (!personIds.length) return;
    if (!session?.access_token) return;
    const cohort = cohorts.find((row) => row.id === cohortId);
    if (!cohort) return;
    const memberUserIds = Array.from(new Set([...(cohort.memberIds ?? []), ...personIds]));
    await runMutation('Updating cohort members...', 'Cohort updated', async () => {
      await sendCoachMutation(
        `/api/coaching/cohorts/${cohortId}/members`,
        'PUT',
        { member_user_ids: memberUserIds }
      );
      await refreshPortalData();
    });
    markDraftChanged('Cohort membership updated.');
  };

  const handleClickAssignPersonToCohort = (cohortId: string) => {
    if (!canComposeDraft) return false;
    if (!dragPayload || dragPayload.type !== 'person') return false;
    void addPeopleToCohort(cohortId, [dragPayload.personId]);
    setDragPayload(null);
    return true;
  };

  const createCohort = async () => {
    if (!canComposeDraft) {
      setSaveState('error');
      setSaveMessage(composeDeniedReason);
      return;
    }
    setSaveState('error');
    setSaveMessage('Cohort creation is not available in the current coaching API. Use existing cohorts.');
  };

  const reorderTask = async (lessonId: string, taskId: string, direction: -1 | 1) => {
    if (!canComposeDraft || !selectedJourney || !session?.access_token) return;
    const lesson = selectedJourney.lessons.find((row) => row.id === lessonId);
    if (!lesson) return;
    const fromIndex = lesson.tasks.findIndex((task) => task.id === taskId);
    if (fromIndex < 0) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= lesson.tasks.length) return;
    const reorderedTaskIds = moveItem(lesson.tasks, fromIndex, toIndex).map((task) => task.id);
    setJourneys((prev) =>
      prev.map((journey) =>
        journey.id === selectedJourney.id
          ? {
              ...journey,
              lessons: journey.lessons.map((row) =>
                row.id === lessonId ? { ...row, tasks: moveItem(row.tasks, fromIndex, toIndex) } : row
              ),
            }
          : journey
      )
    );
    await runMutation('Saving task order...', 'Task order updated', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lessonId}/tasks/reorder`,
        'POST',
        { task_ids: reorderedTaskIds }
      );
      await refreshPortalData();
    });
    setActiveTaskMenu(null);
    markDraftChanged('Task order updated.');
  };

  const removeTask = async (lessonId: string, taskId: string) => {
    if (!canComposeDraft || !selectedJourney || !session?.access_token) return;
    await runMutation('Removing task...', 'Task removed', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lessonId}/tasks/${taskId}`,
        'DELETE'
      );
      await refreshPortalData();
    });
    setActiveTaskMenu(null);
    markDraftChanged('Task removed.');
  };

  const addLesson = async () => {
    if (!canComposeDraft || !selectedJourney || !session?.access_token) return;
    const nextCount = selectedJourney.lessons.length + 1;
    await runMutation('Adding lesson...', 'Lesson added', async () => {
      const created = await sendCoachMutation<{ lesson: { id: string } }>(
        `/api/coaching/journeys/${selectedJourney.id}/lessons`,
        'POST',
        { title: `Lesson ${nextCount}`, sort_order: selectedJourney.lessons.length }
      );
      setSelectedLessonId(created.lesson.id);
      await refreshPortalData();
    });
    markDraftChanged('Lesson added.');
  };

  const addTaskToLesson = async (targetLessonId?: string) => {
    if (!canComposeDraft || !selectedJourney || !session?.access_token) return;
    const lessonId = targetLessonId ?? selectedLessonId;
    const lesson = selectedJourney.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    await runMutation('Adding task...', 'Task added', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lesson.id}/tasks`,
        'POST',
        { title: `Task ${lesson.tasks.length + 1}`, sort_order: lesson.tasks.length }
      );
      await refreshPortalData();
    });
    markDraftChanged('Task added to lesson.');
  };

  const renameLesson = async (lessonId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !canComposeDraft || !selectedJourney || !session?.access_token) {
      setEditingLessonId(null);
      return;
    }
    const existing = selectedJourney.lessons.find((l) => l.id === lessonId);
    if (existing && existing.title === trimmed) { setEditingLessonId(null); return; }
    // Optimistic local update
    setJourneys((prev) =>
      prev.map((j) =>
        j.id === selectedJourney.id
          ? { ...j, lessons: j.lessons.map((l) => (l.id === lessonId ? { ...l, title: trimmed } : l)) }
          : j
      )
    );
    setEditingLessonId(null);
    await runMutation('Renaming lesson...', 'Lesson renamed', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lessonId}`,
        'PATCH',
        { title: trimmed }
      );
      await refreshPortalData();
    });
    markDraftChanged('Lesson renamed.');
  };

  const renameTask = async (lessonId: string, taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !canComposeDraft || !selectedJourney || !session?.access_token) {
      setEditingTaskKey(null);
      return;
    }
    const lesson = selectedJourney.lessons.find((l) => l.id === lessonId);
    const task = lesson?.tasks.find((t) => t.id === taskId);
    if (task && task.title === trimmed) { setEditingTaskKey(null); return; }
    // Optimistic local update
    setJourneys((prev) =>
      prev.map((j) =>
        j.id === selectedJourney.id
          ? {
              ...j,
              lessons: j.lessons.map((l) =>
                l.id === lessonId
                  ? { ...l, tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)) }
                  : l
              ),
            }
          : j
      )
    );
    setEditingTaskKey(null);
    await runMutation('Renaming task...', 'Task renamed', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lessonId}/tasks/${taskId}`,
        'PATCH',
        { title: trimmed }
      );
      await refreshPortalData();
    });
    markDraftChanged('Task renamed.');
  };

  const createJourney = async () => {
    if (!canComposeDraft) { setSaveState('error'); setSaveMessage(composeDeniedReason); return; }
    if (!session?.access_token) { setSaveState('error'); setSaveMessage('Missing session token.'); return; }
    const name = newJourneyName.trim();
    if (!name) { setSaveState('error'); setSaveMessage('Enter a journey name first.'); return; }
    await runMutation('Creating journey...', 'Journey created', async () => {
      const created = await sendCoachMutation<{ journey: { id: string } }>(
        '/api/coaching/journeys',
        'POST',
        { title: name }
      );
      setNewJourneyName('');
      setSelectedJourneyId(created.journey.id);
      await refreshPortalData();
    });
    markDraftChanged('New journey created.');
  };

  const deleteJourney = async (journeyId: string) => {
    if (!canComposeDraft || !session?.access_token) return;
    await runMutation('Deleting journey...', 'Journey deleted', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${journeyId}`,
        'DELETE'
      );
      if (selectedJourneyId === journeyId) {
        setSelectedJourneyId(null);
        setSelectedLessonId(null);
      }
      await refreshPortalData();
    });
    setConfirmDelete(null);
    markDraftChanged('Journey deleted.');
  };

  const deleteLesson = async (lessonId: string) => {
    if (!canComposeDraft || !selectedJourney || !session?.access_token) return;
    await runMutation('Deleting lesson...', 'Lesson deleted', async () => {
      await sendCoachMutation(
        `/api/coaching/journeys/${selectedJourney.id}/lessons/${lessonId}`,
        'DELETE'
      );
      await refreshPortalData();
    });
    if (selectedLessonId === lessonId) setSelectedLessonId(null);
    setConfirmDelete(null);
    markDraftChanged('Lesson deleted.');
  };

  const confirmAndDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'journey') void deleteJourney(confirmDelete.id);
    else if (confirmDelete.type === 'lesson') void deleteLesson(confirmDelete.id);
    else if (confirmDelete.type === 'task' && confirmDelete.parentId) {
      void removeTask(confirmDelete.parentId, confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const purgeSeedPlaceholderJourneys = async () => {
    if (!canComposeDraft || !session?.access_token || seedPurgePending) return;
    const matches = seedPlaceholderJourneys;
    if (!matches.length) {
      setSeedPurgeConfirmOpen(false);
      setSaveState('saved');
      setSaveMessage('No seed placeholder journeys found to purge.');
      return;
    }
    setSeedPurgePending(true);
    setSaveState('pending');
    setSaveMessage(`Purging ${matches.length} placeholder journeys...`);
    const failed: string[] = [];
    for (const journey of matches) {
      try {
        await sendCoachMutation(
          `/api/coaching/journeys/${journey.id}`,
          'DELETE'
        );
      } catch {
        failed.push(journey.name);
      }
    }
    setSeedPurgePending(false);
    setSeedPurgeConfirmOpen(false);
    await refreshPortalData();
    const deleted = matches.length - failed.length;
    if (failed.length > 0) {
      setSaveState('error');
      setSaveMessage(
        `Purged ${deleted} placeholder journeys. Failed ${failed.length}: ${failed.slice(0, 2).join(', ')}${
          failed.length > 2 ? '...' : ''
        }`
      );
      return;
    }
    setSaveState('saved');
    setSaveMessage(`Purged ${deleted} placeholder journeys.`);
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
                    {personaWorkspaceLabel(mode, effectiveRoles).label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.scopeTabs}>
            {([
              ['my', 'My'],
              ['team', 'Team'],
              ['all_allowed', 'All'],
            ] as const).map(([scopeValue, label]) => {
              const selected = contentScope === scopeValue;
              return (
                <Pressable
                  key={scopeValue}
                  style={[s.scopeTab, selected && s.scopeTabActive]}
                  onPress={() => setContentScope(scopeValue)}
                >
                  <Text style={[s.scopeTabText, selected && s.scopeTabTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {hasSuperAdminRole ? (
            <Pressable
              style={[s.elevatedEditPill, superAdminElevatedEdit && s.elevatedEditPillActive]}
              onPress={() => setSuperAdminElevatedEdit((prev) => !prev)}
            >
              <Text style={[s.elevatedEditPillText, superAdminElevatedEdit && s.elevatedEditPillTextActive]}>
                {superAdminElevatedEdit ? 'Elevated Edit On' : 'View-Only Mode'}
              </Text>
            </Pressable>
          ) : null}
          {/* Account */}
          <View style={s.accountWrap}>
            <Pressable style={[s.avatarBtn, accountMenuOpen && s.avatarBtnOpen]} onPress={() => setAccountMenuOpen((p) => !p)}>
              <Text style={s.avatarBtnText}>{accountInitial}</Text>
            </Pressable>
            {accountMenuOpen ? (
              <View style={s.accountDrop}>
                <Text style={s.accountDropLabel}>{accountLabel}</Text>
                <Text style={s.accountDropRole}>{backendRole ?? 'Role from session'}</Text>
                {hasSuperAdminRole ? (
                  <TouchableOpacity
                    style={s.accountDropSwitch}
                    onPress={() => {
                      setAccountMenuOpen(false);
                      if (typeof window === 'undefined') return;
                      if (window.location.pathname === '/admin/users') return;
                      window.history.pushState({}, '', '/admin/users');
                    }}
                  >
                    <Text style={s.accountDropSwitchText}>Switch to Admin Panel</Text>
                  </TouchableOpacity>
                ) : null}
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
      <View style={s.scopeBanner}>
        <Text style={s.scopeBannerText}>
          Scope: {scopeLabel} • {canComposeDraft ? 'Authoring enabled' : 'Read-only'}
          {hasSuperAdminRole && !superAdminElevatedEdit ? ' (enable Elevated Edit for writes)' : ''}
        </Text>
      </View>
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
                      {selAsset?.title ?? 'Asset'} selected — click a lesson to place it
                    </Text>
                    <Pressable onPress={() => { setDragPayload(null); setDraggingAssetId(null); }}>
                      <Text style={s.selectedAssetBannerClose}>✕</Text>
                    </Pressable>
                  </View>
                );
              })()}
              <View style={s.sidebarScroll}>
                {collections.length === 0 ? (
                  <View style={s.libraryEmptyState}>
                    <Text style={s.libraryEmptyTitle}>No library assets configured yet.</Text>
                    <Text style={s.libraryEmptyBody}>Assets are managed via the admin panel's Content Uploads screen and published here.</Text>
                  </View>
                ) : (
                  collections.map((collection) => {
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
                  })
                )}
              </View>
            </View>

            {/* ── Builder Canvas ── */}
            <ScrollView style={s.canvas} contentContainerStyle={s.canvasInner} showsVerticalScrollIndicator>
              {/* Journey picker — single-line trigger + dropdown overlay */}
              <View style={{ position: 'relative' as any, zIndex: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: journeyPickerOpen ? '#2563EB' : '#CBD5E1',
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      backgroundColor: '#FFFFFF',
                      gap: 8,
                    }}
                    onPress={() => { setJourneyPickerOpen(!journeyPickerOpen); setJourneyQuery(''); }}
                  >
                    <View style={{ flex: 1 }}>
                      {selectedJourney ? (
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{selectedJourney.name}</Text>
                      ) : (
                        <Text style={{ fontSize: 14, color: '#94A3B8' }}>Select a journey…</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>{journeyPickerOpen ? '▴' : '▾'}</Text>
                  </Pressable>
                  {canComposeDraft && seedPlaceholderJourneys.length > 0 ? (
                    <Pressable
                      style={{ borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#EFF6FF' }}
                      onPress={() => setSeedPurgeConfirmOpen(true)}
                    >
                      <Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '700' }}>Purge Seeds</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Dropdown overlay */}
                {journeyPickerOpen ? (
                  <>
                    {/* Backdrop */}
                    <Pressable
                      style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
                      onPress={() => setJourneyPickerOpen(false)}
                    />
                    <View
                      style={{
                        position: 'absolute' as any,
                        top: '100%' as any,
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                        borderRadius: 12,
                        padding: 12,
                        gap: 8,
                        zIndex: 2,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.12,
                        shadowRadius: 24,
                        elevation: 12,
                      }}
                    >
                      <TextInput
                        value={journeyQuery}
                        onChangeText={setJourneyQuery}
                        placeholder="Search journeys..."
                        placeholderTextColor="#94A3B8"
                        style={s.journeySelectorSearch}
                        autoFocus
                      />
                      <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 6 }}>
                        {filteredJourneys.length === 0 ? (
                          <Text style={s.journeySelectorEmpty}>No journeys match search.</Text>
                        ) : (
                          filteredJourneys.map((journey) => {
                            const selected = selectedJourney?.id === journey.id;
                            return (
                              <Pressable
                                key={journey.id}
                                style={[s.journeySelectorItem, selected && s.journeySelectorItemActive]}
                                onPress={() => {
                                  setSelectedJourneyId(journey.id);
                                  setJourneyPickerOpen(false);
                                }}
                              >
                                <View style={s.journeySelectorItemBody}>
                                  <Text style={[s.journeySelectorItemTitle, selected && s.journeySelectorItemTitleActive]} numberOfLines={1}>
                                    {journey.name}
                                  </Text>
                                  <Text style={s.journeySelectorItemMeta}>{journey.audience} · {journey.lessons.length} lessons</Text>
                                </View>
                                {canComposeDraft ? (
                                  <Pressable
                                    style={s.chipDeleteBtn}
                                    onPress={(event: any) => {
                                      event?.stopPropagation?.();
                                      setConfirmDelete({ type: 'journey', id: journey.id, label: journey.name });
                                    }}
                                  >
                                    <Text style={s.chipDeleteBtnText}>✕</Text>
                                  </Pressable>
                                ) : null}
                              </Pressable>
                            );
                          })
                        )}
                      </ScrollView>
                      {canComposeDraft ? (
                        <View style={[s.inlineCreateRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }]}>
                          <TextInput value={newJourneyName} onChangeText={setNewJourneyName} placeholder="New journey name..." placeholderTextColor="#94A3B8" style={s.inlineCreateInput} />
                          <TouchableOpacity style={s.btnSecondary} onPress={() => { createJourney(); setJourneyPickerOpen(false); }}><Text style={s.btnSecondaryText}>+ Journey</Text></TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </View>

              {/* ── Selected journey header ── */}
              {selectedJourney ? (
                <View style={{
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E40AF' }} numberOfLines={1}>{selectedJourney.name}</Text>
                    <Text style={{ fontSize: 12, color: '#3B82F6' }}>{selectedJourney.audience} · {selectedJourney.lessons.length} lesson{selectedJourney.lessons.length === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {saveState === 'pending' ? <Text style={s.autoSaveHint}>Saving...</Text> : null}
                    {saveState === 'saved' ? <Text style={s.autoSaveHint}>✓ Saved</Text> : null}
                    {saveState === 'error' ? <Text style={s.autoSaveError}>{saveMessage}</Text> : null}
                    {canComposeDraft ? (
                      <Pressable style={s.inlineAddLessonBtn} onPress={addLesson}>
                        <Text style={s.inlineAddLessonBtnText}>+ Lesson</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#64748B' }}>Select a journey above to view and edit its lessons.</Text>
                </View>
              )}

              {!canComposeDraft ? (
                <View style={s.deniedBanner}>
                  <Text style={s.deniedBannerText}>{composeDeniedReason}</Text>
                </View>
              ) : null}

              {dropHint ? <Text style={s.dropHintText}>{dropHint}</Text> : null}

              {/* Lessons */}
              <View style={s.milestoneList}>
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
                        <View style={s.kindBadgeLesson}><Text style={s.kindBadgeLessonText}>Lesson</Text></View>
                        {editingLessonId === lesson.id && canComposeDraft ? (
                          <TextInput
                            style={[s.milestoneTitle, s.inlineEditInput]}
                            value={editingLessonTitle}
                            onChangeText={setEditingLessonTitle}
                            autoFocus
                            selectTextOnFocus
                            onBlur={() => void renameLesson(lesson.id, editingLessonTitle)}
                            onSubmitEditing={() => void renameLesson(lesson.id, editingLessonTitle)}
                            placeholder="Lesson title…"
                            placeholderTextColor="#999"
                          />
                        ) : (
                          <Pressable
                            style={{ flex: 1 } as any}
                            onPress={() => { if (!handleClickDropToLesson(lesson.id, lesson.tasks.length)) setSelectedLessonId(lesson.id); }}
                            {...({ onDoubleClick: canComposeDraft ? () => { setEditingLessonId(lesson.id); setEditingLessonTitle(lesson.title); } : undefined } as any)}
                          >
                            <Text style={s.milestoneTitle}>{lesson.title}</Text>
                          </Pressable>
                        )}
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
                                      {editingTaskKey === `${lesson.id}:${task.id}` && canComposeDraft ? (
                                        <TextInput
                                          style={[s.blockTitle, s.inlineEditInput]}
                                          value={editingTaskTitle}
                                          onChangeText={setEditingTaskTitle}
                                          autoFocus
                                          selectTextOnFocus
                                          onBlur={() => void renameTask(lesson.id, task.id, editingTaskTitle)}
                                          onSubmitEditing={() => void renameTask(lesson.id, task.id, editingTaskTitle)}
                                          placeholder="Task title…"
                                          placeholderTextColor="#999"
                                        />
                                      ) : (
                                        <Pressable
                                          {...({ onDoubleClick: canComposeDraft ? () => { setEditingTaskKey(`${lesson.id}:${task.id}`); setEditingTaskTitle(task.title); } : undefined } as any)}
                                        >
                                          <Text style={s.blockTitle}>{task.title}</Text>
                                        </Pressable>
                                      )}
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

                  {/* Cohort selector (always visible search + list) */}
                  <View style={s.journeySelectorPanel}>
                    <TextInput
                      value={cohortQuery}
                      onChangeText={setCohortQuery}
                      placeholder="Search cohorts..."
                      placeholderTextColor="#94A3B8"
                      style={s.journeySelectorSearch}
                    />
                    <ScrollView style={s.journeySelectorList} contentContainerStyle={s.journeySelectorListInner}>
                      {filteredCohorts.length === 0 ? (
                        <Text style={s.journeySelectorEmpty}>No cohorts match search.</Text>
                      ) : (
                        filteredCohorts.map((cohort) => {
                          const sel = selectedCohort?.id === cohort.id;
                          return (
                            <Pressable
                              key={cohort.id}
                              style={[s.journeySelectorItem, sel && s.journeySelectorItemActive]}
                              onPress={() => { if (!handleClickAssignPersonToCohort(cohort.id)) setSelectedCohortId(cohort.id); }}
                              {...({ dataSet: { dropCohort: cohort.id } } as any)}
                            >
                              <View style={s.journeySelectorItemBody}>
                                <Text style={[s.journeySelectorItemTitle, sel && s.journeySelectorItemTitleActive]} numberOfLines={1}>
                                  {cohort.name}
                                </Text>
                                <Text style={s.journeySelectorItemMeta}>
                                  {cohort.program} · {cohort.memberIds.length} members
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </ScrollView>
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
      {seedPurgeConfirmOpen ? (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Purge Seed Placeholders?</Text>
            <Text style={s.modalBody}>
              This will delete {seedPlaceholderJourneys.length} journey
              {seedPlaceholderJourneys.length === 1 ? '' : 's'} that match seed placeholder patterns.
            </Text>
            <View style={s.purgePreviewList}>
              {seedPlaceholderJourneys.slice(0, SEED_JOURNEY_PREVIEW_LIMIT).map((journey) => (
                <Text key={journey.id} style={s.purgePreviewItem}>• {journey.name}</Text>
              ))}
              {seedPlaceholderJourneys.length > SEED_JOURNEY_PREVIEW_LIMIT ? (
                <Text style={s.purgePreviewItem}>• +{seedPlaceholderJourneys.length - SEED_JOURNEY_PREVIEW_LIMIT} more</Text>
              ) : null}
            </View>
            <View style={s.modalActions}>
              <Pressable
                style={s.modalCancelBtn}
                onPress={() => !seedPurgePending && setSeedPurgeConfirmOpen(false)}
              >
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.modalDeleteBtn, seedPurgePending && s.modalDeleteBtnDisabled]}
                disabled={seedPurgePending}
                onPress={() => { void purgeSeedPlaceholderJourneys(); }}
              >
                <Text style={s.modalDeleteBtnText}>{seedPurgePending ? 'Purging...' : 'Confirm Purge'}</Text>
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
  scopeTabs: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 3,
  },
  scopeTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scopeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  scopeTabTextActive: {
    color: '#1D4ED8',
  },
  elevatedEditPill: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  elevatedEditPillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  elevatedEditPillText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  elevatedEditPillTextActive: {
    color: '#1D4ED8',
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
  accountDropSwitch: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  accountDropSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  accountDropSignOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  scopeBanner: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  scopeBannerText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
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
  libraryEmptyState: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    padding: 14,
    gap: 6,
  },
  libraryEmptyTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  libraryEmptyBody: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
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

  /* ── Journey selector ── */
  journeySelectorCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  journeySelectorCurrent: {
    gap: 2,
  },
  journeySelectorCurrentName: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  journeySelectorCurrentMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  journeySelectorActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  journeySelectorBtn: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
  },
  journeySelectorBtnDisabled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    opacity: 0.65,
  },
  journeySelectorBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  journeySelectorPanel: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 10,
  },
  journeySelectorSearch: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 13,
    backgroundColor: '#FFFFFF',
  },
  journeySelectorList: {
    maxHeight: 280,
  },
  journeySelectorListInner: {
    gap: 8,
  },
  journeySelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  journeySelectorItemActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  journeySelectorItemBody: {
    flex: 1,
    gap: 2,
  },
  journeySelectorItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  journeySelectorItemTitleActive: {
    color: '#1D4ED8',
  },
  journeySelectorItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  journeySelectorEmpty: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  journeyPurgeHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
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
  inlineEditInput: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#fff',
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
  purgePreviewList: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    marginBottom: 16,
  },
  purgePreviewItem: {
    color: '#334155',
    fontSize: 12,
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
  modalDeleteBtnDisabled: {
    opacity: 0.6,
  },
  modalDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
