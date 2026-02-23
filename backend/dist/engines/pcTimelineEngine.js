"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentPcValueForEventAtDate = currentPcValueForEventAtDate;
exports.aggregateProjectedPcAtDate = aggregateProjectedPcAtDate;
exports.buildFutureProjected12mSeries = buildFutureProjected12mSeries;
exports.buildPastActual6mSeries = buildPastActual6mSeries;
exports.derivePc90dFromFutureSeries = derivePc90dFromFutureSeries;
const algorithmConstants_1 = require("./algorithmConstants");
function startOfUtcDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function startOfUtcMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
function endOfUtcMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}
function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}
function addMonths(date, months) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}
function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function currentPcValueForEventAtDate(event, currentDate) {
    const eventDate = startOfUtcDay(new Date(event.eventTimestampIso));
    if (Number.isNaN(eventDate.getTime()))
        return 0;
    const initial = toNumberOrZero(event.initialPcGenerated);
    if (initial <= 0)
        return 0;
    const delayDays = Math.max(0, toNumberOrZero(event.delayBeforePayoffStartsDays));
    const holdDays = Math.max(0, toNumberOrZero(event.holdDurationDays));
    const decayDays = Math.max(1, toNumberOrZero(event.decayDurationDays ?? algorithmConstants_1.ALGO_CONSTANTS.pc.defaultDecayDays));
    const payoffStart = addDays(eventDate, delayDays);
    const decayStart = addDays(payoffStart, holdDays);
    const nowDay = startOfUtcDay(currentDate);
    if (nowDay.getTime() < payoffStart.getTime())
        return 0;
    if (nowDay.getTime() < decayStart.getTime())
        return initial;
    const daysIntoDecay = Math.floor((nowDay.getTime() - decayStart.getTime()) / (1000 * 60 * 60 * 24));
    if (daysIntoDecay >= decayDays)
        return 0;
    const remaining = initial * (1 - daysIntoDecay / decayDays);
    return Math.max(0, remaining);
}
function aggregateProjectedPcAtDate(events, currentDate) {
    return events.reduce((sum, event) => sum + currentPcValueForEventAtDate(event, currentDate), 0);
}
function buildFutureProjected12mSeries(events, now, bumpPercent) {
    const monthStart = startOfUtcMonth(now);
    const safeBump = Math.max(0, toNumberOrZero(bumpPercent));
    return Array.from({ length: 12 }).map((_, i) => {
        const month = addMonths(monthStart, i + 1);
        const pointDate = endOfUtcMonth(month);
        const raw = aggregateProjectedPcAtDate(events, pointDate);
        const bumped = raw * (1 + safeBump);
        return {
            month_start: month.toISOString(),
            value: Number(bumped.toFixed(2)),
        };
    });
}
function buildPastActual6mSeries(actualLogs, now) {
    const monthStart = startOfUtcMonth(now);
    const months = Array.from({ length: 6 }).map((_, i) => addMonths(monthStart, i - 5));
    return months.map((month) => {
        const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
        const value = actualLogs.reduce((sum, log) => {
            const dt = new Date(log.event_timestamp);
            if (Number.isNaN(dt.getTime()))
                return sum;
            const logKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
            if (logKey !== key)
                return sum;
            return sum + toNumberOrZero(log.actual_gci_delta);
        }, 0);
        return {
            month_start: month.toISOString(),
            value: Number(value.toFixed(2)),
        };
    });
}
function derivePc90dFromFutureSeries(futureProjected12m) {
    const firstThree = futureProjected12m.slice(0, 3).reduce((sum, row) => sum + toNumberOrZero(row.value), 0);
    return Number(firstThree.toFixed(2));
}
