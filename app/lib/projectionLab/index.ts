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
export { generateScenario, generateScenarioFromProfile, generateScenarioFromVolume, convertScenarioProfileToAgentProfile, generateRealisticClosings, rebuildLogStreamFromVolumes, adminKpiToLabDef, ALGORITHM_VERSION, SCENARIO_PROFILES, PC_KPI_TEMPLATES, BUILTIN_AGENT_PROFILES } from './scenarioGenerator';
export type { ScenarioProfile } from './scenarioGenerator';
export { executeRun, computeCalibrationMetrics, compareRuns, computePerKpiSeries, buildProjectedIncomeSeries, buildActualBaselineSeries, computeRollingAverage, scenarioToPcEvents } from './runner';
export type { KpiMonthlySeries } from './runner';
export {
  measureKpiCadence,
  generateSyntheticFutureEvents,
  buildCadenceProjectedSeries,
  computeCadenceConfidenceBand,
} from './cadenceProjection';
export type { KpiCadence, CadenceMeasurement, CadenceConfidenceMeta } from './cadenceProjection';
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
