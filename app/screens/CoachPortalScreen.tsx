import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import CompassMark from '../assets/brand/compass_mark.svg';
import { useAdminAuthz } from '../contexts/AdminAuthzContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_ROUTES,
  canAccessAdminRoute,
  getAdminRouteByKey,
  getAdminRouteByPath,
  LEGACY_ADMIN_COACHING_PATH_BY_ROUTE_KEY,
  type AdminRole,
  type AdminRouteKey,
} from '../lib/adminAuthz';

type CoachRouteKey =
  | 'coachingLibrary'
  | 'coachingJourneys'
  | 'coachingCohorts'
  | 'coachingChannels';

type CoachSurface = {
  key: CoachRouteKey;
  path: string;
  label: string;
  headline: string;
  summary: string;
  primaryAction: string;
  columns: [string, string, string, string];
  rows: Array<{ id: string; c1: string; c2: string; c3: string; c4: string }>;
};

const COACH_ROUTE_KEYS: CoachRouteKey[] = [
  'coachingLibrary',
  'coachingJourneys',
  'coachingCohorts',
  'coachingChannels',
];

const COACH_SURFACES: Record<CoachRouteKey, CoachSurface> = {
  coachingLibrary: {
    key: 'coachingLibrary',
    path: '/coach/library',
    label: 'Library',
    headline: 'Curate your coaching content library',
    summary:
      'Upload, organize, and tag coaching assets in one workspace so journeys and channels stay aligned.',
    primaryAction: 'Create Collection',
    columns: ['Asset', 'Category', 'Audience', 'Updated'],
    rows: [
      { id: 'lib-1', c1: 'Buyer Follow-Up Kit', c2: 'Lesson Pack', c3: 'All teams', c4: 'Today' },
      { id: 'lib-2', c1: 'Sponsor Event Promo', c2: 'Campaign', c3: 'Sponsor cohort', c4: 'Yesterday' },
      { id: 'lib-3', c1: 'New Agent Sprint', c2: 'Onboarding', c3: 'Cohort based', c4: '2d ago' },
    ],
  },
  coachingJourneys: {
    key: 'coachingJourneys',
    path: '/coach/journeys',
    label: 'Journeys',
    headline: 'Design learning journeys with clear progression',
    summary: 'Build module sequences, define release pacing, and target the right cohort or channel audience.',
    primaryAction: 'Create Journey',
    columns: ['Journey', 'Audience', 'Modules', 'State'],
    rows: [
      { id: 'jr-1', c1: '30-Day Listing Accelerator', c2: 'New agents', c3: '8', c4: 'Live' },
      { id: 'jr-2', c1: 'Team Production Sprint', c2: 'Team scoped', c3: '6', c4: 'Draft' },
      { id: 'jr-3', c1: 'Sponsor Lead Conversion', c2: 'Sponsor cohort', c3: '5', c4: 'Live' },
    ],
  },
  coachingCohorts: {
    key: 'coachingCohorts',
    path: '/coach/cohorts',
    label: 'Cohorts',
    headline: 'Group participants for targeted coaching delivery',
    summary: 'Manage cohort membership and align each cohort to the right journeys and communication channels.',
    primaryAction: 'Create Cohort',
    columns: ['Cohort', 'Owner', 'Members', 'Program'],
    rows: [
      { id: 'co-1', c1: 'Q1 Rising Agents', c2: 'Coach Avery', c3: '24', c4: 'Listing Accelerator' },
      { id: 'co-2', c1: 'Sponsor Elite Leads', c2: 'Sponsor North', c3: '19', c4: 'Lead Conversion' },
      { id: 'co-3', c1: 'Team Velocity', c2: 'TL Jamie', c3: '11', c4: 'Production Sprint' },
    ],
  },
  coachingChannels: {
    key: 'coachingChannels',
    path: '/coach/channels',
    label: 'Channels',
    headline: 'Run communication channels with the right audience scope',
    summary: 'Coordinate messages for journeys and cohorts while keeping sponsor interactions scoped and compliant.',
    primaryAction: 'Create Channel',
    columns: ['Channel', 'Scope', 'Members', 'Activity'],
    rows: [
      { id: 'ch-1', c1: 'Listing Accelerator Hub', c2: 'Coach', c3: '42', c4: '2h ago' },
      { id: 'ch-2', c1: 'Sponsor Lead Briefing', c2: 'Sponsor scoped', c3: '19', c4: '4h ago' },
      { id: 'ch-3', c1: 'Team Velocity Check-In', c2: 'Team scoped', c3: '11', c4: '1d ago' },
    ],
  },
};

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

