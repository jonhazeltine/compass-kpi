# Algorithm Addendum Part 1 — Projection Integrity & Calibration

> Repo integration note (2026-02-25): This appendix preserves uploaded proposal language as the canonical addendum artifact for spec planning.
> Current canon may be superseded only where explicit addendum integration notes are added to `Master Spec.md`, `03_engines.md`, and `ALGORITHM_SPEC_LOCK.md`.

## Canonical Integration Status (2026-02-25)
- Status: `planned / spec-integrated, implementation deferred`
- Supersedes canon where explicitly referenced in addendum integration notes in repo spec files
- Implementation scope deferred pending backend/admin sequencing after current M3b/FE-00 focus


## 0) Purpose
Ensure Projected Commissions (PC) forecasts remain **fair, stable, and accurate** even when users:
- track different KPI sets,
- log inconsistently,
- under-report activity during onboarding,
- and need meaningful 12-month visibility.

This addendum introduces a calibration layer that is **per-user, self-correcting, and compatible with the current PC timeline/decay engine**.

---

## 1) Known algorithm problems (running issue list)

### Problem #1 — Selection bias / observability gap
PC only reflects what a user chooses to track and logs. Users tracking high-yield KPIs (or more KPIs) can show higher PC than equally productive users tracking fewer/different KPIs.

**Impact:** unfair comparisons, distorted confidence, distorted coaching nudges.

---

### Problem #2 — Long-horizon under-forecast ("6-month cliff")
Most PC KPIs use TTC ~60–90 days and decay that effectively “empties” the forecast tail, making months 6–12 artificially low early on. The only way the 12-month view fills in is continued logging + time passing.

**Impact:** pessimistic 12-month forecast, weak future planning, reduced motivation.

---

### Problem #3 — Onboarding value skew from incomplete KPI accounting
Onboarding assigns KPI-driven PC values using average price × commission rate × KPI weights. If a user doesn’t include most of their real activity (or underestimates frequency), the assigned values can be massively skewed due to misattribution.

**Impact:** incorrect baseline PC, wrong early nudges, wrong confidence behavior.

---

## 2) Directional fix (required)
### Move from GLOBAL KPI weights → INDIVIDUALIZED KPI impact
Keep the base/global KPI weights as defaults, but introduce a **per-user adjustment factor** per KPI.

**EffectiveWeight(user, KPI) = BaseWeight(KPI) × UserAdjustment(user, KPI)**

This preserves the existing PC equation and timeline logic but makes the model user-specific.

---

## 3) Self-correcting calibration (AI-assisted, lightweight)
The system should adjust user KPI impacts over time using ground truth.

### Ground truth event
**Deal Closed (actual GCI)** is the truth signal.

### Update trigger
On each Deal Closed:
- look back over a defined window (aligned to TTC logic),
- collect the logged PC-KPIs in that window,
- compare predicted payoff vs actual GCI,
- adjust KPI user multipliers gradually (small learning rate, bounded).

**Key principle:** update the KPIs that contributed the most predicted value in that lookback window (credit assignment), not all KPIs equally.

**Outcome:** a “6 KPI” user becomes accurate for their workflow without being forced into a core set.

---

## 4) Onboarding mitigation (day-1 fairness) — Slider-based baseline + target planning

Replace “type your weekly averages” as the primary mechanism with a **bounded slider flow** that anchors seeding to actuals while still allowing goal-setting.

### 4.1 Goals of the slider flow
- Tie onboarding seed to **what the user actually produced** (reduces aspirational inflation).
- Reduce misattribution when users don’t track everything (introduce an explicit “untracked drivers” remainder).
- Produce a clean separation between:
  - **Baseline (history-realistic)** inputs used for seeding
  - **Target (future plan)** inputs used for goal planning

### 4.2 Proposed onboarding sequence (3 stages)

#### Stage 1 — KPI selection (baseline set)
User selects the KPIs they want to track *right now*.
- This is intentionally flexible; users may choose a narrow set.

