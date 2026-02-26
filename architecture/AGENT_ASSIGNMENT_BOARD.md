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
- Workers must update the assignment row/block status (or add a blocker note) in this board before sending their final report back.
- Worker reports to user/controller should be brief status summaries; detailed scope/proof belongs in the board assignment block/report section.

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
- One assignment should have exactly one active worker session by default.
- If multiple workers are intentionally assigned to the same assignment, mark it explicitly in the assignment row/block as `shared coverage` (or `pairing`) and name each worker session.
- If duplicate work starts unintentionally on the same assignment, controller must reconcile ownership in the board immediately and stop one worker before more code is written.
- Board is the authority for assignment ownership and status; chat summaries do not override the board.

## Program Status (Current)
- Program baseline: `M3 / M3b` active
- Approved overlap slice: `M5` Team management parity (Figma-first)
- Admin track: A2 usability pass committed; branch contains additional docs/control-plane commits
- Challenge flow: CTA/link rescue committed and accepted

## Active Assignments

| ID | Status | Program status | Persona | Flow | Screens in scope | Owner | Branch / Worktree | Figma refs | Deliverable |
|---|---|---|---|---|---|---|---|---|---|
| `COACHING-UI-W2-COMMS-ENTRYPOINTS` | `committed+pushed` | `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven UI prep)` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` (`W2 comms entry points`) | `Team Dashboard (leader/member)`, `Challenge Details/Results`, `User/Coaching shells` (`Inbox/Channels`, `Channel Thread`, `Broadcast Composer`) | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred) | manual-spec-driven (`COACHING_*` docs + intended wiring docs; W1 shells required) | Large-swatch W2 communication entry-point wiring pass accepted: context-aware channel/thread shell routing + leader broadcast composer entry context labels; API-backed messaging/send remains deferred |
| `ADMIN-A3-USERS-OPS-POLISH-A` | `committed+pushed` | `A3 (parallel with M5/M6)` | `Admin operator` | `admin users + reports ops workflow` | `/admin/users`, `/admin/reports` (operator lists/actions only) | `Mobile-2` | `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred) | N/A (admin web, no Figma parity requirement for this swath) | Accepted and pushed (`fc85b3b`): users/reports operator workflow usability improvements in `AdminShellScreen.tsx`; manual browser spot-check still recommended follow-up |
| `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION` | `committed+pushed` | `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven coaching content integration)` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` (`W3 coaching_content integration`) | `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail` + embedded CTA routes from `Home`, `Team`, `Challenge` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree required if app code worker is active elsewhere) | manual-spec-driven unless coaching Figma exports are later locked | Accepted: API-backed journeys list/detail/progress + explicit lesson progress actions on W1/W2 shells; docs statuses advanced to `🟡 partial` |
| `COACHING-ARCH-COACH-PERSONA-A` | `active` | `M6 coaching slice (planning/architecture)` | `Coach`, `Admin operator` (authoring/ops), plus downstream `Leader/Member/Solo` | `coaching content operations / publishing` | coach content library, journey authoring/curation, publishing/targeting, sponsor/paid coaching packaging, admin portal touchpoints | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + Fourth Reason reference | Large-swatch Coach persona operating model and content-ops architecture package (authoring ownership, delivery packaging, admin/coach portal boundaries, sponsorship/paid coaching integration seams) |

## Blocked Assignments

| ID | Status | Program status | Persona | Flow | Screens | Blocker | Next action |
|---|---|---|---|---|---|---|---|
| `COACHING-INTEGRATION-A` | `unblocked via explicit owner approval` | `M3/M3b baseline + approved M6 planning overlap` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` | host surfaces across `Home`, `Challenge`, `Team`, `Profile` + future `Inbox/Journeys` | Former blocker resolved: owner approved pull-forward planning work; assignment spec now defined; docs-only to avoid code/sprint collision while `TEAM-MEMBER-PARITY-A` runs | Execute via `Coach-1`; update board first, then brief report back |

## Recently Completed (Awaiting Review / Landed on Branch)

