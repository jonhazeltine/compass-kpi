# Algorithm Addendum Part 2 — Projection Lab (Admin Simulation + Regression)

> Repo integration note (2026-02-25): This appendix preserves uploaded proposal language as the canonical addendum artifact for spec planning.
> Current canon may be superseded only where explicit addendum integration notes are added to `Master Spec.md`, `03_engines.md`, and `ALGORITHM_SPEC_LOCK.md`.

## Canonical Integration Status (2026-02-25)
- Status: `planned / spec-integrated, implementation deferred`
- Primary roadmap placement target: `A3` build, `A4` hardening/regression
- Backend hooks may be staged earlier as a separate scoped backend-prep track


## 0) Purpose
Create an internal **Projection Lab** in the admin panel that can:
1) generate synthetic users + timelines,
2) run the real KPI→PC algorithm against them,
3) show outputs over time,
4) compare versions, and
5) fail fast when changes reintroduce known issues (6-month cliff, onboarding skew, KPI selection bias, etc.).

This is a testing harness for **algorithm integrity**. It should mock **inputs only** (synthetic events), never the algorithm.

---

## 1) Admin Panel modules

### A) Scenario Library (CRUD)
A library of reusable scenario definitions.

**Scenario fields (practical):**
- name, description, tags (e.g., `6_month_cliff`, `undercounting`, `anchors`)
- profile: avg price, commission rate, optional seasonality toggle
- timeline: list of dated events
  - KPI log events (kpi_id, count)
  - pipeline anchor events (Listings Pending, Buyers Under Contract, Closed)
  - silence windows (no activity)
  - optional: actual closings events (for scoring)
- expected_assertions (“shape rules”)
  - bounds (PC never negative)
  - monotonic segments (steady activity → PC shouldn’t drop)
  - slope caps (PC delta per day shouldn’t exceed X without anchors)
  - horizon sanity (PC_365 shouldn’t start near 0 under steady 60–90d TTC)

**UI requirement:** Provide both:
- guided form builder (to create/edit quickly)
- JSON editor (authoritative; saves future engineering time)

---

### B) Synthetic Data Generator (wizard)
A wizard to generate scenarios without hand-writing timelines.

**Inputs:**
- KPI mix (e.g., calls 5/day, social posts 3/week, appointments 2/week)
- TTC distribution bands (60–90, 30–60, etc.)
- logging compliance (100%, 50%, 20%) to test undercounting sensitivity
- inactivity pattern (none, weekend-only, 2-week gaps)
- anchors frequency (e.g., 1 buyer UC/month)
- randomness seed (repeatable runs)

**Outputs:**
- generates N synthetic “users”
- generates daily event streams for 90/180/365 days
- stores them as a scenario set (or multiple scenarios)

---

### C) Runner (Simulation Engine)
Runs the **production algorithm** against synthetic events.

**Behavior:**
- creates an isolated simulation run record
- runs the algorithm exactly as production would, but reading inputs from scenario events
- captures daily snapshots of outputs

**Do not mock the algorithm. Mock only inputs.**

**Outputs captured per day (minimum):**
- pc_total, pc_30, pc_90, pc_365
- confidence + modifiers
- component breakdowns (per KPI type contribution, anchor contribution, confidence reduction)
- optional debug traces (admin-only)

---

### D) Diff & Regression
Compare runs to detect regressions and material changes.

**Run A vs Run B:**
- run the same scenarios
- compare time series
- highlight material changes
- show pass/fail on assertions

**Material change thresholds (examples):**
- PC_90 change > 10%
- confidence curve differs by > 0.10
- PC_365 at day 1 falls below defined floor

---

### E) Scorecard Dashboard (shipping gate)
For each algorithm version/candidate build:
- pass rate on scenario assertions
- worst offenders (top failing scenarios)
- summary metrics: stability, bias, volatility, undercount sensitivity

This becomes the **go/no-go** view for changes to projection logic.

---

## 2) Safe integration: “provider layer” (swap inputs, keep logic)
Use the same code path as production by abstracting inputs behind providers.

**Providers (conceptual):**
- KPI log provider (prod reads live data; sim reads scenario events)
- pipeline anchor provider
- user profile provider
- actuals provider (optional)

**Projection service stays unchanged:**
- production: calculate(userId, asOfDate)
- simulation: calculateFromProviders(providers, asOfDate)

Internally, both call the same calculation functions.

---

## 3) Data model (minimum viable)
Implement alongside existing admin schema without touching user tables.

Minimum entities needed:
- scenarios
- scenario_events (date, type, payload)
- runs (scenario or scenario_set, algorithm_version, seed, timestamps)
- run_snapshots (date, horizons, confidence, breakdown)
- assertions (per scenario)
- assertion_results (per run)

Note: use existing naming conventions and persistence patterns; the above are conceptual.

---

## 4) Admin UI flows

### Flow 1 — Create/edit scenario
Admin → Projection Lab → Scenario Library → New
- pick template (steady activity, undercounting, anchor-driven, dormancy, etc.)
- adjust parameters
- save

### Flow 2 — Run simulation
Scenario → Run
- choose algorithm version (current vs candidate)
- set duration (180/365)
- run

### Flow 3 — Inspect run
Charts:
- PC over time (total + horizons)
- confidence over time
- contribution breakdown (stacked KPI types + anchors)
- markers where assertions fail

### Flow 4 — Compare
Select two runs → Diff
- percent deltas by horizon
- volatility comparison
- regression list (e.g., “6-month cliff resurfaced”)

---

## 5) Operationalization (so it gets used)
Every change that touches projection logic should:
- run the “golden scenario set”
- store snapshots
- mark pass/fail
- show candidate vs current with a simple verdict

If CI is not wired yet, provide a manual alternative:
- one button: Run regression suite
- runs 20–50 scenarios
- returns pass/fail scorecard

---

## 6) Convert known issues into first-class scenarios

### A) 6-month cliff scenario set
**Setup:**
- TTC 60–90 dominant
- consistent logging
- duration 365

**Assertions:**
- PC_365 day 1 must exceed floor
- PC_365 should not be materially lower than PC_90 multiplied by a reasonable band
- decay should not dominate until inactivity occurs

### B) Undercounting sensitivity set
**Setup:**
- same “true activity,” different “logged activity %”

**Assertions:**
- per-KPI implied value stays within bounds
- PC doesn’t inflate superlinearly when logs are sparse
- anchors stabilize variance

---

## 7) Minimal build path (ship this)

### Phase 1 (fast)
- scenario library (JSON-first)
- runner generates daily snapshots
- 5 scenarios + 8 assertions
- single-run chart view

### Phase 2
- generator wizard
- diff tool
- regression suite button

### Phase 3
- CI integration + version gating
