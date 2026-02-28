# 05 Acceptance Tests

## MVP Scenarios

### 1) Authenticated User Context
- Given a valid bearer token
- When client requests `GET /me`
- Then response is `200` with user `id` and `email`
- And no admin-only fields are returned

### 2) KPI Log (PC Type) Creates Projection Contribution
- Given an authenticated user with average price point and commission rate
- And a KPI of type `PC` with weight, TTC, and decay settings
- When client submits `POST /kpi-logs` for that KPI
- Then log is stored with `pc_generated`, `payoff_start_date`, `ttc_end_date`, and `decay_end_date`
- And log stores applied timing snapshots (`delay_days_applied`, `hold_days_applied`, `decay_days_applied`)
- And dashboard projection values update on next fetch

### 2C) KPI Log Deletion Removes Entry Effects
- Given an authenticated user with existing KPI log entries
- When user calls `DELETE /kpi-logs/{id}` for an owned log
- Then API returns success and the log no longer appears in dashboard `recent_logs`
- And dashboard projection/actual totals are recomputed without the deleted event
- And deleting a pipeline-anchor log refreshes/clears anchor status from remaining anchor logs

### 2A) TTC Range Parsing Applies Delayed Payoff
- Given a PC KPI with `ttc_definition = "90-120 days"` and decay configured
- When user logs that KPI today
- Then projected payoff start is delayed by 90 days
- And full hold duration is 30 days before decay begins
- And dashboard future series reflects no contribution before the payoff start window

### 2B) Onboarding One-Time Projection Seed
- Given a new user submits onboarding profile payload with `selected_kpis`, `kpi_weekly_inputs`, financial inputs, and pipeline counts
- When `PATCH /me` is called for the first completed onboarding submission
- Then backend seeds weekly historical synthetic PC logs (excluding the most recent week) using onboarding averages
- And pipeline anchor rows are upserted for listings/buyers pending counts
- And subsequent `GET /dashboard` future projection uses seeded baseline plus current pipeline influence
- And reseeding does not duplicate data on later profile edits
- And selected PC KPIs receive initialized per-user calibration multipliers derived from onboarding historical KPI mix

### 3) KPI Log (GP/VP Type) Does Not Generate PC
- Given an authenticated user and a KPI of type `GP` or `VP`
- When user logs the KPI
- Then GP/VP totals update correctly
- And `pc_generated` remains null/zero for that log
- And PC projection value does not increase from that event

### 4) Actual GCI Logging Stays Separate from PC
- Given an authenticated user and KPI `Deal Closed` requiring direct value input
- When user logs with `logged_value` for GCI
- Then Actual GCI and Deals Closed increase
- And PC projection is not directly increased by this actuals log

### 5) Forecast Confidence Affects Display Layer Only
- Given a dashboard payload with base projection values and confidence score
- When confidence score changes from Green to Yellow to Red thresholds
- Then confidence visual indicators change
- And base PC projection values remain unchanged for the same underlying logs
- And confidence explainability components are returned (`historical_accuracy_score`, `pipeline_health_score`, `inactivity_score`)

### 5A) Dashboard Chart Series Shape (Engine Output)
- Given an authenticated user with KPI history
- When client requests `GET /dashboard`
- Then `chart.past_actual_6m` returns 6 monthly points
- And `chart.future_projected_12m` returns 12 monthly points
- And `chart.boundary_index` marks past/future split for rendering
- And chart rendering requires no client-side projection formula
- And `projection.calibration_diagnostics` is present for model-quality explainability

### 5B) Adaptive PC Calibration Loop
- Given a user with PC logs and subsequent `Actual` deal-close logs
- When a deal-close log is written
- Then backend records a calibration event row with actual/predicted ratio and attribution payload
- And per-user KPI multipliers update by predicted-share attribution with bounded step logic
- And projection calculations use updated multipliers on future PC logs
- And confidence base formula remains unchanged (diagnostics additive only)

### 6) Pipeline Anchors Are Accepted and Reflected
- Given an authenticated user
- When user logs/updates `Pipeline Anchor: Listings Pending` and `Pipeline Anchor: Buyers UC`
- Then latest anchor counts are persisted with timestamps
- And forecast/confidence inputs include anchor-derived context