| ID | Status | Program status | Persona | Screens affected | Commit(s) | Notes |
|---|---|---|---|---|---|---|
| `TEAM-PARITY-A` | `committed` | `M3/M3b + approved M5 overlap` | `Team Leader` | `Team Dashboard`, `Invite Member`, `Pending Invitations`, `Team KPI Settings`, `Pipeline`, `Single Person Challenges / Team Challenges` | `9e572e1` | Team Leader mobile flow parity swath completed; docs sync rule satisfied in same commit. |
| `TEAM-MEMBER-PARITY-A` | `pushed` | `M3/M3b + approved M5 overlap` | `Team Member` | `Team Dashboard (member)`, `Team Challenges`, `Challenge List`, `Challenge Details`, `Challenge Leaderboard / Results` | `1372ddf` | Team Member parity + wiring pass accepted by controller; screenshot folder verified (`app/test-results/team-member-parity-a`). Duplicate Mobile-1/Mobile-2 execution reconciled; accepted result is `1372ddf`. |
| `COACHING-INTEGRATION-A` | `committed` | `M3/M3b baseline + approved M6 planning overlap (docs-only)` | `Team Leader`, `Team Member`, `Solo User` | Coaching matrix/addendum + intended wiring/screenmap + next-wave assignment specs | `(this change set)` | Docs-only planning package accepted pending commit/push: W1/W2 route naming lock, coaching insert-point status table, persona coaching rows, and `COACHING-UI-W1/W2` assignment specs. |
| `COACHING-UI-W1-ALLOCATION-SHELLS` | `committed+pushed` | `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven UI prep)` | `Team Leader`, `Team Member`, `Solo User` | Home/Challenge/Team/Profile coaching placeholder CTAs + `user` coaching shell destinations | `(this change set)` | W1 shell destinations + placeholder CTA allocation landed in `KPIDashboardScreen.tsx`; screenmap/wiring docs updated to `🟡 stub`; runtime screenshots pending follow-up validation. |
| `COACHING-UI-W2-COMMS-ENTRYPOINTS` | `committed+pushed` | `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven UI prep)` | `Team Leader`, `Team Member`, `Solo User` | Team/Challenge coaching comms entry points + user coaching shells context routing | `(this change set)` | W2 comms entry-point wiring landed in `KPIDashboardScreen.tsx`; docs statuses advanced from `🟡 stub` to `🟡 partial` for comms surfaces; runtime screenshots pending follow-up validation. |
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
- `Status:` `pushed`
- `Program status:` `M3/M3b + approved M5 overlap`
- `Persona:` `Team Member`
- `Flow:` `team + challenge participation`
- `Owner:` `Mobile-2` (accepted return; duplicate Mobile-1 reporting reconciled)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree preferred)
- `Worker note (2026-02-26):` Figma export blocker resolved. Canonical exports for all five in-scope Team Member/Challenge screens verified in `design/figma/exports/screens/`. Implementation pass in progress.
- `Worker note (2026-02-26, handoff pickup):` TEAM-MEMBER-PARITY-A execution resumed on `codex/a2-admin-list-usability-pass`; worker owns `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` for this pass and will preserve shared KPI logging mechanics + Home/Priority lock.
- `Worker completion note (2026-02-26):` Team Member participation parity + wiring pass implemented in `KPIDashboardScreen.tsx`; runtime screenshots captured for all five in-scope screens and `tsc` passed. Assignment remains `review` pending controller approval/commit verification.
- `Worker note (2026-02-26, returned for review):` Tightened Team Member participation parity in `KPIDashboardScreen.tsx` with member challenge list segmentation + create chooser modal (Figma `168-16436` / `173-13190` alignment), Team Challenges member CTA cleanup (`389-21273`), and member route metadata/wiring polish. `cd app && npx tsc --noEmit --pretty false` passed. Runtime screenshots + route walkthrough capture still pending controller/device validation.
- `Controller review note (2026-02-26):` Accepted and pushed as `1372ddf` after screenshot folder verification (`/Users/jon/compass-kpi/app/test-results/team-member-parity-a/`) and scope review. Duplicate worker execution on this assignment was reconciled to the accepted commit.

#### Screens In Scope (Large Swath)
1. `Team Dashboard (member perspective)`
2. `Team Challenges`
3. `Challenge List`
4. `Challenge Details`
5. `Challenge Leaderboard / Results`

#### Canonical Figma References (Approved for This Assignment)
- `Team Dashboard (member perspective)` -> node `389-19791`
  - `/Users/jon/compass-kpi/design/figma/exports/screens/team_member_dashboard_v1.png`
- `Team Challenges (member perspective)` -> node `389-21273`
  - `/Users/jon/compass-kpi/design/figma/exports/screens/team_member_team_challenges_v1.png`
- `Challenge List (member participation)` -> node `168-16436`
  - `/Users/jon/compass-kpi/design/figma/exports/screens/challenge_list_member_v1.png`
- `Challenge Details / Progress` -> node `173-13190` (controller-approved canonical)
  - `/Users/jon/compass-kpi/design/figma/exports/screens/challenge_details_progress_v1.png`
- `Challenge Leaderboard / Results` -> node `388-11502` (controller-approved canonical)
  - `/Users/jon/compass-kpi/design/figma/exports/screens/challenge_leaderboard_results_v1.png`

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
- Use the approved canonical refs listed in this assignment block for all five in-scope screens
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
- First update this board:
  - set assignment status (`blocked`, `review`, `committed`, etc.)
  - add blocker or completion notes in this assignment block if status changed
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

### `COACHING-INTEGRATION-A`

