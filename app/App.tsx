import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdminAuthzProvider } from './contexts/AdminAuthzContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthFlowScreen from './screens/AuthFlowScreen';
import AdminShellScreen from './screens/AdminShellScreen';
import HomeScreen from './screens/HomeScreen';

function AppContent() {
  const { session, loading } = useAuth();
  const forceAuthFlow = process.env.EXPO_PUBLIC_FORCE_AUTH_FLOW === 'true';
  const appSurface = (process.env.EXPO_PUBLIC_APP_SURFACE ?? 'member').toLowerCase();
  const renderAdminShell = Platform.OS === 'web' && appSurface === 'admin';

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
      {session && !forceAuthFlow ? (renderAdminShell ? <AdminShellScreen /> : <HomeScreen />) : <AuthFlowScreen />}
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