### 6A) KPI Selection Eligibility and Visibility Rules
- Given an authenticated user in onboarding or KPI management
- When client renders selectable KPI catalog entries
- Then `Listing Taken` appears as selectable
- And `Deal Closed` and `Pipeline Anchor` entries are not selectable add/remove candidates
- And recommended KPI picks (3-5) are shown first with access to browse full catalog
- And tier-restricted selectable KPIs remain visible in locked state with upgrade routing behavior

### 6B) KPI Value Mutability Boundaries
- Given an authenticated non-admin user
- When onboarding or KPI management UI is rendered for system KPIs
- Then KPI payout/value metadata is displayed as read-only (no editable value input control)
- And any attempt to submit KPI payout/value/weight overrides through member-facing flows is rejected
- Given a platform admin
- When KPI value/weight settings are changed through `/admin/kpis/*`
- Then subsequent projection calculations use the updated admin-defined configuration

### 7) Challenge Join and Progress Tracking
- Given an active challenge with associated KPI IDs
- When user joins challenge and logs relevant KPIs
- Then challenge participation record exists
- And `% complete` reflects only challenge-mapped KPI activity

### 7A) Challenge Detail MVP Data Fallback Safety (Docs-First Inventory)
- Given challenge detail UI consumes existing challenge families only (`GET /challenges`, `POST /challenge-participants`)
- When team-goal aggregate or KPI-level contribution fields are absent
- Then challenge detail renders explicit fallback states (no fabricated aggregate values)
- And individual progress uses `my_participation.progress_percent` when present
- And leaderboard rank is derived from server-ordered `leaderboard_top[]` rows
- And missing leaderboard display names fall back to deterministic member labels
- And non-joined users see join-first empty state rather than misleading progress completion

### 8) Team Leader Permissions
- Given a user with `team_leader` role
- When user creates a team challenge and marks mandatory KPI(s)
- Then selected members are enrolled per challenge settings
- And mandatory KPIs appear locked for assigned users

### 9) Tier Restriction Enforcement
- Given a user on a lower tier
- When user attempts restricted action (e.g., premium challenge feature)
- Then API returns `403`
- And app routes user to plan/upgrade flow

### 10) Sponsored Challenge Lifecycle
- Given an enabled sponsored challenge in the active date range
- When user requests `GET /sponsored-challenges` and `GET /sponsored-challenges/{id}`
- Then sponsor branding, disclaimer, reward, and CTA metadata are present
- When user joins via challenge participants endpoint
- Then participation is stored with `sponsored_challenge_id`

### 11) Channel Membership Enforcement
- Given a channel and a user who is not a channel member
- When user requests `GET /api/channels/{id}/messages` or posts to `POST /api/channels/{id}/messages`
- Then API returns `403`
- And no message write occurs

### 12) Broadcast Permission and Throttle
- Given a channel with a non-admin/non-leader member
- When member posts to `POST /api/channels/{id}/broadcast`
- Then API returns `403`
- Given an authorized broadcaster exceeds 24h cap
- When broadcaster posts to `POST /api/channels/{id}/broadcast`
- Then API returns `429`
- And broadcast action is logged in audit records for permitted sends

### 13) Unread Counter and Mark-Seen Behavior
- Given a channel with at least two members
- When member A sends a message
- Then member B unread count increases on `GET /api/messages/unread-count`
- When member B posts `POST /api/messages/mark-seen`
- Then unread count resets for that channel/member

### 14) Coaching Journey and Lesson Progress
- Given an authenticated user and active coaching journey with milestones/lessons
- When user requests `GET /api/coaching/journeys` and `GET /api/coaching/journeys/{id}`
- Then journey metadata and lesson progress are returned
- When user posts `POST /api/coaching/lessons/{id}/progress`
- Then progress is persisted with auditable status/updated timestamp

### 15) Coaching Broadcast Scope Enforcement
- Given a non-leader member
- When member posts `POST /api/coaching/broadcast` with `scope_type=team`
- Then API returns `403`
- Given a team leader and a platform admin
- When leader posts team scope and admin posts global scope
- Then API returns `201` and audit rows are persisted

