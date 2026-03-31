/**
 * Shared animation utilities for VP Tree and GP City.
 */

// ── No-repeat micro-step picker ─────────────────────────────────────────────

/**
 * Creates a picker that cycles through a pool without immediate repetition.
 * Works for any string-union type (MicroStepType, CityMicroStep, etc.).
 */
export function createMicroStepPicker<T extends string>(pool: readonly T[]) {
  let last: T | null = null;
  return (filter?: (t: T) => boolean): T => {
    let available = [...pool] as T[];
    if (filter) available = available.filter(filter);
    available = available.filter((t) => t !== last);
    if (available.length === 0) available = [...pool] as T[];
    const pick = available[Math.floor(Math.random() * available.length)];
    last = pick;
    return pick;
  };
}

// ── Zoom target ─────────────────────────────────────────────────────────────

export interface ZoomTarget {
  x: number;
  y: number;
  label: string;
}

/**
 * Pick a random zoom target, avoiding immediate repeat.
 */
let lastZoomIdx = -1;
export function pickZoomTarget(targets: ZoomTarget[]): ZoomTarget | null {
  if (targets.length === 0) return null;
  if (targets.length === 1) return targets[0];
  let idx = Math.floor(Math.random() * targets.length);
  if (idx === lastZoomIdx) idx = (idx + 1) % targets.length;
  lastZoomIdx = idx;
  return targets[idx];
}

// ── Progress computation ────────────────────────────────────────────────────

export interface ProgressState {
  /** 0..1 progress toward next zoom milestone */
  fastBarValue: number;
  /** 0..1 progress toward next tier threshold */
  slowBarValue: number;
  /** true if a zoom animation should trigger on this log */
  shouldTriggerZoom: boolean;
  /** true if a tier threshold was crossed */
  shouldTriggerTier: boolean;
}

// Front-loaded engagement: more zoom events at low tiers, fewer at high tiers
const ZOOM_INTERVALS_BY_TIER = [3, 3, 5, 5, 8, 8];

/**
 * Compute progress bar values and animation triggers.
 * @param prevTotal - total before this log
 * @param newTotal - total after this log
 * @param tierThresholds - array of tier min values (e.g. [0, 25, 100, 250, 500, 1000])
 * @param logsSinceLastZoom - how many logs since the last zoom fired
 * @param zoomIntervalOverride - override the tier-based interval (optional)
 */
export function computeProgress(
  prevTotal: number,
  newTotal: number,
  tierThresholds: readonly number[],
  logsSinceLastZoom: number,
  zoomIntervalOverride?: number,
): ProgressState {
  // Find current and next tier
  let currentTierIdx = 0;
  for (let i = tierThresholds.length - 1; i >= 0; i--) {
    if (newTotal >= tierThresholds[i]) { currentTierIdx = i; break; }
  }
  let prevTierIdx = 0;
  for (let i = tierThresholds.length - 1; i >= 0; i--) {
    if (prevTotal >= tierThresholds[i]) { prevTierIdx = i; break; }
  }

  const shouldTriggerTier = currentTierIdx > prevTierIdx;

  // Slow bar: progress within current tier toward next
  const currentMin = tierThresholds[currentTierIdx];
  const nextMin = currentTierIdx < tierThresholds.length - 1
    ? tierThresholds[currentTierIdx + 1]
    : currentMin + 500; // past max tier, still show progress
  const tierRange = nextMin - currentMin;
  const slowBarValue = tierRange > 0 ? Math.min(1, (newTotal - currentMin) / tierRange) : 1;

  // Fast bar: progress toward next zoom (tier-aware interval)
  const zoomInterval = zoomIntervalOverride ?? (ZOOM_INTERVALS_BY_TIER[currentTierIdx] ?? 5);
  const logsNow = logsSinceLastZoom + 1;
  const shouldTriggerZoom = !shouldTriggerTier && logsNow >= zoomInterval;
  const fastBarValue = shouldTriggerZoom ? 1 : Math.min(1, logsNow / zoomInterval);

  return { fastBarValue, slowBarValue, shouldTriggerZoom, shouldTriggerTier };
}

// ── Animation sequence runner ───────────────────────────────────────────────

interface AnimationPhase {
  play: () => void;
  delayMs: number;
}

/**
 * Run animation phases sequentially with delays.
 * Returns a cleanup function to cancel pending timeouts.
 */
export function runAnimationSequence(phases: AnimationPhase[]): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cumulative = 0;
  for (const phase of phases) {
    cumulative += phase.delayMs;
    const t = setTimeout(phase.play, cumulative);
    timers.push(t);
  }
  return () => timers.forEach(clearTimeout);
}
