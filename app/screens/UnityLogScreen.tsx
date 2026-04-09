import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';
import { useKpiLogging } from '../hooks/useKpiLogging';
import KpiTileGrid from '../components/kpi/KpiTileGrid';
import { PreRenderedTreeCanvas } from '../components/vp-tree/PreRenderedTreeCanvas';
import { getStage, VP_STAGES, type GrowthStage } from '../components/vp-tree/constants';
import {
  useSharedValue,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { kpiTypeAccent } from './kpi-dashboard/helpers';
import type { DashboardPayload, BottomTab } from './kpi-dashboard/types';
import { bottomTabIconSvgByKey, bottomTabDisplayLabel } from './kpi-dashboard/constants';

type LogMode = 'PRIORITY' | 'GP' | 'VP' | 'PC';
type LoggableKpi = DashboardPayload['loggable_kpis'][number];

const LOG_MODES: LogMode[] = ['PRIORITY', 'GP', 'VP', 'PC'];
const NAV_TABS: BottomTab[] = ['challenge', 'team', 'home', 'logs', 'coach'];

// Tree view takes top 55% of available space (matching original Unity layout)
const TREE_VIEW_RATIO = 0.55;

// Map VP total → image stage (0-9)
function vpToImageStage(vpTotal: number): number {
  // VP stages 0-5 map to image stages 0-9
  const stage = getStage(vpTotal);
  return Math.min(stage * 2, 9);
}

function filterKpis(kpis: LoggableKpi[], mode: LogMode): LoggableKpi[] {
  if (mode === 'PRIORITY') {
    const order = ['VP', 'GP', 'PC'];
    return [...kpis].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)).slice(0, 8);
  }
  return kpis.filter((k) => k.type === mode).slice(0, 8);
}

interface UnityLogScreenProps {
  onBack: () => void;
  onNavigateTo?: (tab: BottomTab) => void;
}

