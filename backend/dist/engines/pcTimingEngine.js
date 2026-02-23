"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTtcDefinition = parseTtcDefinition;
exports.resolvePcTiming = resolvePcTiming;
function toFiniteNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return null;
    return parsed;
}
function toWholeNonNegative(value) {
    const parsed = toFiniteNumber(value);
    if (parsed === null)
        return null;
    return Math.max(0, Math.round(parsed));
}
function parseTtcDefinition(ttcDefinition) {
    if (typeof ttcDefinition !== "string")
        return null;
    const raw = ttcDefinition.trim();
    if (!raw)
        return null;
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
        return {
            delayDays: 0,
            holdDays: total,
            totalTtcDays: total,
        };
    }
    return null;
}
function resolvePcTiming(input) {
    const parsedFromDefinition = parseTtcDefinition(input.ttc_definition ?? null);
    const delayDays = toWholeNonNegative(input.delay_days) ??
        parsedFromDefinition?.delayDays ??
        0;
    const holdDays = toWholeNonNegative(input.hold_days) ??
        parsedFromDefinition?.holdDays ??
        (() => {
            const fallbackTtc = toWholeNonNegative(input.ttc_days) ?? 0;
            return Math.max(0, fallbackTtc - delayDays);
        })();
    const totalTtcDays = toWholeNonNegative(input.ttc_days) ??
        parsedFromDefinition?.totalTtcDays ??
        (delayDays + holdDays);
    return {
        delayDays,
        holdDays,
        totalTtcDays: Math.max(totalTtcDays, delayDays + holdDays),
    };
}
