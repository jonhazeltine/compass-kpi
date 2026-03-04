/**
 * Projection Lab — Type Definitions
 *
 * Canonical types for the admin-only projection simulation harness.
 * Spec: docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md
 */

// ── Scenario Builder ──────────────────────────────────

export type LabKpiDefinition = {
  kpi_id: string;
  name: string;
  unit: string;
  weight_percent: number;
  ttc_definition: string | null;
  delay_days: number | null;
  hold_days: number | null;
  decay_days: number | null;
  gp_value: number;
  vp_value: number;
  direction: 'higher_is_better' | 'lower_is_better';
};

export type LabUserProfile = {
  user_id: string;
  display_name: string;
  average_price_point: number;
  commission_rate: number;
};

export type LabLogEntry = {
  log_id: string;
  kpi_id: string;
  event_date_iso: string;
  quantity: number;
  /** Pre-computed or overridden initial PC for this event */
  initial_pc_override?: number;
  /** Optional GP points for this event */
  gp_points?: number;
  /** Optional VP points for this event */
  vp_points?: number;
};

export type LabActualClosing = {
  closing_id: string;
  event_date_iso: string;
  actual_gci_delta: number;
};

export type LabScenario = {
  scenario_id: string;
  seed: number;
  name: string;
  description: string;
  created_by_admin: string;
  created_at: string;
  algorithm_version: string;
  user_profile: LabUserProfile;
  kpi_definitions: LabKpiDefinition[];
  log_stream: LabLogEntry[];
  actual_closings: LabActualClosing[];
  is_golden: boolean;
  tags: string[];
};

// ── Runner Output ─────────────────────────────────────

export type EventPhase = 'before_payoff' | 'hold' | 'decay' | 'expired';

export type EventPhaseDiagnostic = {
  log_id: string;
  kpi_id: string;
  kpi_name: string;
  event_date_iso: string;
  initial_pc: number;
  delay_days: number;
  hold_days: number;
  decay_days: number;
  payoff_start_iso: string;
  decay_start_iso: string;
  full_decay_iso: string;
  phase_at_eval: EventPhase;
  current_value: number;
};

export type MonthlySeriesPoint = {
  month_start: string;
  value: number;
};

export type ConfidenceComponents = {
  historicalAccuracy: number;
  pipelineHealth: number;
  inactivity: number;
  composite: number;
  band: 'green' | 'yellow' | 'red';
};

export type GpVpSnapshot = {
  gp_raw: number;
  gp_current: number;
  vp_raw: number;
  vp_current: number;
  gp_tier: 1 | 2 | 3 | 4;
  vp_tier: 1 | 2 | 3 | 4;
  gp_bump_percent: number;
  vp_bump_percent: number;
  total_bump_percent: number;
};

export type RunBundle = {
  run_id: string;
  scenario_id: string;
  algorithm_version: string;
  eval_date_iso: string;
  created_at: string;
  admin_user: string;
  seed: number;
  checksum: string;

  // Summary values
  pc_30d: number;
  pc_90d: number;
  pc_180d: number;
  pc_at_eval_date: number;

  // Time series
  future_projected_12m: MonthlySeriesPoint[];
  past_actual_6m: MonthlySeriesPoint[];

  // Raw vs modifier-applied
  raw_pc_at_eval: number;
  bump_applied_pc_at_eval: number;
  calibration_multiplier: number;

  // Per-event breakdown
  event_contributions: EventPhaseDiagnostic[];

  // GP/VP state
  gp_vp: GpVpSnapshot;

  // Confidence
  confidence: ConfidenceComponents;

  // Safety
  production_writes_enabled: false;
};

// ── Golden Test ───────────────────────────────────────

export type GoldenExpectedOutput = {
  pc_30d: number;
  pc_90d: number;
  pc_180d: number;
  tolerance_percent: number;
};

export type GoldenTestResult = {
  scenario_id: string;
  scenario_name: string;
  algorithm_version: string;
  passed: boolean;
  expected: GoldenExpectedOutput;
  actual: { pc_30d: number; pc_90d: number; pc_180d: number };
  deltas: { pc_30d_pct: number; pc_90d_pct: number; pc_180d_pct: number };
};

export type RegressionReport = {
  report_id: string;
  created_at: string;
  algorithm_version: string;
  total_scenarios: number;
  passed: number;
  failed: number;
  results: GoldenTestResult[];
};

// ── Calibration Sandbox ───────────────────────────────

export type CalibrationMetrics = {
  actual_total: number;
  projected_total: number;
  error_ratio: number;
  absolute_error: number;
  current_multiplier: number;
  adjusted_multiplier: number;
};

// ── Run Comparison ────────────────────────────────────

export type RunComparisonDelta = {
  field: string;
  run_a_value: number;
  run_b_value: number;
  delta: number;
  delta_percent: number;
};

export type RunComparison = {
  run_a_id: string;
  run_b_id: string;
  top_drivers: RunComparisonDelta[];
  summary_deltas: RunComparisonDelta[];
};

// ── UI State ──────────────────────────────────────────

export type LabView =
  | 'scenario_list'
  | 'scenario_create'
  | 'scenario_detail'
  | 'run_detail'
  | 'compare'
  | 'golden'
  | 'settings';
