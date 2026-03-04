# Projection Lab — Schema Mapping

> Maps conceptual Projection Lab entities to current Compass KPI schema.
> Required by: `ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md` §4

## Mode 1 (In-Memory) — Current Implementation

Mode 1 runs entirely client-side with synthetic data injected into the ported engine.
No database reads or writes occur. This mapping documents the production schema
that the synthetic data models mirror.

## Entity Mapping

| Conceptual Entity | Production Table | Key Columns | Lab Equivalent |
|---|---|---|---|
| Users / settings | `public.users` | `id`, `email`, `role`, `app_metadata` | `LabUserProfile` (synthetic) |
| KPI definitions | `public.kpis` | `id`, `slug`, `name`, `unit`, `direction`, `weight_percent`, `ttc_definition`, `delay_days`, `hold_days`, `decay_days`, `gp_value`, `vp_value`, `icon_file` | `LabKpiDefinition` (synthetic) |
| KPI logs | `public.kpi_logs` | `id`, `user_id`, `kpi_id`, `event_timestamp`, `quantity`, `payoff_start_date`, `delay_days_applied`, `hold_days_applied`, `decay_days_applied`, `pc_generated`, `actual_gci_delta` | `LabLogEntry` + `LabActualClosing` (synthetic) |
| Pipeline anchors | `public.pipeline_anchor_status` | `id`, `user_id`, `anchor_type`, `value`, `updated_at` | Not used in Mode 1 (pipeline health uses synthetic ratio) |
| Calibration tracking | `public.user_kpi_calibration` | `user_id`, `kpi_id`, `multiplier`, `sample_count`, `last_error_ratio` | `CalibrationMetrics` (computed in-memory) |
| Calibration events | `public.user_kpi_calibration_events` | `id`, `user_id`, `kpi_id`, `event_type`, `old_multiplier`, `new_multiplier`, `error_ratio` | Not stored; computed per-run |

## Engine Source Mapping

| Lab Engine Module | Production Backend Source | Status |
|---|---|---|
| `app/lib/projectionLab/engine.ts` (PC timing) | `backend/src/engines/pcTimingEngine.ts` | Exact mirror |
| `app/lib/projectionLab/engine.ts` (PC timeline) | `backend/src/engines/pcTimelineEngine.ts` | Exact mirror |
| `app/lib/projectionLab/engine.ts` (GP/VP) | `backend/src/engines/gpVpEngine.ts` | Exact mirror |
| `app/lib/projectionLab/engine.ts` (constants) | `backend/src/engines/algorithmConstants.ts` | Exact mirror |
| `app/lib/projectionLab/engine.ts` (confidence) | Lab-side implementation | Follows spec bands/weights from constants |

## Mode 2 (Future — Optional)

When/if Mode 2 is implemented, dedicated `lab_*` tables would be created:

| Lab Table | Purpose |
|---|---|
| `lab_scenarios` | Scenario definitions with seed + version tags |
| `lab_runs` | Run bundle persistence with audit fields |
| `lab_golden_snapshots` | Expected output snapshots for regression |

Mode 2 is out of scope for the initial build per spec §11.

## Verification

On implementation, verify column names against current migration state.
If actual names/columns differ from this mapping, update this document first.
