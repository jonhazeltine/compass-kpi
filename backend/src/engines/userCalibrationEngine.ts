import { ALGO_CONSTANTS } from "./algorithmConstants";

export type CalibrationQualityBand = "low" | "medium" | "high";

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampMultiplier(value: number): number {
  return clamp(
    value,
    ALGO_CONSTANTS.calibration.multiplierMin,
    ALGO_CONSTANTS.calibration.multiplierMax
  );
}

export function normalizeErrorRatio(errorRatio: number): number {
  return clamp(
    errorRatio,
    ALGO_CONSTANTS.calibration.errorRatioMin,
    ALGO_CONSTANTS.calibration.errorRatioMax
  );
}

export function computeInitializationMultipliers(input: {
  selectedPcKpiIds: string[];
  historicalWeeklyByKpi: Record<string, number>;
  baseWeightByKpi: Record<string, number>;
}): Record<string, number> {
  const { selectedPcKpiIds, historicalWeeklyByKpi, baseWeightByKpi } = input;
  const ids = selectedPcKpiIds.filter((id) => !!id);
  if (ids.length === 0) return {};

  const totalHist = ids.reduce((sum, id) => sum + Math.max(0, toNumberOrZero(historicalWeeklyByKpi[id])), 0);
  const totalBase = ids.reduce((sum, id) => sum + Math.max(0, toNumberOrZero(baseWeightByKpi[id])), 0);
  if (totalHist <= 0 || totalBase <= 0) {
    return Object.fromEntries(ids.map((id) => [id, 1]));
  }

  const out: Record<string, number> = {};
  for (const id of ids) {
    const userShare = Math.max(0, toNumberOrZero(historicalWeeklyByKpi[id])) / totalHist;
    const baseShare = Math.max(1e-6, Math.max(0, toNumberOrZero(baseWeightByKpi[id])) / totalBase);
    const raw = Math.sqrt(userShare / baseShare);
    out[id] = Number(clampMultiplier(raw).toFixed(6));
  }
  return out;
}

export function computeCalibrationStep(input: {
  multiplierOld: number;
  sampleSize: number;
  errorRatio: number;
  attributionShare: number;
}): { multiplierNew: number; step: number; trust: number; normalizedErrorRatio: number } {
  const normalizedErrorRatio = normalizeErrorRatio(toNumberOrZero(input.errorRatio));
  const delta = normalizedErrorRatio - 1;
  const trust = Math.min(
    1,
    Math.max(0, (Math.max(0, toNumberOrZero(input.sampleSize)) + 1) / ALGO_CONSTANTS.calibration.trustWarmupSamples)
  );
  const attributionShare = clamp(toNumberOrZero(input.attributionShare), 0, 1);
  const step = ALGO_CONSTANTS.calibration.stepCoefficient * trust * delta * attributionShare;
  const multiplierNew = clampMultiplier(toNumberOrZero(input.multiplierOld) * (1 + step));
  return {
    multiplierNew: Number(multiplierNew.toFixed(6)),
    step: Number(step.toFixed(6)),
    trust: Number(trust.toFixed(6)),
    normalizedErrorRatio: Number(normalizedErrorRatio.toFixed(6)),
  };
}

export function nextRollingAverage(oldValue: number | null, sampleSize: number, newValue: number): number {
  const n = Math.max(0, Math.floor(toNumberOrZero(sampleSize)));
  const oldSafe = oldValue === null ? newValue : toNumberOrZero(oldValue);
  if (n <= 0) return Number(newValue.toFixed(6));
  const next = oldSafe + (newValue - oldSafe) / (n + 1);
  return Number(next.toFixed(6));
}

export function calibrationQualityBand(sampleSize: number): CalibrationQualityBand {
  const n = Math.max(0, Math.floor(toNumberOrZero(sampleSize)));
  if (n >= ALGO_CONSTANTS.calibration.diagnostics.highSampleMin) return "high";
  if (n >= ALGO_CONSTANTS.calibration.diagnostics.mediumSampleMin) return "medium";
  return "low";
}
