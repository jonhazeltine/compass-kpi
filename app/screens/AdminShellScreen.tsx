import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminRouteGuard from '../components/AdminRouteGuard';
import { useAdminAuthz } from '../contexts/AdminAuthzContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_ROUTES,
  AdminRouteDefinition,
  AdminRouteKey,
  canAccessAdminRoute,
  getAdminRouteByKey,
  getAdminRouteByPath,
  getInitialAdminRouteKey,
  normalizeAdminRole,
} from '../lib/adminAuthz';
import {
  ADMIN_NOT_FOUND_PATH,
  ADMIN_UNAUTHORIZED_PATH,
  getAdminRouteStage,
  getAdminRouteStageTone,
} from '../lib/adminShellConfig';
import { colors, space } from '../theme/tokens';
import CompassMark from '../assets/brand/compass_mark.svg';

function formatRoles(roles: string[]) {
  if (roles.length === 0) return 'none found in session metadata';
  return roles.join(', ');
}

function PlaceholderScreen({
  route,
  rolesLabel,
}: {
  route: AdminRouteDefinition;
  rolesLabel: string;
}) {
  const stage = getAdminRouteStage(route.key);
  const tone = getAdminRouteStageTone(stage);
  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>{route.path}</Text>
          <Text style={styles.panelTitle}>{route.label}</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.stagePillText, { color: tone.text }]}>{stage}</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>{route.description}</Text>
      <View style={styles.metaList}>
        <Text style={styles.metaRow}>Status: placeholder (A1 shell scaffold)</Text>
        <Text style={styles.metaRow}>Required roles: {route.requiredRoles.join(', ')}</Text>
        <Text style={styles.metaRow}>Detected session roles: {rolesLabel}</Text>
      </View>
      <View style={styles.placeholderGrid}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>Next implementation</Text>
          <Text style={styles.placeholderCardValue}>
            {stage === 'A1 now' ? 'Guard + nav behavior' : stage === 'A2 later' ? 'CRUD screens + API wiring' : 'Ops views + reports'}
          </Text>
        </View>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>Contract policy</Text>
          <Text style={styles.placeholderCardValue}>Reuse documented `/admin/*` endpoints only</Text>
        </View>
      </View>
    </View>
  );
}

function NotFoundState({ requestedPath }: { requestedPath: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>404</Text>
      <Text style={styles.panelTitle}>Admin route not found</Text>
      <Text style={styles.panelBody}>
        This admin path is not part of the current A1 shell scaffold. Use the left navigation to continue.
      </Text>
      <View style={styles.metaList}>
        <Text style={styles.metaRow}>Requested path: {requestedPath}</Text>
        <Text style={styles.metaRow}>Resolved shell state: {ADMIN_NOT_FOUND_PATH}</Text>
      </View>
    </View>
  );
}

