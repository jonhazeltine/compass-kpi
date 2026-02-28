# W13 Vendor Security + Legal Checklist (DEP-005)

## Purpose
Dependency closure checklist for third-party runtime integrations (`Stream Chat`, `Mux`) before Wave A/B implementation starts.

Status: `planned/control-plane gate` until all required gates below are `PASS`.

## Gate Decision Rule
- `DEP-005 = PASS` only when every required gate in this file is marked `PASS`, with evidence links attached, and Architecture + Security + Legal approvals recorded.
- Any required gate marked `FAIL` or `PENDING` keeps `DEP-005` `open` and runtime provider implementation remains blocked.

## Required Pass/Fail Gates

| Gate ID | Gate | Required Evidence | PASS Criteria | FAIL Trigger |
|---|---|---|---|---|
| DEP5-G1 | SOC / Compliance Evidence | SOC 2 Type II report (or equivalent), security questionnaire responses, subprocessor list | Current report window covers intended launch period; no unresolved high-risk exceptions for chat/video data handling | Missing report, expired report window, or unresolved high-risk exception |
| DEP5-G2 | Data Processing Agreement (DPA) | Signed DPA + data flow appendix + deletion obligations | DPA executed by legal entities; processing roles and deletion/retention obligations explicitly defined | No signed DPA or missing processing/deletion terms |
| DEP5-G3 | Data Residency + Cross-Border Handling | Region map, storage/transit location statements, transfer mechanism docs | Approved region posture documented and compliant with product/legal policy for target tenants | Residency unknown, unsupported region, or transfer basis not documented |
| DEP5-G4 | Secret Rotation + Key Management | Key inventory, rotation cadence, owner assignment, revocation runbook | All provider keys/tokens have owner, cadence, and emergency revocation procedure; least-privilege scopes defined | Shared/unowned credentials, no cadence, or no revocation path |
| DEP5-G5 | Webhook Security Controls | Signature verification requirements, replay-window policy, source validation/IP allowlist policy, test evidence | Webhook auth model approved and testable (signature + replay protections + source controls) | Webhook trust model undefined or unverifiable |
| DEP5-G6 | Incident Response Ownership | Named on-call owners, escalation matrix, severity SLAs, provider contact path | Security + platform owners accept incident matrix and on-call handoff | No named owners/escalation path or undefined severity handling |
| DEP5-G7 | Offboarding / Termination Controls | Data export/deletion runbook, credential teardown checklist, contract termination checklist | Proven termination path for data access cutoff, credential revocation, and retained-audit handling | No enforceable offboarding controls or irreversible vendor lock-in risk |

## Status Tracker (Owners + Due Dates)

| Gate ID | Owner | Due Date | Current Status | Evidence Link(s) | Notes |
|---|---|---|---|---|---|
| DEP5-G1 | Security | 2026-03-06 | PENDING | `TBD` | Validate SOC/control exceptions for Stream and Mux independently. |
| DEP5-G2 | Legal | 2026-03-07 | PENDING | `TBD` | DPA must include deletion obligations aligned with `DEP-004` policy outcomes. |
| DEP5-G3 | Legal + Architecture | 2026-03-08 | PENDING | `TBD` | Confirm region policy by tenant segment and deployment geography. |
| DEP5-G4 | Security + Platform | 2026-03-05 | PENDING | `TBD` | Include rotation cadence + break-glass revoke procedure. |
| DEP5-G5 | Platform + Security | 2026-03-06 | PENDING | `TBD` | Include signature + replay-window + source-control test evidence. |
| DEP5-G6 | Security + Engineering Manager | 2026-03-05 | PENDING | `TBD` | Record primary/secondary incident owners and after-hours handoff. |
| DEP5-G7 | Legal + Security + Platform | 2026-03-09 | PENDING | `TBD` | Ensure termination checklist covers both providers and key cleanup. |

## Approval Checkpoint

| Function | Approver | Date | Approval |
|---|---|---|---|
| Security | `TBD` | `TBD` | PENDING |
| Legal | `TBD` | `TBD` | PENDING |
| Architecture | `TBD` | `TBD` | PENDING |

## Runtime Gate Binding
- Until this checklist reaches all-required `PASS`, these remain blocked:
  - `W13-IMPLEMENT-STREAM-ADAPTER-A`
  - `W13-IMPLEMENT-MUX-ADAPTER-A`
  - `W13-RUNTIME-PARITY-AND-HARDENING-A`
