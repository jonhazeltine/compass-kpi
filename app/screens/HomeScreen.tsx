import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import KPIDashboardScreen from './KPIDashboardScreen';
import ProfileScreen from './ProfileScreen';
import GoalsScreen from './GoalsScreen';
import SettingsScreen from './SettingsScreen';
import InviteCodeScreen from './InviteCodeScreen';
import AvatarMenu from '../components/nav/AvatarMenu';
import { useAuth } from '../contexts/AuthContext';

type UserMenuRoute = 'dashboard' | 'profile' | 'goals' | 'settings' | 'invite';
type DashboardRouteTarget = {
  tab?: 'team' | 'coach' | 'challenge';
  screen?: string;
  target_id?: string;
} | null;
const SELF_PROFILE_DRAWER_ID = '__self_profile__';

export default function HomeScreen() {
  const { signOut } = useAuth();
  const [activeRoute, setActiveRoute] = useState<UserMenuRoute>('dashboard');
  const [menuVisible, setMenuVisible] = useState(false);
  const [dashboardRouteTarget, setDashboardRouteTarget] = useState<DashboardRouteTarget>(null);

  const routeTo = (route: UserMenuRoute) => {
    setMenuVisible(false);
    setActiveRoute(route);
  };

  const onInviteRedeemSuccess = (result: {
    route_target?: DashboardRouteTarget;
  }) => {
    setActiveRoute('dashboard');
    setDashboardRouteTarget(result.route_target ?? null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {activeRoute === 'dashboard' ? (
          <KPIDashboardScreen
            onOpenUserMenu={() => setMenuVisible(true)}
            onOpenInviteCode={() => routeTo('invite')}
            menuRouteTarget={dashboardRouteTarget}
            onMenuRouteTargetConsumed={() => setDashboardRouteTarget(null)}
          />
        ) : null}
        {activeRoute === 'profile' ? <ProfileScreen onBack={() => setActiveRoute('dashboard')} /> : null}
        {activeRoute === 'goals' ? <GoalsScreen onBack={() => setActiveRoute('dashboard')} /> : null}
        {activeRoute === 'settings' ? <SettingsScreen onBack={() => setActiveRoute('dashboard')} /> : null}
        {activeRoute === 'invite' ? (
          <InviteCodeScreen onBack={() => setActiveRoute('dashboard')} onRedeemSuccess={onInviteRedeemSuccess} />
        ) : null}
      </View>
      <AvatarMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelectProfile={() => {
          setMenuVisible(false);
          setActiveRoute('dashboard');
          setDashboardRouteTarget({
            tab: 'team',
            screen: 'profile_drawer',
            target_id: SELF_PROFILE_DRAWER_ID,
          });
        }}
        onSelectGoals={() => routeTo('goals')}
        onSelectSettings={() => routeTo('settings')}
        onSelectInvite={() => routeTo('invite')}
        onSignOut={() => {
          setMenuVisible(false);
          void signOut();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
});
