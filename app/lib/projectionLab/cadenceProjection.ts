/**
 * Projection Lab — Forward Cadence Projection
 *
 * Measures an agent's recent KPI cadence and projects it forward,
 * generating synthetic future events that keep the pipeline fed.
 * The result: a projection line that sustains instead of decaying to zero.
 */

import type {
  LabLogEntry,
  LabKpiDefinition,
  LabUserProfile,
  LabScenario,
  MonthlySeriesPoint,
} from './types';
import type { PcEvent } from './engine';
import {
  resolvePcTiming,
  buildFutureProjected12mSeries,
  ALGO_CONSTANTS,
} from './engine';

// ── Types ─────────────────────────────────────────────

export type KpiCadence = {
  kpi_id: string;
  kpi_name: string;
  weighted_events_per_month: number;
  raw_events_90d: number;
  observation_days: number;
};

export type CadenceMeasurement = {
  cadences: KpiCadence[];
  total_weighted_events_per_month: number;
  observation_window_days: number;
};

export type CadenceConfidenceMeta = {
  coefficient_of_variation: number;
  observation_months: number;
  band_width_percent: number;
  label: 'narrow' | 'moderate' | 'wide';
};

// ── Helpers ───────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function addMonthsUtc(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// ── 1. Measure KPI Cadence ────────────────────────────

/**
 * Analyze the recent log stream and compute a recency-weighted
 * events-per-month rate for each KPI.
 *
 * Recency weighting (3 x 30-day buckets):
 *   Last 30 days  → 50%
 *   31-60 days    → 30%
 *   61-90 days    → 20%
 *
 * Handles agents with < 90 days of data by renormalizing weights.
 */
