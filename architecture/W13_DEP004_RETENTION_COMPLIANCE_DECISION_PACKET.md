# W13 DEP-004 Retention + Compliance Decision Packet

## Purpose
Owner sign-off packet for `DEP-004` (data retention/compliance policy) required before runtime Stream/Mux implementation waves.

Status: `decision needed` (docs/control-plane gate).

## Decision Rule
- `DEP-004 = PASS` only when all required policy decisions below are approved and signed by Product + Legal + Architecture.
- Any unresolved required decision keeps `DEP-004` in `open` status and blocks:
  - `W13-IMPLEMENT-STREAM-ADAPTER-A`
  - `W13-IMPLEMENT-MUX-ADAPTER-A`
  - `W13-RUNTIME-PARITY-AND-HARDENING-A`

## Retention/Deletion Matrix by Data Class

| Data Class | Examples | Retention Baseline | Deletion Trigger | Deletion SLA | Notes |
|---|---|---|---|---|---|
| Chat Message Content | channel messages, DMs, broadcast content | `DECISION NEEDED` (e.g., 12-24 months) | User deletion request, org termination, policy expiry | `DECISION NEEDED` (e.g., 30 days) | Must preserve role/audit requirements without retaining beyond policy. |
| Chat Metadata | sender id, channel id, timestamps, delivery/read state | `DECISION NEEDED` | Policy expiry or legal instruction | `DECISION NEEDED` | Metadata may require longer retention than content for auditability. |
| AI Suggestion Artifacts | suggestion prompt/response, approval state, reviewer metadata | `DECISION NEEDED` | Policy expiry, legal deletion request | `DECISION NEEDED` | Must remain approval-first and auditable while policy-active. |
| Video Asset Media | uploaded media binary/transcodes | `DECISION NEEDED` | Policy expiry, explicit delete, contract termination | `DECISION NEEDED` | Applies to provider-hosted media lifecycle controls. |
| Video Metadata | media id, provider ids, processing state, error codes | `DECISION NEEDED` | Policy expiry + hold release | `DECISION NEEDED` | Retained for operational traceability; sanitized fields only. |
| Webhook/Event Audit Records | event ids, verification status, receipt timestamps | `DECISION NEEDED` | Policy expiry (unless legal hold) | `DECISION NEEDED` | Needed to prove verification/deletion compliance actions. |
| Security/Access Logs | token issuance logs, sync failures, operator actions | `DECISION NEEDED` | Security policy expiry | `DECISION NEEDED` | Align with incident response + investigation windows. |

## Legal Hold Rules (Required)

1. Hold scope precedence:
   - Legal hold overrides standard retention/deletion windows for covered records.
2. Hold activation requirements:
   - Hold must include owner, case reference, effective timestamp, and scoped data classes.
3. Hold behavior:
   - Covered records are exempt from deletion jobs until hold release.
   - Read-only/audit visibility remains available to authorized operators only.
4. Hold release requirements:
   - Release requires legal approver identity, release timestamp, and explicit release scope.
5. Post-release behavior:
   - Normal retention/deletion timers resume; deletion processing follows defined SLA.

## Stream/Mux Reconciliation Behavior

### Stream (Chat)
- Compass remains retention authority.
- Deletion/retention actions in Compass must reconcile to provider state and store outcome status.
- Required reconciliation statuses:
  - `delete_pending`
  - `delete_confirmed`
  - `delete_failed_retryable`
  - `delete_failed_terminal`
- Failure handling:
  - Retry policy required with bounded attempts and auditable failure capture.
  - Terminal failures require ops/legal review path and explicit exception record.

### Mux (Video)
- Compass policy drives playback eligibility + deletion intent.
- Provider asset deletion/restriction must be reconciled back into Compass metadata.
- Required reconciliation statuses:
  - `retention_active`
  - `pending_delete`
  - `deleted`
  - `delete_failed`
- Failure handling:
  - Failed provider deletion remains blocked from playback where policy requires.
  - Failures must be visible in ops diagnostics and included in compliance audit exports.

## Unresolved Decisions (Owner Action Required)

| Decision ID | Topic | Decision Needed | Owner(s) | Due Date | Current State |
|---|---|---|---|---|---|
| D4-001 | Chat content retention duration | Final retention window for chat content by tenant tier/region | Product + Legal | 2026-03-06 | OPEN |
| D4-002 | Metadata retention duration | Whether metadata outlives content and by how long | Legal + Architecture | 2026-03-06 | OPEN |
| D4-003 | Deletion SLA | Max allowed deletion completion time after approved request | Product + Legal + Platform | 2026-03-07 | OPEN |
| D4-004 | Legal hold initiation rights | Which roles can create/release holds and required approvals | Legal + Security | 2026-03-07 | OPEN |
| D4-005 | Provider failure exception policy | When failed provider deletion can be accepted with compensating controls | Legal + Security + Architecture | 2026-03-08 | OPEN |
| D4-006 | Cross-border retention constraints | Region-specific retention/deletion deviations | Legal + Product | 2026-03-08 | OPEN |

## Explicit Sign-Off Block

| Function | Approver | Date | Decision |
|---|---|---|---|
| Product | `TBD` | `TBD` | PENDING |
| Legal | `TBD` | `TBD` | PENDING |
| Architecture | `TBD` | `TBD` | PENDING |
| Security | `TBD` | `TBD` | PENDING |

Final gate outcome:
- `DEP-004` = `PENDING` until all required decisions are resolved and sign-off table is complete.
