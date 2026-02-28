# SOW Parity Matrix

## Purpose
Track parity between the external dev-team SOW sprint plan and the current Compass KPI implementation in this repo.

## Source Documents
- `/Users/jon/Downloads/SOW Signed (12).pdf` (21 pages, extracted 2026-02-20)
- `/Users/jon/Downloads/Proposal Jon.pdf` (2 pages, extracted 2026-02-20)

## Source Timeline Snapshot
- Proposal states revised timeline moved from 5.5 months to 6.5 months and includes Flutter direction plus advanced animation scope.
- SOW Milestone 3 ("Mobile App Development") defines 8 sprints.
- Additional milestones in SOW include admin panel, testing/launch, and marketing website.

## Implementation Parity (Repo State)

### Milestone 3 / Sprint 1: Core Infrastructure & Authentication
Status: `partial`
- Done:
- Backend auth-protected API baseline and Supabase integration.
- Core database migrations and role-aware access checks.
- Not yet done:
- Full mobile app architecture implementation as defined in SOW sprint narrative.

### Milestone 3 / Sprint 2: Onboarding & User Profile
Status: `partial`
- Done:
- User row initialization and baseline profile usage in KPI calculations.
- Not yet done:
- Full onboarding UI flow and profile UX.
- Full backend onboarding edge-function workflow as described in SOW.

### Milestone 3 / Sprint 3: KPI System & Dashboard Foundation
Status: `partial-to-strong`
- Done:
- KPI log ingestion, PC/GP/VP/Actual separation, dashboard endpoint, pipeline anchors, idempotency.
- Not yet done:
- Full client KPI visual/animation layer and sound/haptics behavior from SOW.

### Milestone 3 / Sprint 4: Challenge System & Gamification
Status: `partial`
- Done:
- Teams, memberships, challenges listing/join, baseline progress + leaderboard logic.
- Not yet done:
- Full challenge template management (admin flows).
- Full gamified mobile UX and animations.

### Milestone 3 / Sprint 5: Team Management & Collaboration
Status: `partial-to-strong`
- Done:
- Team creation/member management, channels, messages, unread counts, broadcast permissions, push token registration.
- Not yet done:
- Full team collaboration UI and some drill-down/admin breadth implied in SOW.

### Milestone 3 / Sprint 6: Advanced Features & Notifications
Status: `partial-to-strong`
- Done:
- Push token persistence, coaching baseline, AI suggestion queue (approval-first), hardening checks.
- Sponsored challenge read APIs and tier-gated sponsored participation linkage.
- Offline batch KPI ingest endpoint with idempotent replay handling.
- Notification queue and dispatch status lifecycle baseline.
- Not yet done:
- Full push provider integration and scheduling automation.
- Offline cache/sync UX and robust sync orchestration from app side.
- Forecast confidence "dual logic" algorithm parity with SOW narrative.

### W13 Third-Party Managed Service Plan (Docs-First Exception)
Status: `planned (docs locked, implementation gated)`
- Scope lock:
  - Communications provider fixed to `Stream Chat`.
  - Video provider fixed to `Mux` (direct upload + signed playback + webhook lifecycle).
  - Compass backend/API facade remains source of truth for all clients.
- Sequence lock:
  - `Wave A`: Stream adapter/token/channel-sync foundation.
  - `Wave B`: Mux adapter/upload/playback/webhook foundation.
  - `Wave C`: cross-surface parity + failure handling + observability.
  - `Wave D`: release hardening and regression/perf/compliance validation.
- Gating:
  - Runtime implementation is blocked until `DEP-002`, `DEP-004`, and `DEP-005` are closed.

### Milestone 3 / Sprint 7: Sponsored Challenges & Polish
Status: `not started/low`
- Done:
- Very limited sponsored challenge references in contracts.
- Not yet done:
- Sponsored challenge schema/API system and sponsor management backend.
- Performance/polish pass at full product scope.

### Milestone 3 / Sprint 8: Testing & QA
Status: `partial`
- Done:
- Automated backend acceptance chain through `test:sprint5` and `test:release`.
- Not yet done:
- Full end-to-end product QA/UAT, device matrix, and app-store readiness workflows.

