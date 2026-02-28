# W13 Dependency Sign-Off Brief (DEP-002 / DEP-004 / DEP-005)

## Purpose
Single-page owner sign-off summary consolidating the required decisions to unlock W13 runtime waves (`Stream`, `Mux`).
Control-plane tracker source: `/Users/jon/compass-kpi/architecture/PROJECT_CONTROL_PLANE.md` (`W13 Dependency Closeout Tracker` section).

Date: `2026-02-28`  
Program slice: `W13 docs-first exception`  
Current Wave A gate: `NO-GO` (dependencies still `OPEN`)

## Status Language (Normalized)
- Dependency status: `OPEN` or `CLOSED`.
- Evidence status: `PRESENT` or `PENDING_EVIDENCE`.
- Sign-off status: `SIGNED` or `PENDING_SIGNATURE`.

## Go/No-Go Rule
`Wave A Ready = GO` only when all three dependencies are `CLOSED`:
- `DEP-002` Tenancy decision
- `DEP-004` Retention/compliance decision
- `DEP-005` Vendor security/legal checklist

If any dependency is `OPEN`, Wave A remains `NO-GO`.

## Consolidated Decision Summary

| Dependency | Decision Required | Dependency Status | Owner(s) | Source Artifact |
|---|---|---|---|---|
| DEP-002 | Approve final tenancy model and enforcement (`org_id` required; `team_id` optional; context ownership + webhook routing + migration rules). | OPEN | Architecture + Owner | `/Users/jon/compass-kpi/architecture/W13_DEP002_TENANCY_DECISION_PACKET.md` |
| DEP-004 | Approve retention/deletion policy matrix by data class, legal hold behavior, Stream/Mux reconciliation handling, and unresolved policy decisions. | OPEN | Product + Legal (+ Architecture/Security sign-off) | `/Users/jon/compass-kpi/architecture/W13_DEP004_RETENTION_COMPLIANCE_DECISION_PACKET.md` |
| DEP-005 | Pass all vendor security/legal gates (SOC/compliance, DPA, residency, secret rotation, webhook security, IR ownership, offboarding controls) with evidence. | OPEN | Security + Legal + Architecture | `/Users/jon/compass-kpi/architecture/W13_VENDOR_SECURITY_LEGAL_CHECKLIST.md` |

## Missing Evidence Callouts
- DEP-002: `PENDING_SIGNATURE` for owner model selection and Architecture/Owner sign-off; `PENDING_EVIDENCE` for closure decision-log reference.
- DEP-004: `PENDING_EVIDENCE` for unresolved retention windows/deletion SLA/legal-hold authority/failure exceptions; `PENDING_SIGNATURE` across Product/Legal/Architecture/Security.
- DEP-005: `PENDING_EVIDENCE` for all gate evidence links currently `TBD`; `PENDING_SIGNATURE` across Security/Legal/Architecture.

## Required Owner Decisions (Action List)

### DEP-002
- Approve recommended Model A (`org_id` required + optional `team_id`) or select alternate model with constraints.
- Confirm tenancy enforcement rules for token issuance, channel mapping, webhook ownership, and migration.

### DEP-004
- Finalize retention windows by data class.
- Finalize deletion SLA.
- Approve legal hold creation/release policy and authority.
- Approve provider deletion-failure exception policy.
- Approve cross-border retention deviations (if any).

### DEP-005
- Confirm evidence completeness for all seven checklist gates.
- Confirm named incident owners and escalation model.
- Confirm offboarding/termination controls are operationally testable.

## Consolidated Sign-Off Block

| Function | Approver | Date | Decision | Notes |
|---|---|---|---|---|
| Owner | `TBD` | `TBD` | PENDING_SIGNATURE | Final cross-dependency approval for Wave A gate. |
| Architecture | `TBD` | `TBD` | PENDING_SIGNATURE | DEP-002 enforcement and boundary confirmation. |
| Product | `TBD` | `TBD` | PENDING_SIGNATURE | DEP-004 policy acceptance. |
| Legal | `TBD` | `TBD` | PENDING_SIGNATURE | DEP-004/DEP-005 compliance acceptance. |
| Security | `TBD` | `TBD` | PENDING_SIGNATURE | DEP-005 control gate acceptance. |

## Final Gate Outcome
- `Wave A Ready`: `NO-GO` (until DEP-002, DEP-004, DEP-005 all move to `CLOSED`)
- Blocked assignments while `NO-GO`:
  - `W13-IMPLEMENT-STREAM-ADAPTER-A`
  - `W13-IMPLEMENT-MUX-ADAPTER-A`
  - `W13-RUNTIME-PARITY-AND-HARDENING-A`

## Wave A GO/NO-GO Matrix
| Dependency | Dependency Status | Evidence Status | Sign-Off Status | Wave A Criterion Met |
|---|---|---|---|---|
| DEP-002 | OPEN | PENDING_EVIDENCE | PENDING_SIGNATURE | NO |
| DEP-004 | OPEN | PENDING_EVIDENCE | PENDING_SIGNATURE | NO |
| DEP-005 | OPEN | PENDING_EVIDENCE | PENDING_SIGNATURE | NO |
| **Overall Wave A** | **NO-GO** | — | — | **NO** |
