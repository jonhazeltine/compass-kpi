# Agent Assignment Board

## Purpose
Single control-plane board for active/blocked/completed agent assignments in `/Users/jon/compass-kpi`.

Use this to reduce chat handoff overhead. The controller thread should read/update this file before issuing new worker instructions or reviewing returned work.

## Short-Form Worker Launch (Default)
Default instruction to a worker should be:

`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment <ASSIGNMENT_ID> exactly as written. Follow the assignment block, validation requirements, and report-back format.`

Only use long custom prompts when the board is missing required details or a one-off exception is needed.

## Maintenance Rules (Required)
- Update this board when an assignment is created, blocked, reassigned, completed, or approved.
- Include `Program status`, `Persona`, and `Screens in scope` for every UI-facing assignment.
- If a worker changes screen availability/wiring/status, update both docs in the same change set:
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- Figma-first UI assignments must include exact node IDs and export filenames.
- Prefer separate worktrees for concurrent code workers touching app code.
- Every `active` assignment must have a detailed assignment block in `## Assignment Specs`.
- Workers should be launched from assignment IDs, not ad hoc prompt names.

## Assignment Lifecycle (Status Values)
- `queued`: approved but not started
- `active`: currently assigned and in progress
- `blocked`: cannot proceed; blocker must be listed
- `review`: worker returned results/commit; awaiting controller review
- `committed`: accepted commit exists (push may still be pending)
- `pushed`: accepted and pushed
- `closed`: fully complete and no further action expected

## Concurrency / Ownership Rules (Default Rails)
- Prefer separate worktrees for concurrent code workers.
- One active code worker owns a high-conflict file/surface at a time (e.g. `app/screens/KPIDashboardScreen.tsx`).
- If an assignment needs a shared file owned by another active assignment, worker must stop and report blocker.
- Board is the authority for assignment ownership and status; chat summaries do not override the board.

## Program Status (Current)
- Program baseline: `M3 / M3b` active
- Approved overlap slice: `M5` Team management parity (Figma-first)
- Admin track: A2 usability pass committed; branch contains additional docs/control-plane commits
- Challenge flow: CTA/link rescue committed and accepted

## Active Assignments

| ID | Status | Program status | Persona | Flow | Screens in scope | Owner | Branch / Worktree | Figma refs | Deliverable |
|---|---|---|---|---|---|---|---|---|---|
| `TEAM-MEMBER-PARITY-A` | `active` | `M3/M3b + approved M5 overlap` | `Team Member` | `team + challenge participation` | `Team Dashboard (member perspective)`, `Team Challenges`, `Challenge List`, `Challenge Details`, `Challenge Leaderboard / Results` | worker (mobile) | `codex/a2-admin-list-usability-pass` (recommend dedicated worktree) | Team Member Team/Challenge flow refs from Figma persona groups; exact node IDs required in report | Large-swatch Team Member participation parity + wiring pass (role-appropriate CTA cleanup, member-view modules, team/challenge cross-surface consistency, docs status updates) |

## Blocked Assignments

