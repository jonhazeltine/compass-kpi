# Algorithm Spec Lock (M3)

Canonical source: `docs/spec/appendix/Master Spec.md` section "Calcs and Algorithmns".

## Constants and Thresholds
- Confidence weights:
  - Historical Accuracy (HA): 35%
  - Pipeline Health (PH): 50%
  - Inactivity (IN): 15%
- Historical accuracy score bands:
  - no projected payoff in period -> 70
  - ratio < 0.50 -> 20
  - 0.50 <= ratio < 0.80 -> 45
  - 0.80 <= ratio <= 1.20 -> 90
  - 1.20 < ratio <= 1.75 -> 95
  - ratio > 1.75 -> 85
- Pipeline health score bands (45-day window):
  - projected pc 0 and pipeline 0 -> 10
  - projected pc 0 and pipeline >0 -> 85
  - metric < 0.5 -> 15
  - 0.5 <= metric < 0.8 -> 40
  - 0.8 <= metric <= 1.5 -> 90
  - metric > 1.5 -> 95
- Inactivity score:
  - <=14 days -> 100
  - then linear decline over next 60 days to min 1
- GP tiers and bump:
  - Tier 1: 0-99 -> 0%
  - Tier 2: 100-299 -> 2.5%
  - Tier 3: 300-599 -> 5.0%
  - Tier 4: 600+ -> 7.5%
- VP tiers and bump:
  - Tier 1: 0-99 -> 0%
  - Tier 2: 100-299 -> 2.0%
  - Tier 3: 300-599 -> 4.0%
  - Tier 4: 600+ -> 6.0%

## Formula Traceability Table
| Formula ID | Master Spec Clause | Backend Symbol | Test Coverage |
|---|---|---|---|
| ALG-PC-1 | I.A Initial PC equation | `calculateKpiEffects` | `test:sprint1` scenario #2 |
| ALG-PC-2 | I.B TTC timeline dates | `resolvePcTiming` + `currentPcValueForEventAtDate` | `test:algorithms` (pc timeline checks) |
| ALG-PC-3 | I.C linear decay | `currentPcValueForEventAtDate` | `test:algorithms` (mid-decay/decayed-out) |
| ALG-PC-4 | I.B TTC range parsing (`X-Y` -> delay+hold) | `parseTtcDefinition` | `test:algorithms` (delayed payoff checks) |
| ALG-CF-1 | II overall confidence weighted formula | `computeConfidence` | `test:algorithms` (confidence checks) |
| ALG-CF-HA | II.A historical accuracy component | `computeConfidence` | `test:algorithms` + `test:sprint1` snapshot components |
| ALG-CF-PH | II.B pipeline health component | `computeConfidence` | `test:algorithms` + `test:sprint1` snapshot components |
| ALG-CF-IN | II.C inactivity component | `computeConfidence` | `test:algorithms` + `test:sprint1` snapshot components |
| ALG-ONB-1 | III onboarding back-plot weekly simulation | `buildOnboardingBackplotPcEvents` | `test:algorithms` (backplot checks) |
| ALG-GP-1 | IV GP accumulation + decay trigger | `computeGpVpState` | `test:algorithms` (gp/vp checks) |
| ALG-VP-1 | V VP accumulation + decay | `computeGpVpState` | `test:algorithms` (gp/vp checks) |
| ALG-BUMP-1 | VI GP/VP tier bump application | `computeGpVpState` + `buildFutureProjected12mSeries` | `test:algorithms` + dashboard payload checks |
| ALG-CAL-1 | Adaptive weighting effective weight (`base * multiplier`) | `calculateKpiEffects` | sprint adaptive calibration tests |
| ALG-CAL-2 | Onboarding multiplier initialization by share ratio | `computeInitializationMultipliers` | sprint adaptive calibration tests |
| ALG-CAL-3 | Deal-close calibration step update (bounded/trust-weighted) | `computeCalibrationStep` + `runDealCloseCalibration` | sprint adaptive calibration tests |

## Implementation Notes
- Confidence is display-layer only and does not mutate base projection values.
- PC timing resolution order is deterministic and backward compatible:
  - use explicit `delay_days`/`hold_days` when present,
  - else parse `ttc_definition`,
  - else fallback to legacy `ttc_days` as total TTC window.
- `GET /dashboard` now returns chart-ready backend series:
  - `chart.past_actual_6m`
  - `chart.future_projected_12m`
  - `chart.confidence_band_by_month`
  - `chart.boundary_index`
- Frontend renders these series directly; no client projection math.
- Adaptive projection calibration is persisted per user/KPI:
  - storage: `user_kpi_calibration`
  - audit: `user_kpi_calibration_events`
  - applied snapshots on logs: `pc_base_weight_applied`, `pc_user_multiplier_applied`, `pc_effective_weight_applied`