export default function UnityLogScreen({ onBack, onNavigateTo }: UnityLogScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const { session } = useAuth();

  const [kpis, setKpis] = useState<LoggableKpi[]>([]);
  const [mode, setMode] = useState<LogMode>('PRIORITY');
  const [vpTotal, setVpTotal] = useState(0);
  const [imageStage, setImageStage] = useState(0);

  // Shared values for tree effects
  const decayProgress = useSharedValue(0);
  const orbProgress = useSharedValue(0);
  const orbOpacity = useSharedValue(0);
  const trunkGlowOpacity = useSharedValue(0);
  const rustleOffsetX = useSharedValue(0);
  const rustleOffsetY = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const tierFlashOpacity = useSharedValue(0);
  const tierScale = useSharedValue(1);

  const stage = getStage(vpTotal) as GrowthStage;

  // Gentle wind sway
  useEffect(() => {
    if (stage < 1) return;
    const swayAmount = 1.5 + stage * 0.5;
    rustleOffsetX.value = withRepeat(
      withSequence(
        withTiming(swayAmount, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-swayAmount, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    rustleOffsetY.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
  }, [stage]);

  // Pulse animation — called on every successful KPI log
  const playPulse = useCallback(() => {
    // Orb rises from ground to canopy
    orbProgress.value = 0;
    orbOpacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 250 }),
    );
    orbProgress.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });

    // Trunk glow on absorption
    trunkGlowOpacity.value = withSequence(
      withTiming(0, { duration: 1100 }),
      withTiming(0.7, { duration: 150 }),
      withTiming(0, { duration: 500 }),
    );

    // Particle burst
    particleOpacity.value = withSequence(
      withTiming(0, { duration: 1100 }),
      withTiming(1, { duration: 40 }),
      withTiming(0, { duration: 250 }),
    );
    particleProgress.value = 0;
    particleProgress.value = withSequence(
      withTiming(0, { duration: 1100 }),
      withTiming(1, { duration: 500 }),
    );
  }, []);

  // Full logging system
  const logging = useKpiLogging({
    token: session?.access_token,
    gpUnlocked: true,
    vpUnlocked: true,
    onLogSuccess: (_kpiId, kpi, _response) => {
      playPulse();
      // Update VP total and check for stage transition
      const vpGain = kpi.vp_value ?? 10;
      setVpTotal((prev) => {
        const newTotal = prev + vpGain;
        const newImgStage = vpToImageStage(newTotal);
        setImageStage(newImgStage);
        return newTotal;
      });
    },
  });

  // Fetch loggable KPIs and VP total on mount
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to fetch dashboard');
        const payload = data as DashboardPayload;
        const loggable = (payload.loggable_kpis ?? []).filter((k) => !k.requires_direct_value_input);
        setKpis(loggable);
        const vp = payload.points?.vp ?? 0;
        setVpTotal(Math.round(vp));
        setImageStage(vpToImageStage(Math.round(vp)));
      } catch (e) {
        console.error('[UnityLogScreen] fetch error:', e);
      }
    })();
  }, [session?.access_token]);

  // Layout
  const navBarH = 72 + Math.max(insets.bottom, 10);
  const availableH = windowH - navBarH;
  const treeViewH = Math.round(availableH * TREE_VIEW_RATIO);
  const overlayTop = treeViewH;
  const visibleKpis = filterKpis(kpis, mode);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.webMsg}>Tree view works on device/simulator</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tree visualization — top 55% */}
      <View style={[styles.treeView, { height: treeViewH }]}>
        <PreRenderedTreeCanvas
          width={windowW}
          height={treeViewH}
          stage={stage}
          imageStage={imageStage}
          renderMode="transparent"
          decayProgress={decayProgress}
          orbProgress={orbProgress}
          orbOpacity={orbOpacity}
          trunkGlowOpacity={trunkGlowOpacity}
          rustleOffsetX={rustleOffsetX}
          rustleOffsetY={rustleOffsetY}
          particleProgress={particleProgress}
          particleOpacity={particleOpacity}
          tierFlashOpacity={tierFlashOpacity}
          tierScale={tierScale}
        />
      </View>

      {/* RN overlay: tabs + KPI tiles */}
      <View style={[styles.overlay, { top: overlayTop, bottom: navBarH }]}>
        {/* Mode tabs */}
        <View style={styles.tabStrip}>
          {LOG_MODES.map((m) => {
            const active = mode === m;
            const accent = m === 'PRIORITY' ? '#e8eaf0' : kpiTypeAccent(m as LoggableKpi['type']);
            return (
              <TouchableOpacity
                key={m}
                style={styles.tab}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, active && { color: '#fff' }]}>{m}</Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: accent }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* KPI tile grid */}
        <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {kpis.length === 0 ? (
            <ActivityIndicator size="small" color="#2ecc71" style={{ marginTop: 20 }} />
          ) : visibleKpis.length === 0 ? (
            <Text style={styles.emptyText}>No {mode} KPIs available</Text>
          ) : (
            <KpiTileGrid kpis={visibleKpis} logging={logging} darkMode />
          )}
        </ScrollView>
      </View>

      {/* Bottom nav bar */}
      <View style={[styles.navBar, { height: navBarH, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {NAV_TABS.map((tab) => {
          const TabIcon = bottomTabIconSvgByKey[tab];
          const isLog = tab === 'home';
          return (
            <TouchableOpacity
              key={tab}
              style={styles.navItem}
              onPress={() => {
                if (isLog) return;
                if (onNavigateTo) onNavigateTo(tab);
                else onBack();
              }}
              activeOpacity={isLog ? 1 : 0.6}
            >
              {isLog ? (
                <View style={styles.navLogOuter}>
                  <View style={styles.navLogBtn}>
                    <TabIcon width={32} height={32} color="#fff" />
                  </View>
                  <Text style={styles.navLogLabel}>LOG</Text>
                </View>
              ) : (
                <>
                  <View style={styles.navIconWrap}>
                    <TabIcon width={38} height={38} color="#8d95a5" />
                  </View>
                  <Text style={styles.navLabel}>{bottomTabDisplayLabel[tab]}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webMsg: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  treeView: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,17,23,0.75)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    color: '#8d95a5',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },
  gridScroll: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  emptyText: {
    color: '#8d95a5',
    fontSize: 14,
    padding: 16,
  },
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0d1117',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  navLogOuter: {
    alignItems: 'center',
  },
  navLogBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2ecc71',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  navLogLabel: {
    color: '#2ecc71',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  navIconWrap: {
    marginBottom: 2,
  },
  navLabel: {
    color: '#8d95a5',
    fontSize: 10,
    fontWeight: '500',
  },
});