#### Snapshot
- `Status:` `committed+pushed` (`post-W2 planning continuation accepted`)
- `Program status:` `M3/M3b baseline + approved M6 planning overlap (docs-only)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (manual-spec-driven integration planning)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; dedicated worktree preferred)
- `Controller note (2026-02-26):` Activated in parallel with `TEAM-MEMBER-PARITY-A` because it is docs-only and does not touch mobile app code.
- `Approval note (2026-02-26):` User explicitly approved coaching planning integration and requested minimal chat handoff via assignment board.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete; executing docs-only planning package now (`matrix`, `coaching wiring addendum`, `intended wiring`, `persona screenmap`) and will add next-wave assignment specs before returning for review.
- `Completion note (2026-02-26, Coach-1):` Docs-only planning package completed. Added `W1`/`W2` route naming lock + entry points, coaching insert-point status table in intended wiring, persona-specific coaching screenmap rows (`manual-spec-driven`), tightened capability matrix with `build now / later` markers, and two next-wave implementation assignment specs.
- `Validation note (2026-02-26, Coach-1):` Persona labels, destination names, and status legend checked for consistency across matrix/addendum/wiring/screenmap. No app/backend code files changed. Route naming changes remain planning-only; `DECISIONS_LOG.md` deferred until runtime implementation changes boundaries.
- `Controller review note (2026-02-26):` Docs package accepted. Next coding wave proceeds via `COACHING-UI-W1-ALLOCATION-SHELLS`, with `COACHING-UI-W2-COMMS-ENTRYPOINTS` remaining queued behind W1 shell landing.
- `Worker note (2026-02-26, Coach-1 post-W2 continuation start):` Reopened docs-only coaching planning from latest accepted `COACHING-UI-W2-COMMS-ENTRYPOINTS` state to define next coding-wave specs (`W3+`) and explicit contract-boundary notes for UI/backend separation.
- `Current blocker status (2026-02-26, Coach-1, post-W2 planning continuation):` `none` at start. Using accepted W2 shell/context routing state and existing `/docs/spec/04_api_contracts.md` coaching/channel endpoints as baseline; will document gaps/boundaries instead of proposing schema/API changes.
- `Completion note (2026-02-26, Coach-1 post-W2 continuation):` Added post-W2 contract-boundary notes in coaching planning docs (W3 content integration vs W4 comms API integration, UI/backend ownership split, approval-gated backend-prep trigger) and appended next coding-wave assignment specs `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION` + `COACHING-UI-W4-COMMS-API-INTEGRATION`.
- `Validation note (2026-02-26, Coach-1 post-W2 continuation):` Docs-only changes; no app/backend/schema/API contract files edited. Naming lock and non-negotiable boundaries revalidated against existing coaching addendum/matrix and accepted W2 notes. `DECISIONS_LOG.md` remains deferred unless runtime or endpoint-family boundaries change in implementation.
- `Controller review note (2026-02-26, post-W2 continuation):` Accepted. Useful contract-boundary notes and next-wave assignment specs (`W3`/`W4`) added without widening scope into backend/API changes. `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION` is now the preferred next mobile coaching wave; `W4` remains queued behind `W3` or explicit reprioritization.

#### Surfaces In Scope (Large Swath)
1. `Home / Priority` (coaching nudge allocation only; no UI implementation)
2. `Challenge` surfaces (`Challenge List`, `Challenge Details / Results`, sponsored challenge detail overlaps)
3. `Team` surfaces (leader/member dashboard and team challenges coaching modules)
4. `Profile / Settings` (goals/coaching prefs/notification prefs allocation)
5. Future dedicated flows:
   - `Inbox / Channels`
   - `Coaching Journeys`

#### Primary Objective
Produce the first implementation-ready coaching integration planning package (manual/non-Figma) by defining:
- the first coaching slice to build (`W1` allocation + shells, plus recommended `W2` entry points)
- persona-specific capability placement across current Compass surfaces
- dedicated coaching destination naming and route intent
- sponsored challenge overlap boundaries and integration seams
- next coding assignment specs (`COACHING-UI-W1-*`) that can be executed with short-form board launches

#### Required Reads (Assignment-Specific)
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`

#### Constraints (Hard)
- Docs/planning only (`no app code`, `no backend code`, `no schema/API changes`)
- Do not edit `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` or other app code files
- Keep coaching work explicitly marked as `manual-spec-driven` unless a Figma-backed coaching screen is identified
- Respect non-negotiables:
  - coaching cannot redefine KPI engine behavior
  - confidence is display/context only
  - KPI logging remains source of truth for activity
- Must state persona + capability group + hosting surface for every proposed module/screen
- Must state sponsored challenge overlap boundaries for any sponsor-facing coaching proposal

#### Deliverables (Large Swath, docs-only)
1. Update `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
   - tighten first-slice scope and add `build now / later` markers
2. Update `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
   - define explicit `W1` and `W2` destination names + entry points
