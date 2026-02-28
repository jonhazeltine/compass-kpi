# Project Control Plane

## Purpose
Keep the full Compass KPI program in view while executing one sprint at a time.

This document is the always-on project horizon and is used alongside:
- `architecture/ARCHITECTURE.md`
- `architecture/NON_NEGOTIABLES.md`
- `architecture/CURRENT_SPRINT.md`
- `architecture/DECISIONS_LOG.md`

## Program Horizon

### Phase Roadmap
| Phase | Objective | Entry Criteria | Exit Criteria | Status | Target Window |
|---|---|---|---|---|---|
| 0: Governance Baseline | Lock architecture guardrails, scope gates, and delivery workflow. | Architecture docs loaded and current. | Sprint gate and traceability workflow active. | active | Q1 2026 |
| 1: KPI Core | Deliver auth, KPI logging, dashboard, forecast foundations. | Tenancy + role assumptions documented. | KPI core acceptance tests pass. | planned | Q1-Q2 2026 |
| 2: Team + Challenge | Deliver team management, challenge lifecycle, leaderboards. | KPI core stable and monitored. | Team/challenge acceptance tests pass. | planned | Q2 2026 |
| 3: Communication Integration | Add channels, messaging, unread, push, broadcast controls. | Tenancy keys confirmed for comms schema. | Comms module passes role/rate/audit tests. | planned | Q2-Q3 2026 |
| 4: Coaching + AI Assist | Add journeys/coaching surfaces and AI suggestion queue (approval-first). | Coaching ownership model decided. | Approval queue and audit policy enforced. | planned | Q3 2026 |
| 5: Hardening + Launch | End-to-end QA, security checks, release readiness. | Feature-complete scope freeze. | Release checklist complete. | planned | Q3 2026 |
| 6: Backend Completion Track | Complete remaining backend MVP structure (sponsored, admin core, offline sync, notification pipeline, confidence parity). | Sprint 1-5 baseline stable with release gate passing. | `test:backend-mvp` gate passes with documented ops readiness. | active | Q1-Q2 2026 |

### W13 Docs-First Exception Milestone (Phase 3/4 Seam)
| Milestone | Scope Type | Objective | Blockers/Gates | Status |
|---|---|---|---|---|
| W13 Third-Party Video + Chat Integration Planning | docs/control-plane exception | Lock provider strategy (`Stream Chat`, `Mux`), contract surfaces, acceptance scenarios, and assignment sequencing without runtime code changes. | `DEP-002`, `DEP-004`, `DEP-005` must close before implementation waves A/B. | active |

### Cross-Sprint Invariants
These must remain true in every phase and sprint:
- PC and Actual GCI remain separate in schema, logic, and UI.
- GP/VP never generate PC.
- Forecast confidence modifies display and interpretation only.
- Pipeline anchors are required forecast inputs.
- Structural changes are logged in `architecture/DECISIONS_LOG.md`.

## Delivery Controls

### Sprint-to-Roadmap Traceability
For each sprint item in `architecture/CURRENT_SPRINT.md`, add:
- `Roadmap Phase`: one row from Phase Roadmap.
- `Spec Link`: one or more files in `docs/spec/`.
- `Non-Negotiables`: relevant rule numbers from `architecture/NON_NEGOTIABLES.md`.
- `Acceptance Tests`: links to scenarios in `docs/spec/05_acceptance_tests.md`.
- `Decision Log Needed`: yes/no.

### Dependency Register
| ID | Dependency | Blocking Scope | Needed By | Owner | Status | Notes |
|---|---|---|---|---|---|---|
| DEP-001 | Billing authority decision (Stripe-only vs hybrid) | Subscription workflows and paywall behavior | Before subscription implementation | Product/Architecture | open | Keep RevenueCat code deferred until resolved. |
| DEP-002 | Tenancy key strategy (`org_id`, optional `team_id`) | Team/comms/coaching schema | Before communication schema migration | Architecture | open | Must be explicit before adding comms tables. |
| DEP-003 | Coaching ownership model (leader vs dedicated coach role) | Coaching permissions and UI scopes | Before coaching module build | Product | open | Required for role matrix and endpoint access rules. |
| DEP-004 | Data retention and compliance policy | Message storage, AI context, deletion workflows | Before communication launch | Product/Legal | open | Needed for audit and deletion behavior. |
| DEP-005 | Third-party vendor security/legal checklist (Stream + Mux) | Runtime provider integrations, production key issuance, data handling approvals | Before third-party runtime implementation waves A/B | Security/Legal/Architecture | open | Must explicitly clear SOC/compliance, DPA, webhook/IP allowlist, secret rotation, incident response owners. Source of truth: `/Users/jon/compass-kpi/architecture/W13_VENDOR_SECURITY_LEGAL_CHECKLIST.md`. |