Inputs already collected:
- avg price point
- commission rate
- **historical baseline: last 12 months Actual GCI**

#### Stage 2 — Baseline sliders (“Explain your past”)
Show the selected KPIs with **bounded sliders** representing weekly quantities.

UI behavior:
- Start with suggested defaults (based on common patterns or prior input).
- User adjusts sliders until the model indicates: “This KPI mix plausibly explains your historical production.”

Key requirement: a visible **Baseline Coverage Meter**
- Coverage is computed using the **real projection engine** by simulating a steady weekly pattern from the slider values and reading **PC_365** as the implied annual production.
- Coverage display is: **coverage_pct = min(100, PC_365 / ActualGCI_12mo)**.
- The UI must also display a complementary remainder bucket: **Untracked Drivers = 100% − coverage_display_pct** (see constraints).

Constraints:
- Baseline plan targets **100% coverage** of last-12-month Actual GCI.
- UI coverage display is **capped at 100%**.
- Exception: the **final KPI adjustment** that crosses 100% is allowed to overshoot slightly to enable adding/including that KPI.
- Hard overshoot cap: **105%** (internal), while still displaying 100% on the screen.
- **Proceed rule (Stage 2):** user must reach **≥ 80% Coverage** to continue.
  - If Coverage < 80%, guide the user to increase coverage by (a) adjusting baseline sliders upward (within caps) and/or (b) adding high-leverage baseline KPIs (recommended: the existing **Buyer Contract Signed** KPI and **Listings Taken** KPI from the master KPI catalog — use the canonical names/slugs already defined in the KPI list).
  - **Untracked Drivers** remainder is allowed but must be **≤ 20%** to proceed.
- Users can leave some remainder as “Untracked Drivers” if their chosen KPIs do not cover everything they did.

Outputs from Stage 2:
- baseline weekly quantities per selected KPI
- baseline coverage percentage
- untracked drivers remainder (as a percentage or value)

These outputs drive the onboarding seed (tail seeding + continuity projection).

#### Stage 3 — Target sliders (“Build your future”)
User optionally sets a target (e.g., higher annual GCI or weekly activity goal).

UI behavior:
- Set target baseline (e.g., 10–30% lift or explicit target value).
- Sliders now represent **future plan** quantities and may exceed baseline.
- Clear labeling: “Targets do not change your historical seed; they shape your plan.”

Outputs from Stage 3:
- target weekly quantities per KPI
- optional target GCI goal

Targets should not contaminate baseline seeding logs. They are planning inputs.