### 16) AI Suggestion Approval-First Workflow
- Given an authenticated creator
- When client posts `POST /api/ai/suggestions`
- Then suggestion is stored as `pending`
- When non-admin calls approve/reject
- Then API returns `403`
- When admin calls approve/reject on pending suggestion
- Then status transitions to `approved` or `rejected` with audit actor fields
- And no direct channel message dispatch occurs from AI suggestion transitions

### 17) Coaching Team-Scoped Visibility Hardening
- Given a team-scoped journey
- When a non-member requests `GET /api/coaching/journeys` or `GET /api/coaching/journeys/{id}`
- Then team-scoped journey data is filtered or denied (`403` on direct access)
- And only team members/admins can update `POST /api/coaching/lessons/{id}/progress`

### 18) AI Cross-User Targeting Hardening
- Given a non-admin user
- When user posts `POST /api/ai/suggestions` targeting another user outside leader scope
- Then API returns `403`
- Given a team leader targeting a user on their own team, or a platform admin targeting any user
- Then API allows suggestion creation with `pending` status

### 19) Sponsored Challenge Access and Participation
- Given an active sponsored challenge with tier requirement and sponsor metadata
- When eligible user requests `GET /sponsored-challenges` and `GET /sponsored-challenges/{id}`
- Then challenge appears with branding, disclaimer, reward, and CTA fields
- When ineligible tier requests challenge detail
- Then API returns `403`
- When eligible user joins challenge with `sponsored_challenge_id`
- Then participant row persists sponsor linkage

### 20) Offline Batch KPI Ingest
- Given an authenticated user and valid KPI payload list
- When user posts `POST /kpi-logs/batch`
- Then API returns per-entry statuses and aggregate summary counts
- And duplicate idempotency keys return `duplicate` without inflating writes
- And successful entries preserve single-write non-negotiable behavior

### 21) Admin Core Operations Authorization and Audit
- Given a non-admin user
- When user requests admin core endpoints (`/admin/kpis`, `/admin/challenge-templates`, `/admin/users`)
- Then API returns `403`
- Given a platform admin
- When admin creates/updates/deactivates KPI and challenge template records
- Then API returns success with persisted changes
- And admin user role/tier/status update endpoints persist expected values
- And admin actions are written to `admin_activity_log`
- And platform admin can inspect/reset/reinitialize user KPI calibration state through admin calibration routes

### 22) Notification Queue + Dispatch Lifecycle
- Given a non-admin user
- When user calls notification queue operations
- Then API returns `403` with standardized error envelope
- Given a platform admin
- When admin enqueues notification jobs
- Then queue rows are persisted as `queued`
- When admin dispatches with success/failure outcomes
- Then rows transition to `sent` or `failed` with attempt tracking

### 23) Forecast Confidence Snapshot and Policy Summary
- Given an authenticated member with KPI activity and anchors
- When user posts `POST /api/forecast-confidence/snapshot`
- Then API returns score/band plus persisted confidence snapshot metadata
- And base dashboard projection values remain unchanged by confidence snapshot operation
- Given admin and non-admin users
- When calling `GET /ops/summary/policy`
- Then non-admin receives `403` and admin receives policy integrity counters

### 24) Onboarding Baseline Coverage Guardrails (Planned Addendum)
- Given onboarding baseline slider inputs are used to simulate a steady weekly KPI pattern against last-12-month Actual GCI
- When coverage is computed for the baseline stage
- Then coverage display is capped at `100%`
- And internal overshoot is permitted only up to `105%`
- And user cannot proceed while baseline coverage is `< 80%`
- And user cannot proceed while `Untracked Drivers` remainder is `> 20%`
- And baseline and target KPI streams are persisted separately for later use

### 25) Continuity Projection ON/OFF Horizon Behavior (Planned Addendum)
- Given continuity projection is configurable per environment/admin toggle
- When continuity is `OFF`
- Then provider-forecast contribution is zero and continuity modifier is `1.0`
- When continuity is `ON`
- Then far-horizon projection can include provider-forecast continuity inputs
- And continuity inputs remain forecast-only (not user logs)
- And overlapping real logs replace/override provider continuity contributions

