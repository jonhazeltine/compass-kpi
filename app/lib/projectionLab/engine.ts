/**
 * Projection Lab — Engine Boundary
 *
 * Ports the canonical backend engine math for in-memory (mode-1) execution.
 * Source of truth: backend/src/engines/*.ts
 * This file MUST NOT fork from production algorithm math.
 */

// ── Algorithm Constants (exact mirror of backend/src/engines/algorithmConstants.ts) ──

export const ALGO_CONSTANTS = {
  pc: {
    defaultDecayDays: 180,
  },
  confidence: {
    weights: {
      historicalAccuracy: 0.35,
      pipelineHealth: 0.5,
      inactivity: 0.15,
    },
    inactivity: {
      graceDays: 14,
      linearDeclineDays: 60,
      minScore: 1,
      maxScore: 100,
    },
    historicalAccuracy: {
      fallbackNoProjectionScore: 70,
      bands: [
        { minInclusive: Number.NEGATIVE_INFINITY, maxInclusive: 0.499999, score: 20 },
        { minInclusive: 0.5, maxInclusive: 0.799999, score: 45 },
        { minInclusive: 0.8, maxInclusive: 1.2, score: 90 },
        { minInclusive: 1.200001, maxInclusive: 1.75, score: 95 },
        { minInclusive: 1.750001, maxInclusive: Number.POSITIVE_INFINITY, score: 85 },
      ],
    },
    pipelineHealth: {
      forecastWindowDays: 45,
      noProjectionNoPipelineScore: 10,
      noProjectionWithPipelineScore: 85,
      bands: [
        { minInclusive: Number.NEGATIVE_INFINITY, maxInclusive: 0.499999, score: 15 },
        { minInclusive: 0.5, maxInclusive: 0.799999, score: 40 },
        { minInclusive: 0.8, maxInclusive: 1.5, score: 90 },
        { minInclusive: 1.500001, maxInclusive: Number.POSITIVE_INFINITY, score: 95 },
      ],
    },
    bandThresholds: {
      greenMin: 75,
      yellowMin: 50,
    },
  },
  gp: {
    decayTriggerInactivityDays: 30,
    decayDurationDays: 60,
  },
  vp: {
    inactivityThresholdHours: 12,
    dailyDecayFactor: 0.98,
    minValue: 1,
  },
  tiers: {
    t1MaxInclusive: 99,
    t2MaxInclusive: 299,
    t3MaxInclusive: 599,
    bumps: {
      gp: { 1: 0, 2: 0.025, 3: 0.05, 4: 0.075 } as Record<number, number>,
      vp: { 1: 0, 2: 0.02, 3: 0.04, 4: 0.06 } as Record<number, number>,
    },
  },
  calibration: {
    multiplierMin: 0.5,
    multiplierMax: 1.5,
    errorRatioMin: 0.5,
    errorRatioMax: 1.5,
    stepCoefficient: 0.08,
    trustWarmupSamples: 8,
    diagnostics: {
      mediumSampleMin: 3,
      highSampleMin: 8,
    },
  },
} as const;

// ── Shared Helpers ────────────────────────────────────

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toWholeNonNegative(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
}

// ── PC Timing Engine (mirror of pcTimingEngine.ts) ────

export type PcTimingInput = {
  ttc_days?: number | null;
  delay_days?: number | null;
  hold_days?: number | null;
  ttc_definition?: string | null;
};

export type ResolvedPcTiming = {
  delayDays: number;
  holdDays: number;
  totalTtcDays: number;
};

export function parseTtcDefinition(ttcDefinition: unknown): ResolvedPcTiming | null {
  if (typeof ttcDefinition !== 'string') return null;
  const raw = ttcDefinition.trim();
  if (!raw) return null;

  const rangeMatch = raw.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (rangeMatch) {
    const start = toWholeNonNegative(rangeMatch[1]) ?? 0;
    const end = toWholeNonNegative(rangeMatch[2]) ?? 0;
    const orderedStart = Math.min(start, end);
    const orderedEnd = Math.max(start, end);
    return {
      delayDays: orderedStart,
      holdDays: Math.max(0, orderedEnd - orderedStart),
      totalTtcDays: orderedEnd,
    };
  }

  const singleMatch = raw.match(/(\d+)/);
  if (singleMatch) {
    const total = toWholeNonNegative(singleMatch[1]) ?? 0;
    return { delayDays: 0, holdDays: total, totalTtcDays: total };
  }

  return null;
}

