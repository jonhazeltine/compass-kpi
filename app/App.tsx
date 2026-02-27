import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminAuthzProvider } from './contexts/AdminAuthzContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthFlowScreen from './screens/AuthFlowScreen';
import AdminShellScreen from './screens/AdminShellScreen';
import CoachPortalScreen from './screens/CoachPortalScreen';
import HomeScreen from './screens/HomeScreen';
import { getAdminRouteByPath, type AdminRouteKey } from './lib/adminAuthz';

const COACH_PORTAL_ROUTE_KEYS: AdminRouteKey[] = [
  'coachingUploads',
  'coachingLibrary',
  'coachingJourneys',
  'coachingCohorts',
  'coachingChannels',
];

function isCoachPortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const route = getAdminRouteByPath(pathname);
  return !!route && COACH_PORTAL_ROUTE_KEYS.includes(route.key);
}

function AppContent() {
  const { session, loading } = useAuth();
  const forceAuthFlow = process.env.EXPO_PUBLIC_FORCE_AUTH_FLOW === 'true';
  const appSurface = (process.env.EXPO_PUBLIC_APP_SURFACE ?? 'member').toLowerCase();
  const renderAdminShell = Platform.OS === 'web' && appSurface === 'admin';
  const [webPathname, setWebPathname] = useState<string | null>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    return window.location.pathname;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const syncPath = () => setWebPathname(window.location.pathname);
    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = function pushState(...args: Parameters<History['pushState']>) {
      originalPush(...args);
      window.dispatchEvent(new Event('codex:pathchange'));
    };
    window.history.replaceState = function replaceState(...args: Parameters<History['replaceState']>) {
      originalReplace(...args);
      window.dispatchEvent(new Event('codex:pathchange'));
    };

    window.addEventListener('popstate', syncPath);
    window.addEventListener('codex:pathchange', syncPath);
    syncPath();

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('codex:pathchange', syncPath);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      {session && !forceAuthFlow ? (
        renderAdminShell ? (
          isCoachPortalPath(webPathname) ? (
            <CoachPortalScreen />
          ) : (
            <AdminShellScreen />
          )
        ) : (
          <HomeScreen />
        )
      ) : (
        <AuthFlowScreen />
      )}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <AdminAuthzProvider>
            <AppContent />
          </AdminAuthzProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
