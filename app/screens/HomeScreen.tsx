import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
import KPIDashboardScreen from './KPIDashboardScreen';
import ProfileScreen from './ProfileScreen';
import GoalsScreen from './GoalsScreen';
import SettingsScreen from './SettingsScreen';
import InviteCodeScreen from './InviteCodeScreen';
import VPTreeScreen from './VPTreeScreen';
import GPCityScreen from './GPCityScreen';
import AnimationGalleryScreen from './AnimationGalleryScreen';
import AvatarMenu from '../components/nav/AvatarMenu';
import { useAuth } from '../contexts/AuthContext';

type UserMenuRoute = 'dashboard' | 'profile' | 'goals' | 'settings' | 'invite' | 'vp-tree' | 'gp-city' | 'animation-gallery';
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

  const [refreshKey, setRefreshKey] = useState(0);
  const onInviteRedeemSuccess = (result: {
    route_target?: DashboardRouteTarget;
  }) => {
    setRefreshKey((k) => k + 1);
    setActiveRoute('dashboard');
    setDashboardRouteTarget(result.route_target ?? null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        {activeRoute === 'dashboard' ? (
          <KPIDashboardScreen
            key={refreshKey}
            onOpenUserMenu={() => setMenuVisible(true)}
            onOpenInviteCode={() => routeTo('invite')}
            onOpenVPTree={() => routeTo('vp-tree')}
            onOpenGPCity={() => routeTo('gp-city')}
            onOpenGallery={() => routeTo('animation-gallery')}
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
        {activeRoute === 'vp-tree' ? <VPTreeScreen onBack={() => setActiveRoute('dashboard')} onOpenGallery={() => setActiveRoute('animation-gallery')} /> : null}
        {activeRoute === 'gp-city' ? <GPCityScreen onBack={() => setActiveRoute('dashboard')} /> : null}
        {activeRoute === 'animation-gallery' ? <AnimationGalleryScreen onBack={() => setActiveRoute('dashboard')} /> : null}
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
