/**
 * useDeploy — Computes tier progress and stage indices for VP/GP viz cards.
 *
 * Tracks point totals, computes progress within current tier (0-1),
 * maps tier index to image stage (0-9), and detects tier-up transitions.
 */
import { useEffect, useRef, useState } from 'react';
import { triggerHapticAsync } from '../../lib/feedback';

function computeTierIndex(total: number, thresholds: readonly number[]): number {
  let idx = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (total >= thresholds[i]) { idx = i; break; }
  }
  return idx;
}

function computeProgress(total: number, thresholds: readonly number[]): number {
  const tierIdx = computeTierIndex(total, thresholds);
  const currentMin = thresholds[tierIdx];
  const nextMin = tierIdx < thresholds.length - 1 ? thresholds[tierIdx + 1] : currentMin + 500;
  const range = nextMin - currentMin;
  return range > 0 ? Math.min(1, (total - currentMin) / range) : 1;
}

/** Map tier index (0-5) to image stage index (0-9), 2 images per tier */
function tierToImageStage(tierIdx: number): number {
  return Math.min(9, tierIdx * 2);
}

interface UseDeployOptions {
  vpTotal: number;
  gpTotal: number;
  tierThresholds: readonly number[];
  vpDevStageOverride?: number | null;
  gpDevStageOverride?: number | null;
}

export function useDeploy({
  vpTotal,
  gpTotal,
  tierThresholds,
  vpDevStageOverride,
  gpDevStageOverride,
}: UseDeployOptions) {
  const [vpTierUp, setVpTierUp] = useState(false);
  const [gpTierUp, setGpTierUp] = useState(false);

  const prevVpTotalRef = useRef(vpTotal);
  const prevGpTotalRef = useRef(gpTotal);

  const vpProgress = computeProgress(vpTotal, tierThresholds);
  const gpProgress = computeProgress(gpTotal, tierThresholds);
  const vpTierIdx = computeTierIndex(vpTotal, tierThresholds);
  const gpTierIdx = computeTierIndex(gpTotal, tierThresholds);
  const vpStageIndex = vpDevStageOverride ?? tierToImageStage(vpTierIdx);
  const gpStageIndex = gpDevStageOverride ?? tierToImageStage(gpTierIdx);

  // Detect tier-ups when totals change
  useEffect(() => {
    const prevVpTier = computeTierIndex(prevVpTotalRef.current, tierThresholds);
    const prevGpTier = computeTierIndex(prevGpTotalRef.current, tierThresholds);
    if (vpTierIdx > prevVpTier) {
      setVpTierUp(true);
      void triggerHapticAsync('tierUp');
      setTimeout(() => setVpTierUp(false), 3000);
    }
    if (gpTierIdx > prevGpTier) {
      setGpTierUp(true);
      void triggerHapticAsync('tierUp');
      setTimeout(() => setGpTierUp(false), 3000);
    }
    prevVpTotalRef.current = vpTotal;
    prevGpTotalRef.current = gpTotal;
  }, [vpTotal, gpTotal, vpTierIdx, gpTierIdx, tierThresholds]);

  return {
    vpProgress,
    gpProgress,
    vpStageIndex,
    gpStageIndex,
    vpTierUp,
    gpTierUp,
  };
}