### 26) Horizon Confidence Penalty by Forecast Reliance (Planned Addendum)
- Given per-horizon projection outputs include provenance splits (`real`, `seeded_history`, `provider_forecast`)
- When provider forecast share increases in a horizon
- Then horizon confidence decreases by continuity modifier clamp rules without changing base projection values
- And modifier floor/ceiling behavior is preserved (`0.60` to `1.00`)

### 27) Synthetic / Provider Forecast Isolation Rules (Planned Addendum)
- Given onboarding seeded history and provider continuity inputs exist for forecast integrity
- When challenge progress, leaderboards, GP/VP, and calibration truth updates are computed
- Then provider continuity inputs are excluded from those computations
- And seeded/provider sources remain distinguishable for audit/debug purposes

### 28) Projection Lab Scenario Regression Harness (Planned A3/A4)
- Given an admin creates a Projection Lab scenario with synthetic inputs
- When the scenario is executed
- Then the real KPI→PC algorithm path is used (inputs mocked only)
- And continuity ON/OFF comparisons can be run and diffed
- And regression assertions can evaluate known failure modes (6-month cliff, onboarding skew, KPI selection bias)
- And run outputs can be exported/reviewed without mutating production user data by default

### 29) Stream Token Role/Scope Gating (Planned W13)
- Planned dependency gate: runnable only after `DEP-002`, `DEP-004`, and `DEP-005` close.
- Given an authenticated user without required channel scope
- When user requests `POST /api/channels/token`
- Then API returns `403` and no provider token is issued
- And response uses Compass-owned error envelope (`code`, `message`, `request_id`) with no raw provider internals
- Given an authorized member/leader/admin
- When request is valid for allowed channel scope
- Then API returns token payload with bounded TTL and provider metadata
- And token payload includes resolved Compass grants for requested purpose (`chat_read` | `chat_write` | `channel_admin`)

### 30) Channel Mapping and Membership Reconciliation (Planned W13)
- Planned dependency gate: runnable only after `DEP-002`, `DEP-004`, and `DEP-005` close.
- Given a Compass channel context with changed membership
- When `POST /api/channels/sync` runs
- Then provider membership reconciles to Compass authority state
- And drift results are reported with deterministic status fields
- And unauthorized membership elevation is not possible via provider-only operations
- And reconcile result includes deterministic diff metadata (`members_added`, `members_removed`, `roles_updated`, `metadata_updated`)

### 31) Messaging Reliability Parity (Planned W13)
- Planned dependency gate: runnable only after `DEP-002`, `DEP-004`, and `DEP-005` close.
- Given provider-backed chat is enabled behind Compass facade
- When users send/read/broadcast messages through existing channel families
- Then unread/read/broadcast semantics remain consistent with scenarios #11-#13
- And failures return stable Compass error envelopes without leaking provider internals
- And channel payload sync-state metadata remains deterministic (`not_synced|syncing|synced|stale|error`)

### 32) Mux Asset Lifecycle Verification (Planned W13)
- Given an authorized upload session is created via `POST /api/coaching/media/upload-url`
- When provider lifecycle events arrive at `POST /api/webhooks/mux`
- Then signature verification gates event acceptance
- And asset status transitions follow upload -> processing -> ready/failed
- And coaching/journey payload read-model fields reflect latest valid lifecycle state
- Planned validation detail (gated by `DEP-002` / `DEP-004` / `DEP-005`):
  - verify replay-window rejection for stale webhook timestamps
  - verify idempotent handling of duplicate webhook deliveries
  - verify lifecycle ordering tolerance (out-of-order events do not regress `ready` to earlier states)
  - verify `deleted` event removes playback eligibility while preserving audit record

### 33) Provider Failure Path Handling (Planned W13)
- Planned dependency gate: runnable only after `DEP-002`, `DEP-004`, and `DEP-005` close.
- Given provider timeout/token error/sync failure/webhook signature mismatch
- When affected chat/video endpoint is called
- Then API returns deterministic error envelopes with request tracing
- And failure counters are visible in ops/admin diagnostics
- And client-facing fallback states can be rendered without blocking unrelated KPI flows
- And chat token/sync failure paths enforce predictable status mapping (`403` scope-denied, `409` reconcile conflict, `503` provider unavailable)
- Planned Mux-focused failure assertions (gated by `DEP-002` / `DEP-004` / `DEP-005`):
  - upload-url failure returns stable typed code (`provider_unavailable` / `size_limit_exceeded` / `unsupported_content_type`)
  - playback-token call for non-ready media returns `media_not_ready` and no token
  - webhook signature mismatch increments verification-failure counters and does not mutate lifecycle state
  - processing-timeout path marks media `failed` with sanitized provider failure detail