export function resolvePcTiming(input: PcTimingInput): ResolvedPcTiming {
  const parsedFromDefinition = parseTtcDefinition(input.ttc_definition ?? null);

  const delayDays =
    toWholeNonNegative(input.delay_days) ?? parsedFromDefinition?.delayDays ?? 0;

  const holdDays =
    toWholeNonNegative(input.hold_days) ??
    parsedFromDefinition?.holdDays ??
    (() => {
      const fallbackTtc = toWholeNonNegative(input.ttc_days) ?? 0;
      return Math.max(0, fallbackTtc - delayDays);
    })();

  const totalTtcDays =
    toWholeNonNegative(input.ttc_days) ??
    parsedFromDefinition?.totalTtcDays ??
    delayDays + holdDays;

  return {
    delayDays,
    holdDays,
    totalTtcDays: Math.max(totalTtcDays, delayDays + holdDays),
  };
}

// ── PC Timeline Engine (mirror of pcTimelineEngine.ts) ──

export type PcEvent = {
  eventTimestampIso: string;
  initialPcGenerated: number;
  delayBeforePayoffStartsDays?: number;
  holdDurationDays: number;
  decayDurationDays?: number;
};

export type MonthlySeriesPoint = {
  month_start: string;
  value: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function currentPcValueForEventAtDate(event: PcEvent, currentDate: Date): number {
  const eventDate = startOfUtcDay(new Date(event.eventTimestampIso));
  if (Number.isNaN(eventDate.getTime())) return 0;

  const initial = toNumberOrZero(event.initialPcGenerated);
  if (initial <= 0) return 0;

  const delayDays = Math.max(0, toNumberOrZero(event.delayBeforePayoffStartsDays));
  const holdDays = Math.max(0, toNumberOrZero(event.holdDurationDays));
  const decayDays = Math.max(
    1,
    toNumberOrZero(event.decayDurationDays ?? ALGO_CONSTANTS.pc.defaultDecayDays)
  );

  const payoffStart = addDays(eventDate, delayDays);
  const decayStart = addDays(payoffStart, holdDays);
  const nowDay = startOfUtcDay(currentDate);

  if (nowDay.getTime() < payoffStart.getTime()) return 0;
  if (nowDay.getTime() < decayStart.getTime()) return initial;

  const daysIntoDecay = Math.floor(
    (nowDay.getTime() - decayStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysIntoDecay >= decayDays) return 0;

  const remaining = initial * (1 - daysIntoDecay / decayDays);
  return Math.max(0, remaining);
}

export function aggregateProjectedPcAtDate(events: PcEvent[], currentDate: Date): number {
  return events.reduce(
    (sum, event) => sum + currentPcValueForEventAtDate(event, currentDate),
    0
  );
}

export function buildFutureProjected12mSeries(
  events: PcEvent[],
  now: Date,
  bumpPercent: number
): MonthlySeriesPoint[] {
  const monthStart = startOfUtcMonth(now);
  const safeBump = Math.max(0, toNumberOrZero(bumpPercent));

  return Array.from({ length: 12 }).map((_, i) => {
    const month = addMonths(monthStart, i + 1);
    const pointDate = endOfUtcMonth(month);
    const raw = aggregateProjectedPcAtDate(events, pointDate);
    const bumped = raw * (1 + safeBump);
    return { month_start: month.toISOString(), value: Number(bumped.toFixed(2)) };
  });
}

export function buildPastActual6mSeries(
  actualLogs: Array<{ event_timestamp: string; actual_gci_delta: number }>,
  now: Date
): MonthlySeriesPoint[] {
  const monthStart = startOfUtcMonth(now);
  const months = Array.from({ length: 6 }).map((_, i) => addMonths(monthStart, i - 5));

  return months.map((month) => {
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
    const value = actualLogs.reduce((sum, log) => {
      const dt = new Date(log.event_timestamp);
      if (Number.isNaN(dt.getTime())) return sum;
      const logKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
      if (logKey !== key) return sum;
      return sum + toNumberOrZero(log.actual_gci_delta);
    }, 0);
    return { month_start: month.toISOString(), value: Number(value.toFixed(2)) };
  });
}

export function derivePc90dFromFutureSeries(
  futureProjected12m: MonthlySeriesPoint[]
): number {
  const firstThree = futureProjected12m
    .slice(0, 3)
    .reduce((sum, row) => sum + toNumberOrZero(row.value), 0);
  return Number(firstThree.toFixed(2));
}

// ── GP/VP Engine (mirror of gpVpEngine.ts) ────────────

type Tier = 1 | 2 | 3 | 4;

export type GpVpEngineSnapshot = {
  gp_raw: number;
  gp_current: number;
  vp_raw: number;
  vp_current: number;
  gp_tier: Tier;
  vp_tier: Tier;
  gp_bump_percent: number;
  vp_bump_percent: number;
  total_bump_percent: number;
};

function diffDays(now: Date, then: Date): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
}

function diffHours(now: Date, then: Date): number {
  return Math.max(0, (now.getTime() - then.getTime()) / (1000 * 60 * 60));
}

function tierForValue(points: number): Tier {
  const p = Math.max(0, points);
  if (p <= ALGO_CONSTANTS.tiers.t1MaxInclusive) return 1;
  if (p <= ALGO_CONSTANTS.tiers.t2MaxInclusive) return 2;
  if (p <= ALGO_CONSTANTS.tiers.t3MaxInclusive) return 3;
  return 4;
}

export function computeGpVpState(input: {
  now: Date;
  gpLogs: Array<{ event_timestamp: string; points_generated: number }>;
  vpLogs: Array<{ event_timestamp: string; points_generated: number }>;
}): GpVpEngineSnapshot {
  const { now, gpLogs, vpLogs } = input;

  const gpRaw = gpLogs.reduce((sum, row) => sum + toNumberOrZero(row.points_generated), 0);
  const vpRaw = vpLogs.reduce((sum, row) => sum + toNumberOrZero(row.points_generated), 0);

  const latestGpTs = gpLogs
    .map((row) => new Date(row.event_timestamp))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const latestVpTs = vpLogs
    .map((row) => new Date(row.event_timestamp))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  let gpCurrent = gpRaw;
  if (latestGpTs) {
    const inactivityDays = diffDays(now, latestGpTs);
    if (inactivityDays > ALGO_CONSTANTS.gp.decayTriggerInactivityDays) {
      const daysIntoDecay = inactivityDays - ALGO_CONSTANTS.gp.decayTriggerInactivityDays;
      const ratio = Math.max(0, 1 - daysIntoDecay / ALGO_CONSTANTS.gp.decayDurationDays);
      gpCurrent = gpRaw * ratio;
    }
  }

  let vpCurrent = vpRaw;
  if (latestVpTs) {
    const inactivityHours = diffHours(now, latestVpTs);
    if (inactivityHours > ALGO_CONSTANTS.vp.inactivityThresholdHours) {
      const dayChecks = Math.floor(inactivityHours / 24);
      vpCurrent = Math.max(
        ALGO_CONSTANTS.vp.minValue,
        vpRaw * Math.pow(ALGO_CONSTANTS.vp.dailyDecayFactor, dayChecks)
      );
    }
  }

  const gpTier = tierForValue(gpCurrent);
  const vpTier = tierForValue(vpCurrent);
  const gpBump = ALGO_CONSTANTS.tiers.bumps.gp[gpTier] ?? 0;
  const vpBump = ALGO_CONSTANTS.tiers.bumps.vp[vpTier] ?? 0;
  const totalBump = gpBump + vpBump;

  return {
    gp_raw: Number(gpRaw.toFixed(2)),
    gp_current: Number(gpCurrent.toFixed(2)),
    vp_raw: Number(vpRaw.toFixed(2)),
    vp_current: Number(vpCurrent.toFixed(2)),
    gp_tier: gpTier,
    vp_tier: vpTier,
    gp_bump_percent: gpBump,
    vp_bump_percent: vpBump,
    total_bump_percent: totalBump,
  };
}

// ── Confidence Engine (lab-side computation) ──────────

export function computeConfidence(input: {
  hasProjection: boolean;
  hasPipeline: boolean;
  projectionTotal: number;
  actualTotal: number;
  pipelineTotal: number;
  daysSinceLastActivity: number;
}): {
  historicalAccuracy: number;
  pipelineHealth: number;
  inactivity: number;
  composite: number;
  band: 'green' | 'yellow' | 'red';
} {
  const {
    hasProjection,
    hasPipeline,
    projectionTotal,
    actualTotal,
    pipelineTotal,
    daysSinceLastActivity,
  } = input;
  const c = ALGO_CONSTANTS.confidence;

  // Historical accuracy
  let haScore: number;
  if (!hasProjection || projectionTotal <= 0) {
    haScore = c.historicalAccuracy.fallbackNoProjectionScore;
  } else {
    const ratio = actualTotal / projectionTotal;
    const band = c.historicalAccuracy.bands.find(
      (b) => ratio >= b.minInclusive && ratio <= b.maxInclusive
    );
    haScore = band?.score ?? c.historicalAccuracy.fallbackNoProjectionScore;
  }

  // Pipeline health
  let phScore: number;
  if (!hasProjection && !hasPipeline) {
    phScore = c.pipelineHealth.noProjectionNoPipelineScore;
  } else if (!hasProjection && hasPipeline) {
    phScore = c.pipelineHealth.noProjectionWithPipelineScore;
  } else {
    const ratio = projectionTotal > 0 ? pipelineTotal / projectionTotal : 0;
    const band = c.pipelineHealth.bands.find(
      (b) => ratio >= b.minInclusive && ratio <= b.maxInclusive
    );
    phScore = band?.score ?? c.pipelineHealth.noProjectionNoPipelineScore;
  }

  // Inactivity
  let inScore: number;
  if (daysSinceLastActivity <= c.inactivity.graceDays) {
    inScore = c.inactivity.maxScore;
  } else {
    const daysOverGrace = daysSinceLastActivity - c.inactivity.graceDays;
    const decline = (daysOverGrace / c.inactivity.linearDeclineDays) * (c.inactivity.maxScore - c.inactivity.minScore);
    inScore = Math.max(c.inactivity.minScore, c.inactivity.maxScore - decline);
  }

  // Composite
  const composite = Number(
    (
      haScore * c.weights.historicalAccuracy +
      phScore * c.weights.pipelineHealth +
      inScore * c.weights.inactivity
    ).toFixed(2)
  );

  const band: 'green' | 'yellow' | 'red' =
    composite >= c.bandThresholds.greenMin
      ? 'green'
      : composite >= c.bandThresholds.yellowMin
        ? 'yellow'
        : 'red';

  return {
    historicalAccuracy: Number(haScore.toFixed(2)),
    pipelineHealth: Number(phScore.toFixed(2)),
    inactivity: Number(inScore.toFixed(2)),
    composite,
    band,
  };
}

// ── Event Phase Classification ────────────────────────

export type EventPhase = 'before_payoff' | 'hold' | 'decay' | 'expired';

export function classifyEventPhase(
  event: PcEvent,
  currentDate: Date
): { phase: EventPhase; payoffStart: Date; decayStart: Date; fullDecay: Date } {
  const eventDate = startOfUtcDay(new Date(event.eventTimestampIso));
  const delayDays = Math.max(0, toNumberOrZero(event.delayBeforePayoffStartsDays));
  const holdDays = Math.max(0, toNumberOrZero(event.holdDurationDays));
  const decayDays = Math.max(
    1,
    toNumberOrZero(event.decayDurationDays ?? ALGO_CONSTANTS.pc.defaultDecayDays)
  );

  const payoffStart = addDays(eventDate, delayDays);
  const decayStart = addDays(payoffStart, holdDays);
  const fullDecay = addDays(decayStart, decayDays);
  const nowDay = startOfUtcDay(currentDate);

  let phase: EventPhase;
  if (nowDay.getTime() < payoffStart.getTime()) phase = 'before_payoff';
  else if (nowDay.getTime() < decayStart.getTime()) phase = 'hold';
  else if (nowDay.getTime() < fullDecay.getTime()) phase = 'decay';
  else phase = 'expired';

  return { phase, payoffStart, decayStart, fullDecay };
}
