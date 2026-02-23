"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampMultiplier = clampMultiplier;
exports.normalizeErrorRatio = normalizeErrorRatio;
exports.computeInitializationMultipliers = computeInitializationMultipliers;
exports.computeCalibrationStep = computeCalibrationStep;
exports.nextRollingAverage = nextRollingAverage;
exports.calibrationQualityBand = calibrationQualityBand;
const algorithmConstants_1 = require("./algorithmConstants");
function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function clampMultiplier(value) {
    return clamp(value, algorithmConstants_1.ALGO_CONSTANTS.calibration.multiplierMin, algorithmConstants_1.ALGO_CONSTANTS.calibration.multiplierMax);
}
function normalizeErrorRatio(errorRatio) {
    return clamp(errorRatio, algorithmConstants_1.ALGO_CONSTANTS.calibration.errorRatioMin, algorithmConstants_1.ALGO_CONSTANTS.calibration.errorRatioMax);
}
function computeInitializationMultipliers(input) {
    const { selectedPcKpiIds, historicalWeeklyByKpi, baseWeightByKpi } = input;
    const ids = selectedPcKpiIds.filter((id) => !!id);
    if (ids.length === 0)
        return {};
    const totalHist = ids.reduce((sum, id) => sum + Math.max(0, toNumberOrZero(historicalWeeklyByKpi[id])), 0);
    const totalBase = ids.reduce((sum, id) => sum + Math.max(0, toNumberOrZero(baseWeightByKpi[id])), 0);
    if (totalHist <= 0 || totalBase <= 0) {
        return Object.fromEntries(ids.map((id) => [id, 1]));
    }
    const out = {};
    for (const id of ids) {
        const userShare = Math.max(0, toNumberOrZero(historicalWeeklyByKpi[id])) / totalHist;
        const baseShare = Math.max(1e-6, Math.max(0, toNumberOrZero(baseWeightByKpi[id])) / totalBase);
        const raw = Math.sqrt(userShare / baseShare);
        out[id] = Number(clampMultiplier(raw).toFixed(6));
    }
    return out;
}
function computeCalibrationStep(input) {
    const normalizedErrorRatio = normalizeErrorRatio(toNumberOrZero(input.errorRatio));
    const delta = normalizedErrorRatio - 1;
    const trust = Math.min(1, Math.max(0, (Math.max(0, toNumberOrZero(input.sampleSize)) + 1) / algorithmConstants_1.ALGO_CONSTANTS.calibration.trustWarmupSamples));
    const attributionShare = clamp(toNumberOrZero(input.attributionShare), 0, 1);
    const step = algorithmConstants_1.ALGO_CONSTANTS.calibration.stepCoefficient * trust * delta * attributionShare;
    const multiplierNew = clampMultiplier(toNumberOrZero(input.multiplierOld) * (1 + step));
    return {
        multiplierNew: Number(multiplierNew.toFixed(6)),
        step: Number(step.toFixed(6)),
        trust: Number(trust.toFixed(6)),
        normalizedErrorRatio: Number(normalizedErrorRatio.toFixed(6)),
    };
}
function nextRollingAverage(oldValue, sampleSize, newValue) {
    const n = Math.max(0, Math.floor(toNumberOrZero(sampleSize)));
    const oldSafe = oldValue === null ? newValue : toNumberOrZero(oldValue);
    if (n <= 0)
        return Number(newValue.toFixed(6));
    const next = oldSafe + (newValue - oldSafe) / (n + 1);
    return Number(next.toFixed(6));
}
function calibrationQualityBand(sampleSize) {
    const n = Math.max(0, Math.floor(toNumberOrZero(sampleSize)));
    if (n >= algorithmConstants_1.ALGO_CONSTANTS.calibration.diagnostics.highSampleMin)
        return "high";
    if (n >= algorithmConstants_1.ALGO_CONSTANTS.calibration.diagnostics.mediumSampleMin)
        return "medium";
    return "low";
}