### 34) Compliance Retention and Deletion Policy Enforcement (Planned W13)
- Given approved retention/deletion policy under `DEP-004`
- When chat/video metadata reaches retention boundaries or receives deletion request
- Then lifecycle behavior matches approved retention matrix
- And audit trail captures policy actor/time/reason
- And provider-side deletion/retention sync outcomes are recorded
- Planned video-specific compliance assertions (gated by `DEP-002` / `DEP-004` / `DEP-005`):
  - retention TTL enforcement removes expired playback eligibility
  - deletion request persists legal/audit reason and actor metadata
  - provider deletion reconciliation state is exposed as read-model status (`pending_delete`, `deleted`, `delete_failed`)
  - retry policy for failed provider deletion is auditable and bounded

### 35) Regression Guardrail for Existing Communication/Coaching Paths (Planned W13)
- Planned dependency gate: runnable only after `DEP-002`, `DEP-004`, and `DEP-005` close.
- Given Stream/Mux adapter paths are enabled
- When regression suite runs on existing endpoint families
- Then `inbox*`, `channel_thread`, `coach_broadcast_compose`, and `coaching_journeys*` paths remain green
- And KPI engine behavior remains unchanged (no provider side-effect mutation)
- And role-gated chat token issuance remains Compass-authoritative (no provider-only role escalation path)
- Planned rollout/regression assertions (gated by `DEP-002` / `DEP-004` / `DEP-005`):
  - Mux feature flag OFF path preserves existing coaching/journey payload contract shape (fields may be null/absent per planned additive contract)
  - Mux feature flag ON path adds media lifecycle fields without breaking existing clients
  - fallback copy/state for `processing` and `failed` media does not block lesson/journey navigation
  - no provider webhook event can mutate KPI log totals, forecast base values, or confidence base calculation inputs

## Edge Cases

### E1) Offline Log Sync Ordering and Integrity
- Given multiple offline logs from same user/device
- When logs sync in batch later
- Then server preserves original event timestamps
- And duplicate events are idempotently handled when `idempotency_key` is reused
- And derived totals are consistent regardless of upload order

### Execution Note (Current Sprint)
- Runnable baseline acceptance command:
  - `cd backend && npm run test:sprint1`
- This command validates scenarios #1-#6 plus E1, E3, E4, and E7 against local backend + configured Supabase project.
- Algorithm parity command:
  - `cd backend && npm run test:algorithms`
- This command validates deterministic engine behavior for PC timeline/decay, confidence components, onboarding back-plot, and GP/VP bump logic.
- Sprint 2 command:
  - `cd backend && npm run test:sprint2`
- This command includes Sprint 1 regression checks and validates #7, #8, and E6.
- Sprint 3 command:
  - `cd backend && npm run test:sprint3`
- This command includes Sprint 1 + Sprint 2 regression checks and validates communication baseline policy checks.
- Sprint 4 command:
  - `cd backend && npm run test:sprint4`
- This command includes Sprint 1-3 regression checks and validates coaching + AI approval-first baseline behavior.
- Sprint 5 command:
  - `cd backend && npm run test:sprint5`
- This command includes Sprint 1-4 regression checks and validates hardening + launch-gate policy checks.
- Sprint 6 command:
  - `cd backend && npm run test:sprint6`
- This command includes Sprint 1-5 regression checks and validates sponsored challenge + offline batch ingest baseline.
- Sprint 7 command:
  - `cd backend && npm run test:sprint7`
- This command includes Sprint 1-6 regression checks and validates admin core operations baseline.
- Sprint 8 command:
  - `cd backend && npm run test:sprint8`
- This command includes Sprint 1-7 regression checks and validates notification queue + error envelope baseline.
- Sprint 9 command:
  - `cd backend && npm run test:sprint9`
- This command includes Sprint 1-8 regression checks and validates confidence snapshot + policy summary baseline.
- Sprint 10 command:
  - `cd backend && npm run test:sprint10`
