# Current Sprint

## Goal
Execute **FE-00 (Gate Fix)** to transition from backend-only scope to a frontend program with parallel Mobile (M1-M8) and Admin (A1-A4) tracks.

## In Scope
- Gate reset and scope transition:
  - Replace backend-only sprint gate with frontend kickoff.
  - Establish frontend sprint roadmap (M1-M8, A1-A4) in this file.
- Frontend traceability setup:
  - Add sprint-to-spec and sprint-to-acceptance mapping for all frontend sprints.
  - Preserve non-negotiable UI modeling constraints in all sprint definitions.
- Asset readiness governance:
  - Define required isolated exports, component sheets, node-id links, and dimensions as FE entry criteria.
  - Mark readiness status for M1 and M2 as explicit sprint gate criteria.
- Frontend acceptance harness setup:
  - Add frontend UI/API integration harness section to `docs/spec/05_acceptance_tests.md`.
- W13 docs-first exception slice (planning only):
  - Lock third-party managed-service direction for communications/video (`Stream Chat` + `Mux`) in architecture/spec docs.
  - Record dependency gates (`DEP-002`, `DEP-004`, vendor security/legal approval) and queue dependency-ordered assignments.
  - Explicitly prohibit runtime/provider implementation work in this sprint slice.

## Out of Scope
- Net-new backend endpoint families beyond documented contracts in `docs/spec/04_api_contracts.md`.
- Billing authority implementation details (`DEP-001`) beyond minimal upgrade/paywall UX.
- Marketing website implementation (deferred to future approved track).
- Third-party runtime integration coding (`Stream`/`Mux` adapters, webhook handlers, client SDK wiring) before dependency gates close.

## Definition of Done (FE-00)
- `architecture/CURRENT_SPRINT.md` reflects FE-00 + full frontend roadmap.
- Frontend Sprint Traceability table is complete for FE-00, M1-M8, A1-A4.
- `docs/spec/05_acceptance_tests.md` includes frontend acceptance harness mapping by sprint.
- Asset readiness gate criteria are explicit and testable.
- Decision log updated for sprint-gate transition decision.

## Notes
Use this file as sprint gate. Requests outside In Scope require explicit approval.
FE-00 start date: 2026-02-21.
Default cadence: FE-00 = 1 week; M/A sprints = 2 weeks.
Parallel staffing assumption: Mobile-first priority; Admin stream starts once M3 assets/contracts are stable.

## Program Rules (Applies to Every Frontend Sprint)
1. PC vs Actual GCI must remain separated in UI state, components, and payload presentation.
2. GP/VP must not be represented as PC or used to infer PC values.
3. Forecast Confidence modifies display/interpretation only, not base values.
4. Pipeline anchors must remain visible as forecast inputs.
5. No sprint starts without traceability rows in this file and links to spec + acceptance scenarios.
6. Pixel-parity stories cannot enter `in_build` without isolated export, frame node-id, and relevant component-sheet coverage.

## Frontend Roadmap

### Track M (Mobile)
- `M1`: Core Infrastructure + Auth UI Parity
- `M2`: Onboarding + Profile/Goals
- `M3`: KPI System + Dashboard Foundation
- `M4`: Challenge System + Gamification
- `M5`: Team Management + Collaboration
- `M6`: Advanced Features + Notifications + Coaching + AI
- `M7`: Sponsored Challenges + Visual Polish
- `M8`: Mobile QA + Release Readiness

### Track A (Admin Web)
- `A1`: Admin Shell + AuthZ (parallel with M3-M4)
- `A2`: KPI Catalog + Challenge Templates (parallel with M4-M5)
- `A3`: Users + Analytics + Reports (parallel with M5-M6)
- `A4`: Sponsored Admin + Hardening (parallel with M7-M8)

