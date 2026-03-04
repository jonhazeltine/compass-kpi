/**
 * Projection Lab — Golden Test + Regression Harness
 *
 * Validates deterministic scenarios against expected output snapshots
 * with configurable tolerance thresholds.
 */

import type {
  LabScenario,
  GoldenExpectedOutput,
  GoldenTestResult,
  RegressionReport,
  RunBundle,
} from './types';
import { executeRun } from './runner';
import { ALGORITHM_VERSION } from './scenarioGenerator';

// ── Golden Scenario Storage (in-memory for mode 1) ────

export type GoldenScenarioEntry = {
  scenario: LabScenario;
  expected: GoldenExpectedOutput;
};

const goldenStore: Map<string, GoldenScenarioEntry> = new Map();

export function registerGoldenScenario(
  scenario: LabScenario,
  expected: GoldenExpectedOutput
): void {
  goldenStore.set(scenario.scenario_id, {
    scenario: { ...scenario, is_golden: true },
    expected,
  });
}

export function removeGoldenScenario(scenarioId: string): boolean {
  return goldenStore.delete(scenarioId);
}

export function getGoldenScenarios(): GoldenScenarioEntry[] {
  return Array.from(goldenStore.values());
}

export function getGoldenScenarioById(
  scenarioId: string
): GoldenScenarioEntry | undefined {
  return goldenStore.get(scenarioId);
}

// ── Golden Test Runner ────────────────────────────────

function pctDelta(expected: number, actual: number): number {
  if (expected === 0 && actual === 0) return 0;
  if (expected === 0) return actual > 0 ? 100 : -100;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

export function runGoldenTest(
  entry: GoldenScenarioEntry,
  adminUser: string,
  evalDate?: Date
): GoldenTestResult {
  const run: RunBundle = executeRun({
    scenario: entry.scenario,
    evalDate,
    adminUser,
  });

  const { expected, scenario } = entry;
  const actual = {
    pc_30d: run.pc_30d,
    pc_90d: run.pc_90d,
    pc_180d: run.pc_180d,
  };

  const deltas = {
    pc_30d_pct: Number(pctDelta(expected.pc_30d, actual.pc_30d).toFixed(2)),
    pc_90d_pct: Number(pctDelta(expected.pc_90d, actual.pc_90d).toFixed(2)),
    pc_180d_pct: Number(pctDelta(expected.pc_180d, actual.pc_180d).toFixed(2)),
  };

  const tolerance = expected.tolerance_percent;
  const passed =
    Math.abs(deltas.pc_30d_pct) <= tolerance &&
    Math.abs(deltas.pc_90d_pct) <= tolerance &&
    Math.abs(deltas.pc_180d_pct) <= tolerance;

  return {
    scenario_id: scenario.scenario_id,
    scenario_name: scenario.name,
    algorithm_version: scenario.algorithm_version,
    passed,
    expected,
    actual,
    deltas,
  };
}

// ── Regression Runner ─────────────────────────────────

export function runRegressionSuite(
  adminUser: string,
  evalDate?: Date
): RegressionReport {
  const entries = getGoldenScenarios();
  const results = entries.map((entry) =>
    runGoldenTest(entry, adminUser, evalDate)
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    report_id: `regression-${Date.now().toString(36)}`,
    created_at: new Date().toISOString(),
    algorithm_version: ALGORITHM_VERSION,
    total_scenarios: results.length,
    passed,
    failed,
    results,
  };
}

// ── Snapshot Creator (captures expected output from a run) ──

export function captureGoldenSnapshot(
  run: RunBundle,
  tolerancePercent: number = 5
): GoldenExpectedOutput {
  return {
    pc_30d: run.pc_30d,
    pc_90d: run.pc_90d,
    pc_180d: run.pc_180d,
    tolerance_percent: tolerancePercent,
  };
}
