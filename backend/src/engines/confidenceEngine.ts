import { ALGO_CONSTANTS } from "./algorithmConstants";
import { PcEvent, currentPcValueForEventAtDate } from "./pcTimelineEngine";

export type ConfidenceBand = "green" | "yellow" | "red";

export type ConfidenceComponents = {
  historical_accuracy_score: number;
  pipeline_health_score: number;
  inactivity_score: number;
  historical_accuracy_ratio: number | null;
  pipeline_health_metric: number | null;
  inactivity_days: number;
  total_actual_gci_last_12m: number;
  total_projected_pc_payoff_last_12m: number;
  potential_gci_from_pipeline_45d: number;
  projected_pc_next_45d: number;
};

export type ConfidenceResult = {
  score: number;
  band: ConfidenceBand;
  components: ConfidenceComponents;
};

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreFromBands(
  metric: number,
  bands: ReadonlyArray<{ minInclusive: number; maxInclusive: number; score: number }>
): number {
  for (const band of bands) {
    if (metric >= band.minInclusive && metric <= band.maxInclusive) {
      return band.score;
    }
  }
  return bands[bands.length - 1]?.score ?? 0;
}

function confidenceBand(score: number): ConfidenceBand {
  if (score >= ALGO_CONSTANTS.confidence.bandThresholds.greenMin) return "green";
  if (score >= ALGO_CONSTANTS.confidence.bandThresholds.yellowMin) return "yellow";
  return "red";
}