export function measureKpiCadence(
  logStream: LabLogEntry[],
  kpiDefinitions: LabKpiDefinition[],
  evalDate: Date,
  windowDays: number = 90,
): CadenceMeasurement {
  const evalMs = evalDate.getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  // Find the earliest event to know how much data we actually have
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

  // Determine actual observation span
  const earliestRelevant = relevantLogs.reduce((min, log) => {
    const d = new Date(log.event_date_iso).getTime();
    return d < min ? d : min;
  }, evalMs);
  const observationDays = Math.max(1, Math.ceil((evalMs - earliestRelevant) / msPerDay));

  // Define bucket boundaries and weights
  // Bucket A: evalDate-30d to evalDate (most recent)
  // Bucket B: evalDate-60d to evalDate-30d
  // Bucket C: evalDate-90d to evalDate-60d
  const bucketBoundaries = [
    { start: evalMs - 30 * msPerDay, end: evalMs, weight: 0.50 },
    { start: evalMs - 60 * msPerDay, end: evalMs - 30 * msPerDay, weight: 0.30 },
    { start: evalMs - 90 * msPerDay, end: evalMs - 60 * msPerDay, weight: 0.20 },
  ];

  // Only include buckets that have data coverage
  const activeBuckets = bucketBoundaries.filter((b) => b.start >= windowStart.getTime());

  // Renormalize weights if fewer than 3 buckets have coverage
  const totalWeight = activeBuckets.reduce((s, b) => s + b.weight, 0);
  const normalizedBuckets = activeBuckets.map((b) => ({
    ...b,
    weight: totalWeight > 0 ? b.weight / totalWeight : 0,
  }));

  // Count events per KPI per bucket (using quantity, not just row count)
  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));
  const uniqueKpiIds = new Set([
    ...kpiDefinitions.map((k) => k.kpi_id),
    ...relevantLogs.map((l) => l.kpi_id),
  ]);

  const cadences: KpiCadence[] = [];
  let totalWeightedPerMonth = 0;

  for (const kpiId of uniqueKpiIds) {
    const kpi = kpiMap.get(kpiId);
    const kpiLogs = relevantLogs.filter((l) => l.kpi_id === kpiId);
    const rawEvents = kpiLogs.reduce((s, l) => s + l.quantity, 0);

    // Weighted events-per-month calculation
    let weightedMonthly = 0;
    for (const bucket of normalizedBuckets) {
      const bucketLogs = kpiLogs.filter((l) => {
        const t = new Date(l.event_date_iso).getTime();
        return t >= bucket.start && t < bucket.end;
      });
      const bucketEvents = bucketLogs.reduce((s, l) => s + l.quantity, 0);
      // Each bucket represents ~30 days (1 month), so bucketEvents = events in that month
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

// ── 2. Generate Synthetic Future Events ───────────────

/**
 * Using the measured cadence, generate synthetic PcEvents for
 * months 1-12 in the future. Each synthetic event goes through
 * the same delay→hold→decay pipeline as real events.
 */
export function generateSyntheticFutureEvents(
  cadence: CadenceMeasurement,
  kpiDefinitions: LabKpiDefinition[],
  userProfile: LabUserProfile,
  evalDate: Date,
  monthsForward: number = 12,
): PcEvent[] {
  const kpiMap = new Map(kpiDefinitions.map((k) => [k.kpi_id, k]));
  const events: PcEvent[] = [];

  for (let m = 1; m <= monthsForward; m++) {
    const monthStart = addMonthsUtc(evalDate, m);
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const totalDays = daysInUtcMonth(year, month);

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
        1; // quantity=1 per event

      const decayDays = kpi.decay_days ?? ALGO_CONSTANTS.pc.defaultDecayDays;

      for (let i = 0; i < count; i++) {
        // Space events evenly through the month
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

// ── 3. Build Cadence-Projected Series ─────────────────

/**
 * Combine historical PcEvents with synthetic future PcEvents,
 * then run the combined set through the existing engine to produce
 * a 12-month projection that sustains instead of decaying.
 */
export function buildCadenceProjectedSeries(
  scenario: LabScenario,
  evalDate: Date,
  bumpPercent: number,
): MonthlySeriesPoint[] {
  // Measure current cadence from log stream
  const cadence = measureKpiCadence(
    scenario.log_stream,
    scenario.kpi_definitions,
    evalDate,
  );

  // Generate synthetic future events at observed cadence
  const syntheticEvents = generateSyntheticFutureEvents(
    cadence,
    scenario.kpi_definitions,
    scenario.user_profile,
    evalDate,
  );

  // Convert historical log stream to PcEvents (inline to avoid circular import with runner)
  const kpiMap = new Map(scenario.kpi_definitions.map((k) => [k.kpi_id, k]));
  const historicalEvents: PcEvent[] = scenario.log_stream.map((log) => {
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

  // Combine and run through the standard engine
  const combinedEvents = [...historicalEvents, ...syntheticEvents];

  return buildFutureProjected12mSeries(combinedEvents, evalDate, bumpPercent);
}

// ── 4. Confidence Band ────────────────────────────────

/**
 * Compute a confidence band width based on how consistent
 * the agent's KPI activity has been across months.
 *
 * Low coefficient of variation = narrow band (predictable agent)
 * High CV = wide band (erratic agent)
 * More observation months = tighter band
 */
export function computeCadenceConfidenceBand(
  logStream: LabLogEntry[],
  evalDate: Date,
  windowDays: number = 90,
): CadenceConfidenceMeta {
  const msPerDay = 1000 * 60 * 60 * 24;
  const windowStart = new Date(evalDate.getTime() - windowDays * msPerDay);

  // Bucket all events into calendar months
  const monthBuckets = new Map<string, number>();
  for (const log of logStream) {
    const d = new Date(log.event_date_iso);
    if (Number.isNaN(d.getTime()) || d < windowStart || d > evalDate) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + log.quantity);
  }

  const observationMonths = monthBuckets.size;

  // Need at least 2 months for meaningful CV
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

  // Band width: CV-based, narrowed by observation depth
  const observationFactor = Math.max(0.5, 1 - (observationMonths - 1) * 0.1);
  const bandWidth = Math.max(5, Math.min(50, cv * 40 * observationFactor));

  const label: CadenceConfidenceMeta['label'] =
    bandWidth <= 15 ? 'narrow' : bandWidth <= 30 ? 'moderate' : 'wide';

  return {
    coefficient_of_variation: Number(cv.toFixed(3)),
    observation_months: observationMonths,
    band_width_percent: Number(bandWidth.toFixed(1)),
    label,
  };
}
