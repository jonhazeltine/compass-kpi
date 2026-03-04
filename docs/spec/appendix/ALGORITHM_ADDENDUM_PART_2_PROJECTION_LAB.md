# Algorithm Addendum Part 2 — Projection Lab (Admin Simulation + Regression)

## Canonical Integration Status (2026-03-04)
- Status: `planned / spec-integrated, implementation deferred`
- Sprint alignment: `A3` build target, `A4` hardening/regression (already mapped in `CURRENT_SPRINT.md`)
- Scope type for this document: implementation-ready roadmap (no runtime code change by this doc alone)

## 0) Context + Goal
Projection Lab is an admin-only harness around the real projection engine. It exists to test projection behavior with synthetic inputs, compare algorithm versions, and detect regressions without corrupting production user data.

Projection Lab is not a separate calculator and must not fork algorithm math from production.

## 1) Explicit Problems To Solve
- `P1` No safe place to test algorithm changes: need synthetic scenarios isolated from production user activity.
- `P2` No repeatability: need deterministic seeded scenarios that reproduce exactly.
- `P3` No regression detection: need golden scenarios + thresholded pass/fail.
- `P4` No explainability: need per-event timeline and contribution breakdown.
- `P5` No calibration sandbox: need synthetic actuals + error metrics to evaluate calibration behavior.

## 2) Baseline Algorithm Contract (Do Not Redefine)
Projection Lab must use current canonical algorithm behavior from repo docs/engine modules.

### 2.1 Initial PC value per PC log event
`Initial_PC_Generated = User_Average_Price_Point * User_Commission_Rate * PC_Weight_Percent`

### 2.2 Timeline behavior from TTC
- Range `X-Y days`: delay = `X`, hold = `Y - X`
- Single `Z days`: delay = `0`, hold = `Z`

For each event:
- `payoff_start = log_date + delay`
- `decay_start = log_date + delay + hold`

### 2.3 Decay behavior (linear)
Within decay window:
`Current_Decayed_PC_Value = max(0, Initial_PC_Generated * (1 - Days_Into_Decay / Total_Decay_Duration_Days))`

Phase rules:
- before payoff start -> contributes `0`
- hold window -> contributes full `Initial_PC_Generated`
- after full decay -> contributes `0`

### 2.4 Confidence model support
Lab must support confidence display and component drill-down using existing/planned confidence structure.

### 2.5 Onboarding back-plot mechanism
Lab must support onboarding/back-plot style scenario generation and replay through the same timeline/decay path.

## 3) Sprint + Scope Guardrails
- In-scope planning target: `A3/A4` admin track.
- No change to non-negotiables.
- No production KPI log writes by default.
- No endpoint-family sprawl outside approved admin/projection-lab surface.
- Structural changes (new route family/tables) must be logged in `architecture/DECISIONS_LOG.md` in the same implementation change set.

## 4) Schema Mapping Requirement (Environment-Tuned)
Projection Lab implementation must not assume names blindly; map conceptual entities to current schema explicitly.

Create a mapping artifact:
- `docs/spec/appendix/PROJECTION_LAB_SCHEMA_MAPPING.md` (or backend constant module)

Conceptual -> expected current candidates (verify on implementation):
- `Users/settings` -> `public.users`
- `KPI definitions` -> `public.kpis`
- `KPI logs` -> `public.kpi_logs`
- `Pipeline anchors` -> `public.pipeline_anchor_status`
- `Calibration tracking` -> `public.user_kpi_calibration`, `public.user_kpi_calibration_events`

If actual names/columns differ, implementation must update the mapping artifact first.

## 5) Architecture (Admin Module)
Projection Lab module split:
- `A) Scenario Builder`
- `B) Scenario Runner`
- `C) Results Explorer`
- `D) Golden Tests + Regression`
- `E) Calibration Sandbox`
- `F) Audit + Safety`

### 5.A Scenario Builder
Scenario JSON includes:
- synthetic user profile
- KPI subset with TTC + weights
- synthetic log stream over date range
- optional synthetic actual closings
- seed/version tags

Required storage fields:
- `scenario_id`, `seed`, `created_by_admin`, `created_at`, version tags

### 5.B Runner
Runs real engine with injected data.

Mode choice:
- `Mode 1 (v1 required)`: in-memory injection (recommended)
- `Mode 2 (optional later)`: dedicated `lab_*` tables via DAL switch

Runner output bundle minimum:
- PC time series
- per-event contribution breakdown
- event phase diagnostics (delay/hold/decay)
- confidence + components (where available)
- display-time modifiers separated from raw PC

### 5.C Results Explorer
Admin UI views:
- summary cards (`30/90/180` + selected-date PC)
- graph: raw vs modifier-applied overlay
- contribution drilldown by event
- run diff (`A vs B`) with top change drivers
- JSON/CSV export

### 5.D Golden + Regression Harness
- golden scenario flag
- expected output snapshot per algorithm version
- thresholded regression runner with pass/fail report

### 5.E Calibration Sandbox
- synthetic actual closings
- error metrics (standardized formula)
- lab-only metric writes unless explicitly promoted

### 5.F Audit + Safety
Required:
- admin-only gate
- environment banner (`PROD`/`STAGING`)
- hard default: production KPI-log writes disabled
- run audit fields: admin, scenario, version, timestamp, seed, checksum

## 6) Route / Screen Map (Admin)
Planned structure:
- `/admin/projection-lab/scenarios`
- `/admin/projection-lab/scenarios/new`
- `/admin/projection-lab/scenarios/:id`
- `/admin/projection-lab/runs/:id`
- `/admin/projection-lab/compare`
- `/admin/projection-lab/golden`
- `/admin/projection-lab/settings`

Implementation note:
- Existing admin shell is route/state-driven; add route keys to `app/lib/adminAuthz.ts` when implementation starts.

## 7) Sequenced Implementation Plan
1. Extract/lock callable engine boundary used by runtime and lab.
2. Define scenario JSON schema + seeded generator.
3. Implement in-memory runner and run bundle persistence.
4. Build minimal admin UI (scenario list/create/run, run detail, compare).
5. Implement golden harness and threshold config.
6. Add calibration sandbox metrics.
7. Add CI/manual regression command + report artifact.

## 8) Done Criteria
- `D1` Shared callable engine boundary used by runtime and lab.
- `D2` Deterministic scenario generation by seed.
- `D3` Run detail has series + event-level timeline breakdown.
- `D4` Compare-runs identifies deltas + top drivers.
- `D5` Golden harness produces pass/fail report with thresholds.
- `D6` Safety controls enforced (no prod writes by default, admin-only, audited runs).

## 9) Acceptance Harness Alignment
Projection Lab remains mapped to acceptance scenario `#28` and A3/A4 harness rows in:
- `docs/spec/05_acceptance_tests.md`

When implementation starts, expand scenario `#28` with concrete route-level checks and regression thresholds.

## 10) Claude Assignment Hand-Off (Ready Block)
When launching Claude for implementation, include these constraints:
- implement against this roadmap and current engine contracts
- mode 1 (in-memory runner) first
- no production KPI-log writes by default
- keep display modifiers separate from raw PC values
- update `DECISIONS_LOG.md` with any structural changes
- provide deterministic validation artifacts (scenario seed + run checksum + diff report)

## 11) Out-of-Scope For Initial Build
- replacing core projection math
- broad team-level simulation parity
- production write mode enablement
- non-admin user-facing Projection Lab surfaces