### Milestone 4+5: Admin Panel Design & Development
Status: `partial`
- Done:
- Admin backend core APIs for KPI catalog, challenge templates, and user role/tier/status operations.
- Not yet done:
- Full admin web surface.
- Advanced admin analytics/reporting/export families.

### Milestone 6: Testing, Bug Fixing & Launch
Status: `partial`
- Done:
- Backend launch-gate command and ops checklist baseline.
- Not yet done:
- Production deployment runbook execution, full cross-surface launch readiness.

### Milestone 7: Website Designs & Development
Status: `not started`
- Not yet done:
- Marketing website implementation.

## Backend Coverage Snapshot (Current)
Implemented backend routes primarily cover:
- KPI core (`/kpi-logs`, `/dashboard`)
- Teams/challenges (`/teams*`, `/challenges`, `/challenge-participants`)
- Communication (`/api/channels*`, `/api/messages/*`, `/api/push-tokens`)
- Coaching and AI baseline (`/api/coaching/*`, `/api/ai/suggestions*`)
- Ops summaries (`/ops/summary/sprint1|2|3`)

Not implemented backend route families listed in API spec:
- Admin CRUD/report/export families (`/admin/*`)

## Interpretation
- Current repo is ahead on backend foundation relative to typical early SOW sprint velocity.
- Current repo is behind SOW parity on UI-heavy scope, admin panel scope, and website scope.
- Backend MVP completion track (Sprint 6-10) is now implemented and regression-gated in repo.
- Remaining parity gap versus SOW is primarily UI/app polish, full admin surface breadth, and website scope.

## Backend Completion Sprint Roadmap (Proposed)

### Sprint 6: Sponsored Challenge Core + Offline Batch Ingest
Goal: close highest-impact missing member-facing backend surfaces.
- In scope:
- Schema and APIs for sponsored challenges (`/sponsored-challenges`, `/sponsored-challenges/:id`).
- Minimal sponsor entities and active-window filtering.
- Bulk offline KPI ingest endpoint with idempotent replay safety.
- Acceptance command: `npm run test:sprint6` (chains through sprint1-5).

### Sprint 7: Admin Core Operations APIs
Goal: complete minimal admin-operable backend management surfaces.
- In scope:
- Admin KPI catalog CRUD endpoints.
- Admin challenge template CRUD endpoints.
- Admin user role/tier/status update endpoints.
- Acceptance command: `npm run test:sprint7` (chains through sprint6).

### Sprint 8: Notification Delivery + Ops/Error Standardization
Goal: convert push token persistence into an operational notification backend.
- In scope:
- Push dispatch queue + send/retry/audit tables and worker path.
- Baseline scheduled notification flow for challenge/coaching reminders.
- Standardized error envelope with stable `code/message/request_id`.
- Acceptance command: `npm run test:sprint8` (chains through sprint7).

### Sprint 9: Forecast Confidence Parity + Security Audit Hardening
Goal: align confidence engine behavior and lock down policy surface.
- In scope:
- Implement/validate forecast confidence dual-logic model parity (recency + projected-vs-actual calibration).
- RLS/policy audit pass for all sprint1-9 tables.
- Security-focused regression checks for privilege boundaries.
- Acceptance command: `npm run test:sprint9` (chains through sprint8).

### Sprint 10: Backend MVP Finalization + Launch Backend Gate
Goal: finalize backend MVP and lock release gate.
- In scope:
- Performance/indexing pass on high-volume query paths.
- Final backend launch checklist and rollback verification.
- Consolidated release-gate command (`npm run test:backend-mvp`) chaining sprint1-10.
- Acceptance command: `npm run test:sprint10` + `npm run test:backend-mvp`.

## Gating and Testing Protocol (Same Pattern)
- Every sprint adds:
- SQL migration(s) if schema changes are required.
- One dedicated acceptance runner `backend/scripts/sprintX_acceptance.js`.
- One package script `test:sprintX` that chains all previous sprint suites first.
- No sprint marked complete unless:
- New `test:sprintX` passes.
- All chained prior sprint tests remain green.
- `docs/spec/04_api_contracts.md` and `docs/spec/05_acceptance_tests.md` are updated.
- `architecture/DECISIONS_LOG.md` is updated when structural changes are introduced.