3. Update `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
   - mark coaching wiring insert points and statuses using the standard legend
4. Update `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
   - add/update coaching-related intended destinations/status rows if changed
5. Add assignment-ready board specs for the next coaching implementation wave (at least two):
   - e.g. `COACHING-UI-W1-ALLOCATION-SHELLS`
   - e.g. `COACHING-UI-W2-COMMS-ENTRYPOINTS`

#### Validation (Required)
- Consistency check across docs:
  - persona labels align across matrix/screenmap/wiring
  - destination names align with naming guidance
  - statuses use standard legend (`⚪ 🔵 🟡 🟢 🔴`)
- Confirm no app/backend code files changed
- If any structural route naming changes are proposed, note whether `DECISIONS_LOG.md` is required now or deferred until implementation (do not silently change architecture boundaries)

#### Report-Back Format (Required)
- First update this board:
  - set assignment status (`blocked`, `review`, `committed`, etc.)
  - add completion notes in this assignment block
- `Program status`
- `Persona(s) affected`
- `Capability groups covered`
- `Surfaces / screens updated in docs`
- `What changed in matrix`
- `What changed in wiring addendum`
- `What changed in master wiring diagram / screenmap`
- `First coding wave assignments created` (IDs + short purpose)
- `Open decisions / blockers`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-INTEGRATION-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-UI-W1-ALLOCATION-SHELLS`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven UI prep)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`W1 allocation + route shells`)
- `Owner:` worker (mobile UI)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `manual-spec-driven` (no coaching Figma exports locked yet)
- `Controller seed note (2026-02-26):` Destination naming + entry-point intent locked by `COACHING-INTEGRATION-A`; implement shells/placeholders only, no functional comms behavior.
- `Worker note (2026-02-26, Mobile-1 execution start):` Picked up `COACHING-UI-W1-ALLOCATION-SHELLS` on `codex/a2-admin-list-usability-pass`. Will add route/state shell destinations + placeholder CTAs only, preserve KPI logging behavior, and avoid backend/API/schema changes.
- `Worker completion note (2026-02-26, Mobile-1):` W1 coaching shell destinations implemented in `KPIDashboardScreen.tsx` (`inbox`, `inbox_channels`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail`) with placeholder entry CTAs on Home, Challenge Details/Results, Team Dashboard (leader/member), and User/Profile coaching shell host. Updated `INTENDED_WIRING_DIAGRAM.md` + `INTENDED_PERSONA_FLOW_SCREENMAP.md` statuses/wiring notes to reflect W1 stub availability.
- `Worker validation note (2026-02-26, Mobile-1):` `cd app && npx tsc --noEmit --pretty false` passed. Backend/API/schema files untouched and KPI logging behavior not intentionally modified. Runtime route walkthrough + screenshots not captured in this environment and remain pending controller/device validation.
- `Controller review note (2026-02-26):` Accepted. Scope stayed within W1 shell/placeholder allocation, docs sync rule satisfied (`INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md`), and local `tsc` re-check passed. Runtime screenshots remain a follow-up validation gap but do not block this shell-only landing.

#### Primary Objective
Create `W1` coaching allocation + shell placeholders in the mobile member app without changing backend/API/schema behavior:
- reserve route/state destination names and shell screens for:
  - `inbox`
  - `inbox_channels`
  - `channel_thread`
  - `coach_broadcast_compose` (role-gated shell)
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`
- add lightweight placeholder entry points/CTAs on approved host surfaces
- preserve existing KPI logging, challenge, and team flow behavior

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`