| ID | Status | Program status | Persona | Flow | Screens | Blocker | Next action |
|---|---|---|---|---|---|---|---|
| `COACHING-INTEGRATION-A` | `queued` | `post Team Member parity planning` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` | host surfaces across `Home`, `Challenge`, `Team`, `Profile` + future `Inbox/Journeys` | Wait for Team Member participation parity baseline and manual feature-set definition details | Define first manual coaching slice against coaching matrix + wiring addendum |

## Recently Completed (Awaiting Review / Landed on Branch)

| ID | Status | Program status | Persona | Screens affected | Commit(s) | Notes |
|---|---|---|---|---|---|---|
| `TEAM-PARITY-A` | `committed` | `M3/M3b + approved M5 overlap` | `Team Leader` | `Team Dashboard`, `Invite Member`, `Pending Invitations`, `Team KPI Settings`, `Pipeline`, `Single Person Challenges / Team Challenges` | `9e572e1` | Team Leader mobile flow parity swath completed; docs sync rule satisfied in same commit. |
| `ADMIN-A2-USABILITY` | `committed` | `A2` | `Admin operator` | `Admin KPI Catalog`, `Challenge Templates` (web admin) | `0a45742` | Row-window reset, no-results recovery, show-more count, template ID visibility |
| `MOBILE-CHALLENGE-RESCUE` | `committed` | `M3/M3b` | `Solo/User + Team contexts (challenge flow)` | `Challenge List`, `Challenge Details`, `Challenge Leaderboard` | `020ce4d` | CTA/link audit + misleading CTA fixes |
| `FIGMA-TEAM-EXPORTS` | `committed+pushed` | `control-plane` | `N/A` | Team flow canonical exports/docs | `1638282`, `df8c825` | Added isolated Team exports; corrected Team Dashboard canonical node to `173-29934` |
| `INTENDED-FLOW-DOCS` | `committed+pushed` | `control-plane` | `All` | Intended screenmap/wiring/coaching docs | `b04f8bf`, `9f87eb3` | Persona screenmap, master wiring, coaching matrix/addendum |
| `DOC-STATUS-STANDARDIZATION` | `committed` | `control-plane` | `All` | Screenmap + wiring diagram docs | `bb9af5d`, `397749a` | Standard status colors + sync-update rule |

## Standard Worker Report Requirements (Reference)

Every worker report should include:
- `Program status`
- `Persona affected`
- `Screens changed`
- `Figma references used` (exact node IDs + exports if UI work)
- `Top mismatches before changes` (for parity work)
- `What now matches`
- `Still differs`
- `Deferred intentionally`
- `Files touched` (with line refs)
- `Validation performed` (`tsc`, screenshots, route checks)
- `Commit hash(es)` (if committed)

## Assignment Specs (Execute from here)

### `TEAM-MEMBER-PARITY-A`

#### Snapshot
- `Status:` `active`
- `Program status:` `M3/M3b + approved M5 overlap`
- `Persona:` `Team Member`
- `Flow:` `team + challenge participation`
- `Owner:` worker (mobile)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree preferred)

#### Screens In Scope (Large Swath)
1. `Team Dashboard (member perspective)`
2. `Team Challenges`
3. `Challenge List`
4. `Challenge Details`
5. `Challenge Leaderboard / Results`

#### Primary Objective
Complete a Team Member participation parity + wiring pass across Team/Challenge surfaces:
- role-appropriate Team Dashboard member perspective (de-emphasize/remove leader-only management emphasis where needed)
- Team Challenges member participation parity
- Challenge surfaces consistency for Team Member participation perspective
- cross-surface Team/Challenge navigation consistency
- docs status/wiring updates if statuses or transitions change

#### Required Reads (Standard + Assignment-Specific)
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/MOBILE_TEAM_CHALLENGE_SCREENMAP_AND_BUILD_SEQUENCE.md`
- `/Users/jon/compass-kpi/design/figma/FIGMA_INDEX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FIGMA_BUILD_MAPPING.md`

#### Constraints (Hard)
- No `Home/Priority` changes
- No backend/API/schema changes
- Preserve shared KPI logging mechanics (tile actions/endpoints/dedupe/KPI identity)
- Do not break Team Leader flow parity completed in `TEAM-PARITY-A` (`9e572e1`)
- Figma-first: exact node IDs/exports required in report for every touched screen
- No guessing from composite screenshots when exact export exists
- If exact Team Member/Challenge refs for a touched screen are missing, stop and report blocker before coding that screen

#### Implementation Pattern (Large Swath)
- Work in one focused run, but keep commits scoped (`1-2` commits max)
- Start with mismatch lists by screen
- Fix role-appropriate CTA hierarchy and routing first
- Then tighten parity/layout consistency across Team + Challenge participation surfaces
- Validate Team/Challenge member flows end-to-end
- Keep Team Logging behavior unchanged if touched

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Runtime screenshots (actual app) for each screen touched
- Route map checks for Team Member participation paths
- Confirm `Home/Priority` untouched
- Confirm shared logging mechanics unchanged

#### Docs Sync Rule (Required)
If screen availability/wiring/status changes, update BOTH in the same change set:
1. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
2. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Report-Back Format (Required)
- `Program status`
- `Persona affected`
- `Screens changed`
- `Figma references used` (exact node IDs + exports)
- `Top mismatches before changes` (by screen)
- `What now matches` (by screen)
- `Still differs` (by screen)
- `Deferred intentionally` (by screen)
- `Route map` (Team/Challenge member paths)
- `Files touched` (with line refs)
- `Home/Priority untouched?` (`yes/no`)
- `Shared logging mechanics unchanged?` (`yes/no`)
- `tsc result`
- `Screenshot paths`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment TEAM-MEMBER-PARITY-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

## Controller Review Checklist (Reference)
- Sprint scope alignment (`CURRENT_SPRINT.md`) and explicit exception approval if applicable
- Non-negotiables preserved (`NON_NEGOTIABLES.md`)
- Persona + screen scope matches assignment row
- Figma compliance (exact refs, no guessing)
- Docs sync rule followed (screenmap + wiring diagram updated together when status/wiring changed)
- Scoped commits only; no unrelated artifacts staged

## Notes / Working Conventions
- Temporary artifacts must not be committed:
  - `app/.tmp-tests/`
  - `app/test-results/`
  - `design/figma/exports/screens/_team_dashboard_candidates/`
  - swap files / editor temp files
- `references/...` is informational unless explicitly part of the assignment deliverable.