### W13 Dependency Closeout Tracker (DEP-002 / DEP-004 / DEP-005)

Single source for Wave A dependency closure state. Keep this tracker in sync with source artifacts.

| Dependency | Closure Criteria | Evidence Link(s) | Owner | Status |
|---|---|---|---|---|
| DEP-002 | Owner signs off final tenancy key strategy (`org_id` required, `team_id` optional) plus enforcement rules for Stream/Mux channel/media/webhook ownership and migration path. | `/Users/jon/compass-kpi/architecture/W13_DEP002_TENANCY_DECISION_PACKET.md` | Architecture + Owner | open |
| DEP-004 | Retention/deletion policy approved for chat/video metadata and webhook/audit retention windows, with explicit policy actor/approval record. | `TBD: policy artifact link` | Product/Legal | open |
| DEP-005 | All required gates in vendor checklist are `PASS` with evidence and Security/Legal/Architecture approvals recorded. | `/Users/jon/compass-kpi/architecture/W13_VENDOR_SECURITY_LEGAL_CHECKLIST.md` | Security/Legal/Architecture | open |

#### Wave A Ready Rule (Go / No-Go)
- `Wave A Ready = GO` only when **all three** dependencies above are `closed`:
  - `DEP-002` status = `closed`
  - `DEP-004` status = `closed`
  - `DEP-005` status = `closed`
- If any dependency remains `open`, `pending`, or `blocked`, `Wave A Ready = NO-GO` and runtime assignments remain blocked:
  - `W13-IMPLEMENT-STREAM-ADAPTER-A`
  - `W13-IMPLEMENT-MUX-ADAPTER-A`
  - `W13-RUNTIME-PARITY-AND-HARDENING-A`

### Risk Register
| ID | Risk | Probability | Impact | Mitigation | Trigger |
|---|---|---|---|---|---|
| R-001 | Architecture drift from spec docs during rapid iteration | medium | high | Enforce traceability checks in every PR. | Feature merges without spec references. |
| R-002 | Scope creep across sprints | high | high | Strict sprint gate via `CURRENT_SPRINT.md` and explicit approvals. | Work started without in-scope mapping. |
| R-003 | Non-negotiable rule regression | medium | high | Add acceptance scenarios tied to each non-negotiable. | KPI math or forecast changes without tests. |
| R-004 | Duplicate work across agents/sessions | medium | medium | Single task ledger with status + ownership. | Same artifact edited by multiple agents. |

## Agent Orchestration Rules
- Central architecture ownership remains in `architecture/*` docs.
- Cursor agents execute scoped tickets, not global architecture changes.
- Every agent output must include:
  - changed files
  - assumptions made
  - linked spec sections
  - linked acceptance tests
- No structural change merges without same-change update to `architecture/DECISIONS_LOG.md`.

## Non-Technical Change Control
Use one ID-backed queue for documentation/spec/design changes.

| Change ID | Type | Canonical File | Requested By | Status | Supersedes | Notes |
|---|---|---|---|---|---|---|
| DOC-001 | architecture | architecture/PROJECT_CONTROL_PLANE.md | Jon | active | — | Establishes full-project oversight model. |

Rules:
- Extend existing canonical docs first; avoid creating parallel docs.
- Every non-technical update declares whether it supersedes prior text.
- Keep one source of truth per subject area.

## Cadence
- Per task: validate traceability fields before implementation.
- Per PR: check non-negotiables, sprint scope, decision-log requirements.
- Per sprint close: update phase status, dependency statuses, risk statuses.
- Per sprint start: re-read architecture, non-negotiables, current sprint, and this file.