- This command includes Sprint 1-9 regression checks and validates performance/index + final backend gate baseline.
- Backend MVP gate:
  - `cd backend && npm run test:backend-mvp`
- Release gate command:
  - `cd backend && npm run test:release`
- W13 docs-first note:
  - Scenarios #29-#35 are contract planning scenarios in this slice and become runnable only after dependency gates (`DEP-002`, `DEP-004`, `DEP-005`) close and implementation waves are approved.

### E2) Expired Token
- Given an expired bearer token
- When requesting protected endpoint
- Then response is `401` with stable error payload

### E3) Missing Required Direct Value Input
- Given KPI requiring direct value input
- When `logged_value` is missing
- Then response is `422` and no partial write occurs

### E4) Deactivated Account Behavior
- Given a user with `account_status=deactivated`
- When user attempts login or log submission
- Then writes are blocked by policy
- And historical data remains retained for reactivation

### E5) KPI Definition Update Safety
- Given admin edits a KPI’s weight/TTC settings
- When new logs are created after the change
- Then new logs use new settings
- And historical logs remain auditable with prior effective values/rules
- And historical timing behavior remains stable because applied timing is persisted per log

### E6) Challenge Late-Join Policy
- Given a user joins an already-running challenge
- When prior-log inclusion is set to OFF
- Then progress starts at join timestamp only
- When prior-log inclusion is ON
- Then eligible historical logs in challenge window are included

### E7) API Error Handling
- Given malformed request body
- When endpoint validation runs
- Then response is `400` with clear field-level message where possible

### E8) Sponsored CTA Safety
- Given sponsored challenge contains CTA URL
- When user taps CTA
- Then link opens in approved browser flow
- And tap event is tracked (without blocking challenge progression)

### E9) Selection Bias Convergence (Planned Simulation Scenario)
- Given two synthetic users with identical closings but different tracked KPI subsets
- When sufficient calibration updates are simulated via Projection Lab
- Then prediction accuracy converges within bounded tolerance across both users

### E10) Continuity Replacement Overlap Safety (Planned)
- Given continuity projection contributes forecast-only future inputs
- When real KPI logs arrive in the same buffered horizon window
- Then overlapping provider continuity contributions are removed/ignored deterministically
- And no duplicate contribution remains in horizon provenance accounting

## Regression Checklist

- Auth routes still enforce bearer token requirements.
- PC and Actual GCI remain separated in API payloads and dashboard composition.
- GP/VP logs do not write or inflate PC contribution fields.
- Forecast Confidence can change without mutating base projection values.
- Pipeline Anchors remain accepted and queryable in current relevance window.
- KPI selection surfaces exclude non-selectable operational entries (`Deal Closed`, `Pipeline Anchor`) while retaining visibility of locked tier-restricted selectable KPIs.
- KPI payout/value/weight metadata remains immutable in member-facing KPI flows and mutable only through admin KPI catalog paths.
- Team role checks still prevent non-leaders from leader-only actions.
- Tier checks still block restricted features with predictable `403` responses.
- Sponsored challenge endpoints return correct metadata and join behavior.
- Challenge detail fallback rendering remains safe when team aggregate/KPI drill-in fields are unavailable in current challenge payload families.
- Admin CRUD endpoints remain role-restricted and auditable.
- Error responses continue to follow documented status codes (`400/401/403/404/409/422/500`).

## Frontend Acceptance Harness (FE Program)

This section defines UI/API integration validation for the frontend sprint roadmap (FE-00, M1-M8, A1-A4).

### Harness Principles
- Validate API contract consumption from `docs/spec/04_api_contracts.md` without redefining backend rules.
- Validate UI state contract on key screens:
  - `loading`
  - `empty`
  - `error`
  - `ready`
- Preserve non-negotiables in UI representation:
  - PC vs Actual GCI separation
  - GP/VP never represented as PC
  - confidence as display-only overlay
  - pipeline anchors shown as forecast input context

### Sprint Mapping Matrix

