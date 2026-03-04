/**
 * Projection Lab — In-Memory Runner (Mode 1)
 *
 * Executes the real projection engine with injected synthetic data.
 * No production KPI-log writes. All computation is client-side.
 */

import type {
  LabScenario,
  RunBundle,
  EventPhaseDiagnostic,
  CalibrationMetrics,
  RunComparison,
  RunComparisonDelta,
} from './types';
import {
  resolvePcTiming,
  currentPcValueForEventAtDate,
  aggregateProjectedPcAtDate,
  buildFutureProjected12mSeries,
  buildPastActual6mSeries,
  derivePc90dFromFutureSeries,
  computeGpVpState,
  computeConfidence,
  classifyEventPhase,
  ALGO_CONSTANTS,
} from './engine';
import type { PcEvent } from './engine';
import { ALGORITHM_VERSION } from './scenarioGenerator';

// ── Checksum ──────────────────────────────────────────

function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ── Convert scenario logs to PcEvents ─────────────────

function scenarioToPcEvents(scenario: LabScenario): PcEvent[] {
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

// ── Run Executor ──────────────────────────────────────

export function executeRun(input: {
  scenario: LabScenario;
  evalDate?: Date;
  adminUser: string;
  calibrationMultiplier?: number;
}): RunBundle {
  const {
    scenario,
    evalDate = new Date(),
    adminUser,
    calibrationMultiplier = 1.0,
  } = input;

  const pcEvents = scenarioToPcEvents(scenario);
  const kpiMap = new Map(scenario.kpi_definitions.map((k) => [k.kpi_id, k]));

  // GP/VP state
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

  // PC series
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

  // Summary values
  const rawPcAtEval = aggregateProjectedPcAtDate(pcEvents, evalDate);
  const bumpApplied = rawPcAtEval * (1 + gpVp.total_bump_percent);
  const calibrated = bumpApplied * calibrationMultiplier;

  const pc90d = derivePc90dFromFutureSeries(futureProjected12m);

  // PC at 30d and 180d
  const date30d = new Date(evalDate);
  date30d.setUTCDate(date30d.getUTCDate() + 30);
  const date180d = new Date(evalDate);
  date180d.setUTCDate(date180d.getUTCDate() + 180);

  const rawPc30d = aggregateProjectedPcAtDate(pcEvents, date30d) * (1 + gpVp.total_bump_percent);
  const rawPc180d = aggregateProjectedPcAtDate(pcEvents, date180d) * (1 + gpVp.total_bump_percent);

  // Per-event diagnostics
  const eventContributions: EventPhaseDiagnostic[] = scenario.log_stream.map((log) => {
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

    const pcEvent: PcEvent = {
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

  // Confidence
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

  // Build checksum
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
    production_writes_enabled: false,
  };
}

// ── Calibration Sandbox ───────────────────────────────

export function computeCalibrationMetrics(
  scenario: LabScenario,
  run: RunBundle
): CalibrationMetrics {
  const actualTotal = scenario.actual_closings.reduce((s, c) => s + c.actual_gci_delta, 0);
  const projectedTotal = run.raw_pc_at_eval;
  const errorRatio =
    projectedTotal > 0 ? actualTotal / projectedTotal : 0;
  const absoluteError = Math.abs(actualTotal - projectedTotal);

  // Simulate calibration step
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

// ── Run Comparison ────────────────────────────────────

export function compareRuns(runA: RunBundle, runB: RunBundle): RunComparison {
  function delta(field: string, a: number, b: number): RunComparisonDelta {
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

  const summaryDeltas: RunComparisonDelta[] = [
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
