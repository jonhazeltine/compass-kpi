#!/usr/bin/env node
/* eslint-disable no-console */
const { buildFutureProjected12mSeries, buildPastActual6mSeries, derivePc90dFromFutureSeries, currentPcValueForEventAtDate } = require("../dist/engines/pcTimelineEngine");
const { computeConfidence } = require("../dist/engines/confidenceEngine");
const { computeGpVpState } = require("../dist/engines/gpVpEngine");
const { buildOnboardingBackplotPcEvents } = require("../dist/engines/onboardingBackplotEngine");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function closeEnough(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function runPcTimelineChecks() {
  const event = {
    eventTimestampIso: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    initialPcGenerated: 1000,
    holdDurationDays: 10,
    decayDurationDays: 20,
  };
  const before = currentPcValueForEventAtDate(event, new Date(Date.UTC(2025, 11, 31)));
  const hold = currentPcValueForEventAtDate(event, new Date(Date.UTC(2026, 0, 5)));
  const decayMid = currentPcValueForEventAtDate(event, new Date(Date.UTC(2026, 0, 21)));
  const decayedOut = currentPcValueForEventAtDate(event, new Date(Date.UTC(2026, 1, 5)));

  assert(before === 0, "PC timeline: value should be 0 before event");
  assert(hold === 1000, "PC timeline: value should be full during hold");
  closeEnough(decayMid, 500, 10, "PC timeline: mid decay value");
  assert(decayedOut === 0, "PC timeline: value should be 0 after decay");

  const future = buildFutureProjected12mSeries([event], new Date(Date.UTC(2026, 0, 1)), 0.1);
  assert(future.length === 12, "PC timeline: future series should have 12 points");
  const pc90d = derivePc90dFromFutureSeries(future);
  assert(pc90d >= 0, "PC timeline: 90d projection should be non-negative");

  const actualSeries = buildPastActual6mSeries([
    { event_timestamp: new Date(Date.UTC(2025, 7, 2)).toISOString(), actual_gci_delta: 10000 },
    { event_timestamp: new Date(Date.UTC(2025, 8, 2)).toISOString(), actual_gci_delta: 5000 },
  ], new Date(Date.UTC(2026, 0, 15)));
  assert(actualSeries.length === 6, "PC timeline: past actual series should have 6 points");

  const delayedEvent = {
    eventTimestampIso: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    initialPcGenerated: 1000,
    delayBeforePayoffStartsDays: 90,
    holdDurationDays: 30,
    decayDurationDays: 180,
  };
  const beforeDelay = currentPcValueForEventAtDate(delayedEvent, new Date(Date.UTC(2026, 1, 1)));
  const inHold = currentPcValueForEventAtDate(delayedEvent, new Date(Date.UTC(2026, 3, 5)));
  assert(beforeDelay === 0, "PC timeline: delayed event should be zero before payoff start");
  assert(inHold === 1000, "PC timeline: delayed event should be full in hold window");
}

function runConfidenceChecks() {
  const now = new Date(Date.UTC(2026, 1, 1));
  const pcEvents = [
    {
      eventTimestampIso: new Date(Date.UTC(2025, 6, 1)).toISOString(),
      initialPcGenerated: 10000,
      holdDurationDays: 30,
      decayDurationDays: 180,
    },
  ];
  const actualLogs = [
    { event_timestamp: new Date(Date.UTC(2025, 6, 15)).toISOString(), actual_gci_delta: 9000 },
  ];
  const anchors = [{ anchor_value: 3 }];

  const result = computeConfidence({
    now,
    lastActivityTimestampIso: new Date(Date.UTC(2026, 0, 20)).toISOString(),
    actualLogs,
    pcEvents,
    anchors,
    averagePricePoint: 300000,
    commissionRateDecimal: 0.025,
  });

  assert(result.score >= 0 && result.score <= 100, "confidence: score should be 0-100");
  assert(["green", "yellow", "red"].includes(result.band), "confidence: band should be valid");
  assert(typeof result.components.historical_accuracy_score === "number", "confidence: HA score missing");
  assert(typeof result.components.pipeline_health_score === "number", "confidence: PH score missing");
  assert(typeof result.components.inactivity_score === "number", "confidence: IN score missing");
}

function runGpVpChecks() {
  const now = new Date(Date.UTC(2026, 1, 1));
  const gpState = computeGpVpState({
    now,
    gpLogs: [
      { event_timestamp: new Date(Date.UTC(2025, 10, 1)).toISOString(), points_generated: 400 },
    ],
    vpLogs: [
      { event_timestamp: new Date(Date.UTC(2026, 0, 31)).toISOString(), points_generated: 200 },
    ],
  });

  assert(gpState.gp_current <= gpState.gp_raw, "GP/VP: GP decay should not increase value");
  assert(gpState.vp_current <= gpState.vp_raw, "GP/VP: VP decay should not increase value");
  assert(gpState.total_bump_percent >= 0, "GP/VP: bump percent should be non-negative");
}

function runBackplotChecks() {
  const now = new Date(Date.UTC(2026, 1, 1));
  const events = buildOnboardingBackplotPcEvents({
    now,
    averagePricePoint: 300000,
    commissionRateDecimal: 0.025,
    selectedKpiIds: ["kpi_a"],
    kpiWeeklyInputs: {
      kpi_a: { historicalWeeklyAverage: 2, targetWeeklyCount: 3 },
    },
    kpiPcConfigById: {
      kpi_a: { pc_weight: 0.1, delay_days: 60, hold_days: 30, ttc_days: 90, decay_days: 180 },
    },
  });

  assert(events.length > 40, "backplot: should generate weekly synthetic events over ~1 year");
  assert(events.every((e) => e.initialPcGenerated > 0), "backplot: synthetic events should have positive PC");
}

function main() {
  runPcTimelineChecks();
  runConfidenceChecks();
  runGpVpChecks();
  runBackplotChecks();
  console.log("Algorithm acceptance checks passed.");
}

main();