function UnauthorizedState({
  title,
  message,
  rolesLabel,
  debugLines,
  devOverrideLabel,
  onResetDevPreview,
}: {
  title: string;
  message: string;
  rolesLabel: string;
  debugLines: string[];
  devOverrideLabel?: string;
  onResetDevPreview?: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>403</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelBody}>{message}</Text>
      <Text style={styles.metaRow}>Detected session roles: {rolesLabel}</Text>
      {devOverrideLabel ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Dev preview is overriding your real role</Text>
          <Text style={styles.noticeText}>Current preview: {devOverrideLabel}</Text>
          {onResetDevPreview ? (
            <TouchableOpacity onPress={onResetDevPreview} style={styles.noticeButton} accessibilityRole="button">
              <Text style={styles.noticeButtonText}>Use live role</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {__DEV__ ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>Dev debug (session role metadata)</Text>
          {debugLines.map((line) => (
            <Text key={line} style={styles.debugLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function AdminShellScreen() {
  const { session, signOut } = useAuth();
  const {
    resolvedRoles,
    backendRole,
    backendRoleError,
    backendRoleLoading,
    hasAdminAccess,
    canAccessRoute,
    debugLines,
  } = useAdminAuthz();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [activeRouteKey, setActiveRouteKey] = useState<AdminRouteKey>(() =>
    getInitialAdminRouteKey(process.env.EXPO_PUBLIC_ADMIN_INITIAL_ROUTE)
  );
  const [showUpcomingRoutes, setShowUpcomingRoutes] = useState(false);
  const [devRolePreview, setDevRolePreview] = useState<'live' | 'super_admin' | 'admin' | 'agent'>('live');
  const [unknownAdminPath, setUnknownAdminPath] = useState<string | null>(null);
  const [lastNavPushPath, setLastNavPushPath] = useState<string | null>(null);

  const effectiveRoles = useMemo(() => {
    if (!__DEV__ || devRolePreview === 'live') return resolvedRoles;
    const normalized = normalizeAdminRole(devRolePreview);
    return normalized ? [normalized] : resolvedRoles;
  }, [devRolePreview, resolvedRoles]);
  const rolesLabel = formatRoles(effectiveRoles);
  const devOverrideActive = __DEV__ && devRolePreview !== 'live';
  const effectiveHasAdminAccess = effectiveRoles.includes('platform_admin') || effectiveRoles.includes('super_admin');
  const activeRoute = getAdminRouteByKey(activeRouteKey);
  const canOpenActiveRoute = canAccessAdminRoute(effectiveRoles, activeRoute);
  const a1Routes = ADMIN_ROUTES.filter((route) => getAdminRouteStage(route.key) === 'A1 now').length;
  const blockedRoutes = ADMIN_ROUTES.filter((route) => !canAccessRoute(route)).length;
  const visibleRoutes = ADMIN_ROUTES.filter(
    (route) => showUpcomingRoutes || getAdminRouteStage(route.key) === 'A1 now'
  );

  useEffect(() => {
    if (showUpcomingRoutes) return;
    if (getAdminRouteStage(activeRouteKey) === 'A1 now') return;
    setActiveRouteKey('overview');
  }, [activeRouteKey, showUpcomingRoutes]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const pathname = window.location.pathname;
      if (pathname === ADMIN_UNAUTHORIZED_PATH || pathname === ADMIN_NOT_FOUND_PATH) {
        return;
      }

      const match = getAdminRouteByPath(pathname);
      if (!match) {
        if (pathname.startsWith('/admin')) {
          setUnknownAdminPath(pathname);
        } else {
          setUnknownAdminPath(null);
        }
        return;
      }
      setUnknownAdminPath(null);
      setActiveRouteKey((prev) => (prev === match.key ? prev : match.key));
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    if (!pathname.startsWith('/admin')) {
      setUnknownAdminPath(null);
      return;
    }
    if (pathname === ADMIN_UNAUTHORIZED_PATH || pathname === ADMIN_NOT_FOUND_PATH) {
      return;
    }

    setUnknownAdminPath(getAdminRouteByPath(pathname) ? null : pathname);
  }, [activeRouteKey, canOpenActiveRoute, effectiveHasAdminAccess]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    const route = getAdminRouteByKey(activeRouteKey);
    const shouldShowUnauthorized = !effectiveHasAdminAccess || !canOpenActiveRoute;
    const nextPath = shouldShowUnauthorized
      ? ADMIN_UNAUTHORIZED_PATH
      : unknownAdminPath
        ? ADMIN_NOT_FOUND_PATH
        : route.path;
    if (window.location.pathname === nextPath) return;
    if (lastNavPushPath && nextPath === lastNavPushPath) {
      setLastNavPushPath(null);
      return;
    }
    window.history.replaceState({}, '', nextPath);
  }, [activeRouteKey, canOpenActiveRoute, effectiveHasAdminAccess, lastNavPushPath, unknownAdminPath]);

  const checklistItems = [
    { label: 'Admin shell layout + navigation scaffold', status: 'done' },
    { label: 'Auth/session wiring (reuse Supabase session)', status: 'done' },
    { label: 'AuthZ role checks + route guards', status: 'done' },
    { label: 'Unauthorized state + /admin/unauthorized path flow', status: 'done' },
    { label: 'Unknown /admin/* path handling + not-found state', status: 'done' },
    { label: 'A1 placeholder screens for admin routes', status: 'done' },
    { label: 'A2/A3 route placeholders clearly marked as upcoming', status: 'done' },
    { label: 'Manual authz acceptance pass (admin vs non-admin)', status: 'pending' },
  ] as const;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
          <View style={styles.brandCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoWrap}>
                <CompassMark width={42} height={42} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandTag}>A1</Text>
                <Text style={styles.brandTitle}>Admin Shell</Text>
                <Text style={styles.brandSubtitle}>AuthZ scaffold + route placeholders</Text>
              </View>
            </View>
            <View style={styles.brandMetricsRow}>
              <View style={styles.brandMetricCard}>
                <Text style={styles.brandMetricLabel}>A1 routes</Text>
                <Text style={styles.brandMetricValue}>{a1Routes}</Text>
              </View>
              <View style={styles.brandMetricCard}>
                <Text style={styles.brandMetricLabel}>Blocked now</Text>
                <Text style={styles.brandMetricValue}>{blockedRoutes}</Text>
              </View>
            </View>
            <Text style={styles.brandFootnote}>
              Styled from Compass export palette (navy + blue gradient) while keeping A1 scope to shell/authz only.
            </Text>
          </View>

          <ScrollView
            horizontal={isCompact}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.navList, isCompact && styles.navListCompact]}
            style={styles.navScroll}
          >
            {visibleRoutes.map((route) => {
              const selected = route.key === activeRouteKey;
              const allowed = canAccessAdminRoute(effectiveRoles, route);
              const stage = getAdminRouteStage(route.key);
              const tone = getAdminRouteStageTone(stage);
              return (
                <Pressable
                  key={route.key}
                  style={[
                    styles.navItem,
                    selected && styles.navItemSelected,
                    !allowed && styles.navItemDisabled,
                    isCompact && styles.navItemCompact,
                  ]}
                  onPress={() => {
                    setUnknownAdminPath(null);
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      const nextPath = route.path;
                      if (window.location.pathname !== nextPath) {
                        window.history.pushState({}, '', nextPath);
                        setLastNavPushPath(nextPath);
                      }
                    }
                    setActiveRouteKey(route.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !allowed }}
                >
                  <View style={styles.navTopRow}>
                    <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{route.label}</Text>
                    <View style={[styles.navStagePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.navStageText, { color: tone.text }]}>{stage.replace(' later', '')}</Text>
                    </View>
                  </View>
                  <Text style={styles.navPath}>{route.path}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.navFooterCard}>
            <View style={styles.navFooterRow}>
              <View style={styles.navFooterCopy}>
                <Text style={styles.navFooterTitle}>Show upcoming routes</Text>
                <Text style={styles.navFooterText}>A2/A3 placeholders stay scaffold-only in A1.</Text>
              </View>
              <Switch
                value={showUpcomingRoutes}
                onValueChange={setShowUpcomingRoutes}
                trackColor={{ false: '#CFDAEF', true: '#94B5FF' }}
                thumbColor={showUpcomingRoutes ? '#1F56DA' : '#F8FBFF'}
              />
            </View>
          </View>
        </View>

        <View style={styles.contentColumn}>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollInner}
            showsVerticalScrollIndicator
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Compass KPI Admin</Text>
                <Text style={styles.headerSubtitle}>Session-bound admin surface (A1 foundation)</Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.roleBadge}>
                  {backendRoleLoading ? <ActivityIndicator size="small" color="#1F4EBF" /> : null}
                  <Text style={styles.roleBadgeText}>
                    {backendRole ? `Backend role: ${backendRole}` : 'Role source: session metadata'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={() => {
                    void signOut();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                >
                  <Text style={styles.signOutButtonText}>Sign out</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.summaryRow, isCompact && styles.summaryRowCompact]}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>AuthZ Source</Text>
                <Text style={styles.summaryValue}>
                  {backendRole ? 'Supabase session + backend /me fallback' : 'Supabase session metadata first'}
                </Text>
                <Text style={styles.summaryNote}>
                  {__DEV__ && devRolePreview !== 'live'
                    ? `Dev preview override active: ${devRolePreview}`
                    : 'No new endpoint family introduced'}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>A1 Coverage</Text>
                <Text style={styles.summaryValue}>Shell layout, route guards, 403 state, placeholders</Text>
                <Text style={styles.summaryNote}>A2/A3 routes intentionally scaffold-only</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Web Routing</Text>
                <Text style={styles.summaryValue}>
                  {Platform.OS === 'web'
                    ? `Path sync enabled (${
                        !effectiveHasAdminAccess || !canOpenActiveRoute
                          ? ADMIN_UNAUTHORIZED_PATH
                          : unknownAdminPath
                            ? ADMIN_NOT_FOUND_PATH
                            : activeRoute.path
                      })`
                    : 'Path sync inactive outside web runtime'}
                </Text>
                <Text style={styles.summaryNote}>
                  Browser history/back button now tracks active admin, unauthorized, and not-found states
                </Text>
              </View>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>A1 Checklist</Text>
                <Text style={styles.checklistSubtitle}>Progress snapshot for this thread (kept in scope)</Text>
              </View>
              <View style={styles.checklistList}>
                {checklistItems.map((item) => {
                  const done = item.status === 'done';
                  return (
                    <View key={item.label} style={styles.checklistRow}>
                      <View style={[styles.checklistDot, done ? styles.checklistDotDone : styles.checklistDotPending]} />
                      <Text style={[styles.checklistText, done ? styles.checklistTextDone : styles.checklistTextPending]}>
                        {done ? '[done]' : '[next]'} {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {__DEV__ ? (
              <View style={styles.devPanel}>
                <View style={styles.devPanelHeader}>
                  <Text style={styles.devPanelTitle}>Dev AuthZ Preview</Text>
                  <Text style={styles.devPanelSubtitle}>UI-only role simulation for A1 guard testing</Text>
                </View>
                <View style={[styles.devChipsRow, isCompact && styles.devChipsRowCompact]}>
                  {([
                    ['live', 'Use live role'],
                    ['super_admin', 'Preview super admin'],
                    ['admin', 'Preview admin'],
                    ['agent', 'Preview non-admin'],
                  ] as const).map(([value, label]) => {
                    const selected = devRolePreview === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setDevRolePreview(value)}
                        style={[styles.devChip, selected && styles.devChipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.devChipText, selected && styles.devChipTextSelected]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.content}>
              <AdminRouteGuard
                route={activeRoute}
                rolesOverride={effectiveRoles}
                fallback={({ reason, route }) => (
                  <UnauthorizedState
                    title={reason === 'not_admin' ? 'Unauthorized admin access' : 'Route access denied'}
                    message={
                      reason === 'not_admin'
                        ? 'This admin surface requires a platform or super admin role in the current session metadata.'
                        : `Your current role does not meet the guard for ${route.path}.`
                    }
                    rolesLabel={rolesLabel}
                    debugLines={debugLines}
                    devOverrideLabel={devOverrideActive ? devRolePreview : undefined}
                    onResetDevPreview={devOverrideActive ? () => setDevRolePreview('live') : undefined}
                  />
                )}
              >
                {unknownAdminPath ? (
                  <NotFoundState requestedPath={unknownAdminPath} />
                ) : (
                  <PlaceholderScreen route={activeRoute} rolesLabel={rolesLabel} />
                )}
              </AdminRouteGuard>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDF2FA',
  },
  backgroundOrbOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#CFE0FF',
    top: -60,
    right: -40,
    opacity: 0.7,
  },
  backgroundOrbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#DCEBFF',
    bottom: 40,
    left: -60,
    opacity: 0.75,
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  shellCompact: {
    flexDirection: 'column',
    gap: 12,
  },
  sidebar: {
    width: 320,
    gap: 12,
  },
  sidebarCompact: {
    width: '100%',
  },
  brandCard: {
    backgroundColor: '#12203A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#20365F',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0E1830',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D4478',
  },
  brandCopy: {
    flex: 1,
  },
  brandTag: {
    color: '#9eb6ff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  brandSubtitle: {
    color: '#c5d0e6',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  brandMetricsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  brandMetricCard: {
    flex: 1,
    backgroundColor: '#172A4E',
    borderWidth: 1,
    borderColor: '#294171',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandMetricLabel: {
    color: '#B9C7E4',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  brandMetricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  brandFootnote: {
    marginTop: 10,
    color: '#B6C2DB',
    fontSize: 12,
    lineHeight: 17,
  },
  navScroll: {
    flexGrow: 0,
    maxHeight: 340,
  },
  navList: {
    gap: 10,
  },
  navListCompact: {
    gap: 10,
    paddingRight: 8,
  },
  navItem: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dee6f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navItemCompact: {
    width: 220,
  },
  navItemSelected: {
    borderColor: '#2f67e8',
    backgroundColor: '#edf3ff',
  },
  navItemDisabled: {
    opacity: 0.65,
  },
  navLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  navLabelSelected: {
    color: '#1f4ebf',
  },
  navTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navStagePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  navStageText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navPath: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  navFooterCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE6F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navFooterCopy: {
    flex: 1,
  },
  navFooterTitle: {
    color: '#23314A',
    fontSize: 13,
    fontWeight: '700',
  },
  navFooterText: {
    color: '#70809D',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    gap: 12,
    paddingBottom: 24,
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dee6f2',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202838',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#697488',
    marginTop: 4,
  },
  signOutButton: {
    backgroundColor: '#F4F7FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e1ef',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonText: {
    color: '#293548',
    fontWeight: '600',
    fontSize: 14,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D6E2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 320,
  },
  roleBadgeText: {
    color: '#2B4C9A',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryRowCompact: {
    flexDirection: 'column',
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
    padding: 14,
  },
  summaryLabel: {
    color: '#6A768D',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryValue: {
    color: '#202B3E',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryNote: {
    color: '#748198',
    fontSize: 12,
    marginTop: 6,
  },
  checklistCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
    padding: 14,
    gap: 10,
  },
  checklistHeader: {
    gap: 4,
  },
  checklistTitle: {
    color: '#202B3E',
    fontSize: 15,
    fontWeight: '700',
  },
  checklistSubtitle: {
    color: '#748198',
    fontSize: 12,
  },
  checklistList: {
    gap: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checklistDotDone: {
    backgroundColor: '#1FA56B',
  },
  checklistDotPending: {
    backgroundColor: '#D4A64F',
  },
  checklistText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  checklistTextDone: {
    color: '#243248',
    fontWeight: '600',
  },
  checklistTextPending: {
    color: '#6E5A2D',
    fontWeight: '600',
  },
  devPanel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
    padding: 14,
    gap: 10,
  },
  devPanelHeader: {
    gap: 2,
  },
  devPanelTitle: {
    color: '#202B3E',
    fontSize: 14,
    fontWeight: '700',
  },
  devPanelSubtitle: {
    color: '#748198',
    fontSize: 12,
  },
  devChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  devChipsRowCompact: {
    flexDirection: 'column',
  },
  devChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    backgroundColor: '#F4F8FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  devChipSelected: {
    borderColor: '#7FA7FF',
    backgroundColor: '#E7F0FF',
  },
  devChipText: {
    color: '#35538A',
    fontSize: 12,
    fontWeight: '600',
  },
  devChipTextSelected: {
    color: '#1B49B4',
  },
  content: {
    minHeight: 260,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dee6f2',
    padding: 20,
    gap: 10,
    minHeight: 260,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitleBlock: {
    flex: 1,
  },
  eyebrow: {
    color: '#5e78b5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: '#1e2738',
    fontSize: 22,
    fontWeight: '700',
  },
  panelBody: {
    color: '#52607a',
    fontSize: 15,
    lineHeight: 22,
  },
  metaList: {
    marginTop: space.sm,
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
  },
  metaRow: {
    color: '#4a556c',
    fontSize: 13,
    lineHeight: 18,
  },
  stagePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  placeholderGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  placeholderCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#F6F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1EAF8',
    padding: 12,
    gap: 6,
  },
  placeholderCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E7E9A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  placeholderCardValue: {
    fontSize: 13,
    lineHeight: 18,
    color: '#243248',
    fontWeight: '600',
  },
  debugBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
    paddingTop: 10,
    gap: 4,
  },
  noticeBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE1AA',
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  noticeTitle: {
    color: '#8A5600',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    color: '#815F26',
    fontSize: 12,
  },
  noticeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBC57F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noticeButtonText: {
    color: '#8A5600',
    fontSize: 12,
    fontWeight: '700',
  },
  debugTitle: {
    color: '#6b2f2f',
    fontWeight: '700',
    fontSize: 12,
  },
  debugLine: {
    color: '#5f6675',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Courier',
  },
});