#### Constraints (Hard)
- UI-only shell/allocation work; no backend/API/schema changes
- `manual-spec-driven` only (do not claim Figma parity)
- No KPI engine/confidence/KPI logging behavior changes
- Role-gated actions remain placeholder-only in `W1`
- If shared-file ownership conflicts with another active assignment, stop and report blocker

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Runtime route checks for each new shell destination
- Confirm no backend/API/schema files changed
- Confirm KPI logging behavior unchanged
- If screen availability/wiring/status changes, update both:
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Capability group(s)`
- `Screens / shell destinations added`
- `Entry points added` (by host surface)
- `What is placeholder-only vs functional`
- `Files touched` (with line refs)
- `KPI logging unchanged?` (`yes/no`)
- `tsc result`
- `Screenshot paths`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-W1-ALLOCATION-SHELLS exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-UI-W2-COMMS-ENTRYPOINTS`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M3/M3b baseline + approved M6 planning overlap (communication-first coaching integration)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`W2 communication entry points`)
- `Owner:` worker (mobile UI; backend contract verification only unless separately approved)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree required if app code is active elsewhere)
- `Figma refs:` `manual-spec-driven` unless controller later locks coaching exports
- `Controller seed note (2026-02-26):` Execute after `COACHING-UI-W1-ALLOCATION-SHELLS` lands (or equivalent route shells exist).
- `Controller activation note (2026-02-26):` Activated after W1 shell destinations landed and docs statuses were updated to `🟡 stub`.
- `Worker pickup note (2026-02-26, Mobile-1):` Picked up for implementation on `codex/a2-admin-list-usability-pass`; W1 shell routes already present in local branch/worktree.
- `Current blocker status (2026-02-26, Mobile-1):` `none` at start (manual-spec-driven W2 pass proceeding; runtime screenshot capture may require controller/device validation follow-up).
- `Completion note (2026-02-26, Mobile-1):` W2 comms entry-point wiring pass completed in `KPIDashboardScreen.tsx`: Team leader/member coaching modules now route into context-aware `inbox_channels`; Challenge Details routes `Challenge Updates` into scoped `channel_thread` (challenge/sponsor shell context); leader broadcast CTA routes into role-gated `coach_broadcast_compose` with audience context labels. No KPI logging behavior changes.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅. Route/role-gating checks completed via code-path review (leader-only broadcast CTA remains leader dashboard branch). API assumptions checked against `docs/spec/04_api_contracts.md` (`GET /api/channels`, `GET/POST /api/channels/{id}/messages`, `POST /api/channels/{id}/broadcast`, `POST /api/coaching/broadcast`). Runtime screenshots not captured in this environment; controller/device validation still required.
- `Current blocker status (2026-02-26, Mobile-1, post-pass):` `none` for code deliverable; remaining validation gap is screenshot proof/runtime walkthrough only.
- `Controller review note (2026-02-26):` Accepted. W2 stayed within manual-spec-driven comms entry routing (context labels/scopes and leader-gated composer shell access) without introducing backend/API writes or KPI logging regressions. Docs sync rule satisfied; local `tsc` re-check passed. Runtime screenshots remain validation debt but not a block for shell/context routing.

#### Primary Objective
Implement the first functional communication entry points on existing Compass surfaces using documented contracts where available:
- `Team Leader`
  - Team Dashboard -> `inbox_channels`
  - Team Dashboard -> `coach_broadcast_compose` (role-gated)
- `Team Member`
  - Team Dashboard member coaching module -> `inbox_channels`
  - Challenge Details -> `channel_thread` (challenge context)
- `Solo User`
  - Challenge Details -> `inbox_channels` or `channel_thread` (sponsor/challenge/community scoped only)
