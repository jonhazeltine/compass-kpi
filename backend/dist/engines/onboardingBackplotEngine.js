"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOnboardingBackplotPcEvents = buildOnboardingBackplotPcEvents;
const pcTimingEngine_1 = require("./pcTimingEngine");
function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function startOfUtcWeekMonday(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
}
function buildOnboardingBackplotPcEvents(input) {
    const { now, averagePricePoint, commissionRateDecimal, selectedKpiIds, kpiWeeklyInputs, kpiPcConfigById, } = input;
    const safeAvgPrice = Math.max(0, toNumberOrZero(averagePricePoint));
    const safeCommission = Math.max(0, toNumberOrZero(commissionRateDecimal));
    const recentWeekStart = startOfUtcWeekMonday(now);
    const backplotEnd = new Date(recentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const backplotStart = new Date(backplotEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
    const out = [];
    for (let weekStart = startOfUtcWeekMonday(backplotStart); weekStart <= backplotEnd; weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        for (const kpiId of selectedKpiIds) {
            const cfg = kpiPcConfigById[kpiId];
            if (!cfg)
                continue;
            const weekly = kpiWeeklyInputs[kpiId];
            const historicalWeeklyAverage = Math.max(0, toNumberOrZero(weekly?.historicalWeeklyAverage));
            if (historicalWeeklyAverage <= 0)
                continue;
            const initialPc = safeAvgPrice * safeCommission * Math.max(0, toNumberOrZero(cfg.pc_weight)) * historicalWeeklyAverage;
            const timing = (0, pcTimingEngine_1.resolvePcTiming)({
                ttc_days: cfg.ttc_days,
                delay_days: cfg.delay_days,
                hold_days: cfg.hold_days,
                ttc_definition: cfg.ttc_definition,
            });
            out.push({
                kpiId,
                eventTimestampIso: weekStart.toISOString(),
                initialPcGenerated: Number(initialPc.toFixed(2)),
                delayBeforePayoffStartsDays: timing.delayDays,
                holdDurationDays: timing.holdDays,
                decayDurationDays: Math.max(1, toNumberOrZero(cfg.decay_days)),
            });
        }
    }
    return out;
}