| Frontend Sprint | Required Scenario Coverage | UI Integration Focus |
|---|---|---|
| FE-00 | harness bootstrap checks | Sprint gate update, traceability links, asset-readiness gate definitions |
| M1 | #1, E2 | Auth shell, login parity, session-expired recovery, protected-route loading/error states |
| M2 | scenario #1 extension, #6A, #6B, and onboarding/profile state validation | Onboarding form validation, recommended KPI pick UX, KPI value read-only behavior, full catalog visibility, locked-tier affordances, profile/goal persistence UX, empty/error treatment |
| M3 | #2, #3, #4, #5, #6, E3 | KPI log UX, dashboard projection/actual split, confidence overlay behavior, pipeline anchor update UI |
| M4 | #7, #7A, #8, #9, E6 | Challenge discovery/join/progress UX, detail fallback safety, leader permissions affordances, tier-lock upgrade routing |
| M5 | #11, #12, #13 | Messaging/channel membership enforcement UX, unread/mark-seen flows, broadcast role gating |
| M6 | #14, #15, #16, #17, #18, #20, E1 | Coaching and AI workflows, notifications UX, offline queueing/sync visibility and retry handling |
| M7 | #10, #19, E8 | Sponsored challenge list/detail/join UX, CTA open flow, tier restrictions and sponsor metadata rendering |
| M8 | full #1-#20 + E1/E2/E6/E8 regression | Cross-device QA, accessibility checks, release readiness verification |
| A1 | #21 (authz baseline) | Admin auth guard, role-gated navigation, 403 handling on restricted admin routes |
| A2 | #21 (kpi/template CRUD) | KPI catalog and challenge template CRUD UI behavior with safe deactivation patterns |
| A3 | #21 (user ops), analytics/report validation | User role/tier/status operations, analytics dashboard views, report/export initiation UI |
| A4 | #22, #23, #28 | Notification queue ops UI, policy summary UI, projection-lab regression/admin hardening checks |

## Addendum Acceptance Mapping (2026-02-25, Planned / Spec-Only)

- Part 1 references:
  - `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_1_PROJECTION_INTEGRITY_CALIBRATION.md`
- Part 2 references:
  - `docs/spec/appendix/ALGORITHM_ADDENDUM_PART_2_PROJECTION_LAB.md`
- Planned backend algorithm validation additions:
  - #24, #25, #26, #27
  - E9, E10
- Planned admin Projection Lab validation:
  - #28 (A3/A4 rollout path)
- Planned implementation note:
  - These scenarios are spec-mapped now and should be activated when corresponding backend/admin features are implemented.

### Frontend Regression Gate
- No sprint closes unless prior frontend sprint coverage remains green.
- No pixel-parity story closes unless corresponding export exists with node-id + dimensions logged in `design/figma/FIGMA_INDEX.md`.
- Any UI change impacting contract semantics must cross-check affected rows in `docs/spec/04_api_contracts.md`.

### FE-00 Harness Closeout Criteria (Gate)

| Gate Check | Pass Condition | Fail Condition |
|---|---|---|
| Sprint gate source of truth | `architecture/CURRENT_SPRINT.md` includes FE-00 goal, in-scope/out-of-scope, complete sprint traceability matrix, and FE-00 checkpoint marked complete | FE-00 checkpoint fields remain `pending`/`TBD` or missing |
| Harness mapping coverage | Frontend harness section maps FE-00, M1-M8, and A1-A4 to scenario coverage and UI integration focus | Any frontend sprint row missing or not linked to acceptance scenarios |
| Asset-readiness gate linkage | FE-00 required screen/component export checks are explicit and referenced by sprint gate docs | Required export checks or readiness statuses are missing/ambiguous |
| Non-negotiable alignment | Harness principles and regression gate preserve PC vs Actual separation, GP/VP constraints, confidence display-only rule, and pipeline-anchor visibility | Harness wording permits behavior that conflicts with non-negotiables |
| Traceability consistency | FE-00 traceability row in `CURRENT_SPRINT.md` matches FE-00 harness row and references this file | FE-00 traceability row and harness row are inconsistent |

### FE-00 Harness Closeout Status
- `Status`: `passed` (docs gate closeout)
- `Closeout date`: `2026-02-27`
- `Validated by`: cross-doc consistency check between:
  - `architecture/CURRENT_SPRINT.md`
  - `docs/spec/05_acceptance_tests.md`