- Keep coaching journeys depth limited unless explicitly added to assignment scope

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`

#### Constraints (Hard)
- Respect sponsored overlap boundary:
  - challenge owns participation/progress/results
  - coaching/comms owns messaging/content delivery surfaces
- No KPI engine/confidence/KPI logging behavior changes
- `manual-spec-driven` unless coaching Figma refs are explicitly added
- Document API/read-model gaps; do not invent schema/API changes without approval
- Structural route/boundary changes beyond W1 naming lock require explicit note + decision-log assessment

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route checks for leader/member/solo entry paths
- Role-gating checks for broadcast entry visibility
- API assumption validation against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Screenshot proof for each touched host surface + comms destination
- Docs sync if statuses/wiring change (`screenmap` + `intended wiring`)

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Capability group(s)`
- `Host surfaces changed`
- `Functional entry points wired` (persona + destination)
- `Sponsored overlap boundaries honored` (what stayed separate)
- `API assumptions / gaps`
- `Files touched` (with line refs)
- `tsc result`
- `Screenshot paths`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-W2-COMMS-ENTRYPOINTS exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION`

#### Snapshot
- `Status:` `committed+pushed` (`accepted after blocker-resolution + local tsc recheck`)
- `Program status:` `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven coaching content integration)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`W3 coaching_content integration`)
- `Owner:` worker (mobile UI)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree required if app code worker is active elsewhere)
- `Figma refs:` `manual-spec-driven` unless coaching Figma exports are later locked
- `Dependency note:` `COACHING-UI-W1-ALLOCATION-SHELLS` and `COACHING-UI-W2-COMMS-ENTRYPOINTS` accepted (`committed+pushed`)
- `Controller seed note (2026-02-26):` Prioritize API-backed journeys/progress rendering on existing shell destinations before expanding comms read/write behavior.
- `Controller activation note (2026-02-26):` Activated after accepted W2 shell/context routing and post-W2 contract-boundary planning update from `Coach-1`.
- `Worker pickup note (2026-02-26, Mobile-1):` Picked up on `codex/a2-admin-list-usability-pass` for W3 coaching content integration; proceeding on accepted W1/W2 destination naming and shell baseline.
- `Current blocker status (2026-02-26, Mobile-1):` `none` at start for UI-on-existing-contracts attempt; payload-shape mismatches (if any) will be documented without widening backend scope.
- `Completion note (2026-02-26, Mobile-1):` W3 coaching content integration completed on accepted `coaching_journeys*` shells in `KPIDashboardScreen.tsx`: API-backed journeys list/detail rendering (`GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}`), progress summary (`GET /api/coaching/progress`), and explicit lesson progress actions (`POST /api/coaching/lessons/{id}/progress`) with no auto-complete on view. Embedded Home/Team/Challenge coaching CTAs now propagate journey-context source/reset parameters into W3 content destinations.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅. Route checks for `coaching_journeys`, `coaching_journey_detail`, and `coaching_lesson_detail` completed via code-path review; KPI logging codepaths untouched. API assumptions verified against `docs/spec/04_api_contracts.md` for `GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}`, `GET /api/coaching/progress`, and `POST /api/coaching/lessons/{id}/progress`. Runtime screenshots not captured in this environment; controller/device validation still required.
- `Current blocker status (2026-02-26, Mobile-1, post-pass):` `none` for code deliverable; remaining validation gap is screenshot proof/runtime walkthrough only.
- `Controller follow-up note (2026-02-26):` Re-enter W3 in blocker-resolution mode first; restore runtime renderability and `tsc` green before any further feature work. Report exact fixes (regression callout included missing `useEffect` import + incomplete W3 symbols/styles).
- `Blocker triage note (2026-02-26, Mobile-1):` Investigating reported W3 runtime/compile regression in `KPIDashboardScreen.tsx` before any additional W3 scope. Will confirm import/symbol/style integrity and rerun `tsc`.
- `Blocker-resolution note (2026-02-26, Mobile-1):` Verified current `KPIDashboardScreen.tsx` already includes `useEffect` import, W3 journey helper `fmtMonthDayTime(...)`, and W3 styles (`coachingJourneyModule`, `coachingLessonActionBtnTextActive`, related symbols). No additional code patch was required in this pass.
- `Validation note (2026-02-26, Mobile-1, blocker-resolution pass):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ (green). W3 render-symbol/style regression callouts were rechecked by direct file inspection.
- `Current blocker status (2026-02-26, Mobile-1, blocker-resolution pass):` `resolved` for compile/render-symbol regression; screenshot/runtime walkthrough proof remains pending controller/device validation.
- `Controller review note (2026-02-26):` Accepted. Blocker regression is resolved, local `tsc` is green, and W3 stayed within documented coaching endpoints with explicit lesson progress writes only (no auto-complete on view, no KPI logging writes). Docs sync rule satisfied (`INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md`). Screenshot/runtime walkthrough remains validation debt, not a merge blocker for this wave.

#### Primary Objective
Implement the first functional coaching content layer on the accepted W1/W2 shells:
- wire `coaching_journeys`, `coaching_journey_detail`, and `coaching_lesson_detail` to documented coaching endpoints
- render journey list/detail/lesson progress states for leader/member/solo personas (role/tier visibility stays server-enforced)
- route embedded coaching CTAs (Home/Team/Challenge) into content screens with context-preserving parameters
- keep messaging/comms send/read API integration out of scope unless explicitly approved in a separate assignment

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`

#### Contract-Boundary Notes (Hard)
- Use documented coaching endpoints only:
  - `GET /api/coaching/journeys`
  - `GET /api/coaching/journeys/{id}`
  - `GET /api/coaching/progress`
  - `POST /api/coaching/lessons/{id}/progress` (explicit user action only)
- Do not introduce net-new backend endpoint behavior, schema changes, or API contract edits in this assignment.
- Do not write KPI logs from coaching content actions.
- Do not infer challenge completion/progress from lesson progress.
- Do not auto-complete lesson progress on view/mount; only explicit user action can write progress.
- Preserve W1/W2 destination naming lock (`coaching_journeys*`, `inbox*`, `channel_thread`, `coach_broadcast_compose`).

#### Implementation Focus (Recommended)
1. Journey list + loading/empty/error states (`coaching_journeys`)
2. Journey detail + milestones/lessons (`coaching_journey_detail`)
3. Lesson detail + explicit progress action (`coaching_lesson_detail`)
4. Embedded CTA context propagation from Home/Team/Challenge coaching modules
5. Docs status updates if any coaching destinations advance from `🟡 stub` to `🟡 partial`

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route checks for `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail`
- API assumption validation against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Confirm KPI logging behavior unchanged
- Screenshot proof for each persona path touched + journey/lesson screens
- Docs sync if screen availability/wiring/status changes:
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
  - `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Capability group(s)`
