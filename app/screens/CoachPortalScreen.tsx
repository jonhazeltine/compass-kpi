import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
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
import {
  LEGACY_ADMIN_COACHING_PATH_BY_ROUTE_KEY,
  canAccessAdminRoute,
  getAdminRouteByKey,
  getAdminRouteByPath,
  type AdminRole,
  type AdminRouteKey,
} from '../lib/adminAuthz';

type CoachRouteKey = 'coachingLibrary' | 'coachingJourneys' | 'coachingCohorts' | 'coachingChannels';
type SaveState = 'idle' | 'pending' | 'saved' | 'error';

type CoachSurface = {
  key: CoachRouteKey;
  path: string;
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

type JourneyBlock = {
  id: string;
  assetId: string;
};

type JourneyMilestone = {
  id: string;
  title: string;
  blocks: JourneyBlock[];
};

type JourneyDraft = {
  id: string;
  name: string;
  audience: string;
  milestones: JourneyMilestone[];
};

type DragPayload =
  | { type: 'asset'; assetId: string; sourceCollectionId: string | null }
  | { type: 'journey_block'; sourceJourneyId: string; sourceMilestoneId: string; blockId: string; assetId: string }
  | null;

const COACH_ROUTE_KEYS: CoachRouteKey[] = ['coachingLibrary', 'coachingJourneys', 'coachingCohorts', 'coachingChannels'];

const COACH_SURFACES: Record<CoachRouteKey, CoachSurface> = {
  coachingLibrary: {
    key: 'coachingLibrary',
    path: '/coach/library',
    label: 'Library',
    headline: 'Library workspace: Assets and Collections',
    summary: 'Library is the canonical content workspace. Organize assets into collections, then assign them into journeys.',
  },
  coachingJourneys: {
    key: 'coachingJourneys',
    path: '/coach/journeys',
    label: 'Journeys',
    headline: 'Journey builder',
    summary: 'Create a new journey, drag assets or collection items into milestones, then save draft changes.',
  },
  coachingCohorts: {
    key: 'coachingCohorts',
    path: '/coach/cohorts',
    label: 'Cohorts',
    headline: 'Group participants for targeted coaching delivery',
    summary: 'Manage cohort membership and align each cohort to the right journeys and communication channels.',
  },
  coachingChannels: {
    key: 'coachingChannels',
    path: '/coach/channels',
    label: 'Channels',
    headline: 'Run communication channels with scoped audiences',
    summary: 'Coordinate channel plans for journeys and cohorts while keeping sponsor interactions compliant.',
  },
};

const COHORT_ROWS = [
  { id: 'co-1', c1: 'Q1 Rising Agents', c2: 'Coach Avery', c3: '24', c4: 'Listing Accelerator' },
  { id: 'co-2', c1: 'Sponsor Elite Leads', c2: 'Sponsor North', c3: '19', c4: 'Lead Conversion' },
  { id: 'co-3', c1: 'Team Velocity', c2: 'TL Jamie', c3: '11', c4: 'Production Sprint' },
];

const CHANNEL_ROWS = [
  { id: 'ch-1', c1: 'Listing Accelerator Hub', c2: 'Coach', c3: '42', c4: '2h ago' },
  { id: 'ch-2', c1: 'Sponsor Lead Briefing', c2: 'Sponsor scoped', c3: '19', c4: '4h ago' },
  { id: 'ch-3', c1: 'Team Velocity Check-In', c2: 'Team scoped', c3: '11', c4: '1d ago' },
];

const DEFAULT_MILESTONES: JourneyMilestone[] = [
  { id: 'ms-kickoff', title: 'Kickoff', blocks: [] },
  { id: 'ms-practice', title: 'Practice', blocks: [] },
  { id: 'ms-application', title: 'Live Application', blocks: [] },
];

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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const copy = [...items];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

function cloneMilestones(): JourneyMilestone[] {
  return DEFAULT_MILESTONES.map((milestone) => ({ ...milestone, blocks: [] }));
}

export default function CoachPortalScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const { signOut } = useAuth();
  const { backendRole, backendRoleLoading, resolvedRoles } = useAdminAuthz();
  const [activeKey, setActiveKey] = useState<CoachRouteKey>(
    () => getCoachRouteKeyFromPath(typeof window !== 'undefined' ? window.location.pathname : undefined) ?? 'coachingLibrary'
  );
  const [notFoundPath, setNotFoundPath] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const [assets, setAssets] = useState<LibraryAsset[]>([
    { id: 'asset-1', title: 'Buyer Follow-Up Kit', category: 'Lesson Pack', scope: 'All teams', duration: '14 min' },
    { id: 'asset-2', title: 'Sponsor Event Promo', category: 'Campaign', scope: 'Sponsor cohort', duration: '8 min' },
    { id: 'asset-3', title: 'New Agent Sprint', category: 'Onboarding', scope: 'Cohort based', duration: '22 min' },
    { id: 'asset-4', title: 'Weekly Objection Handling', category: 'Workshop', scope: 'Team scoped', duration: '16 min' },
    { id: 'asset-5', title: 'Price-Point Discovery Script', category: 'Lesson Pack', scope: 'All teams', duration: '10 min' },
  ]);
  const [collections, setCollections] = useState<LibraryCollection[]>([
    { id: 'col-1', name: 'Listing Accelerator', assetIds: ['asset-1', 'asset-4'] },
    { id: 'col-2', name: 'Sponsor Conversion', assetIds: ['asset-2', 'asset-5'] },
    { id: 'col-3', name: 'Onboarding Essentials', assetIds: ['asset-3'] },
  ]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('col-1');

  const [journeys, setJourneys] = useState<JourneyDraft[]>([
    { id: 'jr-1', name: '30-Day Listing Accelerator', audience: 'New agents', milestones: cloneMilestones() },
    { id: 'jr-2', name: 'Sponsor Lead Conversion', audience: 'Sponsor cohort', milestones: cloneMilestones() },
  ]);
  const [selectedJourneyId, setSelectedJourneyId] = useState('jr-1');
  const [newJourneyName, setNewJourneyName] = useState('');

  const [dragPayload, setDragPayload] = useState<DragPayload>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('No unsaved changes.');
  const [dropHint, setDropHint] = useState('Drag an asset into a collection or journey milestone.');

  const blockIdRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    ? 'Sponsor access is scoped for visibility only. Drag/drop authoring and KPI logging are unavailable.'
    : 'Current role cannot edit journey drafts on this route.';

  const scopeSummary = coachCanCompose
    ? 'Coach access: full authoring controls enabled for Library and Journeys.'
    : teamLeaderCanCompose
      ? 'Team Leader access: authoring controls are team-scoped only.'
      : sponsorOnly
        ? 'Sponsor access: sponsor-scoped visibility only. No KPI logging actions are available.'
        : 'Access is limited to currently authorized coach portal sections.';

  const activeSurface = COACH_SURFACES[activeKey];

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

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null,
    [collections, selectedCollectionId]
  );

  const selectedCollectionAssets = useMemo(() => {
    if (!selectedCollection) return [] as LibraryAsset[];
    return selectedCollection.assetIds.map((assetId) => assetsById.get(assetId)).filter((row): row is LibraryAsset => Boolean(row));
  }, [selectedCollection, assetsById]);

  const selectedJourney = useMemo(
    () => journeys.find((journey) => journey.id === selectedJourneyId) ?? journeys[0] ?? null,
    [journeys, selectedJourneyId]
  );

  const selectedGenericRows = activeKey === 'coachingChannels' ? CHANNEL_ROWS : COHORT_ROWS;
  const selectedGenericRow = selectedGenericRows.find((row) => row.id === selectedRowId) ?? selectedGenericRows[0] ?? null;

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clearDrag = () => setDragPayload(null);
    window.addEventListener('mouseup', clearDrag);
    return () => window.removeEventListener('mouseup', clearDrag);
  }, []);

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
    if (typeof window === 'undefined') return;
    const sync = () => {
      const pathname = window.location.pathname;
      const sourceRoute = getAdminRouteByPath(pathname);
      const sourceRouteKey = sourceRoute?.key ?? null;
      const routeKey = normalizeCoachKey(sourceRouteKey);
      const isCoachPath = pathname.startsWith('/coach') || pathname.startsWith('/admin/coaching');
      if (!isCoachPath) {
        setNotFoundPath(null);
        return;
      }
      if (!routeKey) {
        setNotFoundPath(pathname);
        return;
      }
      setNotFoundPath(null);
      if (sourceRouteKey === 'coachingUploads') {
        if (pathname !== '/coach/library') {
          window.history.replaceState({}, '', '/coach/library');
        }
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

  const navigate = (nextKey: CoachRouteKey) => {
    const nextRoute = getAdminRouteByKey(nextKey);
    setActiveKey(nextKey);
    setNotFoundPath(null);
    if (typeof window !== 'undefined' && window.location.pathname !== nextRoute.path) {
      window.history.pushState({}, '', nextRoute.path);
      window.dispatchEvent(new Event('codex:pathchange'));
    }
  };

  const markDraftChanged = (hint: string) => {
    setDirty(true);
    setSaveState('idle');
    setSaveMessage('Unsaved changes. Save draft to persist this arrangement.');
    setDropHint(hint);
  };

  const parseDragPayload = (eventLike?: any): DragPayload => {
    const text = typeof eventLike?.dataTransfer?.getData === 'function' ? eventLike.dataTransfer.getData('text/plain') : '';
    if (text.startsWith('asset:')) {
      const [, assetId, sourceCollectionId] = text.split(':');
      return { type: 'asset', assetId, sourceCollectionId: sourceCollectionId === 'none' ? null : sourceCollectionId };
    }
    if (text.startsWith('journey-block:')) {
      const [, sourceJourneyId, sourceMilestoneId, blockId, assetId] = text.split(':');
      if (sourceJourneyId && sourceMilestoneId && blockId && assetId) {
        return { type: 'journey_block', sourceJourneyId, sourceMilestoneId, blockId, assetId };
      }
    }
    return dragPayload;
  };

  const handleDragOver = (eventLike: any) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (eventLike?.dataTransfer) {
      eventLike.dataTransfer.dropEffect = canComposeDraft ? 'move' : 'none';
    }
  };

  const assignAssetToCollection = (collectionId: string, payload: DragPayload) => {
    if (!canComposeDraft || !payload || payload.type !== 'asset') return;
    const targetExists = collections.some((collection) => collection.id === collectionId);
    if (!targetExists) return;
    setCollections((prev) =>
      prev.map((collection) => {
        const filteredIds = collection.assetIds.filter((assetId) => assetId !== payload.assetId);
        if (collection.id !== collectionId) {
          return { ...collection, assetIds: filteredIds };
        }
        return { ...collection, assetIds: [...filteredIds, payload.assetId] };
      })
    );
    setSelectedCollectionId(collectionId);
    markDraftChanged('Asset moved into collection.');
  };

  const addAssetToMilestone = (payload: DragPayload, targetMilestoneId: string, targetIndex: number) => {
    if (!selectedJourney) return;

    if (payload?.type === 'asset') {
      setJourneys((prev) =>
        prev.map((journey) => {
          if (journey.id !== selectedJourney.id) return journey;
          const milestones = journey.milestones.map((milestone) => {
            if (milestone.id !== targetMilestoneId) return milestone;
            const insertAt = Math.max(0, Math.min(targetIndex, milestone.blocks.length));
            const nextBlocks = [...milestone.blocks];
            nextBlocks.splice(insertAt, 0, {
              id: `jb-${Date.now()}-${blockIdRef.current++}`,
              assetId: payload.assetId,
            });
            return { ...milestone, blocks: nextBlocks };
          });
          return { ...journey, milestones };
        })
      );
      markDraftChanged('Asset assigned to journey milestone.');
      return;
    }

    if (payload?.type === 'journey_block') {
      setJourneys((prev) =>
        prev.map((journey) => {
          if (journey.id !== selectedJourney.id || payload.sourceJourneyId !== selectedJourney.id) return journey;
          let movingBlock: JourneyBlock | null = null;
          const strippedMilestones = journey.milestones.map((milestone) => {
            if (milestone.id !== payload.sourceMilestoneId) return milestone;
            const remainingBlocks = milestone.blocks.filter((block) => {
              if (block.id !== payload.blockId) return true;
              movingBlock = block;
              return false;
            });
            return { ...milestone, blocks: remainingBlocks };
          });
          if (!movingBlock) return journey;

          const milestones = strippedMilestones.map((milestone) => {
            if (milestone.id !== targetMilestoneId) return milestone;
            const insertAt = Math.max(0, Math.min(targetIndex, milestone.blocks.length));
            const nextBlocks = [...milestone.blocks];
            nextBlocks.splice(insertAt, 0, movingBlock as JourneyBlock);
            return { ...milestone, blocks: nextBlocks };
          });
          return { ...journey, milestones };
        })
      );
      markDraftChanged('Journey block moved.');
    }
  };

  const handleDropToMilestone = (eventLike: any, milestoneId: string, index: number) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    addAssetToMilestone(payload, milestoneId, index);
    setDragPayload(null);
  };

  const handleDropToCollection = (eventLike: any, collectionId: string) => {
    if (typeof eventLike?.preventDefault === 'function') eventLike.preventDefault();
    if (!canComposeDraft) return;
    const payload = parseDragPayload(eventLike);
    assignAssetToCollection(collectionId, payload);
    setDragPayload(null);
  };

  const reorderBlock = (milestoneId: string, blockId: string, direction: -1 | 1) => {
    if (!canComposeDraft || !selectedJourney) return;
    setJourneys((prev) =>
      prev.map((journey) => {
        if (journey.id !== selectedJourney.id) return journey;
        const milestones = journey.milestones.map((milestone) => {
          if (milestone.id !== milestoneId) return milestone;
          const fromIndex = milestone.blocks.findIndex((block) => block.id === blockId);
          if (fromIndex < 0) return milestone;
          const toIndex = fromIndex + direction;
          return { ...milestone, blocks: moveItem(milestone.blocks, fromIndex, toIndex) };
        });
        return { ...journey, milestones };
      })
    );
    markDraftChanged('Journey step order updated.');
  };

  const removeBlock = (milestoneId: string, blockId: string) => {
    if (!canComposeDraft || !selectedJourney) return;
    setJourneys((prev) =>
      prev.map((journey) => {
        if (journey.id !== selectedJourney.id) return journey;
        const milestones = journey.milestones.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, blocks: milestone.blocks.filter((block) => block.id !== blockId) }
            : milestone
        );
        return { ...journey, milestones };
      })
    );
    markDraftChanged('Journey step removed.');
  };

  const createJourney = () => {
    if (!canComposeDraft) {
      setSaveState('error');
      setSaveMessage(composeDeniedReason);
      return;
    }
    const name = newJourneyName.trim();
    if (!name) {
      setSaveState('error');
      setSaveMessage('Enter a journey name to create a blank journey.');
      return;
    }
    const id = `jr-${Date.now()}`;
    const newJourney: JourneyDraft = {
      id,
      name,
      audience: 'Draft audience',
      milestones: cloneMilestones(),
    };
    setJourneys((prev) => [newJourney, ...prev]);
    setSelectedJourneyId(id);
    setNewJourneyName('');
    markDraftChanged('New blank journey created. Add assets to milestones and save.');
  };

  const saveDraft = () => {
    if (!canComposeDraft) {
      setSaveState('error');
      setSaveMessage(composeDeniedReason);
      return;
    }
    if (!selectedJourney) {
      setSaveState('error');
      setSaveMessage('Create or select a journey before saving.');
      return;
    }
    if (!dirty) {
      setSaveState('idle');
      setSaveMessage('No unsaved changes.');
      return;
    }
    setSaveState('pending');
    setSaveMessage('Saving journey draft...');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState('saved');
      setDirty(false);
      setSaveMessage(`Draft saved at ${new Date().toLocaleTimeString()}.`);
    }, 700);
  };

  if (!visibleRoutes.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Coach Portal Access Required</Text>
          <Text style={styles.centerBody}>This account does not have access to the coach portal routes at this time.</Text>
          <Text style={styles.centerMeta}>Current roles: {effectiveRoles.join(', ')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFoundPath) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Route Not Found</Text>
          <Text style={styles.centerBody}>The requested coach route is not available. Continue in the coach portal routes.</Text>
          <Text style={styles.centerMeta}>{notFoundPath}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigate(visibleRoutes[0].key as CoachRouteKey)}>
            <Text style={styles.primaryButtonText}>Open Coach Portal</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bgOrbOne} />
      <View style={styles.bgOrbTwo} />
      <View style={styles.shell}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBrandWrap}>
              <View style={styles.logoWrap}>
                <CompassMark width={38} height={38} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Compass Coach</Text>
                <Text style={styles.heroTitle}>Coach Portal</Text>
                <Text style={styles.heroSubtitle}>Authoring-focused workspace for Library, Journeys, Cohorts, and Channels.</Text>
              </View>
            </View>
            <View style={styles.heroActions}>
              <View style={styles.roleBadge}>
                {backendRoleLoading ? <ActivityIndicator size="small" color="#1E5A42" /> : null}
                <Text style={styles.roleBadgeText}>{backendRole ? `Role: ${backendRole}` : 'Role from session'}</Text>
              </View>
              <TouchableOpacity style={styles.signOutButton} onPress={() => void signOut()}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.scopeText}>{scopeSummary}</Text>
          <Text style={styles.compatText}>
            Compatibility aliases remain active: `/coach/uploads` and `/admin/coaching/*` map to canonical `/coach/*` routes.
          </Text>
        </View>

        <View style={[styles.navCard, isCompact && styles.navCardCompact]}>
          {visibleRoutes.map((route) => {
            const key = route.key as CoachRouteKey;
            const selected = key === activeKey;
            return (
              <Pressable key={route.key} style={[styles.navPill, selected && styles.navPillSelected]} onPress={() => navigate(key)}>
                <Text style={[styles.navPillLabel, selected && styles.navPillLabelSelected]}>{COACH_SURFACES[key].label}</Text>
                <Text style={styles.navPillPath}>{COACH_SURFACES[key].path}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.sectionTitle}>{activeSurface.headline}</Text>
          <Text style={styles.sectionBody}>{activeSurface.summary}</Text>

          {activeKey === 'coachingLibrary' ? (
            <View style={styles.builderWrap}>
              <View style={styles.libraryRail}>
                <Text style={styles.panelTitle}>Assets</Text>
                <Text style={styles.panelHint}>Drag assets into collections or journey milestones.</Text>
                <TextInput
                  value={libraryQuery}
                  onChangeText={setLibraryQuery}
                  placeholder="Search assets"
                  placeholderTextColor="#7A9085"
                  style={styles.searchInput}
                />
                <View style={styles.libraryList}>
                  {filteredAssets.map((asset) => {
                    const selected = selectedRowId === asset.id;
                    return (
                      <Pressable
                        key={asset.id}
                        onPress={() => setSelectedRowId(asset.id)}
                        style={[styles.libraryCard, selected && styles.libraryCardSelected]}
                        {...({
                          draggable: canComposeDraft,
                          onMouseDown: () => canComposeDraft && setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: null }),
                          onDragStart: (event: any) => {
                            setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: null });
                            event?.dataTransfer?.setData?.('text/plain', `asset:${asset.id}:none`);
                            setDropHint('Asset in hand. Drop onto a collection or journey milestone.');
                          },
                          onDragEnd: () => setDragPayload(null),
                        } as any)}
                      >
                        <Text style={styles.libraryCardTitle}>{asset.title}</Text>
                        <Text style={styles.libraryCardMeta}>{asset.category}</Text>
                        <Text style={styles.libraryCardMeta}>{asset.scope}</Text>
                        <Text style={styles.libraryCardMeta}>{asset.duration}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.collectionRail}>
                <Text style={styles.panelTitle}>Collections</Text>
                <Text style={styles.panelHint}>Collections are the organizational container for assets.</Text>
                <View style={styles.collectionList}>
                  {collections.map((collection) => {
                    const isSelected = selectedCollection?.id === collection.id;
                    return (
                      <Pressable
                        key={collection.id}
                        onPress={() => setSelectedCollectionId(collection.id)}
                        style={[styles.collectionCard, isSelected && styles.collectionCardSelected]}
                        {...({
                          onDragOver: handleDragOver,
                          onDrop: (event: any) => handleDropToCollection(event, collection.id),
                          onMouseUp: (event: any) => handleDropToCollection(event, collection.id),
                        } as any)}
                      >
                        <Text style={styles.collectionTitle}>{collection.name}</Text>
                        <Text style={styles.collectionMeta}>{collection.assetIds.length} assets</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.collectionDetailCard}>
                  <Text style={styles.detailTitle}>{selectedCollection?.name ?? 'Collection'}</Text>
                  <Text style={styles.detailMeta}>Drag from Assets to organize this collection.</Text>
                  <View style={styles.collectionItemsList}>
                    {selectedCollectionAssets.map((asset) => (
                      <Pressable
                        key={`collection-item-${asset.id}`}
                        style={styles.collectionItemChip}
                        {...({
                          draggable: canComposeDraft,
                          onMouseDown: () =>
                            canComposeDraft &&
                            setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: selectedCollection?.id ?? null }),
                          onDragStart: (event: any) => {
                            setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: selectedCollection?.id ?? null });
                            event?.dataTransfer?.setData?.(
                              'text/plain',
                              `asset:${asset.id}:${selectedCollection?.id ?? 'none'}`
                            );
                            setDropHint('Collection item in hand. Drop into journey milestone to assign.');
                          },
                          onDragEnd: () => setDragPayload(null),
                        } as any)}
                      >
                        <Text style={styles.collectionItemText}>{asset.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => navigate('coachingJourneys')}>
                      <Text style={styles.primaryButtonText}>Open Journey Builder</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : activeKey === 'coachingJourneys' ? (
            <View style={styles.builderWrap}>
              <View style={styles.libraryRail}>
                <Text style={styles.panelTitle}>Source Assets</Text>
                <Text style={styles.panelHint}>Drag assets or collection items into milestones.</Text>
                <View style={styles.libraryList}>
                  {filteredAssets.map((asset) => (
                    <Pressable
                      key={`journey-asset-${asset.id}`}
                      style={styles.libraryCard}
                      {...({
                        draggable: canComposeDraft,
                        onMouseDown: () => canComposeDraft && setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: null }),
                        onDragStart: (event: any) => {
                          setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: null });
                          event?.dataTransfer?.setData?.('text/plain', `asset:${asset.id}:none`);
                        },
                        onDragEnd: () => setDragPayload(null),
                      } as any)}
                    >
                      <Text style={styles.libraryCardTitle}>{asset.title}</Text>
                      <Text style={styles.libraryCardMeta}>{asset.category}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.sourceCollectionsBox}>
                  <Text style={styles.sourceCollectionsTitle}>Collection Items</Text>
                  {selectedCollectionAssets.map((asset) => (
                    <Pressable
                      key={`journey-col-asset-${asset.id}`}
                      style={styles.collectionItemChip}
                      {...({
                        draggable: canComposeDraft,
                        onMouseDown: () =>
                          canComposeDraft &&
                          setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: selectedCollection?.id ?? null }),
                        onDragStart: (event: any) => {
                          setDragPayload({ type: 'asset', assetId: asset.id, sourceCollectionId: selectedCollection?.id ?? null });
                          event?.dataTransfer?.setData?.('text/plain', `asset:${asset.id}:${selectedCollection?.id ?? 'none'}`);
                        },
                        onDragEnd: () => setDragPayload(null),
                      } as any)}
                    >
                      <Text style={styles.collectionItemText}>{asset.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.journeyCanvas}>
                <View style={styles.canvasHeaderRow}>
                  <View style={styles.journeyListWrap}>
                    {journeys.map((journey) => {
                      const selected = journey.id === selectedJourney?.id;
                      return (
                        <Pressable
                          key={journey.id}
                          style={[styles.journeySelectPill, selected && styles.journeySelectPillSelected]}
                          onPress={() => setSelectedJourneyId(journey.id)}
                        >
                          <Text style={[styles.journeySelectLabel, selected && styles.journeySelectLabelSelected]}>{journey.name}</Text>
                          <Text style={styles.journeySelectMeta}>{journey.audience}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.builderActionBar}>
                  <TextInput
                    value={newJourneyName}
                    onChangeText={setNewJourneyName}
                    placeholder="New journey name"
                    placeholderTextColor="#72887C"
                    style={styles.createJourneyInput}
                  />
                  <TouchableOpacity style={styles.secondaryButton} onPress={createJourney}>
                    <Text style={styles.secondaryButtonText}>Create New Journey</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton} onPress={saveDraft}>
                    <Text style={styles.primaryButtonText}>Save Draft</Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.saveStateChip,
                      saveState === 'pending' && styles.saveStateChipPending,
                      saveState === 'saved' && styles.saveStateChipSaved,
                      saveState === 'error' && styles.saveStateChipError,
                    ]}
                  >
                    {saveState === 'pending' ? 'PENDING' : saveState === 'saved' ? 'SAVED' : saveState === 'error' ? 'ERROR' : 'IDLE'}
                  </Text>
                </View>

                <Text style={styles.panelHint}>{dropHint}</Text>
                <Text style={styles.saveMessage}>{saveMessage}</Text>

                {!canComposeDraft ? (
                  <View style={styles.deniedCard}>
                    <Text style={styles.deniedTitle}>Authoring controls locked</Text>
                    <Text style={styles.deniedBody}>{composeDeniedReason}</Text>
                  </View>
                ) : null}

                {selectedJourney?.milestones.map((milestone) => (
                  <View key={milestone.id} style={styles.milestoneCard}>
                    <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                    <View
                      style={styles.dropZone}
                      {...({
                        onDragOver: handleDragOver,
                        onDrop: (event: any) => handleDropToMilestone(event, milestone.id, milestone.blocks.length),
                        onMouseUp: (event: any) => handleDropToMilestone(event, milestone.id, milestone.blocks.length),
                      } as any)}
                    >
                      {milestone.blocks.length === 0 ? (
                        <Text style={styles.dropZoneHint}>Drop an asset or collection item here</Text>
                      ) : (
                        milestone.blocks.map((block, index) => {
                          const asset = assetsById.get(block.assetId);
                          return (
                            <View
                              key={block.id}
                              style={styles.journeyBlockCard}
                              {...({
                                draggable: canComposeDraft,
                                onMouseDown: () => {
                                  if (!selectedJourney || !canComposeDraft) return;
                                  setDragPayload({
                                    type: 'journey_block',
                                    sourceJourneyId: selectedJourney.id,
                                    sourceMilestoneId: milestone.id,
                                    blockId: block.id,
                                    assetId: block.assetId,
                                  });
                                },
                                onDragStart: (event: any) => {
                                  if (!selectedJourney) return;
                                  setDragPayload({
                                    type: 'journey_block',
                                    sourceJourneyId: selectedJourney.id,
                                    sourceMilestoneId: milestone.id,
                                    blockId: block.id,
                                    assetId: block.assetId,
                                  });
                                  event?.dataTransfer?.setData?.(
                                    'text/plain',
                                    `journey-block:${selectedJourney.id}:${milestone.id}:${block.id}:${block.assetId}`
                                  );
                                },
                                onDragEnd: () => setDragPayload(null),
                              } as any)}
                            >
                              <View style={styles.journeyBlockCopy}>
                                <Text style={styles.journeyBlockTitle}>{asset?.title ?? 'Unknown asset'}</Text>
                                <Text style={styles.journeyBlockMeta}>Step {index + 1} • {asset?.category ?? 'Asset'}</Text>
                              </View>
                              <View style={styles.blockActions}>
                                <TouchableOpacity
                                  style={styles.inlineActionButton}
                                  onPress={() => reorderBlock(milestone.id, block.id, -1)}
                                  disabled={!canComposeDraft}
                                >
                                  <Text style={styles.inlineActionText}>Up</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.inlineActionButton}
                                  onPress={() => reorderBlock(milestone.id, block.id, 1)}
                                  disabled={!canComposeDraft}
                                >
                                  <Text style={styles.inlineActionText}>Down</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.inlineActionButtonDanger}
                                  onPress={() => removeBlock(milestone.id, block.id)}
                                  disabled={!canComposeDraft}
                                >
                                  <Text style={styles.inlineActionTextDanger}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.colLabel, styles.colWide]}>{activeKey === 'coachingChannels' ? 'Channel' : 'Cohort'}</Text>
                <Text style={[styles.colLabel, styles.colWide]}>{activeKey === 'coachingChannels' ? 'Scope' : 'Owner'}</Text>
                <Text style={[styles.colLabel, styles.colWide]}>{activeKey === 'coachingChannels' ? 'Members' : 'Members'}</Text>
                <Text style={[styles.colLabel, styles.colNarrow]}>{activeKey === 'coachingChannels' ? 'Activity' : 'Program'}</Text>
              </View>
              {selectedGenericRows.map((row) => {
                const selected = selectedGenericRow?.id === row.id;
                return (
                  <Pressable key={row.id} style={[styles.tableRow, selected && styles.tableRowSelected]} onPress={() => setSelectedRowId(row.id)}>
                    <Text style={[styles.colValue, styles.colWide]} numberOfLines={1}>{row.c1}</Text>
                    <Text style={[styles.colValue, styles.colWide]} numberOfLines={1}>{row.c2}</Text>
                    <Text style={[styles.colValue, styles.colWide]} numberOfLines={1}>{row.c3}</Text>
                    <Text style={[styles.colValue, styles.colNarrow]} numberOfLines={1}>{row.c4}</Text>
                  </Pressable>
                );
              })}

              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{selectedGenericRow?.c1 ?? 'Selection'}</Text>
                <Text style={styles.detailMeta}>{selectedGenericRow?.c2 ?? ''}</Text>
                <Text style={styles.detailMeta}>{selectedGenericRow?.c3 ?? ''}</Text>
                <Text style={styles.detailMeta}>{selectedGenericRow?.c4 ?? ''}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF7F2',
  },
  bgOrbOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -70,
    right: -40,
    backgroundColor: '#CCE9D9',
    opacity: 0.85,
  },
  bgOrbTwo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: -30,
    left: -50,
    backgroundColor: '#DCEFD2',
    opacity: 0.8,
  },
  shell: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E6DB',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 260,
    flex: 1,
  },
  logoWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D2E8DB',
    backgroundColor: '#F3FBF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    color: '#3E7A62',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#1E342A',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 2,
  },
  heroSubtitle: {
    color: '#4F6B5C',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  heroActions: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 240,
  },
  roleBadge: {
    borderWidth: 1,
    borderColor: '#CFE7D8',
    backgroundColor: '#EFFAF3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadgeText: {
    color: '#255A45',
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#CEE3D6',
    backgroundColor: '#F7FCF9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: '#2A4337',
    fontSize: 13,
    fontWeight: '600',
  },
  scopeText: {
    color: '#2E4F41',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  compatText: {
    color: '#627B70',
    fontSize: 12,
  },
  navCard: {
    borderWidth: 1,
    borderColor: '#D4E6DB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  navCardCompact: {
    flexDirection: 'column',
  },
  navPill: {
    borderWidth: 1,
    borderColor: '#D5E9DE',
    borderRadius: 12,
    backgroundColor: '#F8FCFA',
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 170,
    flex: 1,
  },
  navPillSelected: {
    borderColor: '#3D8E68',
    backgroundColor: '#EAF8F0',
  },
  navPillLabel: {
    color: '#2A4639',
    fontSize: 13,
    fontWeight: '700',
  },
  navPillLabelSelected: {
    color: '#1D6C49',
  },
  navPillPath: {
    color: '#637D72',
    fontSize: 11,
    marginTop: 2,
  },
  contentCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D4E6DB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#1F3329',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionBody: {
    color: '#50695D',
    fontSize: 14,
    lineHeight: 20,
  },
  builderWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  libraryRail: {
    width: 330,
    borderWidth: 1,
    borderColor: '#DDECE4',
    backgroundColor: '#F8FCF9',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  collectionRail: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDECE4',
    backgroundColor: '#FCFEFD',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  panelTitle: {
    color: '#244034',
    fontSize: 15,
    fontWeight: '800',
  },
  panelHint: {
    color: '#5D786C',
    fontSize: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#CFE1D8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#264236',
    backgroundColor: '#FFFFFF',
  },
  libraryList: {
    gap: 8,
    paddingBottom: 4,
  },
  libraryCard: {
    borderWidth: 1,
    borderColor: '#D5E7DD',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 2,
  },
  libraryCardSelected: {
    borderColor: '#2F845E',
    backgroundColor: '#ECF8F1',
  },
  libraryCardTitle: {
    color: '#1F3A2D',
    fontSize: 13,
    fontWeight: '700',
  },
  libraryCardMeta: {
    color: '#617A6F',
    fontSize: 12,
  },
  collectionList: {
    gap: 8,
  },
  collectionCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CFE2D8',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  collectionCardSelected: {
    borderColor: '#2F845E',
    backgroundColor: '#ECF8F1',
    borderStyle: 'solid',
  },
  collectionTitle: {
    color: '#214033',
    fontSize: 13,
    fontWeight: '700',
  },
  collectionMeta: {
    color: '#5C756A',
    fontSize: 12,
  },
  collectionDetailCard: {
    borderWidth: 1,
    borderColor: '#D7E9DF',
    borderRadius: 12,
    backgroundColor: '#F9FCFA',
    padding: 12,
    gap: 6,
    marginTop: 4,
  },
  collectionItemsList: {
    gap: 6,
  },
  collectionItemChip: {
    borderWidth: 1,
    borderColor: '#D2E6DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  collectionItemText: {
    color: '#2A473A',
    fontSize: 12,
    fontWeight: '600',
  },
  journeyCanvas: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDECE4',
    borderRadius: 12,
    backgroundColor: '#FCFEFD',
    padding: 10,
    gap: 10,
  },
  canvasHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  journeyListWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  journeySelectPill: {
    borderWidth: 1,
    borderColor: '#D4E6DC',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 170,
  },
  journeySelectPillSelected: {
    borderColor: '#2F845E',
    backgroundColor: '#ECF8F1',
  },
  journeySelectLabel: {
    color: '#2A473A',
    fontSize: 12,
    fontWeight: '700',
  },
  journeySelectLabelSelected: {
    color: '#1D6C49',
  },
  journeySelectMeta: {
    color: '#647E73',
    fontSize: 11,
  },
  builderActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingVertical: 2,
  },
  createJourneyInput: {
    minWidth: 220,
    flex: 1,
    borderWidth: 1,
    borderColor: '#CFE1D8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#264236',
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#C9DDD1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F4FBF7',
  },
  secondaryButtonText: {
    color: '#28553F',
    fontSize: 12,
    fontWeight: '700',
  },
  saveStateChip: {
    borderWidth: 1,
    borderColor: '#D3E6DC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F5FBF8',
    color: '#5B776A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  saveStateChipPending: {
    borderColor: '#ABCFB9',
    color: '#2A6348',
  },
  saveStateChipSaved: {
    borderColor: '#8FCBAA',
    color: '#1E7B50',
    backgroundColor: '#EAF8F1',
  },
  saveStateChipError: {
    borderColor: '#E4B9B9',
    color: '#8E4040',
    backgroundColor: '#FDF0F0',
  },
  sourceCollectionsBox: {
    borderWidth: 1,
    borderColor: '#D7E9DF',
    borderRadius: 10,
    backgroundColor: '#F9FCFA',
    padding: 8,
    gap: 6,
    marginTop: 2,
  },
  sourceCollectionsTitle: {
    color: '#284436',
    fontSize: 12,
    fontWeight: '700',
  },
  deniedCard: {
    borderWidth: 1,
    borderColor: '#E7C6B4',
    borderRadius: 10,
    backgroundColor: '#FFF8F5',
    padding: 10,
    gap: 4,
  },
  deniedTitle: {
    color: '#7A3E2A',
    fontSize: 13,
    fontWeight: '700',
  },
  deniedBody: {
    color: '#8C5845',
    fontSize: 12,
    lineHeight: 18,
  },
  milestoneCard: {
    borderWidth: 1,
    borderColor: '#D6E8DF',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  milestoneTitle: {
    color: '#1F3A2D',
    fontSize: 14,
    fontWeight: '800',
  },
  dropZone: {
    borderWidth: 1,
    borderColor: '#CFE2D8',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 8,
    gap: 8,
    backgroundColor: '#FBFEFC',
    minHeight: 56,
  },
  dropZoneHint: {
    color: '#658073',
    fontSize: 12,
  },
  journeyBlockCard: {
    borderWidth: 1,
    borderColor: '#D4E7DD',
    borderRadius: 8,
    backgroundColor: '#F7FCF9',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  journeyBlockCopy: {
    flex: 1,
    gap: 2,
  },
  journeyBlockTitle: {
    color: '#234133',
    fontSize: 13,
    fontWeight: '700',
  },
  journeyBlockMeta: {
    color: '#5F7A6E',
    fontSize: 12,
  },
  blockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionButton: {
    borderWidth: 1,
    borderColor: '#CEE2D8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
  },
  inlineActionText: {
    color: '#2C4A3B',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineActionButtonDanger: {
    borderWidth: 1,
    borderColor: '#E8C7C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFF3F3',
  },
  inlineActionTextDanger: {
    color: '#974444',
    fontSize: 11,
    fontWeight: '700',
  },
  saveMessage: {
    color: '#4F6B5C',
    fontSize: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E0ECE5',
    borderBottomWidth: 0,
    backgroundColor: '#F6FBF8',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E0ECE5',
    borderTopWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  tableRowSelected: {
    backgroundColor: '#ECF8F1',
  },
  colWide: {
    flex: 1.2,
  },
  colNarrow: {
    flex: 0.8,
  },
  colLabel: {
    color: '#667D72',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colValue: {
    color: '#2C463A',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  detailCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D8EAE0',
    borderRadius: 12,
    backgroundColor: '#F9FCFA',
    padding: 12,
    gap: 4,
  },
  detailTitle: {
    color: '#243C31',
    fontSize: 15,
    fontWeight: '700',
  },
  detailMeta: {
    color: '#597266',
    fontSize: 12,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#24744F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  centerCard: {
    margin: 20,
    borderWidth: 1,
    borderColor: '#D5E8DD',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 8,
  },
  centerTitle: {
    color: '#243B31',
    fontSize: 18,
    fontWeight: '800',
  },
  centerBody: {
    color: '#556E62',
    fontSize: 13,
    lineHeight: 19,
  },
  centerMeta: {
    color: '#6E847A',
    fontSize: 12,
  },
});
