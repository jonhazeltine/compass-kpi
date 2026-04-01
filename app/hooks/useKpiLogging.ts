import { useCallback, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';
import { triggerHapticAsync, playKpiTypeCueAsync, playFeedbackCueAsync } from '../lib/feedback';
import { API_URL } from '../lib/supabase';
import type { DashboardPayload } from '../screens/kpi-dashboard/types';
import type { SendLogOptions, QueuedLogTask } from '../screens/kpi-dashboard/types';

type LoggableKpi = DashboardPayload['loggable_kpis'][number];

export type UseKpiLoggingOptions = {
  /** Auth token for API calls */
  token: string | undefined;
  /** Called after a successful log — use to refresh dashboard, pulse Unity, etc. */
  onLogSuccess?: (kpiId: string, kpi: LoggableKpi, response: any) => void;
  /** Timestamp override (e.g. for date picker on dashboard). Defaults to now. */
  eventTimestampIso?: string;
  /** Whether GP category is unlocked */
  gpUnlocked?: boolean;
  /** Whether VP category is unlocked */
  vpUnlocked?: boolean;
};

export function useKpiLogging(options: UseKpiLoggingOptions) {
  const { token, onLogSuccess, eventTimestampIso, gpUnlocked = true, vpUnlocked = true } = options;

  // ── State ──────────────────────────────────────────────────────
  const [confirmedKpiTileIds, setConfirmedKpiTileIds] = useState<Record<string, true>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittingKpiId, setSubmittingKpiId] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────
  const kpiTileScaleByIdRef = useRef<Record<string, Animated.Value>>({});
  const kpiTileConfirmTimeoutByIdRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const kpiTileSuccessAnimByIdRef = useRef<Record<string, Animated.Value>>({});
  const logQueueRef = useRef<QueuedLogTask[]>([]);
  const logQueueRunningRef = useRef(false);
  const homeTapHapticLastAtRef = useRef(0);
  const homeTapHapticBurstRef = useRef(0);
  const homeAutoFireStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeAutoFireIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const homeAutoFireKpiIdRef = useRef<string | null>(null);

  // ── Animation helpers ──────────────────────────────────────────

  const getKpiTileScale = useCallback((kpiId: string) => {
    if (!kpiTileScaleByIdRef.current[kpiId]) {
      kpiTileScaleByIdRef.current[kpiId] = new Animated.Value(1);
    }
    return kpiTileScaleByIdRef.current[kpiId];
  }, []);

  const animateKpiTilePress = useCallback(
    (kpiId: string, pressed: boolean) => {
      Animated.spring(getKpiTileScale(kpiId), {
        toValue: pressed ? 0.95 : 1,
        friction: 7,
        tension: 220,
        useNativeDriver: true,
      }).start();
    },
    [getKpiTileScale]
  );

  const flashKpiTileConfirm = useCallback((kpiId: string) => {
    setConfirmedKpiTileIds((prev) => ({ ...prev, [kpiId]: true }));
    const existing = kpiTileConfirmTimeoutByIdRef.current[kpiId];
    if (existing) clearTimeout(existing);
    kpiTileConfirmTimeoutByIdRef.current[kpiId] = setTimeout(() => {
      setConfirmedKpiTileIds((prev) => {
        const next = { ...prev };
        delete next[kpiId];
        return next;
      });
      delete kpiTileConfirmTimeoutByIdRef.current[kpiId];
    }, 220);
  }, []);

  const getKpiTileSuccessAnim = useCallback((kpiId: string) => {
    if (!kpiTileSuccessAnimByIdRef.current[kpiId]) {
      kpiTileSuccessAnimByIdRef.current[kpiId] = new Animated.Value(0);
    }
    return kpiTileSuccessAnimByIdRef.current[kpiId];
  }, []);

  const animateKpiTileSuccess = useCallback(
    (kpiId: string) => {
      const anim = getKpiTileSuccessAnim(kpiId);
      anim.stopAnimation();
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    },
    [getKpiTileSuccessAnim]
  );

  // ── Haptic throttling ──────────────────────────────────────────

  const triggerRapidTapHaptic = useCallback(() => {
    const now = Date.now();
    const delta = now - homeTapHapticLastAtRef.current;
    if (delta > 220) {
      homeTapHapticBurstRef.current = 0;
    } else {
      homeTapHapticBurstRef.current += 1;
    }
    homeTapHapticLastAtRef.current = now;
    if (homeTapHapticBurstRef.current >= 3 && delta < 90) return;
    if (homeTapHapticBurstRef.current >= 6 && delta < 130 && homeTapHapticBurstRef.current % 2 === 0) return;
    void triggerHapticAsync('tap');
  }, []);

  // ── Press feedback ─────────────────────────────────────────────

  const runKpiTilePressInFeedback = useCallback(
    (kpi: LoggableKpi, opts?: { surface?: 'home' | 'log' }) => {
      animateKpiTilePress(kpi.id, true);
      if (opts?.surface === 'home') {
        triggerRapidTapHaptic();
      } else {
        void triggerHapticAsync('tap');
      }
      void playKpiTypeCueAsync(kpi.type);
      flashKpiTileConfirm(kpi.id);
    },
    [animateKpiTilePress, triggerRapidTapHaptic, flashKpiTileConfirm]
  );

  const runKpiTilePressOutFeedback = useCallback(
    (kpiId: string) => {
      animateKpiTilePress(kpiId, false);
    },
    [animateKpiTilePress]
  );

  // ── Core logging ───────────────────────────────────────────────

  const sendLog = useCallback(
    async (kpiId: string, direct?: number, logOptions?: SendLogOptions) => {
      if (!token) {
        Alert.alert('Not authenticated', 'Please sign in again.');
        return false;
      }
      setSubmitting(true);
      setSubmittingKpiId(kpiId);
      try {
        const response = await fetch(`${API_URL}/kpi-logs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kpi_id: kpiId,
            event_timestamp: logOptions?.eventTimestampIso ?? eventTimestampIso ?? new Date().toISOString(),
            logged_value: direct,
            idempotency_key: `${kpiId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Failed to log KPI');

        if (!logOptions?.skipSuccessBadge) {
          animateKpiTileSuccess(kpiId);
        }
        // Find the KPI object for the callback
        onLogSuccess?.(kpiId, {} as LoggableKpi, body);
        return true;
      } catch (e) {
        void triggerHapticAsync('error');
        void playFeedbackCueAsync('logError');
        Alert.alert('Log failed', e instanceof Error ? e.message : 'Failed to log KPI');
        return false;
      } finally {
        setSubmitting(false);
        setSubmittingKpiId(null);
      }
    },
    [token, eventTimestampIso, animateKpiTileSuccess, onLogSuccess]
  );

  const processQueuedLogs = useCallback(async () => {
    if (logQueueRunningRef.current) return;
    logQueueRunningRef.current = true;
    try {
      while (logQueueRef.current.length > 0) {
        const nextTask = logQueueRef.current.shift();
        if (!nextTask) continue;
        await sendLog(nextTask.kpiId, nextTask.direct, nextTask.options);
      }
    } finally {
      logQueueRunningRef.current = false;
      if (logQueueRef.current.length > 0) {
        void processQueuedLogs();
      }
    }
  }, [sendLog]);

  const enqueueLogTask = useCallback(
    (task: QueuedLogTask) => {
      logQueueRef.current.push(task);
      void processQueuedLogs();
    },
    [processQueuedLogs]
  );

  // ── Main tap handler ───────────────────────────────────────────

  const onTapQuickLog = useCallback(
    (
      kpi: LoggableKpi,
      opts?: {
        skipTapFeedback?: boolean;
        sourcePagePoint?: { x: number; y: number } | null;
      }
    ) => {
      // Category lock check
      if ((kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked)) {
        void triggerHapticAsync('warning');
        void playFeedbackCueAsync('locked');
        Alert.alert(
          'Category Locked',
          kpi.type === 'GP'
            ? 'Business Growth unlocks after 3 active days or 20 total KPI logs.'
            : 'Vitality unlocks after 7 active days or 40 total KPI logs.'
        );
        return;
      }

      if (!opts?.skipTapFeedback) {
        void triggerHapticAsync('tap');
        void playKpiTypeCueAsync(kpi.type);
        flashKpiTileConfirm(kpi.id);
      }

      // Direct value input not handled here — dashboard can intercept before calling
      if (kpi.requires_direct_value_input) {
        return;
      }

      animateKpiTileSuccess(kpi.id);

      enqueueLogTask({
        kpiId: kpi.id,
        options: {
          kpiType: kpi.type,
          skipSuccessBadge: true,
          eventTimestampIso: eventTimestampIso ?? new Date().toISOString(),
        },
      });
    },
    [gpUnlocked, vpUnlocked, flashKpiTileConfirm, animateKpiTileSuccess, enqueueLogTask, eventTimestampIso]
  );

  const fireQuickLogAtPoint = useCallback(
    (kpi: LoggableKpi, sourcePagePoint: { x: number; y: number } | null) => {
      runKpiTilePressInFeedback(kpi, { surface: 'home' });
      onTapQuickLog(kpi, { skipTapFeedback: true, sourcePagePoint });
    },
    [onTapQuickLog, runKpiTilePressInFeedback]
  );

  // ── Auto-fire (long-press rapid logging) ───────────────────────

  const stopAutoFire = useCallback((kpiId?: string) => {
    if (kpiId && homeAutoFireKpiIdRef.current && homeAutoFireKpiIdRef.current !== kpiId) return;
    if (homeAutoFireStartTimeoutRef.current) {
      clearTimeout(homeAutoFireStartTimeoutRef.current);
      homeAutoFireStartTimeoutRef.current = null;
    }
    if (homeAutoFireIntervalRef.current) {
      clearInterval(homeAutoFireIntervalRef.current);
      homeAutoFireIntervalRef.current = null;
    }
    homeAutoFireKpiIdRef.current = null;
  }, []);

  const startAutoFire = useCallback(
    (kpi: LoggableKpi, sourcePagePoint: { x: number; y: number } | null) => {
      stopAutoFire();
      homeAutoFireKpiIdRef.current = kpi.id;
      homeAutoFireStartTimeoutRef.current = setTimeout(() => {
        if (homeAutoFireKpiIdRef.current !== kpi.id) return;
        fireQuickLogAtPoint(kpi, sourcePagePoint);
        homeAutoFireIntervalRef.current = setInterval(() => {
          if (homeAutoFireKpiIdRef.current !== kpi.id) return;
          fireQuickLogAtPoint(kpi, sourcePagePoint);
        }, 88);
      }, 180);
    },
    [fireQuickLogAtPoint, stopAutoFire]
  );

  return {
    // State
    confirmedKpiTileIds,
    submitting,
    submittingKpiId,
    // Animation getters
    getKpiTileScale,
    getKpiTileSuccessAnim,
    // Press handlers (for grid tiles)
    fireQuickLogAtPoint,
    startAutoFire,
    stopAutoFire,
    runKpiTilePressOutFeedback,
    // Direct tap (for non-tile callers)
    onTapQuickLog,
  };
}
