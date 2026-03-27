/**
 * usePipelineCheckin — State-management hook for the pipeline check-in
 * overlay, inline pipeline counts, dismissal persistence, and
 * decrease-reason / close / lost workflows.
 *
 * Derived memo values (anchors, nag state, counts) are computed from the
 * payload passed in by the host orchestrator. The `sendLog` callback is
 * also injected so the hook stays decoupled from the dashboard data layer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  DashboardPayload,
  PipelineAnchorNagState,
  PipelineCheckinAnchorTargets,
  PipelineCheckinFieldKey,
  PipelineCheckinReason,
  SendLogOptions,
} from '../screens/kpi-dashboard/types';

import {
  PIPELINE_CHECKIN_DISMISS_KEY_PREFIX,
  PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS,
  PIPELINE_LOST_ENCOURAGEMENT_MESSAGES,
} from '../screens/kpi-dashboard/constants';

import {
  derivePipelineAnchorNagState,
  eventTimestampIsoForSelectedDay,
  findActualGciLogKpi,
  findPipelineCheckinAnchors,
  isoTodayLocal,
  readPipelineAnchorCountsFromPayload,
} from '../screens/kpi-dashboard/helpers';

import { API_URL } from '../lib/supabase';

// ── Injected dependencies ───────────────────────────────────────────

export interface PipelineCheckinDeps {
  payload: DashboardPayload | null;
  state: string; // LoadState
  userId: string | null;
  accessToken: string | null;
  pendingDirectLog: unknown;
  sendLog: (
    kpiId: string,
    direct?: number,
    options?: SendLogOptions,
  ) => Promise<boolean>;
}

// ── Public surface ──────────────────────────────────────────────────

export interface PipelineCheckinState {
  pipelineCheckinVisible: boolean;
  pipelineCheckinListings: number;
  pipelineCheckinBuyers: number;
  pipelineCheckinSubmitting: boolean;
  pipelineCheckinReasonPromptVisible: boolean;
  pipelineCheckinDecreaseFields: PipelineCheckinFieldKey[];
  pipelineCheckinReason: PipelineCheckinReason | null;
  pipelineForceGciEntryField: PipelineCheckinFieldKey | null;
  pipelineCloseDateInput: string;
  pipelineCloseGciInput: string;
  pipelineLostEncouragement: string;
  inlinePipelineSubmitting: boolean;
  /* derived memos */
  pipelineAnchorNag: PipelineAnchorNagState;
  pipelineCheckinAnchors: PipelineCheckinAnchorTargets;
  pipelineAnchorCounts: { listings: number; buyers: number };
  actualGciLogKpi: DashboardPayload['loggable_kpis'][number] | null;
}