export default function CoachPortalScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const { signOut } = useAuth();
  const { backendRole, backendRoleLoading, resolvedRoles } = useAdminAuthz();
  const [activeKey, setActiveKey] = useState<CoachRouteKey>(() =>
    getCoachRouteKeyFromPath(typeof window !== 'undefined' ? window.location.pathname : undefined) ?? 'coachingLibrary'
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [notFoundPath, setNotFoundPath] = useState<string | null>(null);
  const effectiveRoles = resolvedRoles.length > 0 ? resolvedRoles : (['unknown'] as AdminRole[]);
  const visibleRoutes = useMemo(
    () =>
      COACH_ROUTE_KEYS
        .map((key) => getAdminRouteByKey(key))
        .filter((route) => canAccessAdminRoute(effectiveRoles, route)),
    [effectiveRoles]
  );
  const activeSurface = COACH_SURFACES[activeKey];
  const selectedRow = activeSurface.rows.find((row) => row.id === selectedRowId) ?? activeSurface.rows[0] ?? null;
  const scopeSummary = effectiveRoles.includes('coach')
    ? 'Coach access: full coach portal sections enabled.'
    : effectiveRoles.includes('team_leader')
      ? 'Team Leader access: library upload actions remain team-scoped.'
      : effectiveRoles.includes('challenge_sponsor')
        ? 'Sponsor access: sponsor-scoped sections only. KPI logging actions are unavailable.'
        : 'Access is limited to currently authorized coach portal sections.';

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

  if (!visibleRoutes.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Coach Portal Access Required</Text>
          <Text style={styles.centerBody}>
            This account does not have access to the coach portal routes at this time.
          </Text>
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
          <Text style={styles.centerBody}>
            The requested coach route is not available. Continue in the coach portal home routes.
          </Text>
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
                <Text style={styles.heroSubtitle}>
                  A dedicated coaching workspace for content, journeys, cohorts, and channels.
                </Text>
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
            Legacy `/admin/coaching/*` links remain compatibility redirects to canonical `/coach/*` routes.
          </Text>
        </View>

        <View style={[styles.navCard, isCompact && styles.navCardCompact]}>
          {visibleRoutes.map((route) => {
            const key = route.key as CoachRouteKey;
            const selected = key === activeKey;
            return (
              <Pressable
                key={route.key}
                style={[styles.navPill, selected && styles.navPillSelected]}
                onPress={() => navigate(key)}
              >
                <Text style={[styles.navPillLabel, selected && styles.navPillLabelSelected]}>{COACH_SURFACES[key].label}</Text>
                <Text style={styles.navPillPath}>{COACH_SURFACES[key].path}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.sectionTitle}>{activeSurface.headline}</Text>
          <Text style={styles.sectionBody}>{activeSurface.summary}</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.colLabel, styles.colWide]}>{activeSurface.columns[0]}</Text>
            <Text style={[styles.colLabel, styles.colWide]}>{activeSurface.columns[1]}</Text>
            <Text style={[styles.colLabel, styles.colWide]}>{activeSurface.columns[2]}</Text>
            <Text style={[styles.colLabel, styles.colNarrow]}>{activeSurface.columns[3]}</Text>
          </View>
          {activeSurface.rows.map((row) => {
            const selected = selectedRow?.id === row.id;
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
            <Text style={styles.detailTitle}>{selectedRow?.c1 ?? 'Selection'}</Text>
            <Text style={styles.detailMeta}>{selectedRow?.c2 ?? ''}</Text>
            <Text style={styles.detailMeta}>{selectedRow?.c3 ?? ''}</Text>
            <Text style={styles.detailMeta}>Status: {selectedRow?.c4 ?? 'Ready'}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{activeSurface.primaryAction}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
