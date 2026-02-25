# 03 Engines

## KPI Engine (Behavioral Rules)

### KPI Types
- `PC`: contributes to projected commission using configured weights and time windows.
- `GP`: contributes only to GP points/meter.
- `VP`: contributes only to VP points/meter.
- `Actual`: captures realized outcomes (e.g., Deal Closed + GCI value).
- `Pipeline_Anchor`: updates anchor counts used as forecast inputs.
- `Custom`: loggable and challenge-eligible but currency-neutral by default.

### Logging Rules
- Every log updates `users.last_activity_timestamp`.
- KPIs with `Requires_Direct_Value_Input = true` must capture `logged_value`.
- Offline logs must sync with original event time and integrity checks.

## Forecast Engine (Behavioral Rules)

### PC Base Calculation
- For PC-generating KPIs, event contribution is based on:
  - user average price point
  - user commission rate
  - KPI PC weight
  - per-user calibration multiplier (`effective_weight = pc_weight * user_multiplier`)
- TTC timing parity:
  - `ttc_definition` of `X-Y days` parses to `delay_days = X`, `hold_days = (Y-X)`.
  - `ttc_definition` of `Z days` parses to `delay_days = 0`, `hold_days = Z`.
  - Legacy `ttc_days` remains supported as fallback timing input.
- Contribution is `0` before payoff start, full through hold duration, then decays linearly over post-TTC decay duration.
- On onboarding completion (first full onboarding payload), backend seeds weekly historical synthetic PC logs (excluding the most recent week) from onboarding KPI averages, then ongoing projection is driven by real timestamped KPI logs.
- Current onboarding pipeline counts are persisted as anchor status and included as a short-horizon projection influence in the dashboard future series.
- On onboarding completion, selected PC KPIs are initialized with per-user multipliers derived from historical weekly share vs base-weight share (clamped bounds).
- On each `Actual` deal-close log, backend runs predicted-share weighted calibration updates on affected PC KPI multipliers.

### Adaptive PC Calibration
- Calibration state per user/KPI:
  - `multiplier` (bounded)
  - `sample_size`
  - rolling error diagnostics (`rolling_error_ratio`, `rolling_abs_pct_error`)
- Update loop trigger:
  - `Actual` log with positive GCI delta.
- Attribution:
  - weighted by predicted share of overlapping PC contributions at close timestamp.
- Stability controls:
  - bounded error ratio input
  - trust warmup by sample size
  - bounded multiplier output
- Calibration influences projection generation only.
- Confidence formula remains unchanged; calibration diagnostics are additive explainability metadata.

### Confidence Layer
- Forecast Confidence is calculated from backend inputs (e.g., historical accuracy, pipeline health, inactivity).
- Confidence affects display (color/gauge/overlay/coaching context), not base PC values.
- Formula lock + traceability reference: `docs/spec/appendix/ALGORITHM_SPEC_LOCK.md`.

### Pipeline Anchors
- `Listings Pending` and `Buyers UC` are required forecast inputs.
- Anchor relevance window is short-term (specified in spec as 30-day influence window).

## Challenge Engine (Behavioral Rules)
- Challenge progress is derived from KPI logs mapped to challenge KPI sets.
- Supports solo and team challenge modes.
- Handles late-add behavior with explicit policy on prior-log inclusion.
- Sponsored challenges use normal participation mechanics plus sponsor metadata + optional CTA tracking.

## Rule Constraints (Non-Negotiables Mapped)
- PC vs Actual GCI must remain separate in data model and UI.
- GP/VP must not generate PC.
- Forecast Confidence must not mutate base projection numbers.
- Pipeline Anchors are mandatory inputs for forecast confidence context.

## Addendum Integration (2026-02-25) — Projection Integrity + Projection Lab (Planned)

References:
- `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_1_PROJECTION_INTEGRITY_CALIBRATION.md`
- `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md`

Status:
- `spec-integrated, implementation deferred`
- This section records accepted behavioral direction and supersedes earlier wording where explicitly noted.

### Forecast Engine Extensions (Planned)
- Calibration model remains `effective_weight = pc_weight * user_multiplier` and preserves current TTC/decay timeline logic.
- Forecast generation must preserve source provenance separation for projection inputs:
  - `real` (user-entered logs)
  - `seeded_history` (onboarding synthetic backplot)
  - `provider_forecast` (continuity projection; forecast-only source)
- Continuity Projection (optional, admin/config toggled) may provide forecast-only future inputs to prevent an artificially empty 6-12 month horizon.
- Provider continuity inputs are forecast-only and must not:
  - appear as historical user logs,
  - count toward leaderboards/challenges,
  - affect GP/VP,
  - train calibration as ground truth.
- Real user logs override/replace overlapping continuity-forecast inputs in projection computation.

### Onboarding Completion Behavior (Planned Revision)
- Onboarding data model is split into:
  - `baseline` KPI quantities (history-anchored; used for seed/init)
  - `target` KPI quantities (planning-only; no historical seed contamination)
- Baseline coverage is evaluated using the real projection engine against last-12-month actual GCI.
- Baseline outputs drive:
  - onboarding tail seeding
  - continuity projection defaults
  - conservative calibration initialization
- Target outputs drive planning/coaching/what-if only and do not write into historical log stores.

### Confidence Layer Extension (Planned)
- Base confidence formula remains unchanged and display-layer only.
- Add horizon-specific continuity modifier (per `PC_30`, `PC_90`, `PC_365`) based on forecast reliance share from `provider_forecast`.
- Confidence should reflect demonstrated predictiveness and calibration trust quality, not raw KPI count.

### Logging / Integrity Requirements (Planned)
- Synthetic seeded events must be distinguishable from user-entered logs (flags/metadata/provenance).
- Forecast-only provider continuity inputs must remain isolated from competitive scoring, analytics truth loops, and calibration training.

### Admin Projection Lab (Planned A3/A4)
- Admin-only simulation/regression harness will run the real KPI→PC algorithm on synthetic inputs.
- Projection Lab is a testing/integrity layer (mock inputs only), not a replacement algorithm path.
