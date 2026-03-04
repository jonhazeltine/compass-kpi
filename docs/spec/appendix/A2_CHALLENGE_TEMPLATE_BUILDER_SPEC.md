# A2 Challenge Template Builder Spec (Phased KPI Goals)

## Status
- `planned / implementation-ready`
- Primary sprint target: `A2` (admin challenge template authoring), with runtime consumption in challenge create flows (`M4/M5`)
- Dependency: merge Mobile-1 backend challenge-create groundwork before starting this build slice

## 0) Purpose
Define the Challenge Template Builder so admins/sponsors can author reusable challenge themes with:
- fixed duration
- descriptive theme naming
- optional phase-based KPI goal changes
- KPI goal scope per KPI (`individual` vs `team`)

These templates are consumed in challenge creation and shown as large, information-rich template cards.

## 1) Core Product Rules
1. `theme_name` is descriptive and template-level.
2. `challenge_name` is runtime challenge instance naming and is set by sponsor/creator.
3. Default runtime behavior: challenge name prefilled from `theme_name`, but editable before publish.
4. Template duration is explicit and required (weeks).
5. Template phases are optional; if present, phase transitions are automatic by schedule.
6. KPI goals are scoped per KPI:
- `individual` goal: per participant target (example: `10 calls per person`)
- `team` goal: aggregate team target (example: `100 calls as a team`)
7. Phase transitions may change:
- KPI set
- KPI target values
- KPI goal scope (`individual`/`team`)
8. Non-negotiables remain intact:
- no PC vs Actual conflation
- no GP/VP -> PC conversion
- no confidence-base mutation through template behavior

## 2) Vocabulary
- `Theme Name`: descriptive template title (example: `Hurry Up and Call`)
- `Template Description`: plain-language focus and motivation
- `Default Challenge Name`: optional prefill for runtime instance; falls back to `Theme Name`
- `Duration Weeks`: total challenge length
- `Phase`: ordered segment within challenge timeline
- `Phase Offset`: start week/day relative to challenge start
- `Phase KPI Goal`: KPI + target + scope for that phase

## 3) Authoring Model
Template structure (conceptual):
- `theme_name` (required)
- `description` (required)
- `default_challenge_name` (optional; if null, use `theme_name`)
- `duration_weeks` (required, integer)
- `phases[]` (optional; if omitted, system uses one implicit phase covering full duration)
  - `phase_order`
  - `phase_name`
  - `starts_at_week` (or day offset)
  - `ends_at_week` (derived or explicit)
  - `kpi_goals[]`
    - `kpi_id`
    - `target_value`
    - `goal_scope` (`individual` | `team`)

## 4) Phase Behavior
1. Runtime challenge instance locks phase schedule at creation time.
2. At phase boundary, active KPI goals automatically switch to phase definition.
3. Completed phase data remains historical and auditable.
4. Mid-challenge manual edits to template do not retroactively mutate active instance phase schedules (new instances only).

## 5) Admin Builder UX (A2)
Recommended builder flow:
1. `Template Basics`
- Theme Name
- Description
- Default Challenge Name behavior
- Duration (weeks)
2. `Phase Plan`
- add/reorder/remove phases
- set phase start offsets
- verify phase coverage across full duration
3. `KPI Goals per Phase`
- select KPIs
- assign target values
- assign goal scope (`individual` vs `team`)
4. `Review + Save`
- timeline preview
- KPI scope summary
- validation errors surfaced before save

## 6) Challenge Creation Consumption UX (M4/M5)
When user/sponsor creates a challenge from template:
- Template cards must be large enough to display at least:
  - theme name
  - duration
  - phase count
  - main KPIs (top 2-4)
  - concise description
- On select:
  - prefill challenge name from `default_challenge_name` or `theme_name`
  - show phase timeline summary and KPI scope summary
  - allow final naming/edit before creation

## 7) Validation Rules
Required:
1. `duration_weeks >= 1`
2. Phase windows must not overlap.
3. Phase windows must not exceed total duration.
4. Every phase must contain at least one KPI goal.
5. Every KPI goal must include scope and target value.
6. If no explicit phases authored, system generates one full-duration phase.

Recommended constraints:
- max phases (configurable; suggested `<= 8`)
- max KPIs per phase (configurable; suggested `<= 12`)
- target value must be positive

## 8) API + Data Contract Direction (Within Existing Endpoint Family)
Use existing endpoint family:
- `GET /admin/challenge-templates`
- `POST /admin/challenge-templates`
- `GET /admin/challenge-templates/{templateId}`
- `PUT /admin/challenge-templates/{templateId}`
- `PATCH /admin/challenge-templates/{templateId}/status`
- `DELETE /admin/challenge-templates/{templateId}`

Planned additive payload shape (conceptual):
- `theme_name`
- `description`
- `default_challenge_name`
- `duration_weeks`
- `phases[]`
  - `phase_order`
  - `phase_name`
  - `starts_at_week`
  - `kpi_goals[]`
    - `kpi_id`
    - `target_value`
    - `goal_scope`

If implementation requires schema/API structural changes, update:
- `architecture/DECISIONS_LOG.md` in same change set

## 9) Acceptance Mapping (Planned Extensions)
Current anchor:
- `#21` admin CRUD coverage in `docs/spec/05_acceptance_tests.md`

Add planned sub-scenarios under `#21`:
- `#21A` phased template create/edit validation
- `#21B` phase transition schedule integrity
- `#21C` KPI goal scope enforcement (`individual` vs `team`)
- `#21D` runtime challenge-create card metadata completeness

## 10) Implementation Dependency + Sequencing
Before starting this template-builder slice:
1. Merge/push Mobile-1 challenge-create backend groundwork.
2. Reconcile branch/build state (`app tsc`, `backend build`) to clean baseline.
3. Start with backend contract + validation first, then admin UI.

## 11) Claude Handoff Block
Use this instruction when assigning Claude:

`Implement the phased Challenge Template Builder per /Users/jon/compass-kpi/docs/spec/appendix/A2_CHALLENGE_TEMPLATE_BUILDER_SPEC.md. Keep all changes inside the existing /admin/challenge-templates endpoint family unless explicitly approved. Support theme_name, duration, phase-based KPI goal swaps, and per-KPI goal_scope (individual/team). Ensure challenge-create template cards expose duration, phase count, main KPIs, and description. If structural API/schema changes are required, update DECISIONS_LOG.md in the same change set.`