export function computeConfidence(input: {
  now: Date;
  lastActivityTimestampIso?: string | null;
  actualLogs: Array<{ event_timestamp: string; actual_gci_delta: number }>;
  pcEvents: PcEvent[];
  anchors: Array<{ anchor_value: number }>;
  averagePricePoint: number;
  commissionRateDecimal: number;
}): ConfidenceResult {
  const { now, lastActivityTimestampIso, actualLogs, pcEvents, anchors, averagePricePoint, commissionRateDecimal } = input;
  const nowMs = now.getTime();

  const window12mMs = 365 * 24 * 60 * 60 * 1000;
  const cutoff12m = nowMs - window12mMs;

  const totalActualGciLast12m = actualLogs.reduce((sum, row) => {
    const ts = new Date(row.event_timestamp).getTime();
    if (Number.isNaN(ts) || ts < cutoff12m) return sum;
    return sum + toNumberOrZero(row.actual_gci_delta);
  }, 0);

  const totalProjectedPcPayoffLast12m = pcEvents.reduce((sum, event) => {
    const eventTs = new Date(event.eventTimestampIso);
    if (Number.isNaN(eventTs.getTime())) return sum;
    const payoffStart = new Date(eventTs.getTime() + Math.max(0, toNumberOrZero(event.delayBeforePayoffStartsDays)) * 24 * 60 * 60 * 1000);
    if (payoffStart.getTime() < cutoff12m) return sum;
    if (payoffStart.getTime() > nowMs) return sum;
    return sum + Math.max(0, toNumberOrZero(event.initialPcGenerated));
  }, 0);

  let historicalAccuracyScore = Number(ALGO_CONSTANTS.confidence.historicalAccuracy.fallbackNoProjectionScore);
  let historicalAccuracyRatio: number | null = null;
  if (totalProjectedPcPayoffLast12m > 0) {
    historicalAccuracyRatio = totalActualGciLast12m / totalProjectedPcPayoffLast12m;
    historicalAccuracyScore = scoreFromBands(
      historicalAccuracyRatio,
      ALGO_CONSTANTS.confidence.historicalAccuracy.bands
    );
  }

  const safeAvgPrice = Math.max(0, toNumberOrZero(averagePricePoint));
  const safeCommission = Math.max(0, toNumberOrZero(commissionRateDecimal));
  const potentialGciFromPipeline45d = anchors.reduce((sum, anchor) => sum + Math.max(0, toNumberOrZero(anchor.anchor_value)), 0) * safeAvgPrice * safeCommission;

  const horizon45 = new Date(now.getTime() + ALGO_CONSTANTS.confidence.pipelineHealth.forecastWindowDays * 24 * 60 * 60 * 1000);
  let projectedPcNext45d = 0;
  for (let day = 0; day <= ALGO_CONSTANTS.confidence.pipelineHealth.forecastWindowDays; day += 1) {
    const d = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
    projectedPcNext45d += pcEvents.reduce((sum, event) => sum + currentPcValueForEventAtDate(event, d), 0);
  }
  projectedPcNext45d = Number((projectedPcNext45d / (ALGO_CONSTANTS.confidence.pipelineHealth.forecastWindowDays + 1)).toFixed(2));

  let pipelineHealthScore = Number(ALGO_CONSTANTS.confidence.pipelineHealth.noProjectionNoPipelineScore);
  let pipelineHealthMetric: number | null = null;
  if (projectedPcNext45d <= 0) {
    pipelineHealthScore = potentialGciFromPipeline45d > 0
      ? ALGO_CONSTANTS.confidence.pipelineHealth.noProjectionWithPipelineScore
      : ALGO_CONSTANTS.confidence.pipelineHealth.noProjectionNoPipelineScore;
  } else {
    pipelineHealthMetric = potentialGciFromPipeline45d / projectedPcNext45d;
    pipelineHealthScore = scoreFromBands(pipelineHealthMetric, ALGO_CONSTANTS.confidence.pipelineHealth.bands);
  }

  const lastActivityMs = new Date(String(lastActivityTimestampIso ?? now.toISOString())).getTime();
  const inactivityDays = Number.isNaN(lastActivityMs)
    ? 0
    : Math.max(0, Math.floor((nowMs - lastActivityMs) / (1000 * 60 * 60 * 24)));

  let inactivityScore = Number(ALGO_CONSTANTS.confidence.inactivity.maxScore);
  if (inactivityDays > ALGO_CONSTANTS.confidence.inactivity.graceDays) {
    const daysPast = inactivityDays - ALGO_CONSTANTS.confidence.inactivity.graceDays;
    const dropPerDay = ALGO_CONSTANTS.confidence.inactivity.maxScore / ALGO_CONSTANTS.confidence.inactivity.linearDeclineDays;
    inactivityScore = Math.max(
      ALGO_CONSTANTS.confidence.inactivity.minScore,
      ALGO_CONSTANTS.confidence.inactivity.maxScore - daysPast * dropPerDay
    );
  }

  const weighted =
    ALGO_CONSTANTS.confidence.weights.historicalAccuracy * historicalAccuracyScore +
    ALGO_CONSTANTS.confidence.weights.pipelineHealth * pipelineHealthScore +
    ALGO_CONSTANTS.confidence.weights.inactivity * inactivityScore;

  const score = Number(Math.max(0, Math.min(100, weighted)).toFixed(2));

  return {
    score,
    band: confidenceBand(score),
    components: {
      historical_accuracy_score: Number(historicalAccuracyScore.toFixed(2)),
      pipeline_health_score: Number(pipelineHealthScore.toFixed(2)),
      inactivity_score: Number(inactivityScore.toFixed(2)),
      historical_accuracy_ratio: historicalAccuracyRatio === null ? null : Number(historicalAccuracyRatio.toFixed(6)),
      pipeline_health_metric: pipelineHealthMetric === null ? null : Number(pipelineHealthMetric.toFixed(6)),
      inactivity_days: inactivityDays,
      total_actual_gci_last_12m: Number(totalActualGciLast12m.toFixed(2)),
      total_projected_pc_payoff_last_12m: Number(totalProjectedPcPayoffLast12m.toFixed(2)),
      potential_gci_from_pipeline_45d: Number(potentialGciFromPipeline45d.toFixed(2)),
      projected_pc_next_45d: Number(projectedPcNext45d.toFixed(2)),
    },
  };
}