### 4.3 How this reduces known problems
- Reduces onboarding value skew (Problem #3) by anchoring baseline sliders to actuals.
- Mitigates selection bias (Problem #1) by making “untracked drivers” explicit instead of silently misattributing.
- Improves 12-month forecast stability by creating more realistic seed inputs and continuity projection assumptions.

### 4.4 Data/logic separation requirements
- Baseline slider outputs feed:
  - onboarding tail seeding
  - forecast-only continuity buffer
  - initialization of per-user KPI calibration (conservative)
- Target slider outputs feed:
  - planning UI
  - coaching suggestions
  - optional “what if” projections

Do not mix baseline and target streams in the log store.

---

## 5) Fixing the 12-month horizon (hardened solution: continuity projection + reduced confidence)

You are using Option A (onboarding backfill). We will harden it so the 6–12 month horizon is not artificially empty by adding a **continuity projection layer** that is explicitly marked as forecasted and carries reduced confidence.

### 5.1 Tail Seeding (historical backplot)
Seed synthetic historical PC KPI logs based on onboarding weekly averages so the user has a realistic baseline immediately.

**Tweak:** backplot span should be driven by KPI timing config rather than an arbitrary “52 weeks.”
- For selected PC KPIs compute: **impact_window_days = delay_days + hold_days + decay_days** (include TTC only if modeled separately).
- Set: **backplot_span_days = max(365, max(impact_window_days)) + safety_margin**.

### 5.2 Continuity Projection (forecast-only forward buffer)
Continuity Projection is **optional** and controlled by an **admin-panel toggle** (default **ON** in production unless explicitly disabled) with clear explanation of what it does.

When enabled, after tail seeding, generate a limited set of synthetic **future** KPI events **via a provider-only forecast source (not stored as logs)** to represent “continuity of current behavior,” solely to prevent the 6–12 month view from being empty.

**Rules:**
- Generate provider-only forecast events for **365 days from the as-of date** (default; matches PC_365 horizon).
- Implementation preference: **provider-only forecast events** (not persisted as user logs).
- Events are marked **forecast-only** and must not:
  - appear as historical user logs,
  - count toward leaderboards/challenges,
  - train personalization calibration as “truth,”
  - affect GP/VP.
- **Replacement rule:** if real KPI logs occur in the buffered window, forecast-only events in that overlapping time are ignored/removed.

**Important:** This does not change the TTC/decay curve. It supplies future inputs with explicit disclaimers.

**Projection Lab integration:** The toggle must be available per simulation run so scenarios can be executed with Continuity Projection ON vs OFF and diffed.

### 5.3 Reduced Confidence for Forecasted Horizon
Any projection that depends materially on provider-only forecast continuity should show reduced confidence.

Minimum requirement:
- Store/report an internal split of:
  - **PC_from_real_logs**
  - **PC_from_seeded_history**
  - **PC_from_provider_forecast**
- Apply a confidence penalty proportional to forecast reliance in each horizon.
  - Define per-horizon: **forecast_share = PC_provider_forecast / max(total_PC, ε)**
  - Compute a per-horizon continuity confidence modifier:
    - **continuity_modifier = clamp(1 − 0.60 × forecast_share, 0.60, 1.00)**
    - Interpretation: if 100% of a horizon depends on continuity, confidence is reduced by 60% (floored at 60% of base).
  - Apply it to the existing base confidence score:
    - **confidence_horizon = base_confidence × continuity_modifier**
  - Notes:
    - If Continuity Projection is OFF, forecast_share = 0 → continuity_modifier = 1.
    - Apply this per-horizon (PC_30, PC_90, PC_365) so near-term can remain high confidence even when long-term relies on continuity.

UX requirement (strongly recommended):
- Display continuity-based projection as a **separate visual treatment** (e.g., dashed line / shaded extension) distinct from the projection driven by real logs.
- Label it explicitly as “Assuming continuity of current behavior.”

### 5.4 Guardrails (must-haves)
- Synthetic seeded events must be distinguishable from user-entered logs (flags/metadata).
- Seed runs must be idempotent.
- Forecast-only events must be isolated from competitive scoring, analytics, and calibration.

---

## 6) Confidence should reflect predictiveness, not KPI count
Extend confidence logic to incorporate demonstrated predictiveness:
- how stable predicted vs actual has been recently,
- whether the model has enough ground truth to trust personalization.

Avoid confidence improving merely because a user logs many KPIs.

---

## 7) Phased implementation (mid-production safe)

### Phase 0 — Guardrails
- Add observability labeling (internal and/or UI copy).
- Add onboarding normalization guardrails (prevent extreme initial skew).

### Phase 1 — Core upgrade
- Implement per-user KPI adjustment multipliers.
- Initialize from onboarding history.
- Update multipliers using Deal Closed ground truth.

### Phase 2 — Horizon upgrade
- Implement a forward layer and/or revise the payoff/decay kernel to support meaningful 12-month projections.

---

## 8) Acceptance criteria (testable)
- Users with identical closings but different KPI sets converge to similar PC accuracy after sufficient closings.
- New users do not show an empty 6–12 month forecast if they provide onboarding history.
- Incomplete onboarding KPI accounting does not create extreme PC inflation/deflation (bounded deviation).
- Confidence correlates with prediction accuracy over time, not number of KPIs tracked.
