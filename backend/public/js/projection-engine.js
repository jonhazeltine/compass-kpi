/**
 * Projection Lab — Browser Bundle
 *
 * Auto-generated from app/lib/projectionLab/*.ts
 * DO NOT EDIT — this is a read-only copy for the admin web portal.
 * The source of truth is the TypeScript files in app/lib/projectionLab/.
 *
 * Exposes: window.ProjectionLab
 */
(function (exports) {
'use strict';

// ══════════════════════════════════════════════════════
// engine.ts — Algorithm Constants & Core Math
// ══════════════════════════════════════════════════════

const ALGO_CONSTANTS = Object.freeze({
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
        { minInclusive: -Infinity, maxInclusive: 0.499999, score: 20 },
        { minInclusive: 0.5, maxInclusive: 0.799999, score: 45 },
        { minInclusive: 0.8, maxInclusive: 1.2, score: 90 },
        { minInclusive: 1.200001, maxInclusive: 1.75, score: 95 },
        { minInclusive: 1.750001, maxInclusive: Infinity, score: 85 },
      ],
    },
    pipelineHealth: {
      forecastWindowDays: 45,
      noProjectionNoPipelineScore: 10,
      noProjectionWithPipelineScore: 85,
      bands: [
        { minInclusive: -Infinity, maxInclusive: 0.499999, score: 15 },
        { minInclusive: 0.5, maxInclusive: 0.799999, score: 40 },
        { minInclusive: 0.8, maxInclusive: 1.5, score: 90 },
        { minInclusive: 1.500001, maxInclusive: Infinity, score: 95 },
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
      gp: { 1: 0, 2: 0.025, 3: 0.05, 4: 0.075 },
      vp: { 1: 0, 2: 0.02, 3: 0.04, 4: 0.06 },
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
});

// ── Shared Helpers ────────────────────────────────────

function toNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toWholeNonNegative(value) {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
}

// ── PC Timing Engine ─────────────────────────────────

function parseTtcDefinition(ttcDefinition) {
  if (typeof ttcDefinition !== 'string') return null;
  const raw = ttcDefinition.trim();
  if (!raw) return null;

  const rangeMatch = raw.match(/(\d+)\s*[-\u2013\u2014]\s*(\d+)/);
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

function resolvePcTiming(input) {
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

// ── PC Timeline Engine ───────────────────────────────

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function currentPcValueForEventAtDate(event, currentDate) {
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

function aggregateProjectedPcAtDate(events, currentDate) {
  return events.reduce(
    (sum, event) => sum + currentPcValueForEventAtDate(event, currentDate),
    0
  );
}

function buildFutureProjected12mSeries(events, now, bumpPercent) {
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

function buildPastActual6mSeries(actualLogs, now) {
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

function derivePc90dFromFutureSeries(futureProjected12m) {
  const firstThree = futureProjected12m
    .slice(0, 3)
    .reduce((sum, row) => sum + toNumberOrZero(row.value), 0);
  return Number(firstThree.toFixed(2));
}

// ── GP/VP Engine ─────────────────────────────────────

function diffDays(now, then) {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
}

function diffHours(now, then) {
  return Math.max(0, (now.getTime() - then.getTime()) / (1000 * 60 * 60));
}

function tierForValue(points) {
  const p = Math.max(0, points);
  if (p <= ALGO_CONSTANTS.tiers.t1MaxInclusive) return 1;
  if (p <= ALGO_CONSTANTS.tiers.t2MaxInclusive) return 2;
  if (p <= ALGO_CONSTANTS.tiers.t3MaxInclusive) return 3;
  return 4;
}

function computeGpVpState(input) {
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

// ── Confidence Engine ────────────────────────────────

function computeConfidence(input) {
  const {
    hasProjection,
    hasPipeline,
    projectionTotal,
    actualTotal,
    pipelineTotal,
    daysSinceLastActivity,
  } = input;
  const c = ALGO_CONSTANTS.confidence;

  let haScore;
  if (!hasProjection || projectionTotal <= 0) {
    haScore = c.historicalAccuracy.fallbackNoProjectionScore;
  } else {
    const ratio = actualTotal / projectionTotal;
    const band = c.historicalAccuracy.bands.find(
      (b) => ratio >= b.minInclusive && ratio <= b.maxInclusive
    );
    haScore = band?.score ?? c.historicalAccuracy.fallbackNoProjectionScore;
  }

  let phScore;
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

  let inScore;
  if (daysSinceLastActivity <= c.inactivity.graceDays) {
    inScore = c.inactivity.maxScore;
  } else {
    const daysOverGrace = daysSinceLastActivity - c.inactivity.graceDays;
    const decline = (daysOverGrace / c.inactivity.linearDeclineDays) * (c.inactivity.maxScore - c.inactivity.minScore);
    inScore = Math.max(c.inactivity.minScore, c.inactivity.maxScore - decline);
  }

  const composite = Number(
    (
      haScore * c.weights.historicalAccuracy +
      phScore * c.weights.pipelineHealth +
      inScore * c.weights.inactivity
    ).toFixed(2)
  );

  const band =
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

// ── Event Phase Classification ───────────────────────

function classifyEventPhase(event, currentDate) {
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

  let phase;
  if (nowDay.getTime() < payoffStart.getTime()) phase = 'before_payoff';
  else if (nowDay.getTime() < decayStart.getTime()) phase = 'hold';
  else if (nowDay.getTime() < fullDecay.getTime()) phase = 'decay';
  else phase = 'expired';

  return { phase, payoffStart, decayStart, fullDecay };
}


// ══════════════════════════════════════════════════════
// scenarioGenerator.ts — Profiles, PRNG, Scenario Synthesis
// ══════════════════════════════════════════════════════

const ALGORITHM_VERSION = '1.0.0-lab';

// ── Live Catalog Mapper ──────────────────────────────

function adminKpiToLabDef(row) {
  return {
    kpi_id: row.id,
    name: row.name,
    unit: 'count',
    weight_percent: row.pc_weight ?? 0,
    ttc_definition: row.ttc_definition ?? null,
    delay_days: row.delay_days ?? null,
    hold_days: row.hold_days ?? null,
    decay_days: row.decay_days ?? null,
    gp_value: row.gp_value ?? 0,
    vp_value: row.vp_value ?? 0,
    direction: 'higher_is_better',
  };
}

// ── Seeded PRNG (Mulberry32) ─────────────────────────

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRange(rng, min, max) {
  return min + rng() * (max - min);
}

function seededInt(rng, min, max) {
  return Math.floor(seededRange(rng, min, max + 1));
}

function seededId(rng) {
  return Math.floor(rng() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
}

function addDaysIso(baseIso, days) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0] + 'T00:00:00.000Z';
}

// ── Actual-Closings Generator ────────────────────────

function generateRealisticClosings(opts) {
  const { baseDateIso, avgPricePoint, commissionRate, daysSpan, idGen, rngVariance, overrideAnnualDeals } = opts;
  const gciPerDeal = avgPricePoint * commissionRate;

  const targetAnnualGci = 150000;
  const annualDeals = overrideAnnualDeals != null
    ? Math.max(1, overrideAnnualDeals)
    : Math.max(6, Math.min(20, Math.round(targetAnnualGci / gciPerDeal)));

  const MONTHS = 12;
  const baseDate = new Date(baseDateIso);

  const perMonth = new Array(MONTHS).fill(0);
  for (let d = 0; d < annualDeals; d++) {
    const monthIdx = Math.floor(rngVariance() * MONTHS) % MONTHS;
    perMonth[monthIdx]++;
  }

  const closings = [];
  for (let m = 0; m < MONTHS; m++) {
    const count = perMonth[m];
    if (count === 0) continue;
    const monthDate = new Date(Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth() + 1 + m,
      1
    ));
    const daysInMonth = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)
    ).getUTCDate();

    for (let c = 0; c < count; c++) {
      const day = count > 1
        ? Math.max(1, Math.min(daysInMonth, Math.round(((c + 0.5) / count) * daysInMonth)))
        : Math.max(1, Math.min(daysInMonth, Math.round(rngVariance() * daysInMonth)));
      const closingDate = new Date(Date.UTC(
        monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day
      ));

      const variance = 0.7 + rngVariance() * 0.6;
      closings.push({
        closing_id: `lab-closing-${idGen()}`,
        event_date_iso: closingDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
        actual_gci_delta: Number((gciPerDeal * variance).toFixed(2)),
      });
    }
  }
  closings.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));
  return closings;
}

// ── Canonical KPI Templates ──────────────────────────

const PC_KPI_TEMPLATES = [
  { name: 'Phone Call Logged', unit: 'count', weight_percent: 0.025, ttc_definition: '90-120', delay_days: 90, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Sphere Call', unit: 'count', weight_percent: 0.04, ttc_definition: '60-90', delay_days: 60, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'FSBO/Expired Call', unit: 'count', weight_percent: 0.05, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Door Knock Logged', unit: 'count', weight_percent: 0.03, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Appointment Set (Buyer)', unit: 'count', weight_percent: 0.5, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Appointment Set (Seller)', unit: 'count', weight_percent: 0.5, ttc_definition: '30-60', delay_days: 30, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Coffee/Lunch with Sphere', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Conversations Held', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Listing Taken', unit: 'count', weight_percent: 7.0, ttc_definition: '30', delay_days: 0, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Buyer Contract Signed', unit: 'count', weight_percent: 5.0, ttc_definition: '30', delay_days: 0, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'New Client Logged', unit: 'count', weight_percent: 1.25, ttc_definition: '30-90', delay_days: 30, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Text/DM Conversation', unit: 'count', weight_percent: 0.01, ttc_definition: '90-120', delay_days: 90, hold_days: 30, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Open House Logged', unit: 'count', weight_percent: 0.2, ttc_definition: '60-120', delay_days: 60, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Seasonal Check-In Call', unit: 'count', weight_percent: 0.1, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Pop-By Delivered', unit: 'count', weight_percent: 0.08, ttc_definition: '90-150', delay_days: 90, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Holiday Card Sent', unit: 'count', weight_percent: 0.03, ttc_definition: '120-180', delay_days: 120, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
  { name: 'Biz Post', unit: 'count', weight_percent: 0.02, ttc_definition: '120-180', delay_days: 120, hold_days: 60, decay_days: 180, gp_value: 0, vp_value: 0, direction: 'higher_is_better' },
];

// ── Rebuild Log Stream from Volumes ──────────────────

function rebuildLogStreamFromVolumes(opts) {
  const { kpiMonthlyVolume, kpiDefinitions, userProfile, timeSpanMonths } = opts;
  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));

  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - timeSpanMonths);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  const totalDays = Math.round(
    (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  let idCounter = Date.now();
  const nextId = () => {
    idCounter++;
    return (idCounter & 0xffffffff).toString(16).padStart(8, '0');
  };

  const logStream = [];

  for (const [kpiId, monthlyCount] of Object.entries(kpiMonthlyVolume)) {
    const kpi = kpiMap.get(kpiId);
    if (!kpi || monthlyCount <= 0) continue;

    const totalEvents = Math.max(1, Math.round(monthlyCount * timeSpanMonths));
    const intervalDays = totalDays / totalEvents;

    for (let i = 0; i < totalEvents; i++) {
      const dayOffset = Math.round(i * intervalDays);
      const quantity = 1;
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;

      logStream.push({
        log_id: `lab-log-${nextId()}`,
        kpi_id: kpiId,
        event_date_iso: addDaysIso(baseDateIso, Math.min(dayOffset, totalDays)),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }

  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));
  return logStream;
}

// ── Pre-Built Scenario Profiles ──────────────────────

const SCENARIO_PROFILES = [
  {
    id: 'listing-heavy',
    name: 'Listing-Heavy Agent',
    description: 'Experienced listing agent focused on FSBO/expired prospecting, seller appointments, and sphere nurturing. High price point, strong conversion pipeline.',
    kpiNames: ['FSBO/Expired Call', 'Appointment Set (Seller)', 'Listing Taken', 'Sphere Call', 'Open House Logged', 'Conversations Held'],
    gpKpiNames: ['CMA Created (Practice or Live)', 'Listing Presentation Given', 'Listing Video Created', 'Market Stats Review (Weekly)'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep'],
    avgPriceRange: [450000, 750000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [8, 20],
    gpEventsPerKpiRange: [3, 8],
    vpEventsPerKpiRange: [12, 20],
    includeActuals: true,
    agentName: 'Sarah Mitchell',
  },
  {
    id: 'buyer-specialist',
    name: 'Buyer Specialist',
    description: 'Agent primarily working with buyers — open houses, buyer appointments, door knocking, and client intake. Moderate price point market.',
    kpiNames: ['Appointment Set (Buyer)', 'Buyer Contract Signed', 'Open House Logged', 'Door Knock Logged', 'New Client Logged', 'Phone Call Logged'],
    gpKpiNames: ['Buyer Consult Held', 'Script Practice Session', 'CRM Tag Applied'],
    vpKpiNames: ['Exercise Session', 'Hydration Goal Met', 'Good Night of Sleep'],
    avgPriceRange: [250000, 450000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [10, 25],
    gpEventsPerKpiRange: [3, 8],
    vpEventsPerKpiRange: [10, 20],
    includeActuals: true,
    agentName: 'Marcus Chen',
  },
  {
    id: 'sphere-nurture',
    name: 'Sphere-of-Influence Agent',
    description: 'Relationship-focused agent building business through sphere nurturing — calls, coffee meetings, pop-bys, seasonal outreach. Long TTC, high loyalty.',
    kpiNames: ['Sphere Call', 'Coffee/Lunch with Sphere', 'Pop-By Delivered', 'Seasonal Check-In Call', 'Holiday Card Sent', 'Conversations Held'],
    gpKpiNames: ['Content Batch Created', 'Social Posts Shared', 'Database Segmented / Cleaned'],
    vpKpiNames: ['Gratitude Entry', 'Good Night of Sleep', 'Social Connection (Non-work)'],
    avgPriceRange: [350000, 600000],
    commissionRange: [0.025, 0.035],
    logDaysSpan: 270,
    eventsPerKpiRange: [12, 30],
    gpEventsPerKpiRange: [4, 10],
    vpEventsPerKpiRange: [12, 22],
    includeActuals: true,
    agentName: 'Julie Reynolds',
  },
  {
    id: 'new-agent-ramp',
    name: 'New Agent (Ramp-Up)',
    description: 'Recently licensed agent in the first 90 days. Low volume, heavy on lead gen activities — calls, door knocks, texts. No closings yet.',
    kpiNames: ['Phone Call Logged', 'Door Knock Logged', 'Text/DM Conversation', 'Appointment Set (Buyer)', 'New Client Logged'],
    gpKpiNames: ['Training Module Completed', 'Coaching Session Attended', 'Roleplay Session Completed', 'Script Practice Session', 'Objection Handling Reps Logged'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep', 'Gratitude Entry'],
    avgPriceRange: [200000, 350000],
    commissionRange: [0.02, 0.025],
    logDaysSpan: 90,
    eventsPerKpiRange: [3, 10],
    gpEventsPerKpiRange: [4, 12],
    vpEventsPerKpiRange: [10, 18],
    includeActuals: true,
    agentName: 'Tyler Brooks',
  },
  {
    id: 'top-producer',
    name: 'Top Producer (Full Pipeline)',
    description: 'High-volume agent tracking everything — listings, buyers, sphere, open houses, prospecting. Strong across all categories with actuals to calibrate against.',
    kpiNames: ['Listing Taken', 'Buyer Contract Signed', 'Appointment Set (Seller)', 'Appointment Set (Buyer)', 'FSBO/Expired Call', 'Sphere Call', 'Open House Logged', 'New Client Logged'],
    gpKpiNames: ['Coaching Session Attended', 'Weekly Scorecard Review', 'Market Stats Review (Weekly)', 'CMA Created (Practice or Live)', 'Training Module Completed'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep', 'Hydration Goal Met', 'Steps Goal Met / Walk Completed'],
    avgPriceRange: [500000, 900000],
    commissionRange: [0.028, 0.035],
    logDaysSpan: 180,
    eventsPerKpiRange: [10, 30],
    gpEventsPerKpiRange: [4, 10],
    vpEventsPerKpiRange: [15, 25],
    includeActuals: true,
    agentName: 'Amanda Reeves',
  },
  {
    id: 'digital-first',
    name: 'Digital-First Agent',
    description: 'Agent focused on online lead gen — texts, DMs, social posting, and conversion to appointments. Lower-touch prospecting, modern workflow.',
    kpiNames: ['Text/DM Conversation', 'Biz Post', 'Phone Call Logged', 'Appointment Set (Buyer)', 'New Client Logged', 'Conversations Held'],
    gpKpiNames: ['Instagram Post Shared', 'Facebook Post Shared', 'Content Batch Created', 'Social Posts Shared', 'Email Subscribers Added'],
    vpKpiNames: ['Exercise Session', 'Good Night of Sleep'],
    avgPriceRange: [300000, 500000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 120,
    eventsPerKpiRange: [15, 40],
    gpEventsPerKpiRange: [6, 15],
    vpEventsPerKpiRange: [10, 18],
    includeActuals: true,
    agentName: 'Diego Vargas',
  },
  {
    id: 'inactive-agent',
    name: 'Inactive Agent (Decay Test)',
    description: 'Agent who was active 60+ days ago but has stopped logging. Tests GP/VP inactivity decay and confidence decline behavior.',
    kpiNames: ['Phone Call Logged', 'Sphere Call', 'Appointment Set (Buyer)', 'Listing Taken'],
    gpKpiNames: [],
    vpKpiNames: [],
    avgPriceRange: [300000, 500000],
    commissionRange: [0.025, 0.03],
    logDaysSpan: 180,
    eventsPerKpiRange: [4, 8],
    gpEventsPerKpiRange: [0, 0],
    vpEventsPerKpiRange: [0, 0],
    includeActuals: true,
    agentName: 'Kevin Park',
  },
];

function generateScenarioFromProfile(input) {
  const { profile, adminUser, seed: overrideSeed, catalogKpis } = input;
  const seed = overrideSeed ?? Math.floor(Math.random() * 99999);
  const rng = mulberry32(seed);

  const userProfile = {
    user_id: `lab-user-${seededId(rng)}`,
    display_name: profile.agentName,
    average_price_point: Number(
      seededRange(rng, profile.avgPriceRange[0], profile.avgPriceRange[1]).toFixed(0)
    ),
    commission_rate: Number(
      seededRange(rng, profile.commissionRange[0], profile.commissionRange[1]).toFixed(4)
    ),
  };

  const resolveName = (name, type) => {
    if (catalogKpis?.length) {
      const row = catalogKpis.find((r) => r.name === name && r.type === type && r.is_active);
      if (row) return { ...adminKpiToLabDef(row), kpi_id: `lab-kpi-${seededId(rng)}` };
    }
    if (type === 'PC') {
      const tmpl = PC_KPI_TEMPLATES.find((t) => t.name === name);
      if (tmpl) return { ...tmpl, kpi_id: `lab-kpi-${seededId(rng)}` };
    }
    if (type === 'GP') {
      return {
        kpi_id: `lab-kpi-${seededId(rng)}`, name, unit: 'count',
        weight_percent: 0, ttc_definition: null, delay_days: null, hold_days: null, decay_days: null,
        gp_value: 1, vp_value: 0, direction: 'higher_is_better',
      };
    }
    if (type === 'VP') {
      return {
        kpi_id: `lab-kpi-${seededId(rng)}`, name, unit: 'count',
        weight_percent: 0, ttc_definition: null, delay_days: null, hold_days: null, decay_days: null,
        gp_value: 0, vp_value: 1, direction: 'higher_is_better',
      };
    }
    return null;
  };

  const pcDefs = profile.kpiNames.map((n) => resolveName(n, 'PC')).filter((k) => k !== null);
  const gpDefs = (profile.gpKpiNames || []).map((n) => resolveName(n, 'GP')).filter((k) => k !== null);
  const vpDefs = (profile.vpKpiNames || []).map((n) => resolveName(n, 'VP')).filter((k) => k !== null);
  const kpiDefinitions = [...pcDefs, ...gpDefs, ...vpDefs];

  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() - profile.logDaysSpan);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  const isInactive = profile.id === 'inactive-agent';
  const effectiveSpan = isInactive
    ? Math.floor(profile.logDaysSpan * 0.4)
    : profile.logDaysSpan;

  const getEventsRange = (kpi) => {
    if (kpi.gp_value > 0 && kpi.weight_percent === 0) return profile.gpEventsPerKpiRange;
    if (kpi.vp_value > 0 && kpi.weight_percent === 0) return profile.vpEventsPerKpiRange;
    return profile.eventsPerKpiRange;
  };

  const logStream = [];
  for (const kpi of kpiDefinitions) {
    const evRange = getEventsRange(kpi);
    if (evRange[0] === 0 && evRange[1] === 0) continue;
    const count = seededInt(rng, evRange[0], evRange[1]);
    for (let j = 0; j < count; j++) {
      const dayOffset = seededInt(rng, 0, effectiveSpan);
      const quantity = seededInt(rng, 1, 3);
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;
      logStream.push({
        log_id: `lab-log-${seededId(rng)}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, dayOffset),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  const closingsBaseDateIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const actualClosings = profile.includeActuals
    ? generateRealisticClosings({
        baseDateIso: closingsBaseDateIso,
        avgPricePoint: userProfile.average_price_point,
        commissionRate: userProfile.commission_rate,
        daysSpan: 365,
        idGen: () => seededId(rng),
        rngVariance: rng,
      })
    : [];

  return {
    scenario_id: `lab-scenario-${seededId(rng)}`,
    seed,
    name: profile.name,
    description: profile.description,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: [profile.id],
  };
}

function generateScenario(input) {
  const {
    seed,
    adminUser,
    name,
    description,
    kpiCount = 4,
    logDaysSpan = 180,
    logsPerKpi = 12,
    includeActuals = false,
  } = input;

  const rng = mulberry32(seed);

  const userProfile = {
    user_id: `lab-user-${seededId(rng)}`,
    display_name: `Lab Agent ${seed}`,
    average_price_point: Number(seededRange(rng, 200000, 800000).toFixed(0)),
    commission_rate: Number(seededRange(rng, 0.02, 0.035).toFixed(4)),
  };

  const shuffled = [...PC_KPI_TEMPLATES].sort(() => rng() - 0.5);
  const selectedCount = Math.min(kpiCount, shuffled.length);
  const kpiDefinitions = shuffled
    .slice(0, selectedCount)
    .map((tmpl) => ({ ...tmpl, kpi_id: `lab-kpi-${seededId(rng)}` }));

  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() - logDaysSpan);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  const logStream = [];
  for (const kpi of kpiDefinitions) {
    const count = seededInt(rng, Math.max(1, logsPerKpi - 4), logsPerKpi + 4);
    for (let j = 0; j < count; j++) {
      const dayOffset = seededInt(rng, 0, logDaysSpan);
      const quantity = seededInt(rng, 1, 5);
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;
      logStream.push({
        log_id: `lab-log-${seededId(rng)}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, dayOffset),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  const actualClosings = includeActuals
    ? generateRealisticClosings({
        baseDateIso,
        avgPricePoint: userProfile.average_price_point,
        commissionRate: userProfile.commission_rate,
        daysSpan: 365,
        idGen: () => seededId(rng),
        rngVariance: rng,
      })
    : [];

  return {
    scenario_id: `lab-scenario-${seededId(rng)}`,
    seed,
    name: name || `Custom Scenario #${seed}`,
    description: description || `Custom scenario from seed ${seed}`,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: ['custom'],
  };
}

function convertScenarioProfileToAgentProfile(sp) {
  return {
    profile_id: `builtin-${sp.id}`,
    name: sp.name,
    description: sp.description,
    agent_name: sp.agentName,
    avg_price_point: Math.round((sp.avgPriceRange[0] + sp.avgPriceRange[1]) / 2),
    commission_rate: Number(((sp.commissionRange[0] + sp.commissionRange[1]) / 2).toFixed(4)),
    kpi_names: [...sp.kpiNames],
    gp_kpi_names: [...(sp.gpKpiNames || [])],
    vp_kpi_names: [...(sp.vpKpiNames || [])],
    include_actuals: sp.includeActuals,
    is_builtin: true,
    created_at: new Date().toISOString(),
  };
}

const BUILTIN_AGENT_PROFILES = SCENARIO_PROFILES.map(convertScenarioProfileToAgentProfile);

function generateScenarioFromVolume(input) {
  const { profile, volumeInput, adminUser, seed: overrideSeed, catalogKpis } = input;
  const seed = overrideSeed ?? Math.floor(Math.random() * 99999);

  let idCounter = seed;
  const nextId = () => {
    idCounter = (idCounter + 1) & 0xffffffff;
    return idCounter.toString(16).padStart(8, '0');
  };

  const userProfile = {
    user_id: `lab-user-${nextId()}`,
    display_name: profile.agent_name,
    average_price_point: profile.avg_price_point,
    commission_rate: profile.commission_rate,
  };

  const resolveKpiName = (name) => {
    if (catalogKpis?.length) {
      const row = catalogKpis.find((r) => r.name === name && r.is_active);
      if (row) return { ...adminKpiToLabDef(row), kpi_id: `lab-kpi-${nextId()}` };
    }
    const tmpl = PC_KPI_TEMPLATES.find((t) => t.name === name);
    if (tmpl) return { ...tmpl, kpi_id: `lab-kpi-${nextId()}` };
    return null;
  };

  const allNames = [...profile.kpi_names, ...(profile.gp_kpi_names ?? []), ...(profile.vp_kpi_names ?? [])];
  const kpiDefinitions = allNames
    .map(resolveKpiName)
    .filter((k) => k !== null);

  const kpiByName = new Map(kpiDefinitions.map((k) => [k.name, k]));

  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - volumeInput.time_span_months);
  const baseDateIso = baseDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
  const totalDays = Math.round(
    (now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const logStream = [];
  for (const spec of volumeInput.volume_specs) {
    const kpi = kpiByName.get(spec.kpi_name);
    if (!kpi || spec.events_per_month <= 0) continue;

    const totalEvents = Math.round(spec.events_per_month * volumeInput.time_span_months);
    if (totalEvents <= 0) continue;

    const intervalDays = totalDays / totalEvents;

    for (let i = 0; i < totalEvents; i++) {
      const dayOffset = Math.round(i * intervalDays);
      const quantity = 1;
      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        quantity;

      logStream.push({
        log_id: `lab-log-${nextId()}`,
        kpi_id: kpi.kpi_id,
        event_date_iso: addDaysIso(baseDateIso, Math.min(dayOffset, totalDays)),
        quantity,
        initial_pc_override: Number(initialPc.toFixed(2)),
        gp_points: kpi.gp_value * quantity,
        vp_points: kpi.vp_value * quantity,
      });
    }
  }
  logStream.sort((a, b) => a.event_date_iso.localeCompare(b.event_date_iso));

  const closingsBaseDateIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  let varCounter = 0;
  const actualClosings =
    volumeInput.include_actuals
      ? generateRealisticClosings({
          baseDateIso: closingsBaseDateIso,
          avgPricePoint: userProfile.average_price_point,
          commissionRate: userProfile.commission_rate,
          daysSpan: 365,
          idGen: () => nextId(),
          rngVariance: () => {
            varCounter++;
            return (Math.sin(varCounter * 2.654) + 1) / 2;
          },
        })
      : [];

  return {
    scenario_id: `lab-scenario-${nextId()}`,
    seed,
    name: `${profile.name} \u2014 Volume Scenario`,
    description: `Generated from profile "${profile.name}" with ${volumeInput.time_span_months}mo span`,
    created_by_admin: adminUser,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    user_profile: userProfile,
    kpi_definitions: kpiDefinitions,
    log_stream: logStream,
    actual_closings: actualClosings,
    is_golden: false,
    tags: ['volume-generated'],
    source_profile_id: profile.profile_id,
    volume_input: volumeInput,
    kpi_monthly_volume: Object.fromEntries(
      volumeInput.volume_specs
        .filter((v) => v.events_per_month > 0)
        .map((v) => {
          const kpi = kpiDefinitions.find((k) => k.name === v.kpi_name);
          return [kpi?.kpi_id ?? v.kpi_name, v.events_per_month];
        })
    ),
  };
}


// ══════════════════════════════════════════════════════
// cadenceProjection.ts — Forward Cadence Projection
// ══════════════════════════════════════════════════════

function _daysBetween(a, b) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function _addMonthsUtc(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function _daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function measureKpiCadence(logStream, kpiDefinitions, evalDate, windowDays) {
  if (windowDays === undefined) windowDays = 90;
  const evalMs = evalDate.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  const windowStart = new Date(evalMs - windowDays * msPerDay);
  const relevantLogs = logStream.filter((log) => {
    const d = new Date(log.event_date_iso);
    return !Number.isNaN(d.getTime()) && d >= windowStart && d <= evalDate;
  });

  if (relevantLogs.length === 0) {
    return {
      cadences: kpiDefinitions.map((k) => ({
        kpi_id: k.kpi_id,
        kpi_name: k.name,
        weighted_events_per_month: 0,
        raw_events_90d: 0,
        observation_days: 0,
      })),
      total_weighted_events_per_month: 0,
      observation_window_days: 0,
    };
  }

  const earliestRelevant = relevantLogs.reduce((min, log) => {
    const d = new Date(log.event_date_iso).getTime();
    return d < min ? d : min;
  }, evalMs);
  const observationDays = Math.max(1, Math.ceil((evalMs - earliestRelevant) / msPerDay));

  const bucketBoundaries = [
    { start: evalMs - 30 * msPerDay, end: evalMs, weight: 0.50 },
    { start: evalMs - 60 * msPerDay, end: evalMs - 30 * msPerDay, weight: 0.30 },
    { start: evalMs - 90 * msPerDay, end: evalMs - 60 * msPerDay, weight: 0.20 },
  ];

  const activeBuckets = bucketBoundaries.filter((b) => b.start >= windowStart.getTime());
  const totalWeight = activeBuckets.reduce((s, b) => s + b.weight, 0);
  const normalizedBuckets = activeBuckets.map((b) => ({
    ...b,
    weight: totalWeight > 0 ? b.weight / totalWeight : 0,
  }));

  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));
  const uniqueKpiIds = new Set([
    ...kpiDefinitions.map((k) => k.kpi_id),
    ...relevantLogs.map((l) => l.kpi_id),
  ]);

  const cadences = [];
  let totalWeightedPerMonth = 0;

  for (const kpiId of uniqueKpiIds) {
    const kpi = kpiMap.get(kpiId);
    const kpiLogs = relevantLogs.filter((l) => l.kpi_id === kpiId);
    const rawEvents = kpiLogs.reduce((s, l) => s + l.quantity, 0);

    let weightedMonthly = 0;
    for (const bucket of normalizedBuckets) {
      const bucketLogs = kpiLogs.filter((l) => {
        const t = new Date(l.event_date_iso).getTime();
        return t >= bucket.start && t < bucket.end;
      });
      const bucketEvents = bucketLogs.reduce((s, l) => s + l.quantity, 0);
      weightedMonthly += bucketEvents * bucket.weight;
    }

    cadences.push({
      kpi_id: kpiId,
      kpi_name: kpi?.name ?? 'Unknown',
      weighted_events_per_month: Number(weightedMonthly.toFixed(2)),
      raw_events_90d: rawEvents,
      observation_days: observationDays,
    });

    totalWeightedPerMonth += weightedMonthly;
  }

  return {
    cadences,
    total_weighted_events_per_month: Number(totalWeightedPerMonth.toFixed(2)),
    observation_window_days: Math.min(observationDays, windowDays),
  };
}

function generateSyntheticFutureEvents(cadence, kpiDefinitions, userProfile, evalDate, monthsForward) {
  if (monthsForward === undefined) monthsForward = 12;
  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));
  const events = [];

  for (let m = 1; m <= monthsForward; m++) {
    const monthStart = _addMonthsUtc(evalDate, m);
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const totalDays = _daysInUtcMonth(year, month);

    for (const cadenceEntry of cadence.cadences) {
      const count = Math.round(cadenceEntry.weighted_events_per_month);
      if (count <= 0) continue;

      const kpi = kpiMap.get(cadenceEntry.kpi_id);
      if (!kpi) continue;

      const timing = resolvePcTiming({
        ttc_definition: kpi.ttc_definition,
        delay_days: kpi.delay_days,
        hold_days: kpi.hold_days,
      });

      const initialPc =
        userProfile.average_price_point *
        userProfile.commission_rate *
        (kpi.weight_percent / 100) *
        1;

      const decayDays = kpi.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays;

      for (let i = 0; i < count; i++) {
        const day = Math.max(1, Math.min(totalDays,
          Math.floor(((i + 0.5) / count) * totalDays)
        ));
        const eventDate = new Date(Date.UTC(year, month, day));

        events.push({
          eventTimestampIso: eventDate.toISOString(),
          initialPcGenerated: initialPc,
          delayBeforePayoffStartsDays: timing.delayDays,
          holdDurationDays: timing.holdDays,
          decayDurationDays: decayDays,
        });
      }
    }
  }

  return events;
}

function buildCadenceProjectedSeries(scenario, evalDate, bumpPercent) {
  const cadence = measureKpiCadence(
    scenario.log_stream,
    scenario.kpi_definitions,
    evalDate,
  );

  const syntheticEvents = generateSyntheticFutureEvents(
    cadence,
    scenario.kpi_definitions,
    scenario.user_profile,
    evalDate,
  );

  const kpiMap = new Map(scenario.kpi_definitions.map((k) => [k.kpi_id, k]));
  const historicalEvents = scenario.log_stream.map((log) => {
    const kpi = kpiMap.get(log.kpi_id);
    const timing = kpi
      ? resolvePcTiming({
          ttc_definition: kpi.ttc_definition,
          delay_days: kpi.delay_days,
          hold_days: kpi.hold_days,
        })
      : { delayDays: 0, holdDays: 0, totalTtcDays: 0 };
    const initialPc =
      log.initial_pc_override ??
      scenario.user_profile.average_price_point *
        scenario.user_profile.commission_rate *
        ((kpi?.weight_percent ?? 0) / 100) *
        log.quantity;
    return {
      eventTimestampIso: log.event_date_iso,
      initialPcGenerated: initialPc,
      delayBeforePayoffStartsDays: timing.delayDays,
      holdDurationDays: timing.holdDays,
      decayDurationDays: kpi?.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays,
    };
  });

  const combinedEvents = [...historicalEvents, ...syntheticEvents];
  return buildFutureProjected12mSeries(combinedEvents, evalDate, bumpPercent);
}

function computeCadenceConfidenceBand(logStream, evalDate, windowDays) {
  if (windowDays === undefined) windowDays = 90;
  const msPerDay = 1000 * 60 * 60 * 24;
  const windowStart = new Date(evalDate.getTime() - windowDays * msPerDay);

  const monthBuckets = new Map();
  for (const log of logStream) {
    const d = new Date(log.event_date_iso);
    if (Number.isNaN(d.getTime()) || d < windowStart || d > evalDate) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + log.quantity);
  }

  const observationMonths = monthBuckets.size;

  if (observationMonths < 2) {
    return {
      coefficient_of_variation: 1.0,
      observation_months: observationMonths,
      band_width_percent: 40,
      label: 'wide',
    };
  }

  const counts = Array.from(monthBuckets.values());
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;

  if (mean === 0) {
    return {
      coefficient_of_variation: 1.0,
      observation_months: observationMonths,
      band_width_percent: 40,
      label: 'wide',
    };
  }

  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean;

  const observationFactor = Math.max(0.5, 1 - (observationMonths - 1) * 0.1);
  const bandWidth = Math.max(5, Math.min(50, cv * 40 * observationFactor));

  const label = bandWidth <= 15 ? 'narrow' : bandWidth <= 30 ? 'moderate' : 'wide';

  return {
    coefficient_of_variation: Number(cv.toFixed(3)),
    observation_months: observationMonths,
    band_width_percent: Number(bandWidth.toFixed(1)),
    label,
  };
}


// ══════════════════════════════════════════════════════
// runner.ts — Orchestration & Execution
// ══════════════════════════════════════════════════════

function simpleChecksum(data) {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function scenarioToPcEvents(scenario) {
  const kpiMap = new Map(scenario.kpi_definitions.map((k) => [k.kpi_id, k]));

  return scenario.log_stream.map((log) => {
    const kpi = kpiMap.get(log.kpi_id);
    const timing = kpi
      ? resolvePcTiming({
          ttc_definition: kpi.ttc_definition,
          delay_days: kpi.delay_days,
          hold_days: kpi.hold_days,
        })
      : { delayDays: 0, holdDays: 0, totalTtcDays: 0 };

    const initialPc =
      log.initial_pc_override ??
      scenario.user_profile.average_price_point *
        scenario.user_profile.commission_rate *
        ((kpi?.weight_percent ?? 0) / 100) *
        log.quantity;

    return {
      eventTimestampIso: log.event_date_iso,
      initialPcGenerated: initialPc,
      delayBeforePayoffStartsDays: timing.delayDays,
      holdDurationDays: timing.holdDays,
      decayDurationDays: kpi?.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays,
    };
  });
}

function executeRun(input) {
  const {
    scenario,
    evalDate = new Date(),
    adminUser,
    calibrationMultiplier = 1.0,
  } = input;

  const pcEvents = scenarioToPcEvents(scenario);
  const kpiMap = new Map(scenario.kpi_definitions.map((k) => [k.kpi_id, k]));

  const gpLogs = scenario.log_stream
    .filter((l) => (kpiMap.get(l.kpi_id)?.gp_value ?? 0) > 0)
    .map((l) => ({
      event_timestamp: l.event_date_iso,
      points_generated: l.gp_points ?? (kpiMap.get(l.kpi_id)?.gp_value ?? 0) * l.quantity,
    }));
  const vpLogs = scenario.log_stream
    .filter((l) => (kpiMap.get(l.kpi_id)?.vp_value ?? 0) > 0)
    .map((l) => ({
      event_timestamp: l.event_date_iso,
      points_generated: l.vp_points ?? (kpiMap.get(l.kpi_id)?.vp_value ?? 0) * l.quantity,
    }));

  const gpVp = computeGpVpState({ now: evalDate, gpLogs, vpLogs });

  const futureProjected12m = buildFutureProjected12mSeries(
    pcEvents,
    evalDate,
    gpVp.total_bump_percent
  );
  const pastActual6m = buildPastActual6mSeries(
    scenario.actual_closings.map((c) => ({
      event_timestamp: c.event_date_iso,
      actual_gci_delta: c.actual_gci_delta,
    })),
    evalDate
  );

  const cadenceProjected12m = buildCadenceProjectedSeries(
    scenario,
    evalDate,
    gpVp.total_bump_percent
  );
  const cadenceConfidence = computeCadenceConfidenceBand(
    scenario.log_stream,
    evalDate
  );

  const rawPcAtEval = aggregateProjectedPcAtDate(pcEvents, evalDate);
  const bumpApplied = rawPcAtEval * (1 + gpVp.total_bump_percent);
  const calibrated = bumpApplied * calibrationMultiplier;

  const pc90d = derivePc90dFromFutureSeries(futureProjected12m);

  const date30d = new Date(evalDate);
  date30d.setUTCDate(date30d.getUTCDate() + 30);
  const date180d = new Date(evalDate);
  date180d.setUTCDate(date180d.getUTCDate() + 180);

  const rawPc30d = aggregateProjectedPcAtDate(pcEvents, date30d) * (1 + gpVp.total_bump_percent);
  const rawPc180d = aggregateProjectedPcAtDate(pcEvents, date180d) * (1 + gpVp.total_bump_percent);

  const eventContributions = scenario.log_stream.map((log) => {
    const kpi = kpiMap.get(log.kpi_id);
    const timing = kpi
      ? resolvePcTiming({
          ttc_definition: kpi.ttc_definition,
          delay_days: kpi.delay_days,
          hold_days: kpi.hold_days,
        })
      : { delayDays: 0, holdDays: 0, totalTtcDays: 0 };

    const decayDays = kpi?.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays;
    const initialPc =
      log.initial_pc_override ??
      scenario.user_profile.average_price_point *
        scenario.user_profile.commission_rate *
        ((kpi?.weight_percent ?? 0) / 100) *
        log.quantity;

    const pcEvent = {
      eventTimestampIso: log.event_date_iso,
      initialPcGenerated: initialPc,
      delayBeforePayoffStartsDays: timing.delayDays,
      holdDurationDays: timing.holdDays,
      decayDurationDays: decayDays,
    };

    const { phase, payoffStart, decayStart, fullDecay } = classifyEventPhase(
      pcEvent,
      evalDate
    );
    const currentValue = currentPcValueForEventAtDate(pcEvent, evalDate);

    return {
      log_id: log.log_id,
      kpi_id: log.kpi_id,
      kpi_name: kpi?.name ?? 'Unknown',
      event_date_iso: log.event_date_iso,
      initial_pc: Number(initialPc.toFixed(2)),
      delay_days: timing.delayDays,
      hold_days: timing.holdDays,
      decay_days: decayDays,
      payoff_start_iso: payoffStart.toISOString(),
      decay_start_iso: decayStart.toISOString(),
      full_decay_iso: fullDecay.toISOString(),
      phase_at_eval: phase,
      current_value: Number(currentValue.toFixed(2)),
    };
  });

  const daysSinceLastActivity = scenario.log_stream.length > 0
    ? Math.max(
        0,
        Math.floor(
          (evalDate.getTime() -
            new Date(
              scenario.log_stream[scenario.log_stream.length - 1].event_date_iso
            ).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 999;

  const actualTotal = scenario.actual_closings.reduce((s, c) => s + c.actual_gci_delta, 0);

  const confidence = computeConfidence({
    hasProjection: rawPcAtEval > 0,
    hasPipeline: rawPcAtEval > 0,
    projectionTotal: rawPcAtEval,
    actualTotal,
    pipelineTotal: rawPcAtEval * 0.8,
    daysSinceLastActivity,
  });

  const checksumPayload = JSON.stringify({
    seed: scenario.seed,
    evalDate: evalDate.toISOString(),
    pcAtEval: calibrated,
    pc90d,
    version: scenario.algorithm_version,
  });
  const checksum = simpleChecksum(checksumPayload);

  const runId = `run-${Date.now().toString(36)}-${checksum.slice(0, 4)}`;

  return {
    run_id: runId,
    scenario_id: scenario.scenario_id,
    algorithm_version: scenario.algorithm_version || ALGORITHM_VERSION,
    eval_date_iso: evalDate.toISOString(),
    created_at: new Date().toISOString(),
    admin_user: adminUser,
    seed: scenario.seed,
    checksum,

    pc_30d: Number((rawPc30d * calibrationMultiplier).toFixed(2)),
    pc_90d: Number((pc90d * calibrationMultiplier).toFixed(2)),
    pc_180d: Number((rawPc180d * calibrationMultiplier).toFixed(2)),
    pc_at_eval_date: Number(calibrated.toFixed(2)),

    future_projected_12m: futureProjected12m,
    past_actual_6m: pastActual6m,

    raw_pc_at_eval: Number(rawPcAtEval.toFixed(2)),
    bump_applied_pc_at_eval: Number(bumpApplied.toFixed(2)),
    calibration_multiplier: calibrationMultiplier,

    event_contributions: eventContributions,
    gp_vp: gpVp,
    confidence,

    cadence_projected_12m: cadenceProjected12m,
    cadence_confidence: cadenceConfidence,

    production_writes_enabled: false,
  };
}

function computeCalibrationMetrics(scenario, run) {
  const actualTotal = scenario.actual_closings.reduce((s, c) => s + c.actual_gci_delta, 0);
  const projectedTotal = run.raw_pc_at_eval;
  const errorRatio =
    projectedTotal > 0 ? actualTotal / projectedTotal : 0;
  const absoluteError = Math.abs(actualTotal - projectedTotal);

  const clampedErrorRatio = Math.max(
    ALGO_CONSTANTS.calibration.errorRatioMin,
    Math.min(ALGO_CONSTANTS.calibration.errorRatioMax, errorRatio)
  );
  const step = (clampedErrorRatio - 1) * ALGO_CONSTANTS.calibration.stepCoefficient;
  const adjustedMultiplier = Math.max(
    ALGO_CONSTANTS.calibration.multiplierMin,
    Math.min(
      ALGO_CONSTANTS.calibration.multiplierMax,
      run.calibration_multiplier + step
    )
  );

  return {
    actual_total: Number(actualTotal.toFixed(2)),
    projected_total: Number(projectedTotal.toFixed(2)),
    error_ratio: Number(errorRatio.toFixed(4)),
    absolute_error: Number(absoluteError.toFixed(2)),
    current_multiplier: run.calibration_multiplier,
    adjusted_multiplier: Number(adjustedMultiplier.toFixed(4)),
  };
}

function compareRuns(runA, runB) {
  function delta(field, a, b) {
    const d = b - a;
    const pct = a !== 0 ? (d / Math.abs(a)) * 100 : b !== 0 ? 100 : 0;
    return {
      field,
      run_a_value: a,
      run_b_value: b,
      delta: Number(d.toFixed(2)),
      delta_percent: Number(pct.toFixed(2)),
    };
  }

  const summaryDeltas = [
    delta('pc_at_eval_date', runA.pc_at_eval_date, runB.pc_at_eval_date),
    delta('pc_30d', runA.pc_30d, runB.pc_30d),
    delta('pc_90d', runA.pc_90d, runB.pc_90d),
    delta('pc_180d', runA.pc_180d, runB.pc_180d),
    delta('raw_pc_at_eval', runA.raw_pc_at_eval, runB.raw_pc_at_eval),
    delta('bump_applied_pc_at_eval', runA.bump_applied_pc_at_eval, runB.bump_applied_pc_at_eval),
    delta('confidence_composite', runA.confidence.composite, runB.confidence.composite),
    delta('gp_current', runA.gp_vp.gp_current, runB.gp_vp.gp_current),
    delta('vp_current', runA.gp_vp.vp_current, runB.gp_vp.vp_current),
    delta('total_bump_percent', runA.gp_vp.total_bump_percent, runB.gp_vp.total_bump_percent),
  ];

  const topDrivers = [...summaryDeltas]
    .sort((a, b) => Math.abs(b.delta_percent) - Math.abs(a.delta_percent))
    .slice(0, 5);

  return {
    run_a_id: runA.run_id,
    run_b_id: runB.run_id,
    top_drivers: topDrivers,
    summary_deltas: summaryDeltas,
  };
}

function computePerKpiSeries(scenario, evalDate, bumpPercent) {
  if (bumpPercent === undefined) bumpPercent = 0;
  const evalD = evalDate ?? new Date();

  return scenario.kpi_definitions.map((kpi) => {
    const kpiLogs = scenario.log_stream.filter((l) => l.kpi_id === kpi.kpi_id);
    const pcEvents = kpiLogs.map((log) => {
      const timing = resolvePcTiming({
        ttc_definition: kpi.ttc_definition,
        delay_days: kpi.delay_days,
        hold_days: kpi.hold_days,
      });
      const initialPc =
        log.initial_pc_override ??
        scenario.user_profile.average_price_point *
          scenario.user_profile.commission_rate *
          (kpi.weight_percent / 100) *
          log.quantity;

      return {
        eventTimestampIso: log.event_date_iso,
        initialPcGenerated: initialPc,
        delayBeforePayoffStartsDays: timing.delayDays,
        holdDurationDays: timing.holdDays,
        decayDurationDays: kpi.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays,
      };
    });

    const series = buildFutureProjected12mSeries(pcEvents, evalD, bumpPercent);
    const total = series.reduce((s, p) => s + p.value, 0);

    return { kpi_name: kpi.name, kpi_id: kpi.kpi_id, series, total };
  });
}

function buildProjectedIncomeSeries(eventContributions, monthBoundaries, annualGciEstimate) {
  if (eventContributions.length === 0 || monthBoundaries.length === 0) {
    return monthBoundaries.map((b) => ({ month_start: b.month_start, value: 0 }));
  }

  const eventCounts = monthBoundaries.map((boundary) => {
    const monthKey = boundary.month_start.slice(0, 7);
    return eventContributions.filter(
      (ev) => ev.payoff_start_iso.slice(0, 7) === monthKey
    ).length;
  });
  const totalEventsAssigned = eventCounts.reduce((s, c) => s + c, 0);

  if (totalEventsAssigned === 0) {
    const even = annualGciEstimate / monthBoundaries.length;
    return monthBoundaries.map((b) => ({
      month_start: b.month_start, value: Number(even.toFixed(2)),
    }));
  }

  return monthBoundaries.map((boundary, i) => {
    const share = eventCounts[i] / totalEventsAssigned;
    return { month_start: boundary.month_start, value: Number((annualGciEstimate * share).toFixed(2)) };
  });
}

function buildActualBaselineSeries(actualClosings, monthBoundaries) {
  return monthBoundaries.map((boundary) => {
    const monthKey = boundary.month_start.slice(0, 7);
    const total = actualClosings.reduce((sum, c) => {
      const closingKey = c.event_date_iso.slice(0, 7);
      return closingKey === monthKey ? sum + c.actual_gci_delta : sum;
    }, 0);
    return { month_start: boundary.month_start, value: Number(total.toFixed(2)) };
  });
}

function computeRollingAverage(series, windowSize) {
  if (windowSize === undefined) windowSize = 2;
  return series.map((pt, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const windowSlice = series.slice(start, i + 1);
    const avg = windowSlice.reduce((s, p) => s + p.value, 0) / windowSlice.length;
    return { month_start: pt.month_start, value: Number(avg.toFixed(2)) };
  });
}


// ══════════════════════════════════════════════════════
// golden.ts — Regression Test Harness
// ══════════════════════════════════════════════════════

const goldenStore = new Map();

function registerGoldenScenario(scenario, expected) {
  goldenStore.set(scenario.scenario_id, {
    scenario: { ...scenario, is_golden: true },
    expected,
  });
}

function removeGoldenScenario(scenarioId) {
  return goldenStore.delete(scenarioId);
}

function getGoldenScenarios() {
  return Array.from(goldenStore.values());
}

function getGoldenScenarioById(scenarioId) {
  return goldenStore.get(scenarioId);
}

function _pctDelta(expected, actual) {
  if (expected === 0 && actual === 0) return 0;
  if (expected === 0) return actual > 0 ? 100 : -100;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

function runGoldenTest(entry, adminUser, evalDate) {
  const run = executeRun({
    scenario: entry.scenario,
    evalDate,
    adminUser,
  });

  const { expected, scenario } = entry;
  const actual = {
    pc_30d: run.pc_30d,
    pc_90d: run.pc_90d,
    pc_180d: run.pc_180d,
  };

  const deltas = {
    pc_30d_pct: Number(_pctDelta(expected.pc_30d, actual.pc_30d).toFixed(2)),
    pc_90d_pct: Number(_pctDelta(expected.pc_90d, actual.pc_90d).toFixed(2)),
    pc_180d_pct: Number(_pctDelta(expected.pc_180d, actual.pc_180d).toFixed(2)),
  };

  const tolerance = expected.tolerance_percent;
  const passed =
    Math.abs(deltas.pc_30d_pct) <= tolerance &&
    Math.abs(deltas.pc_90d_pct) <= tolerance &&
    Math.abs(deltas.pc_180d_pct) <= tolerance;

  return {
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.name,
    algorithm_version: scenario.algorithm_version,
    passed,
    expected,
    actual,
    deltas,
  };
}

function runRegressionSuite(adminUser, evalDate) {
  const entries = getGoldenScenarios();
  const results = entries.map((entry) =>
    runGoldenTest(entry, adminUser, evalDate)
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    report_id: `regression-${Date.now().toString(36)}`,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    total_scenarios: results.length,
    passed,
    failed,
    results,
  };
}

function captureGoldenSnapshot(run, tolerancePercent) {
  if (tolerancePercent === undefined) tolerancePercent = 5;
  return {
    pc_30d: run.pc_30d,
    pc_90d: run.pc_90d,
    pc_180d: run.pc_180d,
    tolerance_percent: tolerancePercent,
  };
}


// ══════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════

exports.ALGO_CONSTANTS = ALGO_CONSTANTS;
exports.ALGORITHM_VERSION = ALGORITHM_VERSION;
exports.SCENARIO_PROFILES = SCENARIO_PROFILES;
exports.BUILTIN_AGENT_PROFILES = BUILTIN_AGENT_PROFILES;
exports.PC_KPI_TEMPLATES = PC_KPI_TEMPLATES;

// engine
exports.parseTtcDefinition = parseTtcDefinition;
exports.resolvePcTiming = resolvePcTiming;
exports.currentPcValueForEventAtDate = currentPcValueForEventAtDate;
exports.aggregateProjectedPcAtDate = aggregateProjectedPcAtDate;
exports.buildFutureProjected12mSeries = buildFutureProjected12mSeries;
exports.buildPastActual6mSeries = buildPastActual6mSeries;
exports.derivePc90dFromFutureSeries = derivePc90dFromFutureSeries;
exports.computeGpVpState = computeGpVpState;
exports.computeConfidence = computeConfidence;
exports.classifyEventPhase = classifyEventPhase;

// scenarioGenerator
exports.adminKpiToLabDef = adminKpiToLabDef;
exports.generateScenario = generateScenario;
exports.generateScenarioFromProfile = generateScenarioFromProfile;
exports.generateScenarioFromVolume = generateScenarioFromVolume;
exports.convertScenarioProfileToAgentProfile = convertScenarioProfileToAgentProfile;
exports.generateRealisticClosings = generateRealisticClosings;
exports.rebuildLogStreamFromVolumes = rebuildLogStreamFromVolumes;

// runner
exports.executeRun = executeRun;
exports.computeCalibrationMetrics = computeCalibrationMetrics;
exports.compareRuns = compareRuns;
exports.computePerKpiSeries = computePerKpiSeries;
exports.buildProjectedIncomeSeries = buildProjectedIncomeSeries;
exports.buildActualBaselineSeries = buildActualBaselineSeries;
exports.computeRollingAverage = computeRollingAverage;
exports.scenarioToPcEvents = scenarioToPcEvents;

// cadenceProjection
exports.measureKpiCadence = measureKpiCadence;
exports.generateSyntheticFutureEvents = generateSyntheticFutureEvents;
exports.buildCadenceProjectedSeries = buildCadenceProjectedSeries;
exports.computeCadenceConfidenceBand = computeCadenceConfidenceBand;

// golden
exports.registerGoldenScenario = registerGoldenScenario;
exports.removeGoldenScenario = removeGoldenScenario;
exports.getGoldenScenarios = getGoldenScenarios;
exports.getGoldenScenarioById = getGoldenScenarioById;
exports.runGoldenTest = runGoldenTest;
exports.runRegressionSuite = runRegressionSuite;
exports.captureGoldenSnapshot = captureGoldenSnapshot;

})(window.ProjectionLab = window.ProjectionLab || {});