- `Journeys screens/destinations changed`
- `Embedded CTA routes updated` (host surface -> destination)
- `What became functional vs remains shell`
- `Contract assumptions used` (endpoint list)
- `Files touched` (with line refs)
- `KPI logging unchanged?` (`yes/no`)
- `tsc result`
- `Screenshot paths`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-UI-W4-COMMS-API-INTEGRATION`

#### Snapshot
- `Status:` `active`
- `Program status:` `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven comms API integration)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`W4 comms API-backed inbox/thread/broadcast`)
- `Owner:` worker (mobile UI; backend-prep only if separately approved)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree required if app code worker is active elsewhere)
- `Figma refs:` `manual-spec-driven` unless coaching comms Figma exports are later locked
- `Dependency note:` Run after `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION` or with explicit controller reprioritization
- `Controller seed note (2026-02-26):` W4 may proceed on documented channel/coaching endpoint families only; split backend-prep if payload gaps block UI work.
- `Worker pickup note (2026-02-26, Mobile-1):` Picked up on `codex/a2-admin-list-usability-pass` after W3 blocker-resolution verification; starting with contract-shape verification for channels/messages/broadcast endpoints before UI wiring.
- `Current blocker status (2026-02-26, Mobile-1):` `none` at start; will stop and document exact payload/read-model gaps if channel list/thread/broadcast payloads are insufficient for UI assumptions.

#### Primary Objective
Upgrade accepted W2 comms entry routing from shell/context-only to API-backed behavior where existing documented contracts allow:
- `inbox_channels` list fetch/render
- `channel_thread` message read + send flow (role/member scoped)
- `coach_broadcast_compose` send flow (leader role-gated) using documented broadcast path
- maintain scoped context labels (team/challenge/sponsor/community) and role/tier UI gating

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`

#### Contract-Boundary Notes (Hard)
- Start with documented endpoint families only:
  - `GET /api/channels`
  - `GET /api/channels/{id}/messages`
  - `POST /api/channels/{id}/messages`
  - `POST /api/channels/{id}/broadcast`
  - `POST /api/coaching/broadcast` (if scoped broadcast path requires coaching namespace)
- Do not add net-new endpoint families or schema changes without explicit approval (current sprint out-of-scope rule applies).
- If mobile payload/read-model gaps appear (unread counters, scoped metadata, audience labels), stop and split a backend-prep assignment rather than widening this UI assignment.
- UI owns routing/state/loading/errors/CTA gating; backend owns role enforcement, throttles, audit logging, and write semantics.
- Preserve sponsored overlap boundary (challenge owns participation/results; coaching/comms owns content/messaging surfaces).
- No KPI engine/confidence/KPI logging behavior changes.

#### Implementation Focus (Recommended)
1. `inbox_channels` list fetch + scoped context rendering
2. `channel_thread` read + send (basic reliable flow, no real-time requirement)
3. `coach_broadcast_compose` send path (leader-only) with clear scope labels
4. Graceful fallback states when payload shape is insufficient (log + blocker note, no silent assumptions)
5. Docs status updates if comms surfaces advance beyond `🟡 partial`

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route checks for leader/member/solo comms paths
- Role-gating checks for broadcast composer visibility + send action
- API assumption validation against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Screenshot proof for inbox list, channel thread, and broadcast composer (leader)
- Docs sync if screen availability/wiring/status changes (`screenmap` + `intended wiring`)
- If blocked by payload gaps, capture exact gap and endpoint/field expectation in board note

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Capability group(s)`
- `Comms destinations made functional`
- `Broadcast path used` (`/api/channels/{id}/broadcast`, `/api/coaching/broadcast`, or deferred with reason)
- `Contract assumptions / gaps` (exact endpoints + missing fields if blocked)
- `Sponsored overlap boundaries honored` (what stayed separate)
- `Files touched` (with line refs)
- `KPI logging unchanged?` (`yes/no`)
- `tsc result`
- `Screenshot paths`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-W4-COMMS-API-INTEGRATION exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-ARCH-COACH-PERSONA-A`

#### Snapshot
- `Status:` `active`
- `Program status:` `M6 coaching slice (planning/architecture)`
- `Persona:` `Coach`, `Admin operator` (authoring/ops), plus downstream `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching content operations / publishing`
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; dedicated worktree preferred)
- `Figma refs:` `manual-spec-driven` (coach authoring/ops model not yet Figma-backed)
- `Controller seed note (2026-02-26):` Owner identified a critical architecture gap: coach persona/content library/authoring/publishing model is not yet explicit and likely overlaps sponsored + paid coaching packaging.

#### Primary Objective
Define the Coach persona operating model and content operations architecture so upcoming coaching implementation waves do not hard-code the wrong ownership or packaging assumptions.

Produce a planning package that clearly answers:
- where the `Coach` persona lives (admin web extension vs dedicated coach portal vs hybrid)
- who owns content library upload/curation/publishing (`Coach`, `Admin`, `Sponsor ops`)
- how journeys/lessons are packaged for:
  - team coaching
  - sponsored challenge coaching
  - paid coaching products
- how runtime delivery surfaces (`Coaching Journeys`, challenge overlays, team modules) consume published content without owning authoring concerns
- what is in-scope for current app UI vs deferred content-ops/portal implementation

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/references/the fourth reason integration` (as reference only; do not commit changes)