## Frontend Sprint Traceability
| Sprint Item | Roadmap Phase | Spec Link(s) | Non-Negotiables | Acceptance Tests | Decision Log Needed |
|---|---|---|---|---|---|
| FE-00 Gate Fix + Frontend Program Kickoff | 0: Governance Baseline | `architecture/PROJECT_CONTROL_PLANE.md`, `design/figma/FIGMA_INDEX.md`, `docs/spec/appendix/FIGMA_BUILD_MAPPING.md`, `docs/spec/05_acceptance_tests.md` | #1, #2, #3, #4, #9, #10 | frontend harness bootstrap checks | yes |
| W13 Third-Party Video + Chat Integration Plan (Docs-First Exception) | 3/4 seam: Communication -> Coaching Foundation Planning | `architecture/PROJECT_CONTROL_PLANE.md`, `architecture/SOW_PARITY_MATRIX.md`, `docs/spec/04_api_contracts.md`, `docs/spec/05_acceptance_tests.md`, `docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`, `docs/spec/appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md` | #1, #2, #3, #4, #8, #9 | #29, #30, #31, #32, #33, #34, #35 (planned/docs) | yes |
| M1 Core Infrastructure + Auth UI Parity | 1: KPI Core | `docs/spec/01_system_overview.md`, `docs/spec/04_api_contracts.md`, `docs/spec/appendix/FIGMA_BUILD_MAPPING.md` | #1, #3, #8 | #1, E2 | no |
| M2 Onboarding + Profile/Goals | 1: KPI Core | `docs/spec/appendix/Master Spec.md`, `docs/spec/04_api_contracts.md`, `docs/spec/appendix/FIGMA_BUILD_MAPPING.md` | #1, #8 | scenario 1 profile/onboarding UI roundtrip + state coverage | no |
| M3 KPI System + Dashboard Foundation | 1: KPI Core | `docs/spec/03_engines.md`, `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #1, #2, #3, #4, #6 | #2, #3, #4, #5, #6, E3 | no |
| M3b Dashboard Gamification + Interaction Polish (Scope Exception, Time-Boxed) | 1: KPI Core (UX Polish Exception) | `docs/spec/appendix/Master Spec.md`, `docs/spec/appendix/M3B_ANIMATION_AUDIO_CHECKLIST.md` | #1, #2, #3, #4, #8, #9 | dashboard gameplay-loop UX checks + M3 regressions remain green | yes |
| M4 Challenge System + Gamification | 2: Team + Challenge | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #1, #2, #8 | #7, #8, #9, E6 | no |
| M5 Team Management + Collaboration | 3: Communication Integration | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #8 | #11, #12, #13 | no |
| M6 Advanced Features + Notifications + Coaching + AI | 4: Coaching + AI Assist | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #1, #3, #8 | #14, #15, #16, #17, #18, #20, E1 | no |
| M7 Sponsored Challenges + Visual Polish | 4: Coaching + AI Assist | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md`, `design/figma/FIGMA_INDEX.md` | #1, #8 | #10, #19, E8 | no |
| M8 Mobile QA + Release Readiness | 5: Hardening + Launch | `docs/spec/05_acceptance_tests.md`, `ops/README.md` | #1, #2, #3, #4, #8 | frontend full regression matrix | no |
| A1 Admin Shell + AuthZ | 5: Hardening + Launch | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #8 | #21 authz baseline | no |
| A2 KPI Catalog + Challenge Templates | 5: Hardening + Launch | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md` | #8 | #21 CRUD coverage | no |
| A3 Users + Analytics + Reports | 5: Hardening + Launch | `docs/spec/04_api_contracts.md`, `docs/spec/appendix/Master Spec.md`, `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md` | #8 | #21 user ops + analytics/report validation (+ planned Projection Lab scenario tooling) | no |
| A4 Sponsored Admin + Hardening | 5: Hardening + Launch | `docs/spec/04_api_contracts.md`, `docs/spec/05_acceptance_tests.md`, `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md` | #8 | #22, #23 (+ planned Projection Lab regression/admin hardening) | no |

## FE-00 Asset Readiness Gate

### Required Screen Exports (M1/M2 must be green)
- `design/figma/exports/screens/auth_welcome_v1.png`
- `design/figma/exports/screens/auth_onboarding_projection_v1.png`
- `design/figma/exports/screens/auth_onboarding_measure_v1.png`
- `design/figma/exports/screens/auth_login_v1.png`
- `design/figma/exports/screens/auth_forgot_password_v1.png`
- `design/figma/exports/screens/agent_dashboard_my_qualifiers_v1.png`

### Required Component Sheets (M1/M2)
- `design/figma/exports/components/core_buttons_v1.png`
- `design/figma/exports/components/core_inputs_v1.png`
- `design/figma/exports/components/core_tabs_chips_v1.png`
- `design/figma/exports/components/core_cards_v1.png`
- `design/figma/exports/components/core_icons_v1.png`

### Gate Checks
- Each required export exists in repo with versioned filename.
- Frame-level node-id link present in `design/figma/FIGMA_INDEX.md`.
- Dimensions recorded in `design/figma/FIGMA_INDEX.md`.
- Corresponding rows in `docs/spec/appendix/FIGMA_BUILD_MAPPING.md` are not `pending`.

### Current Status
- M1 readiness: `green` (required screen exports + required component sheets complete)
- M2 readiness: `green` (required screen exports + required component sheets complete)

## Open Dependencies (Blocking/Watch)
- Billing authority decision (`DEP-001`) remains open; UI scope limited to paywall/upgrade routing only.
- Tenancy key strategy (`DEP-002`) remains open; monitor for cross-team/admin data-scope impacts.
- Coaching ownership model (`DEP-003`) remains open; implement configurable role checks in UI.
- Data retention/compliance policy (`DEP-004`) remains open; required before broad communication launch UX.
- Vendor security/legal checklist completion (`DEP-005`) remains open; required before Stream/Mux runtime implementation.

## Prior Sprint Summary
- Sprint 1 through Sprint 10 backend track completed on 2026-02-20.
- Backend MVP gate checkpoint passed on 2026-02-20:
  - `cd backend && npm run test:sprint10`
  - `cd backend && npm run test:backend-mvp`

## FE-00 Completion Checkpoint
- Completion date: 2026-02-27.
- Frontend gate transition approved: complete (2026-02-27).
- Asset readiness M1/M2 green: complete.
- Frontend acceptance harness merged: complete (2026-02-27).
- FE-00 harness closeout criteria (explicit pass/fail): complete (see `docs/spec/05_acceptance_tests.md` -> `FE-00 Harness Closeout Criteria (Gate)`).

## Active Implementation Focus (M3 Engine Hardening)
- Canonical algorithm source locked to `docs/spec/appendix/Master Spec.md` ("Calcs and Algorithmns").
- Backend now owns chart series generation and confidence explainability payloads; frontend consumes render-ready series.
- Deterministic algorithm validation command added: `cd backend && npm run test:algorithms`.
- Approved scope exception track: adaptive per-user PC weighting calibration (onboarding initialization + deal-close self-correction + admin calibration controls).
- Approved scope exception track (time-boxed): `M3b Dashboard Gamification + Interaction Polish`, tracked in `docs/spec/appendix/M3B_ANIMATION_AUDIO_CHECKLIST.md`.
- M3 completion execution guidance (IA + logging surfaces, low-interruption gates) is documented in `docs/spec/appendix/M3_COMPLETION_PLAN_PRIORITY_CONTEXT_SURFACES.md` and should be used to sequence post-M3b dashboard/logging work without re-deciding KPI overlap behavior.

## Planned Addendum Integration (Spec-Only, Implementation Deferred)
- Addendum references:
  - `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_1_PROJECTION_INTEGRITY_CALIBRATION.md`
  - `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md`
- Status: `spec planning integrated`; no active implementation scope change to FE-00/M3b/A* from this note alone.
- Planned future backend hardening dependency (post-current focus):
  - projection provenance split (`real`, `seeded_history`, `provider_forecast`)
  - continuity projection toggle + horizon confidence modifier
  - onboarding baseline vs target payload separation (backward-compatible migration path)
- Planned admin roadmap dependency:
  - `Projection Lab` scenario tooling targeted to `A3` build and `A4` hardening/regression, with backend hooks allowed earlier as a separately approved backend-prep slice.
