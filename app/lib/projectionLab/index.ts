/**
 * Projection Lab — Public API
 */

export * from './types';
export {
  ALGO_CONSTANTS,
  parseTtcDefinition,
  resolvePcTiming,
  currentPcValueForEventAtDate,
  aggregateProjectedPcAtDate,
  buildFutureProjected12mSeries,
  buildPastActual6mSeries,
  derivePc90dFromFutureSeries,
  computeGpVpState,
  computeConfidence,
  classifyEventPhase,
} from './engine';
export type {
  PcTimingInput,
  ResolvedPcTiming,
  PcEvent,
  GpVpEngineSnapshot,
} from './engine';
export { generateScenario, ALGORITHM_VERSION } from './scenarioGenerator';
export { executeRun, computeCalibrationMetrics, compareRuns } from './runner';
export {
  registerGoldenScenario,
  removeGoldenScenario,
  getGoldenScenarios,
  getGoldenScenarioById,
  runGoldenTest,
  runRegressionSuite,
  captureGoldenSnapshot,
} from './golden';
export type { GoldenScenarioEntry } from './golden';
