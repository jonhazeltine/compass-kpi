"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALGO_CONSTANTS = void 0;
exports.ALGO_CONSTANTS = {
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
                { minInclusive: Number.NEGATIVE_INFINITY, maxInclusive: 0.499999, score: 20 },
                { minInclusive: 0.5, maxInclusive: 0.799999, score: 45 },
                { minInclusive: 0.8, maxInclusive: 1.2, score: 90 },
                { minInclusive: 1.200001, maxInclusive: 1.75, score: 95 },
                { minInclusive: 1.750001, maxInclusive: Number.POSITIVE_INFINITY, score: 85 },
            ],
        },
        pipelineHealth: {
            forecastWindowDays: 45,
            noProjectionNoPipelineScore: 10,
            noProjectionWithPipelineScore: 85,
            bands: [
                { minInclusive: Number.NEGATIVE_INFINITY, maxInclusive: 0.499999, score: 15 },
                { minInclusive: 0.5, maxInclusive: 0.799999, score: 40 },
                { minInclusive: 0.8, maxInclusive: 1.5, score: 90 },
                { minInclusive: 1.500001, maxInclusive: Number.POSITIVE_INFINITY, score: 95 },
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
            gp: {
                1: 0,
                2: 0.025,
                3: 0.05,
                4: 0.075,
            },
            vp: {
                1: 0,
                2: 0.02,
                3: 0.04,
                4: 0.06,
            },
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
};
