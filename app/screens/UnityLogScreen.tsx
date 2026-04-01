import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UnityView from '@azesmway/react-native-unity';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';
import { useKpiLogging } from '../hooks/useKpiLogging';
import KpiTileGrid from '../components/kpi/KpiTileGrid';
import { kpiTypeAccent } from './kpi-dashboard/helpers';
import type { DashboardPayload, BottomTab } from './kpi-dashboard/types';
import { bottomTabIconSvgByKey, bottomTabDisplayLabel } from './kpi-dashboard/constants';

type LogMode = 'PRIORITY' | 'GP' | 'VP' | 'PC';
type LoggableKpi = DashboardPayload['loggable_kpis'][number];

const LOG_MODES: LogMode[] = ['PRIORITY', 'GP', 'VP', 'PC'];
const NAV_TABS: BottomTab[] = ['challenge', 'team', 'home', 'logs', 'coach'];

// Unity camera.rect = (0, 0.35, 1, 0.65) → renders in top 65% of view
const UNITY_CAMERA_RATIO = 0.55;

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
  const unityRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { session } = useAuth();

  const [kpis, setKpis] = useState<LoggableKpi[]>([]);
  const [mode, setMode] = useState<LogMode>('PRIORITY');
  const [unityReady, setUnityReady] = useState(false);

  const sendToUnity = useCallback((message: string) => {
    console.log('[RN → Unity]', message);
    unityRef.current?.postMessage('VPTree', 'ReceiveMessage', message);
  }, []);

  // Full logging system — same animations, haptics, auto-fire as dashboard
  const logging = useKpiLogging({
    token: session?.access_token,
    gpUnlocked: true, // TODO: derive from dashboard payload
    vpUnlocked: true,
    onLogSuccess: (_kpiId, kpi, _response) => {
      // Pulse Unity tree on every successful log
      sendToUnity(`pulse:${kpi.vp_value ?? 10}`);
    },
  });

  useEffect(() => {
    const t = setTimeout(() => setUnityReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Fetch loggable KPIs and VP total
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
        const vpTotal = payload.points?.vp ?? 0;
        const gpTotal = payload.points?.gp ?? 0;
        sendToUnity(`setvp:${Math.round(vpTotal)}`);
        sendToUnity(`setgp:${Math.round(gpTotal)}`);
      } catch (e) {
        console.error('[UnityLogScreen] fetch error:', e);
      }
    })();
  }, [session?.access_token]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.webMsg}>Unity view only works on device</Text>
      </View>
    );
  }

  const navBarH = 72 + Math.max(insets.bottom, 10);
  const unityViewH = windowH - navBarH;
  const overlayTop = Math.round(unityViewH * UNITY_CAMERA_RATIO);
  const visibleKpis = filterKpis(kpis, mode);

  return (
    <View style={styles.container}>
      {/* Unity — fills above nav bar */}
      {unityReady ? (
        <UnityView
          ref={unityRef}
          style={[StyleSheet.absoluteFill, { bottom: navBarH }]}
          onUnityMessage={(e: any) => {
            console.log('[Unity → RN]', e.nativeEvent.message);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { bottom: navBarH, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#2ecc71" />
        </View>
      )}

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
                onPress={() => {
                setMode(m);
                // Tell Unity to switch visualization (PRIORITY uses VP view)
                const unityMode = m === 'PRIORITY' ? 'vp' : m.toLowerCase();
                sendToUnity(`setmode:${unityMode}`);
              }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, active && { color: '#fff' }]}>{m}</Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: accent }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* KPI tile grid — uses the shared component with full logging system */}
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