#### Constraints (Hard)
- Docs/planning only (`no app code`, `no backend code`, `no schema/API changes`)
- Do not edit mobile or admin implementation files
- No net-new endpoint families or schema proposals presented as approved implementation
- Keep non-negotiables explicit (coaching content/comms cannot mutate KPI engine/base values; KPI logging remains activity source of truth)
- Preserve sponsored challenge boundary: challenge system owns participation/progress/results; coaching owns content/comms
- Clearly separate:
  - authoring/ops surfaces
  - runtime delivery surfaces
  - entitlement/packaging logic

#### Deliverables (Large Swath, docs-only)
1. Extend `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
   - add explicit `Coach` persona row(s)/access model
   - clarify authoring vs delivery ownership per capability group
2. Extend `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
   - add coach/admin authoring portal touchpoints and handoff to runtime delivery
   - define publishing/targeting integration seam
3. Update `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
   - add `Coach` persona section (manual-spec-driven) or explicit admin/coach ops note if coach is modeled as admin portal extension
4. Update `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
   - add coach content-ops/publishing overlay or companion authoring-delivery flow
5. Add next assignment specs to the board (at least one, preferably two) for implementation-ready follow-ons:
   - `COACHING-OPS-PORTAL-A` (docs/admin portal planning or UI shells)
   - `COACHING-PACKAGING-SPONSORED-PAID-A` (packaging/entitlement integration planning)

#### Validation (Required)
- Consistency check across docs:
  - `Coach` persona terminology is consistent
  - authoring vs delivery boundaries are explicit
  - sponsored vs paid coaching packaging boundaries are explicit
  - statuses use standard legend (`⚪ 🔵 🟡 🟢 🔴`) where applicable
- Confirm no app/backend/schema/API files changed
- If any proposal implies structural API/schema boundary changes, mark as `decision needed` and note `DECISIONS_LOG.md` requirement for implementation phase (do not implement now)

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `What Coach persona now means` (plain English)
- `Authoring vs delivery model` (who owns what)
- `Sponsored vs paid coaching packaging model` (proposed boundary)
- `Docs updated` (which docs + what changed)
- `Next assignments created` (IDs + short purpose)
- `Open decisions / risks`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-ARCH-COACH-PERSONA-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `ADMIN-A3-USERS-OPS-POLISH-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `A3 (parallel with M5/M6)`
- `Persona:` `Admin operator`
- `Flow:` `admin users + reports ops workflow`
- `Owner:` `Mobile-2`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `N/A` (admin usability/polish swath; follow existing admin UI patterns)
- `Controller seed note (2026-02-26):` Run in parallel with coaching docs work. Admin-only scope to avoid collision with mobile/coaching router surfaces.
- `Worker note (2026-02-26):` Execution started. Scope locked to admin web `/admin/users` + `/admin/reports` in existing admin shell patterns; no mobile/backend changes.
- `Worker completion note (2026-02-26):` Implemented operator workflow friction fixes in `/admin/users` and `/admin/reports` (filter/no-results recovery, visible-count clarity, filtered-selection warning, reports probe summary/copy-all status). `tsc` passed. Manual browser spot-check not completed in this session (no browser automation path used).
- `Controller review note (2026-02-26):` Accepted and pushed as `fc85b3b`. Scope stayed admin-only and aligns with `A3` operator usability polish. Manual browser spot-check remains recommended before merge to `main`, but not a blocker for branch progress.

#### Screens In Scope (Large Swath)
1. `/admin/users`
2. `/admin/reports`

#### Primary Objective
Deliver a substantial A3 operator usability pass focused on admin users/reports list workflows:
- user list/search/filter/sort/paging readability and recovery UX
- action discoverability for common user operations
- reports list/table usability and operator workflow clarity
- loading/empty/no-results/error state clarity where weak or inconsistent

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`

#### Constraints (Hard)
- Admin web only (`app/screens/AdminShellScreen.tsx` and directly related admin helpers only)
- No mobile app screen edits
- No backend/API/schema changes
- No authz boundary changes
- Follow existing admin shell visual patterns (no redesign pass)
- If a fix requires API changes or structural route changes, stop and report blocker

#### Implementation Pattern (Large Swath)
- Start with a mismatch/issues list for `/admin/users` and `/admin/reports`
- Prioritize operator workflow friction:
  - list resets / no-results recovery
  - sort/search predictability
  - row/action discoverability
  - “show more” / visible-count clarity / paging behavior
- Keep commits scoped to this swath (`1` commit preferred, `2` max if split by screen is cleaner)

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check of `/admin/users` and `/admin/reports` (if available)
- Confirm no mobile files changed
- Confirm no backend/API/schema files changed

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona affected`
- `Screens changed`
- `Top operator issues before changes`
- `What improved`
- `Still rough / deferred`
- `Files touched` (with line refs)
- `Validation performed` (`tsc`, manual browser checks)
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment ADMIN-A3-USERS-OPS-POLISH-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

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
