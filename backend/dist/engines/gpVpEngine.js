"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGpVpState = computeGpVpState;
const algorithmConstants_1 = require("./algorithmConstants");
function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function diffDays(now, then) {
    return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
}
function diffHours(now, then) {
    return Math.max(0, (now.getTime() - then.getTime()) / (1000 * 60 * 60));
}
function tierForValue(points) {
    const p = Math.max(0, points);
    if (p <= algorithmConstants_1.ALGO_CONSTANTS.tiers.t1MaxInclusive)
        return 1;
    if (p <= algorithmConstants_1.ALGO_CONSTANTS.tiers.t2MaxInclusive)
        return 2;
    if (p <= algorithmConstants_1.ALGO_CONSTANTS.tiers.t3MaxInclusive)
        return 3;
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
        if (inactivityDays > algorithmConstants_1.ALGO_CONSTANTS.gp.decayTriggerInactivityDays) {
            const daysIntoDecay = inactivityDays - algorithmConstants_1.ALGO_CONSTANTS.gp.decayTriggerInactivityDays;
            const ratio = Math.max(0, 1 - daysIntoDecay / algorithmConstants_1.ALGO_CONSTANTS.gp.decayDurationDays);
            gpCurrent = gpRaw * ratio;
        }
    }
    let vpCurrent = vpRaw;
    if (latestVpTs) {
        const inactivityHours = diffHours(now, latestVpTs);
        if (inactivityHours > algorithmConstants_1.ALGO_CONSTANTS.vp.inactivityThresholdHours) {
            const dayChecks = Math.floor(inactivityHours / 24);
            vpCurrent = Math.max(algorithmConstants_1.ALGO_CONSTANTS.vp.minValue, vpRaw * Math.pow(algorithmConstants_1.ALGO_CONSTANTS.vp.dailyDecayFactor, dayChecks));
        }
    }
    const gpTier = tierForValue(gpCurrent);
    const vpTier = tierForValue(vpCurrent);
    const gpBump = algorithmConstants_1.ALGO_CONSTANTS.tiers.bumps.gp[gpTier];
    const vpBump = algorithmConstants_1.ALGO_CONSTANTS.tiers.bumps.vp[vpTier];
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