export interface PipelineCheckinActions {
  setPipelineCheckinListings: React.Dispatch<React.SetStateAction<number>>;
  setPipelineCheckinBuyers: React.Dispatch<React.SetStateAction<number>>;
  setPipelineCheckinReasonPromptVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setPipelineCheckinReason: React.Dispatch<React.SetStateAction<PipelineCheckinReason | null>>;
  setPipelineForceGciEntryField: React.Dispatch<React.SetStateAction<PipelineCheckinFieldKey | null>>;
  setPipelineCloseDateInput: React.Dispatch<React.SetStateAction<string>>;
  setPipelineCloseGciInput: React.Dispatch<React.SetStateAction<string>>;
  setPipelineLostEncouragement: React.Dispatch<React.SetStateAction<string>>;
  openPipelineCheckinOverlay: () => void;
  openPipelineDecreaseCloseFlow: (field: PipelineCheckinFieldKey) => void;
  dismissPipelineCheckinForToday: () => void;
  saveInlinePipelineCounts: () => Promise<void>;
  onSavePipelineCheckin: () => void;
  onChoosePipelineDecreaseReason: (reason: PipelineCheckinReason) => void;
  finalizePipelineCheckinSave: (reason: PipelineCheckinReason) => Promise<void>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function usePipelineCheckin(
  deps: PipelineCheckinDeps,
): PipelineCheckinState & PipelineCheckinActions {
  const {
    payload,
    state,
    userId,
    accessToken,
    pendingDirectLog,
    sendLog,
  } = deps;

  // ── local state ─────────────────────────────────────────────────
  const [pipelineCheckinVisible, setPipelineCheckinVisible] = useState(false);
  const [pipelineCheckinListings, setPipelineCheckinListings] = useState(0);
  const [pipelineCheckinBuyers, setPipelineCheckinBuyers] = useState(0);
  const [pipelineCheckinSubmitting, setPipelineCheckinSubmitting] = useState(false);
  const [pipelineCheckinReasonPromptVisible, setPipelineCheckinReasonPromptVisible] = useState(false);
  const [pipelineCheckinDecreaseFields, setPipelineCheckinDecreaseFields] = useState<PipelineCheckinFieldKey[]>([]);
  const [pipelineCheckinReason, setPipelineCheckinReason] = useState<PipelineCheckinReason | null>(null);
  const [pipelineForceGciEntryField, setPipelineForceGciEntryField] = useState<PipelineCheckinFieldKey | null>(null);
  const [pipelineCloseDateInput, setPipelineCloseDateInput] = useState('');
  const [pipelineCloseGciInput, setPipelineCloseGciInput] = useState('');
  const [pipelineLostEncouragement, setPipelineLostEncouragement] = useState('');
  const [pipelineCheckinDismissedDay, setPipelineCheckinDismissedDay] = useState<string | null>(null);
  const [pipelineCheckinDismissalLoaded, setPipelineCheckinDismissalLoaded] = useState(false);
  const [inlinePipelineSubmitting, setInlinePipelineSubmitting] = useState(false);

  // ── derived memos ───────────────────────────────────────────────
  const pipelineAnchorNag = useMemo(() => derivePipelineAnchorNagState(payload ?? null), [payload]);
  const pipelineCheckinAnchors = useMemo(() => findPipelineCheckinAnchors(payload ?? null), [payload]);
  const pipelineAnchorCounts = useMemo(() => readPipelineAnchorCountsFromPayload(payload ?? null), [payload]);
  const actualGciLogKpi = useMemo(() => findActualGciLogKpi(payload ?? null), [payload]);

  const pipelineCheckinDismissStorageKey = useMemo(() => {
    const uid = String(userId ?? '').trim();
    return uid ? `${PIPELINE_CHECKIN_DISMISS_KEY_PREFIX}:${uid}` : null;
  }, [userId]);

  // ── sync local counts when anchors change ───────────────────────
  useEffect(() => {
    if (pipelineCheckinVisible) return;
    setPipelineCheckinListings(pipelineAnchorCounts.listings);
    setPipelineCheckinBuyers(pipelineAnchorCounts.buyers);
  }, [pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings, pipelineCheckinVisible]);

  // ── load dismissed-day from AsyncStorage ────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPipelineCheckinDismissalLoaded(false);
    if (!pipelineCheckinDismissStorageKey) {
      setPipelineCheckinDismissedDay(null);
      setPipelineCheckinDismissalLoaded(true);
      return;
    }
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(pipelineCheckinDismissStorageKey);
        if (!cancelled) setPipelineCheckinDismissedDay(stored || null);
      } catch {
        if (!cancelled) setPipelineCheckinDismissedDay(null);
      } finally {
        if (!cancelled) setPipelineCheckinDismissalLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineCheckinDismissStorageKey]);

  // ── persist helper ──────────────────────────────────────────────
  const persistPipelineDismissedDay = useCallback(
    async (isoDay: string) => {
      setPipelineCheckinDismissedDay(isoDay);
      if (!pipelineCheckinDismissStorageKey) return;
      try {
        await AsyncStorage.setItem(pipelineCheckinDismissStorageKey, isoDay);
      } catch {
        // Non-blocking local persistence.
      }
    },
    [pipelineCheckinDismissStorageKey],
  );

  const persistPipelineCountsMetadata = useCallback(
    async (listings: number, buyers: number) => {
      const token = accessToken;
      if (!token) return;
      try {
        await fetch(`${API_URL}/me`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pipeline_listings_pending: listings,
            pipeline_buyers_uc: buyers,
          }),
        });
      } catch {
        // Non-blocking; anchor logs are the primary save path.
      }
    },
    [accessToken],
  );

  // ── overlay open / close ────────────────────────────────────────
  const openPipelineCheckinOverlay = useCallback(() => {
    setPipelineCheckinListings(pipelineAnchorCounts.listings);
    setPipelineCheckinBuyers(pipelineAnchorCounts.buyers);
    setPipelineCheckinReasonPromptVisible(false);
    setPipelineCheckinDecreaseFields([]);
    setPipelineCheckinReason(null);
    setPipelineForceGciEntryField(null);
    setPipelineCloseDateInput(isoTodayLocal());
    setPipelineCloseGciInput('');
    setPipelineLostEncouragement('');
    setPipelineCheckinVisible(true);
  }, [pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings]);

  const openPipelineDecreaseCloseFlow = useCallback(
    (field: PipelineCheckinFieldKey) => {
      setPipelineCheckinListings(Math.max(0, pipelineAnchorCounts.listings - (field === 'listings' ? 1 : 0)));
      setPipelineCheckinBuyers(Math.max(0, pipelineAnchorCounts.buyers - (field === 'buyers' ? 1 : 0)));
      setPipelineCheckinDecreaseFields([field]);
      setPipelineCheckinReasonPromptVisible(false);
      setPipelineCheckinReason('deal_closed');
      setPipelineForceGciEntryField(field);
      setPipelineCloseDateInput(isoTodayLocal());
      setPipelineCloseGciInput('');
      setPipelineLostEncouragement('');
      setPipelineCheckinVisible(true);
    },
    [pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings],
  );

  const dismissPipelineCheckinForToday = useCallback(() => {
    const today = isoTodayLocal();
    PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.add(today);
    void persistPipelineDismissedDay(today);
    setPipelineCheckinReasonPromptVisible(false);
    setPipelineCheckinReason(null);
    setPipelineForceGciEntryField(null);
    setPipelineCheckinVisible(false);
  }, [persistPipelineDismissedDay]);

  // ── auto-nag effect ─────────────────────────────────────────────
  useEffect(() => {
    if (!payload || state !== 'ready') return;
    if (pipelineCheckinVisible || pendingDirectLog) return;
    if (!pipelineCheckinDismissalLoaded) return;
    const today = isoTodayLocal();
    if (PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.has(today)) return;
    if (pipelineCheckinDismissedDay === today) return;
    if (pipelineAnchorNag.severity === 'ok') return;
    openPipelineCheckinOverlay();
  }, [
    openPipelineCheckinOverlay,
    payload,
    pendingDirectLog,
    pipelineAnchorNag.severity,
    pipelineCheckinDismissalLoaded,
    pipelineCheckinDismissedDay,
    pipelineCheckinVisible,
    state,
  ]);

  // ── inline save ─────────────────────────────────────────────────
  const saveInlinePipelineCounts = useCallback(async () => {
    const listingsKpi = pipelineCheckinAnchors.listings;
    const buyersKpi = pipelineCheckinAnchors.buyers;
    if (!listingsKpi || !buyersKpi) {
      Alert.alert('Pipeline update unavailable', 'Required pipeline anchors are not available.');
      return;
    }
    const nextListings = Math.max(0, Math.round(pipelineCheckinListings));
    const nextBuyers = Math.max(0, Math.round(pipelineCheckinBuyers));
    setInlinePipelineSubmitting(true);
    try {
      const eventIso = new Date().toISOString();
      const listingsSaved = await sendLog(listingsKpi.id, nextListings, {
        kpiType: 'Pipeline_Anchor',
        skipSuccessBadge: true,
        skipProjectionFlight: true,
        eventTimestampIso: eventIso,
      });
      if (!listingsSaved) return;
      const buyersSaved = await sendLog(buyersKpi.id, nextBuyers, {
        kpiType: 'Pipeline_Anchor',
        skipSuccessBadge: true,
        skipProjectionFlight: true,
        eventTimestampIso: eventIso,
      });
      if (!buyersSaved) return;
      await persistPipelineCountsMetadata(nextListings, nextBuyers);
      Alert.alert('Pipeline updated', 'Pipeline counts were saved from the Activity card.');
    } finally {
      setInlinePipelineSubmitting(false);
    }
  }, [
    persistPipelineCountsMetadata,
    pipelineCheckinAnchors.buyers,
    pipelineCheckinAnchors.listings,
    pipelineCheckinBuyers,
    pipelineCheckinListings,
    sendLog,
  ]);

  // ── finalize save (with reason) ─────────────────────────────────
  const finalizePipelineCheckinSave = useCallback(
    async (reason: PipelineCheckinReason) => {
      const listingsKpi = pipelineCheckinAnchors.listings;
      const buyersKpi = pipelineCheckinAnchors.buyers;
      if (!listingsKpi || !buyersKpi) {
        Alert.alert('Pipeline check-in unavailable', 'Required pipeline anchor KPIs are not available yet.');
        return;
      }
      let closeEventIso: string | null = null;
      let closeGciAmount: number | null = null;
      if (reason === 'deal_closed') {
        const normalizedDate = (pipelineCloseDateInput.trim() || isoTodayLocal()).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          Alert.alert('Invalid close date', 'Use YYYY-MM-DD for the close date.');
          return;
        }
        const parsedGci = Number(pipelineCloseGciInput.replace(/,/g, '').trim());
        if (!Number.isFinite(parsedGci) || parsedGci <= 0) {
          Alert.alert('Invalid GCI amount', 'Enter a valid GCI amount greater than 0.');
          return;
        }
        if (!actualGciLogKpi) {
          Alert.alert('Close logging unavailable', 'No Actual GCI log KPI is available for this account yet.');
          return;
        }
        closeEventIso = eventTimestampIsoForSelectedDay(normalizedDate);
        closeGciAmount = parsedGci;
      }

      setPipelineCheckinSubmitting(true);
      try {
        const eventIso = new Date().toISOString();
        const listingsSaved = await sendLog(listingsKpi.id, Math.max(0, Math.round(pipelineCheckinListings)), {
          kpiType: 'Pipeline_Anchor',
          skipSuccessBadge: true,
          skipProjectionFlight: true,
          eventTimestampIso: eventIso,
        });
        if (!listingsSaved) return;
        const buyersSaved = await sendLog(buyersKpi.id, Math.max(0, Math.round(pipelineCheckinBuyers)), {
          kpiType: 'Pipeline_Anchor',
          skipSuccessBadge: true,
          skipProjectionFlight: true,
          eventTimestampIso: eventIso,
        });
        if (!buyersSaved) return;
        await persistPipelineCountsMetadata(
          Math.max(0, Math.round(pipelineCheckinListings)),
          Math.max(0, Math.round(pipelineCheckinBuyers)),
        );
        if (reason === 'deal_closed' && closeEventIso && closeGciAmount != null && actualGciLogKpi) {
          const closeSaved = await sendLog(actualGciLogKpi.id, closeGciAmount, {
            kpiType: 'Actual',
            skipSuccessBadge: true,
            skipProjectionFlight: true,
            eventTimestampIso: closeEventIso,
          });
          if (!closeSaved) return;
        }

        const today = isoTodayLocal();
        PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS.add(today);
        void persistPipelineDismissedDay(today);
        setPipelineCheckinVisible(false);
        setPipelineCheckinReasonPromptVisible(false);
        setPipelineForceGciEntryField(null);

        if (reason === 'deal_lost' && pipelineLostEncouragement) {
          Alert.alert('Keep going', pipelineLostEncouragement);
        }
        if (reason === 'deal_closed') {
          const closeDate = pipelineCloseDateInput.trim() || isoTodayLocal();
          const gci = pipelineCloseGciInput.trim() || '0';
          Alert.alert(
            'Close event logged',
            `Actual GCI close logged and pipeline counts updated (${closeDate}, GCI ${gci}).`,
          );
        }
      } finally {
        setPipelineCheckinSubmitting(false);
      }
    },
    [
      persistPipelineCountsMetadata,
      pipelineCheckinAnchors.buyers,
      pipelineCheckinAnchors.listings,
      actualGciLogKpi,
      pipelineCheckinBuyers,
      pipelineCheckinListings,
      pipelineCloseDateInput,
      pipelineCloseGciInput,
      pipelineForceGciEntryField,
      pipelineLostEncouragement,
      persistPipelineDismissedDay,
      sendLog,
    ],
  );

  // ── save button handler ─────────────────────────────────────────
  const onSavePipelineCheckin = useCallback(() => {
    const prevListings = pipelineAnchorCounts.listings;
    const prevBuyers = pipelineAnchorCounts.buyers;
    const nextListings = Math.max(0, Math.round(pipelineCheckinListings));
    const nextBuyers = Math.max(0, Math.round(pipelineCheckinBuyers));
    const decreased: PipelineCheckinFieldKey[] = [];
    if (nextListings < prevListings) decreased.push('listings');
    if (nextBuyers < prevBuyers) decreased.push('buyers');

    setPipelineCheckinDecreaseFields(decreased);
    if (decreased.length > 0) {
      setPipelineCheckinReasonPromptVisible(true);
      setPipelineCheckinReason(null);
      setPipelineLostEncouragement('');
      return;
    }
    void finalizePipelineCheckinSave('correction');
  }, [finalizePipelineCheckinSave, pipelineAnchorCounts.buyers, pipelineAnchorCounts.listings, pipelineCheckinBuyers, pipelineCheckinListings]);

  // ── decrease reason selection ───────────────────────────────────
  const onChoosePipelineDecreaseReason = useCallback(
    (reason: PipelineCheckinReason) => {
      setPipelineCheckinReason(reason);
      setPipelineCheckinReasonPromptVisible(false);
      if (reason === 'correction') {
        void finalizePipelineCheckinSave(reason);
        return;
      }
      if (reason === 'deal_lost') {
        const msg =
          PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[
            Math.floor(Math.random() * PIPELINE_LOST_ENCOURAGEMENT_MESSAGES.length)
          ] ?? PIPELINE_LOST_ENCOURAGEMENT_MESSAGES[0];
        setPipelineLostEncouragement(msg);
      }
      if (reason === 'deal_closed' && !pipelineCloseDateInput.trim()) {
        setPipelineCloseDateInput(isoTodayLocal());
      }
    },
    [finalizePipelineCheckinSave, pipelineCloseDateInput],
  );

  return {
    // state
    pipelineCheckinVisible,
    pipelineCheckinListings,
    pipelineCheckinBuyers,
    pipelineCheckinSubmitting,
    pipelineCheckinReasonPromptVisible,
    pipelineCheckinDecreaseFields,
    pipelineCheckinReason,
    pipelineForceGciEntryField,
    pipelineCloseDateInput,
    pipelineCloseGciInput,
    pipelineLostEncouragement,
    inlinePipelineSubmitting,
    // derived
    pipelineAnchorNag,
    pipelineCheckinAnchors,
    pipelineAnchorCounts,
    actualGciLogKpi,
    // actions
    setPipelineCheckinListings,
    setPipelineCheckinBuyers,
    setPipelineCheckinReasonPromptVisible,
    setPipelineCheckinReason,
    setPipelineForceGciEntryField,
    setPipelineCloseDateInput,
    setPipelineCloseGciInput,
    setPipelineLostEncouragement,
    openPipelineCheckinOverlay,
    openPipelineDecreaseCloseFlow,
    dismissPipelineCheckinForToday,
    saveInlinePipelineCounts,
    onSavePipelineCheckin,
    onChoosePipelineDecreaseReason,
    finalizePipelineCheckinSave,
  };
}
