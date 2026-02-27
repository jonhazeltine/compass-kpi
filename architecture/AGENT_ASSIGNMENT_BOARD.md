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
| `COACHING-UI-W4-COMMS-API-INTEGRATION` | `committed+pushed` | `M3/M3b baseline + approved M6 planning overlap (manual-spec-driven comms API integration)` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` (`W4 comms API-backed inbox/thread/broadcast`) | `inbox_channels`, `channel_thread`, `coach_broadcast_compose` + Team/Challenge comms entry points | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree required if app code worker is active elsewhere) | manual-spec-driven unless coaching comms Figma exports are later locked | Accepted: API-backed channels list/thread read-send + mark-seen + leader broadcast send via documented endpoints; docs updated, runtime screenshots still pending |
| `COACHING-ARCH-COACH-PERSONA-A` | `committed+pushed` | `M6 coaching slice (planning/architecture)` | `Coach`, `Admin operator` (authoring/ops), plus downstream `Leader/Member/Solo` | `coaching content operations / publishing` | coach content library, journey authoring/curation, publishing/targeting, sponsor/paid coaching packaging, admin portal touchpoints | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + Fourth Reason reference | Accepted and pushed: Coach persona/content-ops architecture package clarifying coach/admin/sponsor ownership, authoring-vs-delivery seam, portal touchpoints, and sponsored/paid packaging boundaries; follow-on planning assignments added |
| `COACHING-PACKAGING-SPONSORED-PAID-A` | `committed+pushed` | `M6 coaching slice (planning/architecture; packaging + entitlements)` | `Coach`, `Admin operator`, `Sponsor ops` (limited), downstream `Leader/Member/Solo` | `coaching content operations / publishing` (`packaging`, `entitlements`, `sponsored/paid boundaries`) | coaching packaging + entitlements planning docs (no app UI) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only) | manual-spec-driven | Accepted and pushed: implementation-ready packaging taxonomy/lifecycle, ownership/approval matrix, runtime entitlement/visibility consumption assumptions, and explicit `decision needed` risks for billing/sponsor approvals/read-model gaps |
| `ADMIN-A2-TABLE-OPS-FIXPACK-B` | `committed+pushed` | `A2 (parallel with M6 coaching planning)` | `Admin operator` | `admin KPI catalog + challenge templates table ops` | `/admin/kpis`, `/admin/challenge-templates` (web admin tables/forms only) | `Mobile-2` | `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred) | N/A (admin web, no Figma parity requirement for this swath) | Accepted and pushed: baseline A2 fixpack + sorting follow-up landed (`91de8d2`, `6854cd1`). Owner cleared baseline manual validation blocker and deferred pagination; sortable KPI/template headers (asc/desc) added. |
| `COACHING-UI-PACKAGE-VISIBILITY-GATING-A` | `committed+pushed` | `M6 coaching slice (runtime UI gating + fallback behavior)` | `Team Leader`, `Team Member`, `Solo User` | `coaching / communication` (`package visibility + entitlement UI gating`) | `Challenge Details/Results`, `coaching_journeys*`, `inbox*`, Team coaching modules (existing W3/W4 surfaces) | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred) | manual-spec-driven + accepted packaging docs (`COACHING-PACKAGING-SPONSORED-PAID-A`) | Accepted and pushed: runtime package visibility/entitlement banners + safe fallback/gated/blocked states across W3/W4 coaching surfaces, with UI-only contract-gap triage and no backend/schema changes. |
| `COACHING-BACKEND-PREP-PACKAGE-READMODEL-A` | `committed+pushed` | `M6 coaching slice (backend-prep planning/spec)` | `Admin operator`, `Coach`, downstream `Leader/Member/Solo` | `coaching content operations / publishing` (`package read-model + entitlement outputs`) | backend contract/read-model planning only (no runtime UI code) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs/backend-prep planning only; separate worktree preferred) | manual-spec-driven + accepted packaging/docs stack | Accepted and pushed: endpoint-family coverage map, read-model output requirement matrix, gap classification, `decision needed` list, and follow-on backend/UI implementation specs for packaging/entitlement runtime outputs |
| `COACHING-W5-AI-READINESS-BOUNDARY-A` | `committed+pushed` | `M6 coaching slice (W5 AI coach assist readiness; planning-only)` | `Coach`, `Admin operator`, downstream `Leader/Member/Solo` | `coaching / AI assist` (`W5 boundary + implementation-readiness gating`) | AI coach assist planning docs + intended wiring overlays (no app/backend code) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + accepted coaching/packaging/read-model docs stack | Accepted and pushed: W5 AI boundary planning package (approval-first action boundaries, insert-point map, approval/audit gates, minimum contract outputs, `build now` vs `defer`, and next-wave W5 assignment specs). |
| `COACHING-W5-UI-AI-ASSIST-SHELL-PROTO-A` | `committed+pushed` | `M6 coaching slice (W5 AI assist UI shell/proto; approval-first)` | `Team Leader`, `Coach`, `Admin operator` (review context), downstream `Member/Solo` limited | `coaching / AI assist` (`runtime insert-point shells + review UX`) | `channel_thread`, `coach_broadcast_compose`, `coaching_lesson_detail`, `coaching_journeys*`, embedded Team/Challenge coaching CTAs (approved insert points only) | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree preferred) | manual-spec-driven + W5 AI boundary docs | Accepted and pushed (`6916f88`, `eb128e8`): approval-first AI assist shell/review modal plus backend `/api/ai/suggestions*` queue submit + queue status feedback integration; no autonomous send/publish and no KPI/forecast/challenge-state mutation paths. |
| `COACHING-W5-BACKEND-AI-SUGGESTIONS-INFAMILY-QUEUE-A` | `committed+pushed` | `M6 coaching slice (W5 AI backend in-family approval queue shaping)` | `Coach`, `Admin operator`, downstream `Leader/Member/Solo` | `coaching / AI assist` (`/api/ai/suggestions*` additive shaping only) | Existing AI suggestion endpoints (`/api/ai/suggestions*`) + contract docs | `Coach-1` | `codex/a2-admin-list-usability-pass` (backend worktree strongly preferred) | N/A (backend/contract; W5 boundary docs) | Accepted and pushed (`17478bb`): additive in-family AI suggestion queue/read-model shaping (`ai_queue_read_model`, list `queue_summary`) + contract doc updates + `DEC-0045`, with no schema/net-new endpoint-family changes. |
| `COACHING-W5-OPS-AI-MODERATION-AUDIT-PASS-A` | `committed+pushed` | `M6 coaching slice (W5 AI moderation/audit ops surfaces; approval-first)` | `Coach`, `Admin operator`, `Sponsor ops` (limited review only) | `coaching / AI assist` (`approval queue`, `audit`, `policy visibility`) | `coach_ops_audit` admin extension touchpoints (`admin/coaching/audit` + AI queue/detail companion views) | `Admin-1` | `codex/a2-admin-list-usability-pass` (admin web worktree preferred) | manual-spec-driven + W5 AI boundary docs | Accepted and pushed (`1a0342f`): Admin Shell `/admin/coaching/audit` AI moderation/audit companion UI (queue/detail/history + approval-first workflows) with docs sync; manual browser spot-check still recommended. |
| `COACHING-SAMPLE-CONTENT-SEED-A` | `committed` | `M6 coaching slice (runtime realism / validation data)` | `Coach`, `Team Leader`, `Team Member`, `Solo User` | `coaching content delivery` (`journeys`, `lessons`, `assignments`, sample progress/messages`) | coaching journeys/lessons runtime surfaces + comms shells (`coaching_journeys*`, `inbox*`, Team/Challenge coaching modules) | `Mobile-2` | `codex/a2-admin-list-usability-pass` (backend/data worktree strongly preferred) | N/A (data/backend seed swath; no Figma requirement) | Committed (2026-02-27): deterministic M6 realism data pack landed with repeatable reset/seed/smoke runbook, expanded multi-journey + mixed-status lessons + richer cohort/sponsor thread history, and docs discoverability updates for owner/dev UI evaluation. |
| `ADMIN-A3_5-USERS-LIST-PAGING-SORT-A` | `committed+pushed` | `A3.5 (parallel with M6 backend-prep implementation)` | `Admin operator` | `admin users list/search/sort/paging polish` | `/admin/users` (primary), `/admin/reports` regression check only | `Admin-1` | `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred) | N/A (admin web; preserve existing patterns) | Accepted and pushed (`5e59ad1`): `/admin/users` sorting/paging workflow polish (header asc/desc toggles, row-window clarity, reset-sort, show-more count labels, row-window reset on filter/sort changes). Manual browser spot-check remains recommended follow-up. |
| `COACHING-W5-E2E-RUNTIME-VALIDATION-REFINEMENT-A` | `committed+pushed` | `M6 coaching slice (W5 AI assist end-to-end runtime validation/refinement)` | `Team Leader`, `Coach`, downstream `Member/Solo` spot-check | `coaching / AI assist` (`mobile seeded-data runtime validation + approval-first UX refinement`) | `inbox_channels`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys*`, `coaching_lesson_detail`, Team/Challenge coaching modules (approved AI insert points only) | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred) | manual-spec-driven + accepted W5 boundary/docs + seeded data | Accepted and pushed (`cb3c92a`): seeded mobile runtime validation captured journeys/channels + AI review states and verified live `/api/ai/suggestions*` approval-first queue create/list (`pending_review`) with copy-only UX clarity refinements; no backend/schema/API boundary changes. |
| `COACHING-W5-OPS-AI-AUDIT-RUNTIME-VALIDATION-REFINEMENT-A` | `blocked` | `M6 coaching slice (W5 AI moderation/audit runtime validation/refinement)` | `Admin operator`, `Coach` (reviewer), `Sponsor ops` limited | `coaching / AI assist` (`admin moderation/audit runtime validation + refinement`) | `/admin/coaching/audit` queue/detail/history views | `Admin-1` | `codex/a2-admin-list-usability-pass` (dedicated admin worktree preferred) | manual-spec-driven + accepted W5 boundary/docs | Blocked/deferred by owner direction: admin audit is not the primary coach AI workflow; pause runtime validation/refinement pending W5 AI coach-persona realignment. Do not continue dialog-copy refinements in this assignment. |
| `COACHING-W5-AI-COACH-PERSONA-REALIGNMENT-A` | `committed+pushed` | `M6 coaching slice (W5 AI coach-persona realignment; planning/spec)` | `Coach`, downstream `Team Leader`, `Team Member`, `Solo User`; `Admin operator` oversight | `coaching / AI assist` (`coach recommendations + queue role realignment`) | coach-facing AI recommendation surfaces in app (`Home`, `Team`, `Challenge`, `coaching_journeys*`, `channel_thread`, `coach_broadcast_compose`) + `/admin/coaching/audit` oversight boundary (planning only) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + accepted W5 AI/UI/backend/admin stack | Accepted and pushed: W5 AI realignment now centers coach-responsibility-aware recommendations (individual/challenge/team) in app surfaces, repositions `/api/ai/suggestions*` as coach recommendation queue/read-model contract, and demotes `/admin/coaching/audit` to secondary oversight/exception workflow. |
| `COACHING-W6-NOTIFICATIONS-READINESS-BOUNDARY-A` | `committed+pushed` | `M6 broader scope (notifications + coaching integration readiness; planning-only)` | `Coach`, `Admin operator`, `Team Leader`, `Team Member`, `Solo User` | `notifications / coaching` (`readiness boundary + insertion map + assignment specs`) | notification entry points across `Home`, `Team`, `Challenge`, `coaching_journeys*`, `inbox*`, admin/ops policy surfaces (planning only) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + accepted M6 coaching stack | Accepted and pushed: W6 notifications/coaching readiness package (class taxonomy, channel/gating policy, insertion-point maps, minimum read-model outputs, `build now` vs `defer`, and next implementation swaths). |
| `COACHING-W6-UI-NOTIFICATION-SURFACES-A` | `committed+pushed` | `M6 broader scope (W6 notifications/coaching UI insertion pass)` | `Team Leader`, `Team Member`, `Solo User`, `Coach` (first-class runtime operator in host surfaces/channels) | `notifications / coaching` (`runtime banners/badges/inbox rows + host/channel entry points`) | `Home`, `Team`, `Challenge`, `coaching_journeys*`, `coaching_lesson_detail`, `inbox*`, `channel_thread` (approved host/runtime insert points; includes cohort channel entry points for non-team individuals) | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred) | manual-spec-driven + accepted W6 notifications boundary docs + W6/W7 rescope package | Accepted and pushed (`6772821`): W6 member-runtime in-app coaching notification surfaces implemented on accepted app-surface + coach-runtime/cohort-channel model using in-family notification read-model consumption and UI fallbacks; no backend/schema/API changes. |
| `COACHING-W6-BACKEND-NOTIFICATION-READMODEL-INFAMILY-A` | `committed+pushed` | `M6 broader scope (W6 notifications/coaching backend in-family read-model shaping)` | `Coach`, `Admin operator`, `Team Leader`, `Team Member`, `Solo User` | `notifications / coaching` (`in-family summary/items shaping`) | existing `channels/messages`, `coaching`, and `notifications` endpoint families + contract docs | `Coach-1` | `codex/a2-admin-list-usability-pass` (backend worktree strongly preferred) | N/A (backend/contract; W6 notifications boundary docs) | Accepted and pushed (`2dd5eea`): additive notification summary/item read-model outputs in existing endpoint families + `/docs/spec/04_api_contracts.md` updates + `DEC-0046`; no schema/net-new endpoint family changes. |
| `COACHING-W6-PREFS-OPS-NOTIFICATION-VISIBILITY-A` | `blocked` | `M6 broader scope (W6 notification prefs + ops visibility surfaces)` | `Admin operator`, `Coach`, `Team Leader`, `Team Member`, `Solo User` | `notifications / coaching` (`prefs UI + ops queue visibility`) | profile/settings coaching notification prefs + `coach_ops_audit` admin extension notification visibility companion | `Admin-1` | `codex/a2-admin-list-usability-pass` (admin web worktree preferred) | manual-spec-driven + accepted W6 notifications boundary docs | Blocked/deferred by owner direction: coaching notifications belong primarily in app surfaces and a separate coach web portal, not mixed into `/admin/coaching/audit`. Do not continue expanding `/admin/coaching/audit` UI under this assignment. |
| `COACHING-OPS-SURFACE-BOUNDARY-CLARITY-SPEC-A` | `review` | `M6 broader scope (docs-only follow-up: admin coaching ops surface purpose + boundary split)` | `Admin operator`, `Coach`, downstream `Team Leader`, `Team Member`, `Solo User` | `coaching / notifications / admin ops` (`surface purpose + boundary clarification`) | `/admin/coaching/audit`, separate notification ops view (if justified), coach-facing in-app AI + notification surfaces (planning only) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + accepted W5/W6 AI/notifications stack | Owner direction tightened: `/admin/coaching/audit` is likely optional super-admin AI troubleshooting only (not primary workflow); coaching notifications belong in app surfaces + separate coach web portal. Follow-on W6/W7 rescoping package/spec required for portal surface set + sequencing. |
| `COACHING-W6-W7-COACH-PORTAL-NOTIFICATION-RESCOPE-A` | `review` | `M6/W7 coaching+notifications rescoping (docs-only sequencing/package split)` | `Coach` (first-class runtime operator), `Challenge Sponsor` (distinct persona), `Admin operator` (super-admin troubleshooting only), downstream `Team Leader`, `Team Member`, `Solo User` | `coaching / notifications / portal` (`W6/W7 rescope + sequencing`) | app coaching notification host surfaces/channels (including cohort-based channels for non-team individuals) + coach web portal (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`) + sponsor-scoped comms/content/KPI-visibility permissions + optional `/admin/coaching/audit` super-admin troubleshooting | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + accepted W5/W6 stack + boundary-clarity follow-up | Docs-only rescoping package prepared from owner direction: demotes `/admin/coaching/audit` to optional super-admin AI troubleshooting, keeps coaches as first-class runtime operators in host surfaces/channels, supports cohort-based channels for non-team individuals, preserves Team Leader challenge participation (`creator != non-participant`), removes generic solo challenge creation as a primary destination (solo create routes via Sponsored Challenges if supported), and treats Challenge Sponsor as a distinct persona with sponsor-scoped comms/content/member-KPI visibility but no KPI logging. |
| `COACHING-W7-COACH-PORTAL-FOUNDATION-SURFACES-A` | `committed` | `W7/W8 coach portal implementation spec pack (docs-only; implementation-ready)` | `Coach`, `Team Leader` (team-scoped content upload only), `Challenge Sponsor` (sponsor-scoped tools), `Admin operator` (limited governance) | `coach portal / content operations` (`surface contracts + role gates + acceptance pack`) | coach web portal `content_upload`, `content_library`, `journeys`, `cohorts`, `channels` + final acceptance pack for admin/mobile/backend lanes (audit remains secondary-only) | `Admin-1` | `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred) | manual-spec-driven + W6/W7 rescope package | Committed docs swath: finalized W7/W8 implementation spec pack with explicit surface contracts, role gates, sponsor constraints, Team Leader team-scoped upload limits, no-sponsor-KPI-logging enforcement, and final implementation acceptance pack for admin/mobile/backend lanes; `/admin/coaching/audit` remains secondary-only governance/troubleshooting. |
| `COACHING-W7-RUNTIME-COACH-SPONSOR-VISIBILITY-A` | `committed` | `W7 runtime coaching visibility swath (mobile)` | `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User` | `coaching / notifications / participation visibility` (`coach+sponsor runtime modules + cohort-channel context`) | `KPIDashboardScreen` host/runtime surfaces: `Home`, `Team`, `Challenge`, `coaching_journeys*`, `inbox*`, `channel_thread` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred) | manual-spec-driven + accepted W6/W7 rescope package + existing read-model outputs | Completed: W7 runtime coach+sponsor visibility modules added across Home/Team/Challenge/Journeys/Inbox surfaces using existing read-model outputs + safe fallbacks; cohort channel context surfaced; team-leader creator+participant behavior enabled in challenge create flow; no backend/schema/API changes and sponsor KPI logging actions remain prohibited. |
| `COACHING-W8-RUNTIME-STATE-HARDENING-A` | `committed` | `W8 runtime hardening (coach/sponsor/team-leader state resilience)` | `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User` | `coaching runtime states` (`loading/empty/error/permission-denied/partial-read-model`) | `KPIDashboardScreen` runtime surfaces: `Home`, `Team`, `Challenge`, `coaching_journeys*`, `inbox*`, `channel_thread` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred) | manual-spec-driven + accepted W6/W7 runtime stack | W8 runtime polish+proof continuation completed: route-clarity copy/state transitions finalized and screenshot evidence matrix captured for loading/empty/error/permission-denied/partial-read-model/read-model-ready states; no backend/schema/API changes. |
| `COACHING-W10-MOBILE-UI-EVALUATION-READINESS-A` | `committed` | `M6 W10 mobile UI evaluation readiness` | `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User` | `coaching / team / challenge evaluability` (`CTA integrity`, `connected screens`, `compact state UI`) | `KPIDashboardScreen` surfaces: `Team`, `Team Challenges`, `Challenge Details`, `Leaderboard/Results`, `coaching_journeys*`, `coaching_journey_detail`, `coaching_lesson_detail`, `inbox*`, `channel_thread` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred) | manual-spec-driven + accepted W6/W7/W8 runtime stack | Committed: large-swatch W10 evaluation-readiness pass in mobile runtime surface completed. Misleading/dead CTAs were removed/re-labeled, diagnostic wall text was condensed into concise state cards/chips, and team/challenge/coaching paths remain connected end-to-end without backend/schema/API changes. |
| `COACHING-W10-COACH-PORTAL-CUSTOMER-SHELL-A` | `committed` | `M6 W10 coach portal customer-facing shell` | `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools) | `coach portal IA/UX` (`customer-facing shell`, `route connectivity`, `copy cleanup`) | `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels` (+ existing detail drill-ins where scaffolded) | `Admin-1` | `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred) | manual-spec-driven + accepted W9/W10 direction | Committed: upgraded `/coach/*` to a coach-product-facing shell baseline with connected route flow, customer-facing copy, actionable Library/Journeys/Cohorts/Channels surfaces, and preserved `/admin/coaching/*` compatibility redirects for transition. |
| `COACHING-W10-REALISM-DATA-PACK-A` | `committed` | `M6 W10 realism data for UI evaluation` | `Coach`, `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor` | `coaching content realism` (`journeys`, `lessons`, `cohorts`, `channels`, `messages`) | Seeded runtime data feeding `coaching_journeys*`, `coaching_lesson_detail`, `inbox*`, team/challenge coaching modules, and `/coach/*` list/detail surfaces | `Coach-1` | `codex/a2-admin-list-usability-pass` (backend/data worktree preferred) | N/A (seed/data/docs swath) | Committed: deterministic realism seed/reset/smoke pack + docs discoverability landed for owner UI evaluation (`9c617f7`). |
| `COACHING-W12-COMMS-HUB-REORG-A` | `review` | `M6 W12 mobile comms hub IA reorg` | `Coach`, `Team Leader`, `Challenge Sponsor`, `Team Member`, `Solo User` | `coaching / communication hub` (`bottom tab rename`, `single comms hub entry`, `persona-specific in-hub layouts`) | `KPIDashboardScreen` mobile runtime surfaces: bottom nav + `inbox*`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys*` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required) | manual-spec-driven + accepted W12 journeys hierarchy baseline | Review-ready: bottom tab now uses Comms semantics, in-hub layout is persona-aware (coach/team-leader/sponsor/member/solo), Journeys remains first-class in the hub, and existing endpoint families/role guardrails are unchanged. |
| `COACHING-W12-JOURNEY-LESSON-HIERARCHY-UX-A` | `review` | `M6 W12 mobile hierarchy UX pass` | `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User` | `coaching journeys UX` (`tap hierarchy`, `explicit back path`, `remove misleading detail-open buttons`) | `KPIDashboardScreen` surfaces: `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required) | manual-spec-driven + accepted W11 route/data baseline | Review-ready: removed button-led journey/lesson deep-link actions, kept list/lesson tap hierarchy, and added explicit back controls (`Journey Detail -> Journeys`, `Lesson Detail -> Journey`) with no backend/schema/API changes. |
| `COACHING-W11-MOBILE-PRODUCT-CLARITY-PASS-A` | `review` | `M6 W11 mobile product-clarity pass` | `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User` | `coaching / challenge / team UX clarity` (`replace diagnostic text walls`, `tight CTA intent copy`, `owner-evaluable screens`) | `KPIDashboardScreen` surfaces: `coaching_journeys*`, `coaching_journey_detail`, `coaching_lesson_detail`, `inbox*`, `channel_thread`, `Team Challenges`, `Challenge Details`, `Leaderboard/Results` | `Mobile-1` | `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required) | manual-spec-driven + accepted W10 route/data baseline | Review-ready: readability-first copy/state pass completed on in-scope mobile surfaces with stacked diagnostic/legalistic cards removed, concise state messaging, and clearer CTA intent hierarchy while preserving route continuity and sponsor/logging guardrails. |
| `COACHING-W12-FOURTHREASON-CHAT-PARITY-MAP-A` | `committed` | `M6/W12 coaching parity planning (docs/control-plane)` | `Coach`, `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor` | `coaching / communication parity` (`Fourth Reason chat+journies UX pattern mapping`) | mobile runtime coaching/comms shells (`inbox*`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys*`) + `/coach/*` portal surfaces (`/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels`, `/coach/uploads`) | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + Fourth Reason reference repo | Committed: W12 parity mapping package landed with implementation-ready mobile + `/coach/*` screen/flow specs mapped to existing Compass contract families (no new endpoint families). |
| `COACHING-W12-DRAGDROP-LIBRARY-TO-JOURNEY-SPEC-A` | `committed` | `M6/W12 coach portal authoring parity planning (docs/control-plane)` | `Coach` (primary), `Team Leader` (team-scoped), `Challenge Sponsor` (sponsor-scoped), `Admin operator` (governance) | `coach portal content authoring` (`library -> journey drag/drop build map`) | `/coach/library`, `/coach/journeys`, `/coach/uploads` + runtime verification touchpoints `coaching_journeys*` | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + Fourth Reason references + existing API contracts | Committed refinement pass: spec now includes full UX flow map, drag/hover/drop/reorder/remove/save interaction-state matrix, required frontend data model, existing API mapping, explicit in-family contract gaps, and phased MVP->polish build plan. |
| `COACHING-W12-IA-SIMPLIFY-DOCS-SYNC-A` | `committed` | `M6/W12 coach portal IA simplification (docs/control-plane)` | `Coach` (primary), `Team Leader` (team-scoped), `Challenge Sponsor` (sponsor-scoped), `Admin operator` (governance) | `coach portal IA` (`library subsumes uploads`, `top-tab only`, `drag library->journey primary`) | `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels` + wiring/screenmap/parity docs | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + W12 parity/dragdrop package | Committed docs-sync: Library now subsumes upload intake, Uploads removed as first-class coach tab, top-tab-only IA declared, and drag Library -> Journey is documented as primary authoring target across screenmap/wiring/parity docs. |
| `COACHING-W12-COMMS-HUB-DOCS-SYNC-A` | `committed` | `M6/W12 coach portal communications IA sync (docs/control-plane)` | `Coach` (primary), `Team Leader` (team-scoped), `Challenge Sponsor` (sponsor-scoped), `Admin operator` (governance) | `coach portal communication` (`channels as comms hub`, `top-tab nav only`, `runtime handoff clarity`) | `/coach/channels` + supporting `/coach/library`, `/coach/journeys`, `/coach/cohorts` docs surfaces | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + W12 parity/IA package | Committed docs-sync: `/coach/channels` now documented as the primary coach communications hub with top-tab-only navigation and consistent runtime handoff language across screenmap/wiring/parity docs, preserving existing boundaries. |
| `COACHING-W12-COMMS-HUB-DOCS-IMPLEMENTATION-SYNC-B` | `committed` | `M6/W12 communications hub implementation docs sync (control-plane)` | `Coach` (primary), `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor`, `Admin operator` | `communication runtime + portal hub` (`post-implementation docs alignment`) | `inbox*`, `channel_thread`, `coach_broadcast_compose`, `/coach/channels` + screenmap/wiring/addendum docs | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + landed Mobile-1 runtime behaviors | Committed docs implementation-sync: screenmap/wiring/addendum now reflect landed member comms runtime and `/coach/channels` comms-hub baseline, with compatibility alias behavior and unchanged role/API boundaries. |
| `COACHING-W11-COACH-PORTAL-STANDALONE-UX-PASS-A` | `review` | `M6 W11 coach portal standalone UX pass` | `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools) | `coach portal IA/UX` (`standalone look`, `de-admin chrome`, `coach-first content workflows`) | canonical `/coach/*` routes with standalone shell treatment and minimized admin framing | `Admin-1` | `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred) | manual-spec-driven + accepted W10 route baseline | Review-ready hard-correction+polish pass completed: canonical `/coach/*` now mounts dedicated `CoachPortalScreen` host (not `AdminShellScreen` chrome), `/admin/coaching/*` foundation paths stay compatibility redirects, DEC-0047 logged, and refreshed screenshot set captured under `app/test-results/w11-coach-portal-standalone-hard-correction/`. |
| `COACHING-W12-COACH-PORTAL-IA-SIMPLIFY-A` | `committed` | `M6 W12 coach portal IA simplify pass` | `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools) | `coach portal IA/UX` (`simplify top-level IA`, `merge uploads into library`, `remove redundant progression actions`) | `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels` (+ compatibility `/coach/uploads` redirect to `/coach/library`) | `Admin-1` | `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred) | manual-spec-driven + accepted W11 host split baseline | Committed: Uploads merged into Library IA/copy, `/coach/uploads` removed from top tabs, `/coach/uploads` and `/admin/coaching/*` compatibility redirects preserved, and per-page next-tab progression actions removed in favor of top-tab navigation only. |
| `COACHING-W12-DRAGDROP-LIBRARY-TO-JOURNEY-MVP-A` | `committed` | `M6 W12 coach portal journey authoring MVP` | `Coach` (primary), `Team Leader` (team-scoped only), `Challenge Sponsor` (sponsor-scoped read context only) | `coach portal authoring UX` (`library -> journey drag/drop`, `reorder/remove/save states`) | `/coach/library`, `/coach/journeys` (coach portal web only) | `Admin-1` | `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred) | committed W12 drag/drop spec (`COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md`) | Committed MVP: added client-side drag/drop assignment from Library to Journey milestones with move/reorder/remove controls, draft save-state feedback (`idle/pending/success/error`), and role-gated lock messaging (sponsor scoped/no KPI logging). No backend/schema/API changes required. |
| `COACHING-W9-COACH-PORTAL-EXPERIENCE-PLANNING-A` | `committed` | `W9 coach portal experience planning (docs/control-plane)` | `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools), `Admin operator` (host foundation only during transition) | `coach portal IA/UX` (`dedicated experience + migration path + production sequencing`) | dedicated coach portal IA/UX direction (outside admin-shell presentation), migration from `/admin/coaching/*` foundation routes, persona visibility model, production-experience sequencing | `Coach-1` | `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred) | manual-spec-driven + W7/W8 acceptance pack | Committed W10 route-decoupling swath: dedicated `/coach/*` uploads/library/cohorts/channels routes + customer-facing shell/nav landed, coach-facing navigation migrated to `/coach/*`, and `/admin/coaching/*` retained as temporary compatibility redirect-only paths (no backend/schema/API changes). |
| `COACHING-W7-SUPERADMIN-AI-TROUBLESHOOTING-AUDIT-A` | `queued` | `W7 optional hardening (super-admin AI troubleshooting only)` | `Super Admin` (primary), `Admin operator` (limited) | `AI troubleshooting / audit` (`exception-only`) | optional trimmed `/admin/coaching/audit` super-admin troubleshooting views | `Admin-1` | `codex/a2-admin-list-usability-pass` (admin web worktree preferred) | manual-spec-driven + W6/W7 rescope package + explicit owner approval gate | Optional exception-only follow-on to repurpose or trim `/admin/coaching/audit` into super-admin AI troubleshooting/audit; not a coach notification or coach primary workflow surface. |

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

### `COACHING-W10-COACH-PORTAL-CUSTOMER-SHELL-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6 W10 coach portal customer-facing shell`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools)
- `Flow:` `coach portal IA/UX`
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred)
- `Controller launch note (2026-02-27):` Improve `/coach/*` into a customer-facing experience and stop relying on admin-shell presentation for coach workflow validation.
- `Worker note (2026-02-27, Admin-1 start):` Board status updated first. Executing large-swatch W10 customer-facing shell pass for `/coach/*` with top-nav + section-nav IA, route connectivity polish, customer-facing copy cleanup, and reduced diagnostic density while preserving role gates and `/admin/coaching/*` compatibility redirects.
- `Current blocker status (2026-02-27, Admin-1 start):` `none` for scoped frontend shell/routes pass (no backend/schema/API changes).
- `Completion note (2026-02-27, Admin-1 completion):` Completed customer-facing coach shell pass: added canonical `/coach/journeys` route, strengthened `/coach/*` IA with top nav + section nav, converted coach surfaces to product wording, and implemented actionable table/card + lightweight detail drill-ins for Library/Journeys/Cohorts/Channels/Uploads. Dense admin diagnostics remain removed from coach-facing viewport.
- `Validation note (2026-02-27, Admin-1 completion):` `cd app && npm run test:unit -- adminAuthz` passed. `cd app && npx tsc --noEmit` reports unrelated pre-existing `KPIDashboardScreen.tsx` style-key errors (`knownLimitedDataChip`, `knownLimitedDataChipText`) outside this swath. Route screenshots captured for touched `/coach/*` pages in `app/test-results/w10-coach-portal-shell-pass/`.
- `Current blocker status (2026-02-27, Admin-1 completion):` `none` for committed W10 shell swath; manual browser spot-check for legacy `/admin/coaching/*` redirect behavior remains recommended before push.

#### Primary Objective
Deliver a basic polished coach-facing shell on `/coach/*`:
- clear nav/header structure
- connected routes across library/journeys/cohorts/channels
- coach-product wording (remove admin-ops heavy copy)
- maintain temporary `/admin/coaching/*` compatibility redirects

#### Hard Constraints
- No backend/API/schema changes.
- Do not expand `/admin/coaching/audit` as primary coach workflow.
- Preserve role boundaries and no sponsor KPI logging.

#### Required Validation
- Run existing web/app typecheck checks used in this repo.
- Route click-through map for `/coach/*` surfaces.
- Runtime screenshots for each touched `/coach/*` route.

#### Report-Back Requirements
- Update this assignment row/block status first
- Program status + persona
- Routes/screens changed
- Route map before/after
- Files changed with line refs
- `/admin/coaching/*` compatibility redirect status
- Validation summary
- Screenshot paths
- Commit hash

### `COACHING-W10-REALISM-DATA-PACK-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6 W10 realism data for UI evaluation`
- `Persona:` `Coach`, `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor`
- `Flow:` `coaching content realism`
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (backend/data worktree preferred)
- `Controller launch note (2026-02-27):` Improve runtime realism for owner review with deterministic data across journeys/lessons/cohorts/channels/messages.
- `Completion note (2026-02-27):` Deterministic realism data-pack execution completed and committed in `9c617f7` (seed script expansion + runbook commands + docs discoverability updates).

#### Primary Objective
Provide realistic, repeatable seeded data so mobile + `/coach/*` evaluate as product behavior rather than placeholder-only flows.

#### Hard Constraints
- No net-new endpoint family.
- No schema-breaking changes without migration/docs.
- Preserve persona boundaries (coach primary, sponsor scoped visibility, no sponsor KPI logging).

#### Required Validation
- Seed/reset command sequence runs successfully.
- Smoke-check command verifies expected records per persona context.
- Docs updated with seed scenario discoverability and run commands.

#### Report-Back Requirements
- Update this assignment row/block status first
- Datasets added (entities/counts)
- Seed/reset/smoke commands
- Files/docs changed
- Commit hash

### `COACHING-W12-FOURTHREASON-CHAT-PARITY-MAP-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6/W12 coaching parity planning (docs/control-plane)`
- `Persona:` `Coach`, `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor`
- `Flow:` `coaching / communication parity`
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Controller launch note (2026-02-27):` Extract reusable chat/journey UX patterns from Fourth Reason and convert them into Compass implementation-ready parity specs mapped to current contracts/routes.
- `Execution note (2026-02-27):` Board updated first; executing docs-only W12 parity-map pass now with explicit no-net-new-endpoint-family boundary.
- `Current blocker status (2026-02-27 start):` `none` for docs/control-plane scope.
- `Completion note (2026-02-27):` Added `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md` with reusable Fourth Reason chat/journey UX pattern extraction, Compass route/contract mapping, and implementation-ready mobile + `/coach/*` screen/flow specs constrained to existing endpoint families.
- `Validation note (2026-02-27):` Verified mapped patterns against current Compass route surfaces in `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` and `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`, and against existing contract families in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`; no net-new endpoint family introduced.
- `Completion note (2026-02-27 W12 closeout):` Linked the parity package into `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md` and `/Users/jon/compass-kpi/docs/spec/README.md` so the mapping is discoverable from core integration docs and appendix index.
- `Controller note (2026-02-27 owner add/execute request):` Assignment reconfirmed as executed from board-first flow with committed parity-map package outputs and no endpoint-family expansion.
- `Controller note (2026-02-27 owner rerun request):` Rechecked W12 package and reconfirmed parity-map deliverable is implementation-ready for mobile + `/coach/*`, mapped exclusively to existing Compass route/contract families with no endpoint-family expansion.

#### Primary Objective
Produce a reusable parity map that translates Fourth Reason chat/journey UX patterns into Compass-ready mobile and `/coach/*` implementation specs using existing endpoint families and current route surfaces.

#### Hard Constraints
- No net-new endpoint families.
- No schema-breaking changes in this assignment.
- Preserve persona boundaries (`coach` primary, sponsor scoped visibility, no sponsor KPI logging).

#### Required Validation
- Cross-check pattern mappings against current Compass route surfaces (`inbox*`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys*`, `/coach/*`).
- Cross-check API mapping against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md` existing endpoint families.
- Ensure parity map calls out `build now` vs `defer` without widening backend/API scope.

#### Report-Back Requirements
- Update this assignment row/block status first
- `Parity map` (pattern -> Compass route -> Compass contract family -> implementation notes)
- `Mobile implementation-ready screens/flow spec`
- `Coach portal implementation-ready screens/flow spec`
- `No new endpoint family` confirmation
- `Files/docs changed`
- Commit hash

### `COACHING-W12-DRAGDROP-LIBRARY-TO-JOURNEY-SPEC-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6/W12 coach portal authoring parity planning (docs/control-plane)`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped upload/link), `Challenge Sponsor` (sponsor-scoped visibility/link), `Admin operator` (governance)
- `Flow:` `coach portal content authoring` (`library -> journey drag/drop`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Controller launch note (2026-02-27):` Create and execute a new assignment for implementation-ready drag/drop authoring UX spec and build map using existing contracts or explicit contract gaps, then update board and commit.
- `Execution note (2026-02-27):` Board checked and updated first. Executed docs-only W12 drag/drop authoring planning swath with explicit no-net-new-endpoint-family boundary.
- `Current blocker status (2026-02-27 start):` `none` for docs/control-plane scope.
- `Completion note (2026-02-27):` Added `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md` with implementation-ready `/coach/library` -> `/coach/journeys` drag/drop UX contract, keyboard/mobile fallback behavior, lane build map, role-gate matrix, and explicit in-family `/api/coaching/*` contract gaps for draft ops/publish-readiness.
- `Validation note (2026-02-27):` Verified route/surface alignment against `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx` and `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`; verified contract-family boundaries against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`; confirmed no new endpoint family required.
- `Current blocker status (2026-02-27 completion):` `none`.
- `Execution note (2026-02-27 refinement start):` Board updated first for owner-requested execution pass to finalize implementation-ready drag/drop package with explicit UX flow map, interaction-state matrix, frontend data model contract, and phased MVP->polish build plan.
- `Completion note (2026-02-27 refinement completion):` Updated `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md` with implementation-ready flow map (Library -> Journey Builder -> publish), detailed interaction-state matrix (`drag`, `hover`, `drop`, `reorder`, `remove`, `save` + conflict/error states), required frontend draft/op data model, existing-contract mapping table, explicit in-family `/api/coaching/*` gap table (`G1-G5`), and phased build plan (`Phase 1 MVP`, `Phase 2 Hardening`, `Phase 3 Polish`).
- `Validation note (2026-02-27 refinement completion):` Revalidated contract-family alignment against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md` and preserved no-net-new-endpoint-family/no-schema-breaking boundaries.

#### Primary Objective
Produce an implementation-ready drag/drop authoring spec that maps library assets into journey composition flows with explicit build slices and contract boundaries, while keeping all API work inside existing endpoint families.

#### Hard Constraints
- No net-new endpoint family.
- No schema-breaking changes in this assignment.
- Preserve role boundaries: coach primary authoring, Team Leader team-scoped only, sponsor scoped visibility only, sponsor no KPI logging.
- Keep `/admin/coaching/audit` secondary-only governance/troubleshooting.

#### Required Validation
- Cross-check drag/drop flow mappings against current `/coach/*` and runtime route surfaces.
- Cross-check contract mapping and gaps against existing families in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`.
- Ensure gap proposals are in-family extensions only (`/api/coaching/*`) and do not introduce net-new endpoint family.

#### Report-Back Requirements
- Update this assignment row/block status first
- Drag/drop build map by lane/surface
- Existing contract mapping + explicit in-family gap list
- Persona/role-gate summary
- Files/docs changed
- Commit hash

### `COACHING-W12-IA-SIMPLIFY-DOCS-SYNC-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6/W12 coach portal IA simplification (docs/control-plane)`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped), `Admin operator` (governance)
- `Flow:` `coach portal IA docs sync` (`library subsumes uploads`, `top-tab only`, `drag library->journey primary`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Execution note (2026-02-27):` Board updated first and assignment activated before doc edits.
- `Completion note (2026-02-27):` Updated `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`, `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`, and `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md` to reflect IA simplification: Library subsumes upload intake, Uploads is compatibility alias only (not first-class coach tab), top-tab-only primary navigation, and drag `Library -> Journey` primary authoring target.
- `Decision note (2026-02-27):` Added `DEC-0048` to `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md` to record the coach portal IA boundary simplification and compatibility-alias rule for uploads.
- `Validation note (2026-02-27):` Cross-doc terminology/route sync verified for `content_upload` vs `coach_content_library` boundary and top-tab IA direction; no backend/API/schema changes made.
- `Current blocker status (2026-02-27 completion):` `none`.
- `Execution note (2026-02-27 rerun):` Re-checked assignment outputs against board direction; IA simplify package remains aligned with owner decision and requires no net-new edits for this rerun.

#### Primary Objective
Apply owner IA decisions across control-plane docs so coach portal authoring is centered on Library and Journey tabs, with uploads folded into Library and drag `Library -> Journey` established as the main composition interaction.

#### Hard Constraints
- Docs-only scope.
- Preserve coach/team-leader/sponsor role boundaries and no-sponsor-KPI-logging rule.
- No net-new endpoint family or schema change.

#### Report-Back Requirements
- Update board status/blocker/completion notes first
- Exact docs changed
- Decision-log update confirmation (if structural boundary changed)
- Commit hash

### `COACHING-W12-COMMS-HUB-DOCS-SYNC-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6/W12 coach portal communications IA sync (docs/control-plane)`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped), `Challenge Sponsor` (sponsor-scoped), `Admin operator` (governance)
- `Flow:` `coach portal communication docs sync` (`channels as comms hub`, `top-tab nav only`, `runtime handoff clarity`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Execution note (2026-02-27):` Assignment added and activated from board-first flow; executing docs sync to align comms-hub IA language and boundaries.
- `Current blocker status (2026-02-27 start):` `none`.
- `Completion note (2026-02-27):` Updated `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`, `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`, and `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md` to define `/coach/channels` as the primary communications hub and keep top-tab-only IA wording consistent with Library-first authoring and runtime handoff boundaries.
- `Validation note (2026-02-27):` Cross-doc terminology sync completed for channels/comms-hub naming and top-tab navigation constraints; no backend/API/schema changes made.
- `Current blocker status (2026-02-27 completion):` `none`.

#### Primary Objective
Sync control-plane docs so `/coach/channels` is defined as the coach communications hub, top-tab-only navigation remains explicit, and runtime communication handoff boundaries are consistent across screenmap/wiring/parity docs.

#### Hard Constraints
- Docs-only scope.
- No net-new endpoint family.
- Preserve coach/team-leader/sponsor role boundaries and no-sponsor-KPI-logging rule.
- Keep `/admin/coaching/audit` secondary-only governance/troubleshooting.

#### Required Validation
- Cross-doc terminology sync for `channels` comms-hub language.
- Confirm top-tab navigation-only wording remains consistent.
- Confirm no backend/API/schema changes.

#### Report-Back Requirements
- Update board status/blocker/completion notes first
- Exact docs changed
- Commit hash

### `COACHING-W12-COMMS-HUB-DOCS-IMPLEMENTATION-SYNC-B`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6/W12 communications hub implementation docs sync (control-plane)`
- `Persona:` `Coach` (primary), `Team Leader`, `Team Member`, `Solo User`, `Challenge Sponsor`, `Admin operator`
- `Flow:` `communication runtime + portal hub docs alignment`
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Execution note (2026-02-27):` Board updated first and assignment activated before docs edits.
- `Current blocker status (2026-02-27 start):` `none`.
- `Completion note (2026-02-27):` Synced `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`, `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`, and `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md` to landed runtime behavior: member comms flows (`inbox*`, `channel_thread`, `coach_broadcast_compose`) are treated as implemented baseline and coach portal `/coach/channels` is documented as a partial comms-hub runtime baseline with compatibility alias support.
- `Validation note (2026-02-27):` Runtime cross-check completed against `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` and `/Users/jon/compass-kpi/app/screens/CoachPortalScreen.tsx`; docs are now aligned to implemented comms-hub behavior with no backend/API/schema changes.
- `Decision note (2026-02-27):` `not needed` — no new structural boundary introduced; existing `DEC-0047` and `DEC-0048` already cover host and IA boundary decisions.
- `Current blocker status (2026-02-27 completion):` `none`.

#### Primary Objective
Sync docs to the implemented communications hub runtime after Mobile-1 landing, across screenmap, wiring diagram, coaching wiring addendum, and board notes.

#### Hard Constraints
- Docs-only scope.
- No net-new endpoint family.
- Preserve role boundaries and no-sponsor-KPI-logging rule.
- Log structural boundary decision in `DECISIONS_LOG.md` only if an actual boundary change is introduced.

#### Required Validation
- Cross-check docs against landed runtime behaviors in:
  - `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`
  - `/Users/jon/compass-kpi/app/screens/CoachPortalScreen.tsx`
- Confirm top-tab and comms-hub language consistency.
- Confirm no backend/API/schema changes in this assignment.

#### Report-Back Requirements
- Update board status/blocker/completion notes first
- Exact docs changed
- `DECISIONS_LOG` update status (`needed`/`not needed`)
- Commit hash

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
- `Status:` `review`
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
- `Status:` `committed`
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
- `Status:` `review`
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
- `Completion note (2026-02-26, Mobile-1):` W4 comms API integration completed in `KPIDashboardScreen.tsx`: `inbox_channels` now fetches/render API channels (`GET /api/channels`) with scoped filtering + shell fallback; `channel_thread` loads messages (`GET /api/channels/{id}/messages`), marks seen (`POST /api/messages/mark-seen`), and sends messages (`POST /api/channels/{id}/messages`); leader `coach_broadcast_compose` sends via `/api/channels/{id}/broadcast` with API error/success handling. Context labels and role-gated UI behavior remain intact.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅. Route and role-gating checks completed via code-path review (leader-only broadcast CTA path preserved; send button disabled for non-leader / no channel selection). API assumptions validated against `docs/spec/04_api_contracts.md` and backend handlers in `backend/src/index.ts` for channel list/thread/message/broadcast + mark-seen. Runtime screenshots not captured in this environment; controller/device validation still required.
- `Current blocker status (2026-02-26, Mobile-1, post-pass):` `none` for code deliverable; remaining validation gap is screenshot proof/runtime walkthrough only.
- `Controller review note (2026-02-26):` Accepted. W4 stayed within documented channel/coaching endpoint families, added API-backed channel list/thread read/send + mark-seen and leader broadcast send, preserved role gating/context labels, and kept KPI logging + challenge ownership boundaries intact. Docs sync rule satisfied and local `tsc` re-check passed. Runtime screenshots remain follow-up validation debt.

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
- `Status:` `review`
- `Program status:` `M6 coaching slice (planning/architecture)`
- `Persona:` `Coach`, `Admin operator` (authoring/ops), plus downstream `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching content operations / publishing`
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; dedicated worktree preferred)
- `Figma refs:` `manual-spec-driven` (coach authoring/ops model not yet Figma-backed)
- `Controller seed note (2026-02-26):` Owner identified a critical architecture gap: coach persona/content library/authoring/publishing model is not yet explicit and likely overlaps sponsored + paid coaching packaging.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Executing docs-only coach persona/content-ops architecture planning pass across coaching matrix, wiring addendum, intended screenmap/wiring docs, then adding follow-on assignment specs for coach ops portal + packaging/entitlement planning.
- `Completion note (2026-02-26, Coach-1):` Added explicit `Coach` + ops access model and authoring-vs-delivery ownership boundaries in coaching matrix; added coach/admin authoring portal touchpoints and publishing/targeting handoff seams in coaching wiring addendum; added `Coach` persona/manual-spec-driven `coach_ops_authoring` section in screenmap; added companion authoring-delivery overlay + handoff table in intended wiring diagram; appended `COACHING-OPS-PORTAL-A` and `COACHING-PACKAGING-SPONSORED-PAID-A` follow-on specs.
- `Validation note (2026-02-26, Coach-1):` Docs-only changes; no app/backend/schema/API files edited. `Coach` terminology, authoring-vs-delivery boundary, and sponsored-vs-paid packaging boundaries were aligned across matrix/addendum/screenmap/wiring. Any runtime/API/schema implications remain marked planning-only / `decision needed` for implementation phase.
- `Controller review note (2026-02-26):` Accepted. This closes the Coach persona/content-ops modeling gap before deeper M6 comms/AI expansion. Planning package cleanly separates authoring/ops portal concerns from member runtime delivery and preserves challenge/KPI ownership boundaries.

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

### `COACHING-OPS-PORTAL-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (planning/architecture; coach ops portal)`
- `Persona:` `Coach`, `Admin operator`, `Sponsor ops` (limited)
- `Flow:` `coach content operations / publishing` (`authoring portal touchpoints + ops handoff`)
- `Owner:` worker (docs-only or admin-shell UI-shell planning, controller-scoped)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only by default; separate worktree preferred if UI shell work is later approved)
- `Figma refs:` `manual-spec-driven` unless coach/admin portal exports are later added
- `Dependency note:` Follows accepted `COACHING-ARCH-COACH-PERSONA-A` coach persona operating model
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Executing docs-first coach ops portal planning package (host recommendation, route grouping, touchpoint workflows, lifecycle states, runtime handoff artifacts) without app/backend/schema changes.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. Planning assumes current `Admin Shell` is the near-term host baseline; any structural hybrid portal split beyond planning will be marked `decision needed`.
- `Completion note (2026-02-26, Coach-1):` Completed docs-first coach ops portal planning package. Added near-term host recommendation (`Admin Shell extension`) + deferred hybrid option, provisional route grouping plan, touchpoint workflow sequences, publish/approval/rollback lifecycle states, and planning-level runtime handoff artifact definition. Synced portal host/route-grouping notes into intended screenmap and intended wiring docs.
- `Validation note (2026-02-26, Coach-1):` Consistent with accepted `COACHING-ARCH-COACH-PERSONA-A` boundaries; explicit role-gating for `Coach`, `Admin operator`, and `Sponsor ops` is documented. No app/backend/schema/API files changed. Hybrid portal split remains `decision needed` and would require `DECISIONS_LOG.md` update in implementation phase.
- `Controller review note (2026-02-26):` Accepted. Portal-host recommendation (`Admin Shell extension` near-term) and route grouping are clear, the lifecycle and handoff model are implementation-ready as planning guidance, and structural split is correctly held as `decision needed`.

#### Primary Objective
Turn the coach persona authoring/ops model into an implementation-ready portal planning package (or UI shell planning slice) without collapsing authoring into member runtime delivery surfaces:
- define near-term host choice (`Admin Shell extension` vs `hybrid coach portal`) and route grouping
- detail portal touchpoints:
  - `coach_content_library`
  - `coach_journey_authoring`
  - `coach_publish_targeting`
  - `coach_packages_entitlements`
  - `coach_ops_audit`
- define role gates (`Coach`, `Admin operator`, `Sponsor ops limited`)
- define authoring->publishing->runtime handoff artifacts and operational states

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

#### Constraints (Hard)
- Default scope is docs/planning only unless controller explicitly upgrades to admin UI shells
- No mobile member app changes
- No backend/API/schema changes
- No net-new endpoint families presented as approved
- Preserve authoring vs runtime delivery boundary
- Preserve sponsored challenge ownership boundary and KPI non-negotiables

#### Deliverables (Docs-First)
1. Portal host recommendation + route grouping plan (admin extension vs hybrid)
2. Touchpoint-by-touchpoint role/access matrix and workflow sequence
3. Publish/approval/rollback lifecycle states and ops responsibilities
4. Runtime handoff artifact definition (planning-level only; no schema approval)
5. If controller requests UI shells, a separate scoped assignment or explicit phase note

#### Validation (Required)
- Consistency with `COACHING-ARCH-COACH-PERSONA-A` boundaries
- Explicit role-gating stated for `Coach`, `Admin operator`, `Sponsor ops`
- No app/backend/schema/API files changed (unless separately approved and scope updated)
- If route/architecture boundary changes are proposed, mark `decision needed` and `DECISIONS_LOG.md` requirement for implementation phase

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Portal host recommendation` (admin extension vs hybrid)
- `Touchpoints defined`
- `Role-gating model`
- `Authoring->publishing->runtime handoff`
- `Open decisions / risks`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-OPS-PORTAL-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-PACKAGING-SPONSORED-PAID-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (planning/architecture; packaging + entitlements)`
- `Persona:` `Coach`, `Admin operator`, `Sponsor ops` (limited), downstream `Leader/Member/Solo`
- `Flow:` `coaching content operations / publishing` (`packaging`, `entitlements`, `sponsored/paid boundaries`)
- `Owner:` worker (docs/planning)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only)
- `Figma refs:` `manual-spec-driven`
- `Dependency note:` Follows accepted `COACHING-ARCH-COACH-PERSONA-A` packaging boundary model and `COACHING-OPS-PORTAL-A` portal touchpoints (if completed)
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Executing docs-only packaging/entitlement planning pass to formalize package taxonomy/lifecycle, ownership approvals, runtime consumption assumptions, and decision-needed risks for sponsored vs paid coaching.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. Billing authority and sponsor approval workflow remain known decision dependencies and will be captured as `decision needed` items rather than implementation proposals.
- `Completion note (2026-02-26, Coach-1):` Completed docs-only packaging/entitlement planning package. Added implementation-ready planning detail for package taxonomy/lifecycle states, ownership/approval matrix by package type, runtime packaging/entitlement consumption assumptions, explicit `decision needed` risks (billing authority, sponsor approvals, entitlement read-model shape, tenancy reuse, role overlap), and follow-on backend-prep/UI assignment suggestions for contract-gap scenarios.
- `Validation note (2026-02-26, Coach-1):` Sponsored vs paid boundaries and authoring vs entitlement vs runtime delivery boundaries are explicit and non-overlapping in planning docs. No app/backend/schema/API files changed. Any schema/API implications remain marked `decision needed` with implementation-phase `DECISIONS_LOG.md` requirement.
- `Controller review note (2026-02-26):` Accepted. Packaging taxonomy, ownership approvals, and runtime consumption assumptions are explicit enough to guide backend-prep or UI gating work without leaking entitlement policy into runtime UI. `decision needed` risks are correctly isolated for later implementation-phase decisions.

#### Primary Objective
Produce an implementation-ready packaging/entitlement planning package that keeps sponsored coaching and paid coaching boundaries explicit:
- define package types and lifecycle states for:
  - `team_coaching_program`
  - `sponsored_challenge_coaching_campaign`
  - `paid_coaching_product`
- define ownership split (`Coach` authoring, `Admin operator` governance, `Sponsor ops` campaign inputs)
- define entitlement/visibility rules and runtime consumption expectations
- identify contract/read-model assumptions for future UI/backend work without proposing approved schema changes

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`

#### Constraints (Hard)
- Docs/planning only
- No backend/API/schema changes
- Do not redefine sponsored challenge participation/results ownership
- Do not couple paid entitlement decisions to journey authoring implementation details
- Keep entitlement/package logic separate from KPI logging and forecast engine behavior

#### Deliverables (Docs-Only)
1. Packaging taxonomy + lifecycle states (`draft`, `review`, `published`, `scheduled`, `retired`, etc.)
2. Ownership/approval matrix by package type (coach/admin/sponsor ops)
3. Runtime consumption contract assumptions (published package assignment + visibility/entitlement flags)
4. Risk list for billing authority and sponsor approval overlaps (`decision needed` items)
5. Follow-on backend-prep/UI assignment suggestions if contract gaps are identified

#### Validation (Required)
- Sponsored vs paid boundaries are explicit and non-overlapping where required
- Authoring vs entitlement vs runtime delivery ownership is explicit
- No app/backend/schema/API files changed
- Any schema/API implications are marked `decision needed` + implementation-phase `DECISIONS_LOG.md` requirement

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Packaging taxonomy`
- `Sponsored vs paid boundary`
- `Ownership / approval model`
- `Runtime consumption assumptions`
- `Open decisions / risks`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-PACKAGING-SPONSORED-PAID-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

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


### `ADMIN-A2-TABLE-OPS-FIXPACK-B`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `A2 (parallel with M6 coaching planning)`
- `Persona:` `Admin operator`
- `Flow:` `admin KPI catalog + challenge templates table ops`
- `Owner:` `Mobile-2`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `N/A` (admin web usability follow-up; preserve existing admin patterns)
- `Controller seed note (2026-02-26):` Safe parallel swath while `Coach-1` executes docs-only packaging planning. Scope intentionally limited to admin A2 tables/forms in `AdminShellScreen.tsx`.
- `Dependency note:` Follows accepted `ADMIN-A2-USABILITY` (`0a45742`); use that pass as baseline and close remaining operator friction discovered via manual browser validation.
- `Execution note (2026-02-26):` Mobile-2 started `ADMIN-A2-TABLE-OPS-FIXPACK-B`; board updated before coding per controller requirement. Scope remains admin web only (`/admin/kpis`, `/admin/challenge-templates`) with `AdminShellScreen.tsx` target.
- `Completion note (2026-02-26):` Implemented KPI Catalog + Challenge Templates operator fixpack in `AdminShellScreen.tsx` only: top filter/count summaries with quick reset actions, hidden selected-row recovery actions, visible-row window reset on data refresh, and stronger row-to-form edit affordance copy. `tsc` passed; manual browser spot-check not completed in this run.
- `Blocker note (2026-02-26):` Required manual browser spot-check is still pending controller/operator confirmation. Initial browser attempt failed with `failed to fetch` because backend API was not running on configured `EXPO_PUBLIC_API_URL`; worker resolved runtime blocker by starting backend bound to `0.0.0.0:4000` and verified `/health` on `http://192.168.86.23:4000`, but cannot self-perform manual click-through in terminal-only session.
- `Owner refinement note (2026-02-26):` Controller accepted manual-validation blocker as passed for baseline A2 behavior and explicitly deferred pagination as not needed for this pass. Continue `ADMIN-A2-TABLE-OPS-FIXPACK-B` with follow-up sorting enhancement only: clickable column headers with asc/desc toggles on visible table fields for `/admin/kpis` and `/admin/challenge-templates`.
- `Completion note (2026-02-26, sorting follow-up):` Added client-side sortable table headers for A2 KPI Catalog and Challenge Templates (click-to-sort asc/desc on visible columns, default `Updated` desc, active sort indicator in header labels). Kept scope admin-only in `AdminShellScreen.tsx`; no backend/API/schema/mobile changes. `cd app && npx tsc --noEmit --pretty false` passed.
- `Controller review note (2026-02-26):` Accepted. Owner cleared the baseline manual-validation blocker and explicitly deferred pagination; sorting follow-up aligns with that refinement and stays admin-only. Combined A2 table fixpack work is now represented by pushed commits `91de8d2` and `6854cd1`.

#### Screens In Scope (Large Swath)
1. `/admin/kpis`
2. `/admin/challenge-templates`

#### Primary Objective
Deliver a substantial A2 follow-up fixpack focused on real operator behavior in KPI Catalog and Challenge Templates after manual browser use:
- validate accepted A2 table improvements in-browser and fix regressions/gaps
- tighten filter/search/reset/selection interactions
- improve table + form coordination clarity (selected row vs filtered rows)
- improve count/visibility messaging and no-results recovery where still rough

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`

#### Constraints (Hard)
- Admin web only (`/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx` and directly related admin helpers only)
- No mobile app screen edits
- No backend/API/schema changes
- No authz/route boundary changes
- Follow existing admin shell visual patterns (no redesign)
- If a fix requires backend/API/route changes, stop and document blocker instead

#### Implementation Pattern (Large Swath)
- Start with a browser-driven mismatch/issues list for `/admin/kpis` and `/admin/challenge-templates`
- Prioritize operator pain:
  - filter/search reset predictability
  - selected-row persistence/visibility after filtering
  - count labels / visible-window clarity
  - no-results recovery actions
  - row-to-form edit affordance clarity
- Keep to `1` scoped commit if possible (`2` max if split by surface is cleaner)

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check of `/admin/kpis` and `/admin/challenge-templates`
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
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment ADMIN-A2-TABLE-OPS-FIXPACK-B exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-UI-PACKAGE-VISIBILITY-GATING-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (runtime UI gating + fallback behavior)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`package visibility + entitlement UI gating`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `manual-spec-driven` (use accepted coaching docs + current runtime surfaces)
- `Dependency note:` Follows accepted `COACHING-PACKAGING-SPONSORED-PAID-A`, `COACHING-UI-W3-JOURNEYS-CONTENT-INTEGRATION`, and `COACHING-UI-W4-COMMS-API-INTEGRATION`.
- `Controller seed note (2026-02-26):` Large-swatch runtime hardening pass to make packaging/entitlement outcomes visible and safe on current coaching surfaces without embedding policy logic in UI or adding backend/schema changes.
- `Worker pickup note (2026-02-26, Mobile-1):` Picked up on `codex/a2-admin-list-usability-pass`; starting with runtime field/copy assumption audit against accepted packaging docs + current W3/W4 coaching surfaces.
- `Current blocker status (2026-02-26, Mobile-1):` `none` at start; if package visibility outcome fields are absent on current payloads, UI will add explicit fallback gating states + triage notes instead of inferring policy.
- `Worker execution note (2026-02-26, Mobile-1):` Continuing in implementation mode after W3/W4 integration baseline; executing package visibility/entitlement UI gating pass on existing coaching surfaces with docs-first runtime outcome mapping and no backend/schema changes.
- `Blocker check (2026-02-26, Mobile-1):` `none` at execution start; will downgrade to fallback states and log triage categories if runtime payloads lack explicit package/entitlement outcome fields.
- `Completion note (2026-02-26, Mobile-1):` Added runtime package visibility/entitlement banners across in-scope coaching surfaces (Home coaching nudge, Team coaching modules, Challenge coaching block, `inbox*`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys*`) with explicit `available/gated/blocked/fallback` states. UI consumes package outcome fields when present and otherwise renders safe fallback copy/CTA behavior without local policy inference. Action buttons are only disabled when explicit runtime outcomes resolve to `gated/blocked`.
- `Contract-gap triage (2026-02-26, Mobile-1):` `UI-only` implemented (fallback banner/copy + CTA state). `backend-prep existing family` remains likely for `/api/coaching/*` and `/api/channels*` payloads to emit stable `package_visibility` / `entitlement_result` outcomes. `net-new family` deferred/not justified by this UI pass.
- `Current blocker status (2026-02-26, Mobile-1, completion):` `none` for UI delivery. Payload coverage gap remains non-blocking: most current coaching/channel responses do not expose package visibility outcomes, so surfaces intentionally render fallback state until backend-prep adds in-family fields.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ passed. Runtime screenshots for available + fallback/gated states remain pending controller/device validation in this environment.
- `Continuation note (2026-02-26, Mobile-1):` Continuing package-visibility gating pass to close remaining runtime consistency gaps (secondary coaching CTA surfaces / shell interaction parity) while staying within UI-only scope and existing W3/W4 endpoint families.
- `Current blocker status (2026-02-26, Mobile-1, continuation):` `none`; expected work is UI consistency hardening only. Runtime available/gated proof screenshots still depend on controller/device validation data/setup.
- `Continuation completion note (2026-02-26, Mobile-1):` Closed remaining runtime consistency gaps by applying explicit gated-state interaction blocking to coaching shell top nav pills and channel list rows (API + fallback rows), and added package fallback banner coverage to the Profile/Settings coaching allocation card. Also tightened challenge payload typing to accept optional `package_visibility` directly (removed temporary cast in challenge coaching gate derivation).
- `Continuation validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ passed after consistency-hardening patch. Runtime screenshots still pending controller/device validation.
- `Controller review note (2026-02-26):` Accepted. Runtime package visibility/entitlement UI gating is now implemented across the stated W3/W4 coaching surfaces with explicit `available/gated/blocked/fallback` presentation, safe fallback behavior when package outcomes are absent, and no client-side entitlement policy inference. Contract-gap triage correctly points to backend-prep in-family extensions without claiming net-new endpoint/schema work.

#### Screens In Scope (Large Swath)
1. `Challenge Details / Results` coaching overlays
2. `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail`
3. `inbox_channels`, `channel_thread`, `coach_broadcast_compose`
4. Existing Team coaching modules / coaching CTA inserts where package-linked visibility is shown

#### Primary Objective
Apply package visibility / entitlement outcome handling to existing coaching runtime surfaces using server-provided fields where available and safe fallback behavior where not available:
- render explicit gated/blocked/available states
- preserve sponsored-vs-paid boundary language and disclaimers
- avoid inferring policy locally from partial data
- document contract gaps encountered using the triage model (UI-only vs backend-prep within existing family vs net-new family)

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
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`

#### Constraints (Hard)
- Mobile runtime UI only (`/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` and directly related mobile helpers only)
- No backend/API/schema changes
- No Home/Priority redesign work beyond coaching-related gating/CTA states already in scope
- Preserve challenge participation/results ownership boundary
- Do not embed billing/entitlement policy logic in UI; consume outcomes only
- If required fields are missing, implement safe fallback and log contract gap category instead of inventing policy

#### Implementation Pattern (Large Swath)
- Start with surface-by-surface mismatch list (available/gated/blocked/fallback states)
- Add consistent package visibility/entitlement rendering patterns and copy across in-scope coaching surfaces
- Add sponsor attribution / paid gating placeholders only when driven by available fields or explicit fallback
- Produce contract-gap triage notes (UI-only / backend-prep existing family / net-new family)
- Keep to `1` commit if possible (`2` max if a docs-sync follow-up is cleaner)

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Runtime screenshots of in-scope coaching surfaces showing at least:
  - available state
  - fallback unavailable/gated state (if reproducible)
- Confirm no backend/API/schema files changed
- Update `INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md` together if runtime status/wiring notes change

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Screens changed`
- `Package/entitlement UI states added`
- `Sponsored vs paid runtime boundary handling`
- `Contract-gap triage` (UI-only / backend-prep existing family / net-new family)
- `Files touched` (with line refs)
- `Validation performed` (`tsc`, runtime screenshots)
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-PACKAGE-VISIBILITY-GATING-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`


### `COACHING-BACKEND-PREP-PACKAGE-READMODEL-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (backend-prep planning/spec)`
- `Persona:` `Admin operator`, `Coach`, downstream `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching content operations / publishing` (`package read-model + entitlement outputs`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs/backend-prep planning only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven`
- `Dependency note:` Follows accepted `COACHING-PACKAGING-SPONSORED-PAID-A`; may also consume contract-gap triage from `COACHING-UI-PACKAGE-VISIBILITY-GATING-A` if available.
- `Controller seed note (2026-02-26):` Large-swatch backend-prep planning package to define runtime packaging/entitlement read-model outputs inside existing endpoint families where possible and isolate approval-required structural gaps.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Executing docs-first backend-prep planning pass with read-only handler inspection (`backend/src/index.ts`) to map existing endpoint families, define packaging/entitlement read-model outputs by runtime surface, and classify gaps.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. Will treat missing runtime packaging/entitlement fields as planning gaps (`in-family extension` or `decision needed`) and will not propose approved schema/API implementation changes in this pass.
- `Completion note (2026-02-26, Coach-1):` Completed backend-prep planning/spec package. Added endpoint-family coverage map tied to documented contracts + handler inspection (`channels/messages`, `coaching`, `sponsored-challenges`, dashboard/team candidate), planning-level read-model output requirement matrix by runtime surface/use-case, gap classification (`in-family extension` vs `net-new family/schema need`), and explicit `decision needed` list (team module host family, broadcast path semantics, entitlement outcome granularity, sponsored linkage source, cross-family field normalization).
- `Validation note (2026-02-26, Coach-1):` No backend/schema/app code files changed. Coverage map references current documented contracts and read-only handler inspection only. `decision needed` items are explicit and not converted into silent implementation assumptions. Follow-on backend and runtime UI implementation assignment specs appended.
- `Controller review note (2026-02-26):` Accepted. The coverage map and gap classification are specific enough to guide a backend-prep implementation swath without prematurely approving schema/endpoint changes. `decision needed` items are clearly isolated and align with the M6 coaching packaging boundaries.

#### Primary Objective
Define an implementation-ready backend-prep plan for packaging/entitlement runtime read-model outputs:
- identify which existing endpoint families could carry packaging/entitlement outcomes for coaching/challenge/team runtime surfaces
- define read-model output requirements (planning-level) by surface/use-case
- classify gaps as in-family extension vs net-new family/schema need
- produce follow-on implementation assignment specs (backend + UI) without approving schema/API changes in this docs pass

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/backend/src/index.ts` (read-only contract/handler inspection)

#### Constraints (Hard)
- Docs/planning + code inspection only (no backend or schema edits)
- No net-new endpoint families presented as approved
- Preserve challenge participation/results ownership boundary
- Preserve authoring vs entitlement vs runtime delivery separation
- Any structural API/schema proposal must be marked `decision needed` and call out `DECISIONS_LOG.md` requirement for implementation phase

#### Deliverables (Large Swath, Docs-First)
1. Endpoint-family coverage map for required runtime packaging/entitlement outputs (by in-scope surfaces)
2. Read-model output requirement matrix (planning-level)
3. Gap classification (`in-family extension` vs `net-new family/schema need`)
4. `decision needed` list with impact/risk notes
5. Follow-on implementation assignment specs:
   - one backend-prep implementation swath (if justified)
   - one runtime UI follow-up swath (if justified)

#### Validation (Required)
- No backend/schema/app code files changed
- Coverage map references current documented contracts and/or existing handlers only
- `decision needed` items are explicit and not silently converted into implementation assumptions

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Endpoint-family coverage map summary`
- `Read-model output requirements`
- `Gap classification`
- `Open decisions / risks`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-BACKEND-PREP-PACKAGE-READMODEL-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-BACKEND-IMPL-PACKAGE-READMODEL-INFAMILY-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (backend-prep implementation; in-family read-model shaping)`
- `Persona:` `Admin operator`, `Coach`, downstream `Leader/Member/Solo`
- `Flow:` `coaching content operations / publishing` (`package read-model + entitlement outputs`)
- `Owner:` worker (backend)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `N/A` (backend-prep)
- `Dependency note:` Follows accepted `COACHING-BACKEND-PREP-PACKAGE-READMODEL-A` coverage map and gap classification
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Implementing additive packaging/entitlement read-model outputs inside existing endpoint families only (`coaching`, `channels/messages`, `sponsored-challenges`) with no schema or net-new endpoint changes.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. Team coaching module host-family decision remains open, so this pass will avoid cross-family dashboard/team payload reshaping and focus on clearly in-family additive outputs.
- `Completion note (2026-02-26, Coach-1):` Implemented additive `packaging_read_model` outputs in existing endpoint families only: `GET /api/channels`, `GET /api/channels/{id}/messages`, `GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}`, `GET /sponsored-challenges`, and `GET /sponsored-challenges/{id}`. Added shared in-file read-model builders (baseline/partial/inferred status + linked context refs + display requirements), thread-level channel context on messages endpoint, and contract-note updates in `/docs/spec/04_api_contracts.md`.
- `Validation note (2026-02-26, Coach-1):` `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` could not run because backend `package.json` has no `test` script. Fallback validation used `cd /Users/jon/compass-kpi/backend && npm run build` (`tsc`) ✅. Contract diff review documented additive response fields in `/docs/spec/04_api_contracts.md`. Manual endpoint smoke checks not run in this session (no local API/env smoke run performed). No net-new endpoint families or schema changes introduced.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for in-family implementation pass. Remaining items are planning/implementation decisions (`team` host family for package outputs, broadcast path semantics normalization, entitlement outcome granularity/field normalization), not blockers for this delivered slice.
- `Controller review note (2026-02-26):` Accepted and pushed as `2824642` with additive in-family response shaping only (no schema or net-new endpoint families). `DEC-0044` added to `architecture/DECISIONS_LOG.md` for API boundary response-shape changes. Backend generated output + API contracts doc updated in the same change set.

#### Primary Objective
Implement additive packaging/entitlement read-model outputs within existing endpoint families where feasible, without introducing net-new endpoint families or schema changes unless separately approved:
- add runtime-consumable packaging/entitlement output fields to selected existing responses (per controller-approved endpoint list)
- preserve current endpoint semantics and role enforcement
- explicitly stop and report blocker if implementation requires net-new endpoint family or structural schema change

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/backend/src/index.ts`

#### Constraints (Hard)
- Backend code changes allowed only within existing endpoint families (controller-approved scope)
- No net-new endpoint families without explicit approval
- No schema changes without explicit approval
- Preserve challenge participation/results ownership boundary
- Preserve KPI non-negotiables and no KPI logging/forecast mutation via packaging logic
- Any structural boundary change => mark `decision needed` and require `DECISIONS_LOG.md` in implementation change set

#### Validation (Required)
- `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` (or assignment-approved narrower validation if suite is too broad)
- Contract diff review against `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md` (document additive response fields)
- Manual endpoint smoke checks for touched endpoint families (if local env available)
- Confirm no net-new endpoint family/schema changes slipped in

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Endpoint families changed`
- `Additive read-model outputs implemented`
- `Gaps still blocked` (`in-family` vs `decision needed`)
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-BACKEND-IMPL-PACKAGE-READMODEL-INFAMILY-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-UI-PACKAGE-READMODEL-CONSUME-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (runtime UI follow-up; package read-model consumption)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication` (`package visibility + entitlement outputs consumption`)
- `Owner:` worker (mobile UI)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `manual-spec-driven`
- `Dependency note:` Run after backend-prep outputs land for targeted endpoint families, or scope to partially available outputs with explicit controller approval
- `Worker pickup note (2026-02-26, Mobile-1):` Board status/blocker check complete. Executing UI follow-up to consume backend-added package read-model outputs on existing W3/W4 coaching/comms surfaces and reduce fallback-only gating where contracts now provide outcomes.
- `Current blocker status (2026-02-26, Mobile-1):` `none` at start. Will report exact endpoint/field gaps if backend payloads differ from accepted backend-prep implementation notes or remain unavailable on targeted surfaces.
- `Completion note (2026-02-26, Mobile-1):` Consumed backend `packaging_read_model` outputs (additive in-family read-model shape) across existing coaching/comms runtime surfaces by normalizing `packaging_read_model` into UI gate presentation state and preferring it over temporary `package_visibility` fields. Wired consumption for `GET /api/channels`, `GET /api/channels/{id}/messages` (including top-level thread `channel` context metadata), `GET /api/coaching/journeys`, and `GET /api/coaching/journeys/{id}` where payloads are already used by W3/W4 UI. Fallback behavior remains only where endpoint families do not yet expose package outputs on the current mobile path.
- `Current blocker status (2026-02-26, Mobile-1, completion):` `partial contract coverage (non-blocking)` — `/challenges` payloads used by Challenge list/details still do not document/emit `packaging_read_model`, and Team/Home/Profile embedded coaching modules are not backed by package-output endpoint families in current mobile path. UI preserves explicit fallback states on those surfaces.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ passed. Route checks completed via code-path review for touched W3/W4 coaching/comms shells. Runtime screenshots remain pending controller/device validation.
- `Controller review note (2026-02-26):` Accepted and pushed. UI now prefers additive backend `packaging_read_model` outputs on W3/W4 coaching/comms surfaces and normalizes them into the existing gate presentation model without introducing client-side entitlement policy logic. Partial coverage gaps are explicitly preserved as fallback states (`/challenges`, Home/Team/Profile embedded coaching modules) and documented as non-blocking until those endpoint families expose package outputs.

#### Primary Objective
Consume server-provided packaging/entitlement read-model outputs on existing coaching/challenge/comms surfaces and replace temporary fallback heuristics with contract-driven gating:
- apply package visibility/entitlement outcomes on `coaching_journeys*`, challenge overlays, team coaching modules, and `inbox*` as available
- preserve safe fallback behavior where outputs remain unavailable
- avoid embedding package policy/approval logic in the client

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- No backend/API/schema changes in this UI assignment
- Client must not compute entitlement or approval policy logic
- Preserve sponsored challenge ownership boundary and KPI non-negotiables
- If required server outputs are missing, stop and report exact field/endpoint gaps (do not invent fallback policy behavior)

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Runtime screenshot proof for touched surfaces/states (allowed/blocked/fallback where applicable)
- Route checks for all touched coaching/challenge/comms paths
- Docs sync if surface statuses/wiring change (`INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md`)

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Surfaces changed`
- `Read-model outputs consumed`
- `Fallbacks removed vs still required`
- `Contract gaps` (exact endpoint + missing fields if blocked)
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-UI-PACKAGE-READMODEL-CONSUME-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `ADMIN-A3_5-USERS-LIST-PAGING-SORT-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `A3.5 (parallel with M6 backend-prep implementation)`
- `Persona:` `Admin operator`
- `Flow:` `admin users list/search/sort/paging polish`
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree strongly preferred)
- `Figma refs:` `N/A` (admin web usability swath; preserve existing admin patterns)
- `Controller seed note (2026-02-26):` Large admin swath to keep parallel momentum while M6 coaching backend/UI work continues. Scope is admin web only and should avoid mobile/coaching router files.
- `Dependency note:` Follows accepted admin operator passes (`fc85b3b`, `91de8d2`, `6854cd1`). Build on existing table/operator affordances rather than redesigning admin shell.
- `Execution note (2026-02-26):` Worker pickup started on `codex/a2-admin-list-usability-pass`. Executing admin-only `/admin/users` list/search/sort/paging polish in `AdminShellScreen.tsx`; `/admin/reports` limited to regression check only unless a direct consistency issue is found.
- `Completion note (2026-02-26):` Implemented `/admin/users` table workflow polish in `AdminShellScreen.tsx`: clickable user-table header sorting (asc/desc toggles for visible columns), clearer row-window count/footnote copy, `Show more (N left)` paging label, reset-sort action, and row-window reset on filter/sort/test-focus changes. No `/admin/reports` code changes. `cd app && npx tsc --noEmit --pretty false` passed.
- `Blocker note (2026-02-26):` Required manual browser validation remains pending (cannot self-perform click-through in terminal-only session). Need `/admin/users` spot-check for header sort toggles, row-window reset behavior, no-results recovery, and selected-row/list coordination; `/admin/reports` regression check only if controller wants explicit runtime confirmation.
- `Controller review note (2026-02-26):` Accepted and pushed as `5e59ad1` after scoped diff review and fresh app `tsc` check (`npx tsc --noEmit --pretty false`). Runtime browser spot-check remains recommended validation debt, not a push blocker for this admin usability pass.

#### Screens In Scope (Large Swath)
1. `/admin/users` (primary)
2. `/admin/reports` (regression check only; optional small fixes if directly related to list/operator flow consistency)

#### Primary Objective
Deliver a substantial A3.5 admin users list workflow polish pass:
- add/finish predictable client-side sorting on user table columns (asc/desc header toggles)
- improve paging/show-more/list-window behavior clarity and operator control
- tighten filter/search + selected-row/form coordination and recovery UX
- improve row action discoverability and status readability for common operator workflows

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`

#### Constraints (Hard)
- Admin web only (`/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx` and directly related admin helpers only)
- No mobile app screen edits
- No backend/API/schema changes
- No authz boundary changes
- Follow existing admin shell visual patterns (no redesign pass)
- If a needed fix requires API or route changes, stop and document blocker

#### Implementation Pattern (Large Swath)
- Start with a mismatch/issues list for `/admin/users`
- Prioritize sort/search/filter/paging predictability and row action discoverability
- Keep `1` commit preferred (`2` max if a clean split is clearly better)
- If touching `/admin/reports`, keep it to direct consistency/regression fixes only

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check of `/admin/users` (and `/admin/reports` if touched)
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
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment ADMIN-A3_5-USERS-LIST-PAGING-SORT-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W5-AI-READINESS-BOUNDARY-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI coach assist readiness; planning-only)`
- `Persona:` `Coach`, `Admin operator`, downstream `Leader/Member/Solo`
- `Flow:` `coaching / AI assist` (`W5 boundary + implementation-readiness gating`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (no canonical AI coach Figma set locked yet)
- `Dependency note:` Follows accepted coaching persona, packaging, backend-prep, backend in-family read-model implementation, and UI read-model consumption passes (`COACHING-ARCH-*`, `COACHING-PACKAGING-*`, `COACHING-BACKEND-*`, `COACHING-UI-PACKAGE-*`)
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Preparing W5 AI assist boundary package as docs-only planning: allowed/disallowed actions, surface insertion map, approval/audit gates, minimum contract outputs, and next-wave assignment specs (`build now` vs `defer` split required).
- `Current blocker status (2026-02-26, Coach-1):` `none` at start for planning/docs pass. Open dependencies (`DEP-003`, billing/entitlement authority, tenant key strategy, notification taxonomy) will remain explicit `decision needed` items and not be converted into implementation assumptions.
- `Completion note (2026-02-26, Coach-1):` Completed W5 AI coach assist readiness package in coaching planning docs: mapped approved runtime insertion points (`channel_thread`, `coach_broadcast_compose`, `coaching_journeys*`, `coaching_lesson_detail`, Team/Challenge coaching modules, `coach_ops_audit`), defined allowed vs disallowed AI action boundaries (explicitly no KPI/forecast/challenge-state mutations and no auto-send), documented approval/escalation/audit workflow, and specified minimum planning-level AI suggestion contract/read-model outputs (prefer additive shaping in existing `/api/ai/suggestions*` family). Added explicit `build now` vs `defer` split and appended follow-on W5 coding-wave assignment specs for UI shell/proto, backend in-family queue shaping, and moderation/audit ops pass.
- `Validation note (2026-02-26, Coach-1):` Docs-only planning changes. Cross-doc consistency checked across coaching matrix/addendum and intended screenmap/wiring docs for `approval-first`, `no auto-send`, coach/admin portal boundary, and AI surface insertion naming. No app/backend/schema/API implementation files changed in this assignment. Structural boundary changes remain `decision needed` and call out `DECISIONS_LOG.md` requirement for future implementation change sets.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for docs planning pass. Implementation blockers remain explicit `decision needed` items (approval authority matrix by scope, sponsor AI approval depth, AI suggestion contract expansion beyond existing family, audit linkage persistence shape).
- `Controller review note (2026-02-26):` Accepted and pushed. W5 AI readiness boundary is now explicit enough to prevent uncontrolled AI scope drift: approved insert points, approval-first workflow, disallowed mutation actions, minimum contract/read-model outputs, and next-wave assignment specs are all documented without introducing implementation changes.
- `Worker note (2026-02-26, Coach-1 post-acceptance spec-extension start):` Board check complete for follow-on planning request. Preparing a new W5 AI coach-persona realignment assignment spec (docs-only) to re-center coach-facing AI recommendation surfaces in the app, clarify `/api/ai/suggestions*` as the coach recommendation queue contract, and demote `/admin/coaching/audit` to secondary oversight unless explicitly required.
- `Current blocker status (2026-02-26, Coach-1 post-acceptance spec-extension):` `none` at start for assignment-spec drafting. Realignment policy details (coach runtime authority vs admin moderation depth) will remain explicit in the new spec as `decision needed` where unresolved.
- `Completion note (2026-02-26, Coach-1 post-acceptance spec-extension):` Added new implementation-ready assignment spec `COACHING-W5-AI-COACH-PERSONA-REALIGNMENT-A` to the board (row + full block). The spec defines coach-facing AI recommendation surfaces (activity/inactivity-based suggested prompts + next actions in app surfaces), repositions `/api/ai/suggestions*` as the primary coach recommendation queue/read-model contract (with admin moderation as secondary governance), and explicitly demotes `/admin/coaching/audit` to oversight/exception workflow unless policy/runtime evidence requires primary use.
- `Validation note (2026-02-26, Coach-1 post-acceptance spec-extension):` Board-only docs update. Assignment row/block naming, dependency references, and scope boundaries were checked against accepted W5 UI/backend/admin AI slices and the blocked W5 ops-audit runtime-validation assignment note. No app/backend/schema/API files changed in this continuation.
- `Current blocker status (2026-02-26, Coach-1 post-acceptance spec-extension, completion):` `none` for board-spec drafting. Follow-on implementation blockers remain policy/ownership decisions (coach runtime authority under `DEP-003`, moderation escalation thresholds, sponsor/co-branded recommendation approval depth).

#### Primary Objective
Define an implementation-ready W5 AI coach assist boundary package before any AI UI/backend coding:
- specify approved AI assist use-cases vs disallowed actions (especially KPI writes/forecast mutation boundaries)
- map runtime insertion points across existing coaching surfaces (`journeys`, `lessons`, `channel_thread`, `broadcast composer`, challenge/team coaching modules)
- define human-approval/owner-approval checkpoints and escalation path for AI-generated content/actions
- define minimum API/data contracts and audit requirements for a first safe AI assist slice (planning only; no schema/API implementation)
- produce next-wave assignment specs (UI shell/proto, backend approval queue integration, moderation/audit pass)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- Planning/docs only (no app code, no backend code, no schema changes)
- Preserve non-negotiables (especially no AI mutation of KPI source-of-truth or forecast base values)
- Do not assume billing/entitlement authority decisions beyond accepted `decision needed` notes
- Any proposed structural boundary change must be marked `decision needed` and reference `DECISIONS_LOG.md` requirement for future implementation

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- Docs consistency check across coaching matrix/addendum + intended screenmap/wiring references
- Produce explicit `build now` vs `defer` split for W5 AI work

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `AI assist surfaces mapped`
- `Allowed vs disallowed AI actions`
- `Approval and audit gates`
- `Required contract/data outputs (planning)`
- `Decision needed items`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-AI-READINESS-BOUNDARY-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-W5-UI-AI-ASSIST-SHELL-PROTO-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI assist UI shell/proto; approval-first)`
- `Persona:` `Team Leader`, `Coach`, `Admin operator` (review context), downstream `Member/Solo` limited
- `Flow:` `coaching / AI assist` (`runtime insert-point shells + review UX`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated worktree preferred)
- `Figma refs:` `manual-spec-driven` (W5 AI boundary docs; no canonical AI Figma set locked)
- `Dependency note:` Follows accepted `COACHING-W5-AI-READINESS-BOUNDARY-A`; backend integration may remain stub/mock or use existing `/api/ai/suggestions*` if payloads are sufficient
- `Worker pickup note (2026-02-26, Mobile-1):` Board status/blocker check complete. Implementing approval-first AI assist UI shell/proto inside existing mobile coaching surfaces using local shell state + explicit human-review copy, with no autonomous send/publish behavior.
- `Current blocker status (2026-02-26, Mobile-1):` Resolved. W5 CTA insertions briefly introduced malformed JSX in `KPIDashboardScreen.tsx` (missing/extra `}` around `onPress` handlers); repaired and `tsc` is green again.
- `Completion note (2026-02-26, Mobile-1):` Manual-spec-driven W5 AI assist shell proto is implemented across approved insert points using a shared approval-first modal (draft request/review/edit/apply-to-human-input) in existing coaching surfaces. No AI auto-send/publish path, no KPI/forecast/challenge-state mutation path, and no backend/schema changes in this pass.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ pass after JSX blocker repair; route/CTA gating reviewed in touched W5 insert points and existing send buttons remain explicit human actions. Runtime/device screenshots still pending controller validation.
- `Controller review note (2026-02-26):` Accepted and pushed as `6916f88`. W5 AI shell proto remains approval-first and advisory-only across approved mobile insert points, with explicit human send/apply behavior and no backend/schema changes. Fresh app `tsc` re-check is green.
- `Continuation pickup note (2026-02-26, Mobile-1):` Starting approved W5 mobile follow-on to integrate the existing AI assist review shell with backend `/api/ai/suggestions*` endpoints (approval-first queue submit/read feedback only). Preserving no autonomous send/publish and no KPI/forecast/challenge-state mutation boundaries.
- `Current blocker status (2026-02-26, Mobile-1, continuation completion):` `none`. Existing `/api/ai/suggestions*` in-family queue/read-model payloads were sufficient for mobile approval-first queue submit + status feedback integration without route/module boundary changes.
- `Continuation completion note (2026-02-26, Mobile-1):` Integrated W5 mobile AI assist review modal with backend `/api/ai/suggestions*` endpoints: queue submit (`POST /api/ai/suggestions`) now sends approval-first draft requests using host/context-derived scope strings, and modal queue status panel reads recent suggestions + queue summary from `GET /api/ai/suggestions`. Human send/publish flows remain separate and explicit; no AI execution path was added.
- `Continuation validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ pass after API integration. Route/CTA gating reviewed on approved insert points; queueing is disabled without draft text and still does not trigger any message/broadcast/challenge/KPI writes.
- `Controller review note (2026-02-26, continuation):` Accepted and pushed as `eb128e8`. Mobile W5 AI assist shell now integrates with backend `/api/ai/suggestions*` for approval-first queue submit/read feedback while keeping human send/publish actions separate and preserving all disallowed mutation boundaries.
- `Validation-refinement pickup note (2026-02-26, Mobile-1):` Starting W5 mobile validation-refinement pass to run seeded coaching journeys/channels + AI draft queue flow end-to-end, capture video-worthy screenshots, and tighten approval-first UX copy/feedback only (no backend/schema/API boundary changes).
- `Current blocker status (2026-02-26, Mobile-1, validation-refinement completion):` `partial tooling limitation` — Simulator tap automation was reliable enough to capture seeded coaching journeys/channels + AI modal review states, but not reliable enough to reproducibly capture the final in-UI queue-success state after repeated screenshot-focus context switches. Queue success was verified end-to-end via authenticated `/api/ai/suggestions*` create+list calls against the same local backend and seeded runtime account.
- `Validation-refinement completion note (2026-02-26, Mobile-1):` Captured runtime screenshots for seeded coaching journey detail, seeded inbox/channels list, and W5 AI approval-first review modal states in Expo Go on iOS Simulator, then ran authenticated end-to-end queue validation (`POST /api/ai/suggestions` + `GET /api/ai/suggestions`) confirming `pending` suggestion creation and `pending_review` queue read-model status. Applied copy-only refinements in the AI modal queue panel/button/success messaging to reinforce review-only/no-send behavior.
- `Validation-refinement validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ pass after copy refinements. Local backend (`HOST=0.0.0.0 PORT=4000`) + Expo (`localhost:8081`) runtime used for screenshots; no backend/schema/API boundary changes. Screenshot evidence paths and redacted API validation output included in worker report-back.

#### Primary Objective
Implement manual-spec-driven W5 AI draft request/review UI shells and approved insert-point CTAs without introducing autonomous AI actions:
- add AI assist entry CTAs on approved surfaces only (`channel_thread`, `coach_broadcast_compose`, `coaching_lesson_detail`, `coaching_journeys*`, embedded Team/Challenge coaching modules per policy)
- add AI draft request/review shell(s) with explicit approval-first labels/disclaimers and human edit path
- preserve existing send/publish flows as explicit human actions; no direct AI auto-send

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` (if member-shell implementation starts)

#### Constraints (Hard)
- No KPI log writes, forecast base/confidence mutation, or challenge participation/results mutation via AI paths
- No autonomous send/publish path
- No authz boundary widening; server remains permission source of truth
- If implementation requires net-new route/module boundary, mark `decision needed` and require `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md` in implementation change set

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route/CTA gating review on touched surfaces
- Confirm no backend/schema changes
- Sync doc status updates in screenmap + wiring if runtime availability changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `AI assist entry points wired`
- `Review shell behavior`
- `Disallowed actions preserved`
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-UI-AI-ASSIST-SHELL-PROTO-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W5-BACKEND-AI-SUGGESTIONS-INFAMILY-QUEUE-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI backend in-family approval queue shaping)`
- `Persona:` `Coach`, `Admin operator`, downstream `Leader/Member/Solo`
- `Flow:` `coaching / AI assist` (`/api/ai/suggestions*` additive shaping only)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (backend worktree strongly preferred)
- `Figma refs:` `N/A` (backend/contract)
- `Dependency note:` Follows accepted W5 AI boundary docs and is limited to existing AI suggestion endpoint family unless controller explicitly approves broader scope
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Implementing additive approval-first queue/read-model shaping in existing `/api/ai/suggestions*` handlers only, aligned to W5 AI boundary docs and without schema/net-new endpoint-family changes unless a blocker is confirmed.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. Will stop and document `decision needed` if required W5 fields cannot be represented as additive shaping in current AI suggestion payloads/handlers.
- `Completion note (2026-02-26, Coach-1):` Implemented additive in-family W5 AI suggestion queue/read-model shaping in existing `/api/ai/suggestions*` handlers only. Added inferred/partial `ai_queue_read_model` to suggestion payloads for create/list/approve/reject responses and list-level `queue_summary` on `GET /api/ai/suggestions`, derived from current `ai_suggestions` columns (`scope`, status, actor IDs, timestamps) without schema changes. Preserved admin-only approve/reject semantics and no AI execution/KPI/challenge mutations. Updated `/docs/spec/04_api_contracts.md` with additive fields and logged `DEC-0045` for the API boundary response-shape change.
- `Validation note (2026-02-26, Coach-1):` `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` could not run because backend `package.json` has no `test` script. Fallback validation used `cd /Users/jon/compass-kpi/backend && npm run build` (`tsc`) ✅. Contract diff review completed in `/docs/spec/04_api_contracts.md`. No net-new endpoint family or schema changes introduced.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for in-family queue/read-model shaping. Remaining W5 gaps are explicit `decision needed` items (richer source-context refs persistence, reviewer reasons/history detail, execution linkage persistence, and any expansion beyond `/api/ai/suggestions*` family).
- `Controller review note (2026-02-26):` Accepted and pushed as `17478bb`. Additive W5 AI queue/read-model shaping stays within existing `/api/ai/suggestions*` family, preserves approval semantics, and records API response-shape scope via `DEC-0045`. Fresh backend build (`npm run build`) is green.

#### Primary Objective
Implement additive approval-first queue/read-model outputs inside existing `/api/ai/suggestions*` endpoints to support W5 runtime review shells and coach/admin approval queue surfaces:
- add planning-approved suggestion status/approval metadata/context refs as additive response fields
- preserve current authz + approval semantics and role enforcement
- stop and report blocker if net-new endpoint family or structural schema change is required

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/backend/src/index.ts`

#### Constraints (Hard)
- Existing AI suggestion endpoint family only (`/api/ai/suggestions*`) unless explicit approval expands scope
- No schema changes without explicit approval
- No KPI/forecast/challenge-state mutations through AI suggestion handlers
- Any structural API/schema boundary change => `decision needed` + `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md` in implementation change set

#### Validation (Required)
- `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` (or assignment-approved fallback if no script exists)
- `cd /Users/jon/compass-kpi/backend && npm run build`
- Contract diff review in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Confirm no net-new endpoint families/schema changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `AI endpoint outputs changed`
- `Approval queue/read-model fields added`
- `Gaps still blocked` (`in-family` vs `decision needed`)
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-BACKEND-AI-SUGGESTIONS-INFAMILY-QUEUE-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W5-OPS-AI-MODERATION-AUDIT-PASS-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI moderation/audit ops surfaces; approval-first)`
- `Persona:` `Coach`, `Admin operator`, `Sponsor ops` (limited review only)
- `Flow:` `coaching / AI assist` (`approval queue`, `audit`, `policy visibility`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (admin web worktree preferred)
- `Figma refs:` `manual-spec-driven` (coach ops + W5 AI boundary docs)
- `Dependency note:` Follows W5 AI boundary docs and should prefer `Admin Shell` extension / `coach_ops_audit` companion surfaces; backend queue fields may be stubbed if backend slice is not yet landed
- `Execution note (2026-02-26):` Worker pickup started on `codex/a2-admin-list-usability-pass`. Executing admin web `coach_ops_audit` AI approval queue/detail/audit UI pass in `AdminShellScreen.tsx` only, preserving approval-first/no-autonomous-send boundaries and avoiding backend/API/schema changes.
- `Completion note (2026-02-26):` Implemented `Admin Shell` extension route `/admin/coaching/audit` with `coach_ops_audit` W5 AI moderation/audit companion UI in `AdminShellScreen.tsx`: sortable approval queue list, detail panel with disclaimers/safety flags, approve/reject/return-to-pending review workflows, and audit history rendering. Route uses existing admin role guards only; no backend/API/schema changes. Docs sync completed in `INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md` (statuses advanced to `🟡 partial` for `coach_ops_audit` and AI approval/audit portal surfaces).
- `Blocker note (2026-02-26):` Required manual browser spot-check of `/admin/coaching/audit` is still pending (terminal-only session cannot self-execute click-through). `cd app && npx tsc --noEmit --pretty false` is currently blocked by unrelated pre-existing syntax errors in dirty `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`, not by this assignment’s admin/coaching audit files.
- `Controller review note (2026-02-26):` Accepted and pushed as `1a0342f`. Admin W5 AI moderation/audit ops surfaces are implemented in the Admin Shell extension with approval-first queue/detail/history workflows and no backend/schema/authz widening. Fresh app `tsc` re-check is now green; manual browser spot-check for `/admin/coaching/audit` remains recommended validation debt.

#### Primary Objective
Implement coach/admin AI approval queue and audit detail ops surfaces (admin extension / coach ops companion) with explicit review/reject/history workflows:
- add queue list/detail UI for pending/approved/rejected AI suggestions
- display approval requirements, scope summaries, disclaimers/safety flags, and audit history metadata
- no KPI/forecast/challenge mutation actions and no authz boundary widening

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`

#### Constraints (Hard)
- Admin web / coach ops companion surfaces only (no member mobile AI implementation in this assignment)
- No backend/API/schema changes unless explicitly approved as paired work
- No authz boundary changes
- Preserve approval-first and no-autonomous-send rules

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check of admin/coaching audit AI queue/detail views (if environment available)
- Confirm no mobile/backend/schema changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Ops AI queue/audit surfaces changed`
- `Approval/audit behaviors implemented`
- `Disallowed actions preserved`
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-OPS-AI-MODERATION-AUDIT-PASS-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-SAMPLE-CONTENT-SEED-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6 coaching slice (runtime realism / validation data)`
- `Persona:` `Coach`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching content delivery` (`journeys`, `lessons`, `assignments`, sample progress/messages`)
- `Owner:` `Mobile-2` (backend/data execution)
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (backend/data worktree strongly preferred)
- `Figma refs:` `N/A` (data/backend seed swath)
- `Dependency note:` Follows accepted W3/W4 coaching UI work + package visibility/read-model work so runtime surfaces can be reviewed against realistic states
- `Execution note (2026-02-26):` Mobile-2 started backend/data seed pass; board status advanced to `in_progress` before implementation. Targeting repeatable seed routine + endpoint smoke verification only (no schema/endpoint changes).
- `Completion note (2026-02-26):` Added repeatable script `backend/scripts/coaching_sample_content_seed.js` that seeds labeled sample coaching content (team + solo journeys, milestones/lessons, progress states) plus team/sponsor channels and messages, then smoke-verifies `/api/coaching/journeys`, `/api/coaching/journeys/{id}`, `/api/coaching/progress`, `/api/channels`, and `/api/channels/{id}/messages`. Script prints seed IDs/emails and cleanup hints; no schema or endpoint changes.
- `Controller review note (2026-02-26):` Accepted and pushed as `695cab6`. This is the right realism step for W3/W4/W6 UI review: repeatable sample coaching content + message seeding with endpoint smoke verification, no schema changes, and clear cleanup/reseed hints.
- `Execution note (2026-02-26 follow-up):` Large backend/data realism expansion started per controller request to enrich sponsor-scoped/cohort fixtures and add KPI visibility examples in smoke checks for W7 runtime review.
- `Completion note (2026-02-26 follow-up):` Expanded `backend/scripts/coaching_sample_content_seed.js` to seed sponsor-linked challenge fixtures (free + teams tier), sponsor + cohort channels with messages, team-scoped and solo coaching journeys, and active/inactive KPI visibility examples; smoke checks now verify `/api/coaching/*`, `/api/channels*`, `/dashboard`, and `/sponsored-challenges*` with tier gating and sponsor attribution assertions.
- `Execution note (2026-02-26 visibility follow-up):` Additional backend/data swath started to extend sponsor/cohort realism depth and add repeatable role-visibility checks for coach, team-leader, challenge-sponsor, and member outcomes without introducing new endpoint families.
- `Completion note (2026-02-26 visibility follow-up):` Extended `backend/scripts/coaching_sample_content_seed.js` persona coverage to include explicit `coach`, `team_leader`, `challenge_sponsor`, and `member` visibility outcomes. Added role-scoped assertions for coaching journey visibility, channel visibility/membership, sponsored challenge tier gating, dashboard KPI visibility (active/inactive), and coaching broadcast permission outcomes (allowed/blocked) using existing endpoint families only.
- `Execution note (2026-02-26 W8 validation swath):` Started deterministic backend validation expansion focused on seeded persona visibility outcomes and contract mismatch diagnostics for existing coaching/channel/sponsor endpoint families.
- `Completion note (2026-02-26 W8 validation swath):` Enhanced `backend/scripts/coaching_sample_content_seed.js` with structured endpoint snapshots + check logs and failure diagnostics output for contract mismatches; added deterministic visibility assertions for coach/team-leader/challenge-sponsor/member outcomes including cohort channels and sponsor-scoped KPI visibility on `/dashboard`.
- `Execution note (2026-02-27 realism data pack swath):` Board status updated first for large realism data-pack execution. Expanding deterministic/repeatable seed fixtures for multi-journey coach content, mixed lesson statuses, deeper cohort/channel history, and sponsor-scoped challenge/coaching visibility scenarios with explicit run/reset/smoke command sequence docs for owner/dev UI evaluation use.
- `Current blocker status (2026-02-27 realism data pack swath start):` `none` for backend/data/docs scope. This pass is seed/test-data + docs alignment only (no UI layout edits, no net-new endpoint families).
- `Completion note (2026-02-27 realism data pack swath):` Deterministic seed baseline now defaults to `seed-m6-realism-ui-eval` with reset-before-seed behavior and repeatable auth/runtime identities (`ensureAuthUser`). Expanded fixture depth to 4 journeys (including coach-owned multi-journey coverage + sponsor-visible global journey), 10 lessons with mixed statuses, and 13 meaningful channel-thread messages across team/sponsor/cohort channels. Added explicit role-context smoke assertions for coach/team-leader/member/solo/challenge-sponsor visibility and enforcement boundaries using existing endpoint families only.
- `Validation note (2026-02-27 realism data pack swath):` Ran `cd /Users/jon/compass-kpi/backend && npm run build`, `npm run seed:coaching:realism:reset`, `npm run seed:coaching:realism`, and `npm run seed:coaching:realism:smoke` successfully. Output confirms deterministic dataset counts (`journeys=4`, `milestones=5`, `lessons=10`, `lesson_progress_rows=10`, `channels=3`, `channel_messages=13`, `sponsors=1`, `sponsored_challenges=2`, `kpis=2`) and passing endpoint smoke checks for coaching/channels/dashboard/sponsored families.
- `Docs note (2026-02-27 realism data pack swath):` Added runbook `/Users/jon/compass-kpi/docs/spec/appendix/M6_REALISM_DATA_PACK_UI_EVALUATION.md` and indexed it in `/Users/jon/compass-kpi/docs/spec/README.md` so owner/dev teams can discover deterministic seed/reset/smoke commands and expected persona visibility outcomes.

#### Primary Objective
Seed realistic coaching content and assignment/progress data (using existing schema and endpoint families only) so M6 coaching runtime UI reviews are materially useful:
- create sample coaching journeys with milestones/lessons (enough variety for list/detail/progress states)
- create sample lesson progress states for current test user(s): `not_started`, `in_progress`, `completed`
- create sample channels/messages/broadcast history tied to coaching/team/challenge contexts where existing schema supports it
- ensure at least one sponsor-linked or package-attribution-visible path is represented where current seeded data can support it
- preserve existing production/test rows; use clearly identifiable sample names/prefixes for cleanup/reseed repeatability

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/02_data_model.md` (if needed for table references)
- `/Users/jon/compass-kpi/backend/src/index.ts`
- `/Users/jon/compass-kpi/backend/.env` (read only; do not print secrets)

#### Constraints (Hard)
- No schema changes
- No net-new endpoint families
- Prefer SQL seed script(s) or repeatable backend-safe seed routine over ad hoc manual DB edits
- Do not print secrets from `.env`
- Keep seeded rows clearly labeled for later cleanup/reseed (`Sample`, `Seed`, etc.)
- If structural/backend contract changes become necessary, stop and report exact gap (do not widen scope)

#### Validation (Required)
- Verify seeded content appears through existing endpoints (API smoke checks) for touched families:
  - `/api/coaching/journeys`
  - `/api/coaching/journeys/{id}`
  - `/api/coaching/progress`
  - `/api/channels`
  - `/api/channels/{id}/messages`
- Confirm at least one example each of: active journey, in-progress lesson, completed lesson, message thread with messages
- If runtime mobile check is available, capture a few screenshots of W3/W4 surfaces using seeded data (optional but preferred)

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Seeded content summary` (journeys/milestones/lessons/progress/messages/channels)
- `Endpoints verified`
- `Files/scripts touched`
- `Repeatability / cleanup notes`
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-SAMPLE-CONTENT-SEED-A exactly as written. Follow the assignment block, validation requirements, and report-back format.`

### `COACHING-W5-E2E-RUNTIME-VALIDATION-REFINEMENT-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI assist end-to-end runtime validation/refinement)`
- `Persona:` `Team Leader`, `Coach`, downstream `Member/Solo` spot-check
- `Flow:` `coaching / AI assist` (`mobile seeded-data runtime validation + approval-first UX refinement`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred)
- `Figma refs:` `manual-spec-driven` (W5 boundary docs + existing coaching shells/content; no canonical AI Figma set)
- `Dependency note:` Requires accepted W5 UI/backend/admin passes and seeded coaching content/messages (`695cab6`, `6916f88`, `eb128e8`, `17478bb`, `1a0342f`)
- `Worker pickup note (2026-02-26, Mobile-1):` Executing W5 E2E runtime validation/refinement against seeded mobile coaching surfaces + live `/api/ai/suggestions*` queue flow, with screenshot evidence capture and approval-first copy/feedback refinement only.
- `Current blocker status (2026-02-26, Mobile-1, completion):` `partial tooling limitation` — iOS Simulator tap automation was sufficient for seeded coaching + AI review-state screenshots but not reliable enough to reproducibly capture the final in-UI queue-success state after repeated screenshot-focus context switches. Queue-success state was validated end-to-end via authenticated `/api/ai/suggestions*` create/list checks against the same local backend and seeded runtime account.
- `Completion note (2026-02-26, Mobile-1):` Completed high-value W5 runtime validation across seeded Team/coaching entry visibility, seeded Coaching Journey Detail, seeded Inbox/Channels shell, and AI approval-first review modal states. Verified live queue create/list behavior (`pending` + `pending_review`) via `/api/ai/suggestions*` and applied copy-only refinements to queue panel/button/success/empty/fallback messaging for clearer review-only semantics.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` ✅ after refinements. Runtime walkthrough used Expo Go on iOS Simulator + local backend (`HOST=0.0.0.0 PORT=4000`) + seeded auth data. Screenshot evidence + redacted API queue output captured. No backend/schema/API changes.
- `Controller review note (2026-02-26):` Accepted and pushed as `cb3c92a`. W5 E2E runtime evidence (seeded mobile screenshots + live queue API proof) is sufficient, and copy refinements improve approval-first clarity without changing execution boundaries.

#### Primary Objective
Run a high-value end-to-end runtime validation/refinement pass for W5 AI assist using seeded coaching data and live `/api/ai/suggestions*` queue flows:
- validate key approval-first states across mobile coaching surfaces (draft review, queue submit, queue status feedback, recent queue items)
- capture screenshot evidence of seeded journeys/channels + AI review states
- tighten UX copy/feedback only where it improves approval-first clarity and reduces ambiguity
- preserve all disallowed actions (no autonomous send/publish, no KPI/forecast/challenge mutations)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`

#### Constraints (Hard)
- Mobile coaching surfaces only
- No backend/API/schema changes
- Approval-first only; no autonomous send/publish behavior
- No KPI/forecast/challenge-state mutation paths
- If docs status/wiring changes, sync `INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md`

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Runtime walkthrough with seeded data + `/api/ai/suggestions*` queue create/list checks
- Screenshot evidence for key W5 states on mobile
- Confirm disallowed actions remain impossible

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave` (`M6 coaching slice / W5`)
- `Persona(s) affected`
- `Screens validated/refined`
- `Approval-first states validated`
- `UX refinements made`
- `Disallowed actions preserved`
- `Files touched` (with line refs)
- `Validation performed` (including screenshots/API checks)
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-E2E-RUNTIME-VALIDATION-REFINEMENT-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W5-OPS-AI-AUDIT-RUNTIME-VALIDATION-REFINEMENT-A`

#### Snapshot
- `Status:` `blocked`
- `Program status:` `M6 coaching slice (W5 AI moderation/audit runtime validation/refinement)`
- `Persona:` `Admin operator`, `Coach` (reviewer), `Sponsor ops` limited
- `Flow:` `coaching / AI assist` (`admin moderation/audit runtime validation + refinement`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated admin worktree preferred)
- `Figma refs:` `manual-spec-driven`
- `Dependency note:` Follows accepted `/admin/coaching/audit` ops surfaces (`1a0342f`) and W5 mobile/backend queue integration; seeded content + queue actions should now produce more realistic review states
- `Execution note (2026-02-26):` Worker pickup attempted on `codex/a2-admin-list-usability-pass`. Assignment requires real manual browser validation of `/admin/coaching/audit` queue/detail/history views before any refinement decisions.
- `Blocker note (2026-02-26):` Cannot self-perform required manual browser spot-check in this terminal-only session. Need controller/operator runtime validation results (observed states, clarity issues, or confirmation of no regressions) before refining copy/sorting/filter defaults and before claiming completion.
- `Owner direction note (2026-02-26):` Pause this refinement pass. Admin audit is not the primary W5 coach AI workflow and the assignment is deferred pending coach-persona workflow realignment. Do not continue dialog-copy or moderation-copy refinements under this assignment until re-scoped.

#### Primary Objective
Validate and refine the W5 admin AI moderation/audit experience using real queue items where possible:
- run manual browser spot-check on `/admin/coaching/audit` queue/detail/history views
- verify approval-first review actions/labels/disclaimers are clear
- tighten UI copy/sorting/filter/defaults only where it improves moderation/audit usability
- preserve authz boundaries and no backend/schema/API changes

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`

#### Constraints (Hard)
- Admin web only (`/admin/coaching/audit`)
- No backend/API/schema changes
- No authz boundary widening
- Approval-first / no-autonomous-send rules remain explicit

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check of `/admin/coaching/audit`
- If queue data is sparse, document exact observed states and gaps
- Sync docs only if runtime status/wiring meaningfully changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave` (`M6 coaching slice / W5`)
- `Persona(s) affected`
- `Admin AI audit states validated`
- `Refinements made`
- `Disallowed actions preserved`
- `Files touched` (with line refs)
- `Validation performed` (manual browser + tsc)
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-OPS-AI-AUDIT-RUNTIME-VALIDATION-REFINEMENT-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W5-AI-COACH-PERSONA-REALIGNMENT-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 coaching slice (W5 AI coach-persona realignment; planning/spec)`
- `Persona:` `Coach`, downstream `Team Leader`, `Team Member`, `Solo User`; `Admin operator` oversight
- `Flow:` `coaching / AI assist` (`coach recommendations + queue role realignment`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (W5 AI docs + accepted runtime/admin implementations)
- `Dependency note:` Follows accepted `COACHING-W5-AI-READINESS-BOUNDARY-A`, `COACHING-W5-UI-AI-ASSIST-SHELL-PROTO-A`, `COACHING-W5-BACKEND-AI-SUGGESTIONS-INFAMILY-QUEUE-A`, and `COACHING-W5-OPS-AI-MODERATION-AUDIT-PASS-A`; also respects blocked/deferred `COACHING-W5-OPS-AI-AUDIT-RUNTIME-VALIDATION-REFINEMENT-A` direction that admin audit is not the primary coach AI workflow.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Preparing docs-only W5 coach-persona AI realignment spec based on owner direction: AI should be coach-responsibility-aware across individuals/challenges/teams, surface coach-facing recommendations/next-best-actions in app surfaces, treat `/api/ai/suggestions*` as the recommendation queue contract, and demote `/admin/coaching/audit` to secondary oversight unless explicitly required.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start for assignment-spec drafting. Policy details (coach vs admin escalation thresholds and sponsor/co-branded approvals) remain explicit `decision needed` items.
- `Completion note (2026-02-26, Coach-1):` Completed W5 AI coach-persona realignment assignment spec. The spec now explicitly centers coach-facing AI recommendations in app surfaces (individual, challenge-linked, and team responsibility contexts), defines activity/inactivity-driven suggested prompts + next-best-actions as the primary AI UX, reframes `/api/ai/suggestions*` as the runtime/coach recommendation queue and read-model contract, and demotes `/admin/coaching/audit` to oversight/secondary governance/exception workflow unless policy requires escalation. Deliverables, validation, report-back format, and follow-on implementation assignment expectations were updated to reflect this owner direction.
- `Validation note (2026-02-26, Coach-1):` Board-only docs update. Spec wording, dependencies, and scope were cross-checked against accepted W5 UI/backend/admin AI slices and the blocked ops-audit runtime-validation assignment note. No app/backend/schema/API files changed in this assignment-spec completion.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for board-spec completion. Follow-on implementation blockers remain policy/ownership decisions (`DEP-003` coach runtime authority, moderation escalation thresholds, sponsor/co-branded recommendation approval depth, recommendation signal source granularity).
- `Worker note (2026-02-26, Coach-1 continuation):` Reopened for owner-direction tightening. Continuing the spec so coach-facing AI recommendations are explicitly framed by coach responsibility across individuals/challenges/teams, with app-first next-best-actions as the primary UX and `/admin/coaching/audit` documented as secondary oversight.
- `Current blocker status (2026-02-26, Coach-1, continuation):` `none` at continuation start for board-spec refinement. Remaining unresolved policy thresholds will stay as explicit `decision needed` items in the spec.
- `Controller review note (2026-02-26):` Accepted and pushed. This realignment correctly resets W5 AI toward coach-facing recommendations/next-best-actions by responsibility scope (individual/challenge/team), reframes `/api/ai/suggestions*` as the coach runtime queue/read-model contract, and demotes `/admin/coaching/audit` to oversight/exception workflow consistent with owner direction.

#### Primary Objective
Prepare an implementation-ready W5 AI coach-persona realignment plan/spec that recenters AI usage on coach-facing recommendation surfaces in the app, while clarifying backend/admin roles:
- define coach-facing AI recommendation surfaces in the app where AI is aware of the coach's responsibility for:
  - individuals
  - challenge-linked groups/cohorts
  - teams
- define suggested prompts and next-best-actions informed by activity/inactivity and current coaching context (individual + group responsibilities)
- clarify `/api/ai/suggestions*` as the primary coach recommendation queue/read-model contract for runtime and coach workflows (not only an admin moderation artifact)
- demote `/admin/coaching/audit` to oversight/secondary governance and exception handling unless a policy/approval path explicitly requires primary moderation use
- identify follow-on implementation assignments (UI realignment, backend contract refinements if needed, optional admin oversight refinements)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- Planning/docs only (no app/backend/schema/API code changes)
- Preserve W5 approval-first AI boundaries and disallowed mutations (no KPI/forecast/challenge state mutation; no autonomous send/publish)
- Do not widen authz assumptions for Coach/Admin/Leader without explicit `decision needed` notes
- Any structural route/API boundary expansion must be marked `decision needed` and note `DECISIONS_LOG.md` requirement for future implementation change sets

#### Deliverables (Required)
1. Coach-facing AI recommendation surface map (in-app) by coach responsibility scope:
   - individual guidance surfaces
   - challenge/group guidance surfaces
   - team guidance surfaces
2. Activity/inactivity recommendation pattern matrix (signals -> suggested prompts -> next-best-actions) for individuals and groups
3. `/api/ai/suggestions*` role clarification (coach recommendation queue/read-model contract first; admin moderation/oversight second)
4. `/admin/coaching/audit` role realignment note (secondary oversight/governance, escalation path, when it becomes primary)
5. Implementation split (`build now` vs `defer`) for the realignment
6. Next-wave assignment specs (at least one UI realignment swath; optional backend/admin follow-ons if justified)

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- Cross-doc consistency check against accepted W5 AI boundary + W5 UI/backend/admin implementation status
- Explicit `build now` vs `defer` split in the realignment spec
- Explicit coach-responsibility framing (individual/challenge/team) and admin-audit demotion wording present in the spec

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Coach-facing AI recommendation surfaces`
- `Activity/inactivity recommendation patterns`
- `Role of /api/ai/suggestions*` (realigned)
- `/admin/coaching/audit` role after realignment (secondary oversight / exception path)
- `Build now vs defer`
- `Next assignments created`
- `Decision needed items`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W5-AI-COACH-PERSONA-REALIGNMENT-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W6-NOTIFICATIONS-READINESS-BOUNDARY-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 broader scope (notifications + coaching integration readiness; planning-only)`
- `Persona:` `Coach`, `Admin operator`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `notifications / coaching` (`readiness boundary + insertion map + assignment specs`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (notifications/coaching planning)
- `Dependency note:` Follows accepted coaching persona, packaging, W5 AI boundary, and W5 AI/mobile/backend/admin baseline so notifications can be mapped to real surfaces and approval/audit gates
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Preparing docs-only W6 notifications/coaching readiness package: notification class taxonomy, delivery channel/gating rules, insertion-point map across member/admin coaching surfaces, minimum contract/read-model outputs, and next-wave assignment specs with explicit `build now` vs `defer`.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start for planning/docs pass. Existing open policy dependencies (notification taxonomy depth, `DEP-003`, tenancy key strategy, sponsor approval depth, retention/compliance) will remain explicit `decision needed` items and not be converted into implementation assumptions.
- `Completion note (2026-02-26, Coach-1):` Completed W6 notifications/coaching readiness planning package. Added coaching-integrated notification class taxonomy (assignment/reminder/progress/message/broadcast/AI queue+outcome/package access/sponsor campaign update), delivery channel policy (`in-app`/badge/banner/push placeholder vs deferred email/SMS), insertion-point maps across member runtime and `coach_ops_audit`, minimum notification contract/read-model output requirements (summary/items/preferences/ops queue visibility), and W6-specific gating rules (visibility/entitlement, AI approval inheritance, prefs, role/ops). Added explicit `build now` vs `defer` split and appended follow-on W6 implementation assignment specs for member UI surfaces, backend in-family read-model shaping, and prefs/ops visibility surfaces.
- `Validation note (2026-02-26, Coach-1):` Docs-only planning changes. Cross-doc consistency checked across coaching matrix/addendum and intended screenmap/wiring docs for W6 notification classes, delivery channels/gates, and insertion-point naming. No app/backend/schema/API implementation files changed in this assignment. Structural expansions remain `decision needed` and reference `DECISIONS_LOG.md` for future implementation change sets.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for docs planning pass. Implementation blockers remain explicit `decision needed` items (notification class taxonomy ownership, host family for member notification summaries, preference persistence host, sponsor/package disclaimer source, retention/compliance policy under `DEP-004`).
- `Worker note (2026-02-26, duplicate launch request):` Assignment already completed and currently `review` with docs-only deliverable recorded. No additional changes made in this pickup; awaiting controller review/acceptance or a scoped follow-up request.
- `Controller review note (2026-02-26):` Accepted and pushed. W6 notifications readiness boundary is implementation-ready enough to launch parallel UI/backend/admin notification swaths without inventing taxonomy or delivery semantics ad hoc.

#### Primary Objective
Define an implementation-ready W6 notifications/coaching boundary package before coding notification delivery:
- map notification classes (assignment, progress, message, AI review queue, approval outcomes, sponsor/package access, reminders)
- define allowed channels (in-app inbox/banner/badge/push/email placeholders) and approval/audit gates where applicable
- map insertion points across existing coaching/mobile/admin surfaces
- define minimum contract/read-model outputs and next assignment swaths (`build now` vs `defer`)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- Planning/docs only (no app/backend/schema/API code changes)
- Preserve W5 approval-first AI boundaries
- Any structural route/API boundary expansion must be marked `decision needed` and note `DECISIONS_LOG.md` requirement for future change sets

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- Cross-doc consistency check (screenmap/wiring/coaching docs)
- Explicit `build now` vs `defer` split for W6 notifications work

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave` (`M6 broader scope / post-W5`)
- `Persona(s) affected`
- `Notification classes mapped`
- `Delivery channels + gates`
- `Insertion points`
- `Required contract/read-model outputs (planning)`
- `Decision needed items`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W6-NOTIFICATIONS-READINESS-BOUNDARY-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W6-UI-NOTIFICATION-SURFACES-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 broader scope (W6 notifications/coaching UI insertion pass)`
- `Persona:` `Team Leader`, `Team Member`, `Solo User`, `Coach/Admin operator` (ops visibility hooks only)
- `Flow:` `notifications / coaching` (`member banners/badges/inbox rows`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred)
- `Figma refs:` `manual-spec-driven` (W6 notifications boundary docs)
- `Dependency note:` Follows accepted `COACHING-W6-NOTIFICATIONS-READINESS-BOUNDARY-A` and should consume existing W3/W4/W5 coaching/comms/AI runtime surfaces without widening scope
- `Worker pickup note (2026-02-26, Mobile-1):` Controller/owner approved W6/W7 coach/sponsor/cohort rescope direction; treating assignment as unblocked. Implementing W6 in-app coaching notification surfaces on accepted app-surface + coach-runtime/cohort-channel model using existing coaching/comms/AI runtime surfaces only.
- `Current blocker status (2026-02-26, Mobile-1, start):` `none` after owner rescope approval. Will document any remaining UI-only contract gaps as placeholder/fallback notification states rather than widening backend/API scope.
- `Worker completion note (2026-02-26, Mobile-1):` Implemented W6 member-runtime in-app coaching notification surfaces on approved hosts (`Home`, `Team`, `Challenge`, `coaching_journeys*`, `coaching_lesson_detail`, `inbox*`, `channel_thread`) using additive in-family notification read-model consumption (`channels/messages/coaching`) plus explicit UI fallback synthesis for assignment/reminder/message/access-change/AI queue visibility classes. Notification taps are route-only (no notification-display writes).
- `Current blocker status (2026-02-26, Mobile-1, finish):` `none` for W6 UI pass. Remaining gaps are contract-shaping quality/refinement only (e.g., richer route targets, double-counting reconciliation, push delivery state wiring) and are handled as fallback UI rather than blockers.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed. Route/visibility review completed for touched notification insertion points. Confirmed no backend/schema files changed. Synced `INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md` W6 runtime status rows to `🟡 partial`.

#### Primary Objective
Implement manual-spec-driven W6 coaching notification UI insertion points on approved member surfaces:
- add notification banners/badges/list rows for in-scope coaching classes across `Home`, `Team`, `Challenge`, `coaching_journeys*`, `coaching_lesson_detail`, `inbox*`, and `channel_thread`
- preserve route-target behavior only (no side-effect writes from notification display actions)
- keep AI notification classes aligned with W5 approval-first boundaries (outcome/queue status visibility only)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`

#### Constraints (Hard)
- No backend/API/schema changes
- No KPI/forecast/challenge participation/results mutation from notification UI interactions
- No authz boundary widening
- If a needed runtime destination/module boundary changes structurally, mark `decision needed` and require `DECISIONS_LOG.md` in that implementation change set

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route/visibility review for touched notification insertion points
- Confirm no backend/schema changes
- Sync `INTENDED_PERSONA_FLOW_SCREENMAP.md` + `INTENDED_WIRING_DIAGRAM.md` if runtime status/wiring changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave`
- `Persona(s) affected`
- `Notification surfaces changed`
- `Notification classes represented`
- `Delivery channels represented` (`in-app/badge/banner`; push if any placeholder)
- `Disallowed actions preserved`
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W6-UI-NOTIFICATION-SURFACES-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W6-BACKEND-NOTIFICATION-READMODEL-INFAMILY-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 broader scope (W6 notifications/coaching backend in-family read-model shaping)`
- `Persona:` `Coach`, `Admin operator`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `notifications / coaching` (`in-family summary/items shaping`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (backend worktree strongly preferred)
- `Figma refs:` `N/A` (backend/contract)
- `Dependency note:` Follows accepted W6 notifications boundary docs and is limited to existing `channels/messages`, `coaching`, and `notifications` endpoint families unless controller explicitly approves broader scope
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Implementing additive W6 notification summary/item read-model shaping within existing `channels/messages`, `coaching`, and `notifications` endpoint families only, with no schema or net-new family changes unless a blocker is confirmed.
- `Current blocker status (2026-02-26, Coach-1):` `none` at start. This pass will prioritize additive read-model outputs from current channel unread/message/coaching progress/notification queue payloads and document any entitlement/preferences persistence gaps as `in-family` or `decision needed`.
- `Completion note (2026-02-26, Coach-1):` Implemented additive W6 notification read-model shaping within existing endpoint families only. Added shared notification summary/item/ops queue read-model builders in `backend/src/index.ts` and wired additive outputs to `GET /api/channels`, `GET /api/channels/{id}/messages`, `GET /api/messages/unread-count`, `GET /api/coaching/journeys`, `GET /api/coaching/progress`, `POST /api/notifications/enqueue`, `GET /api/notifications/queue`, and `POST /api/notifications/{id}/dispatch`. Outputs include `notification_items`, `notification_summary_read_model`, queue-level `queue_summary`, and per-row `notification_queue_read_model` (inferred/partial from existing unread/progress/notification_queue data only). Updated `/docs/spec/04_api_contracts.md` and logged `DEC-0046` for the additive API response-shape change.
- `Validation note (2026-02-26, Coach-1):` `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` could not run because backend `package.json` has no `test` script. Required fallback validation used `cd /Users/jon/compass-kpi/backend && npm run build` (`tsc`) ✅. Contract diff review completed in `/docs/spec/04_api_contracts.md`. Confirmed no net-new endpoint families or schema changes in this slice. Manual endpoint smoke checks not run in this session.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for in-family implementation pass. Remaining gaps are explicit `in-family`/`decision needed` follow-ups (canonical notification event persistence for member inbox semantics, preference persistence host, richer context refs/taxonomy normalization, and provider dispatch receipts).
- `Worker note (2026-02-26, Coach-1 continuation/closeout):` Continuing this assignment for final validation + contract/decision-log confirmation + commit packaging. Backend/additive read-model implementation and contract notes are already present in local changes; this pass is closeout only unless validation reveals regressions.
- `Current blocker status (2026-02-26, Coach-1, continuation/closeout):` `none` at closeout start. Expecting commit-ready in-family additive changes only; any new boundary expansion found during validation will be reported instead of implemented.

#### Primary Objective
Implement additive notification summary/item read-model shaping inside existing endpoint families to support W6 UI surfaces and ops visibility:
- add additive notification summary/item outputs where feasible in existing `channels/messages`, `coaching`, and/or `notifications` family responses
- preserve current endpoint semantics, authz, and queue/dispatch ownership
- stop and report blocker if net-new endpoint family or structural schema changes are required

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/backend/src/index.ts`

#### Constraints (Hard)
- Existing endpoint families only (`channels/messages`, `coaching`, `notifications`) unless explicit approval expands scope
- No schema changes without explicit approval
- Preserve W5 AI approval-first boundaries in any AI-related notification outputs
- Any structural API/schema boundary change => `decision needed` + `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md` in implementation change set

#### Validation (Required)
- `cd /Users/jon/compass-kpi/backend && npm test -- --runInBand` (or assignment-approved fallback if no script exists)
- `cd /Users/jon/compass-kpi/backend && npm run build`
- Contract diff review in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Confirm no net-new endpoint families/schema changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave`
- `Persona(s) affected`
- `Endpoint families changed`
- `Notification read-model outputs added`
- `Gaps still blocked` (`in-family` vs `decision needed`)
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W6-BACKEND-NOTIFICATION-READMODEL-INFAMILY-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W6-PREFS-OPS-NOTIFICATION-VISIBILITY-A`

#### Snapshot
- `Status:` `queued`
- `Program status:` `M6 broader scope (W6 notification prefs + ops visibility surfaces)`
- `Persona:` `Admin operator`, `Coach`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `notifications / coaching` (`prefs UI + ops queue visibility`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (admin web worktree preferred)
- `Figma refs:` `manual-spec-driven` (W6 notifications boundary docs)
- `Dependency note:` Follows accepted W6 notifications boundary docs; may consume backend in-family notification read-model outputs if available but should remain stub-safe if not
- `Execution note (2026-02-26):` Worker pickup started on `codex/a2-admin-list-usability-pass`. Executing admin web `coach_ops_audit` notification visibility companion UI + stub-safe notification preference shells first in `AdminShellScreen.tsx`; member profile/settings prefs wiring in `KPIDashboardScreen.tsx` remains optional and will be skipped unless clearly safe/in-scope.
- `Completion note (2026-02-26):` Implemented W6 admin-web-first notification prefs/ops visibility pass in `AdminShellScreen.tsx` under `/admin/coaching/audit`: stub-safe persona preview + coaching notification preference shells (channels/classes), and notification visibility companion summaries/ops rows for coaching/AI-relevant queue/dispatch-outcome visibility. No backend/API/schema changes, no dispatch execution controls, no authz boundary widening. Member profile/settings prefs wiring was intentionally deferred in this swath.
- `Blocker note (2026-02-26):` Manual browser spot-check of `/admin/coaching/audit` notification visibility companion + prefs shell remains pending (terminal-only session cannot self-execute runtime click-through). `cd app && npx tsc --noEmit --pretty false` passed.
- `Owner direction note (2026-02-26):` Pause/defer this assignment. Coaching notifications should live primarily in app surfaces and a separate coach web portal, not in `/admin/coaching/audit`. Do not add more UI to `/admin/coaching/audit` under this assignment; future follow-up should be re-scoped to coach/app notification surfaces.
- `Blocker note (2026-02-26, owner feedback follow-up):` Current `/admin/coaching/audit` page purpose is unclear after W5 coach-persona realignment + W6 notification companion additions (AI review/audit vs notification ops visibility vs coach-facing operational guidance boundaries are blurred). Do not expand this surface further until a docs-only surface-boundary clarification spec is prepared and accepted.
- `Follow-up planning note (2026-02-26, Coach-1):` Preparing docs-only assignment spec `COACHING-OPS-SURFACE-BOUNDARY-CLARITY-SPEC-A` to define operational purpose split for `/admin/coaching/audit`, possible separate notification ops view, and coach-facing in-app AI/notification surfaces.

#### Primary Objective
Implement coaching notification preferences UI shell(s) and admin/ops notification queue visibility companion surfaces within current UI boundaries:
- add profile/settings coaching notification preference controls (UI shell first, backend persistence optional only if already supported)
- add `coach_ops_audit` companion visibility for coaching/AI-relevant notification queue summaries/dispatch outcomes/policy alerts
- preserve approval-first AI and no dispatch-authority-widening boundaries

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` (if profile/settings member-shell work is included in this swath)

#### Constraints (Hard)
- No authz boundary changes
- No backend/API/schema changes unless explicitly approved as paired work
- No notification dispatch execution controls beyond current authority
- Preserve W5 AI approval-first boundaries for AI notification classes

#### Validation (Required)
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual browser spot-check for admin ops visibility surfaces (if environment available)
- Confirm no backend/schema changes (unless explicitly approved)

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Sprint/wave`
- `Persona(s) affected`
- `Prefs/ops surfaces changed`
- `Notification classes/channels represented`
- `Approval/dispatch boundaries preserved`
- `Files touched` (with line refs)
- `Validation performed`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W6-PREFS-OPS-NOTIFICATION-VISIBILITY-A exactly as written. Follow the assignment block, validation requirements, and report-back format. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-OPS-SURFACE-BOUNDARY-CLARITY-SPEC-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `M6 broader scope (docs-only follow-up: admin coaching ops surface purpose + boundary split)`
- `Persona:` `Admin operator`, `Coach`, downstream `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / notifications / admin ops` (`surface purpose + boundary clarification`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (boundary clarification; no new visual parity requirement)
- `Dependency note:` Follows accepted W5 coach-persona AI realignment, W5 AI ops audit admin pass, W6 notifications readiness, W6 backend notification read-model shaping, and blocked W6 prefs/ops visibility follow-up note that `/admin/coaching/audit` page purpose is currently unclear.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Preparing docs-only follow-up assignment spec to clarify operational purpose and boundaries across admin coaching ops surfaces, using owner feedback that current page purpose is unclear.
- `Current blocker status (2026-02-26, Coach-1):` `none` at spec-drafting start. Scope is board-only assignment-spec preparation; no app/backend/docs implementation changes in this pass.
- `Completion note (2026-02-26, Coach-1):` Added docs-only follow-up assignment spec that explicitly defines the planning objective to separate responsibilities among `/admin/coaching/audit` (AI review/audit + policy oversight/exception handling), a distinct notification ops visibility surface (queue/dispatch/retry/policy observability if needed), and coach-facing in-app surfaces (recommendations/next-best-actions, coach work queue, member-facing coaching guidance). Includes required boundary matrix deliverables, route ownership rules, escalation-only criteria for admin audit, and follow-on implementation swath expectations.
- `Validation note (2026-02-26, Coach-1):` Board-only docs update. Spec scope/dependencies cross-checked against accepted W5 AI coach-persona realignment and W6 notifications assignments plus blocked W6 prefs/ops visibility assignment notes. No app/backend/schema/API/spec docs changed in this pass.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for assignment-spec creation. Implementation remains blocked on page-purpose clarification acceptance and any downstream host-surface split decisions.
- `Worker note (2026-02-26, Coach-1 owner-direction continuation):` Reopened for W6/W7 rescoping package preparation. Applying new owner direction that `/admin/coaching/audit` is likely unnecessary as a primary workflow and should be treated as optional super-admin AI troubleshooting only, with coaching notifications moving to app surfaces + a dedicated coach web portal.
- `Current blocker status (2026-02-26, Coach-1, owner-direction continuation):` `none` for board-spec continuation. Rescoping decisions will be recorded as assignment sequencing + portal surface planning only (no implementation changes in this pass).
- `Completion note (2026-02-26, Coach-1 owner-direction continuation):` Added follow-on docs-only rescoping assignment `COACHING-W6-W7-COACH-PORTAL-NOTIFICATION-RESCOPE-A` to formalize the portal-first coach ops shift for notifications/content operations, define coach web portal surface set (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`), and update W6/W7 sequencing away from `/admin/coaching/audit` as a primary ops destination.
- `Validation note (2026-02-26, Coach-1 owner-direction continuation):` Board-only update. New rescoping assignment aligns with accepted W5 coach-persona realignment and W6 notifications boundary while tightening `/admin/coaching/audit` to optional super-admin troubleshooting. No app/backend/schema/API/spec docs changed in this continuation pass.

#### Primary Objective
Prepare an implementation-guiding docs-only follow-up spec that resolves owner feedback that the current admin coaching ops page purpose is unclear by clearly separating operational purpose and boundary ownership across:
- `/admin/coaching/audit` (secondary oversight / governance / exceptions)
- a separate notification ops visibility surface (if warranted by scope and operator needs)
- coach-facing in-app surfaces (primary coach workflows for recommendations, next-best-actions, and coaching guidance)

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- Planning/docs only (no app/backend/schema/API code changes)
- Preserve accepted W5 AI coach-persona realignment: coach-facing in-app AI recommendations remain primary; `/admin/coaching/audit` remains secondary oversight/exception path unless policy requires otherwise
- Preserve W6 notification queue/dispatch ownership boundaries and no authz widening
- Any proposed route/module/API family split must be marked `decision needed` and note `DECISIONS_LOG.md` requirement for future implementation change sets

#### Deliverables (Required)
1. Admin coaching ops surface purpose matrix:
   - `/admin/coaching/audit`
   - separate notification ops view (candidate; define when needed vs not needed)
   - coach-facing in-app surfaces
2. Boundary rules by responsibility:
   - AI recommendation queue/review
   - AI audit/history/policy visibility
   - notification queue/dispatch/retry visibility
   - coach recommendation consumption/next-best-actions
   - notification preferences UX
3. “What does not belong here” list for each surface (anti-scope to prevent page-purpose drift)
4. Escalation criteria:
   - when `/admin/coaching/audit` becomes primary for a workflow
   - when notification ops requires a separate admin surface vs companion panel
5. Naming/route guidance (planning only) for a distinct notification ops view if warranted
6. Follow-on assignment specs (docs/UI/backend/admin) for any approved split/reallocation work

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- Spec explicitly references owner feedback: current page purpose is unclear
- Spec preserves W5 coach-persona realignment (admin audit secondary) and W6 notifications ownership boundaries
- Boundary matrix includes positive ownership + anti-scope (“does not belong”) statements for all three surface categories

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Owner feedback addressed` (page-purpose ambiguity summary)
- `Surface-boundary split` (`/admin/coaching/audit` vs notification ops view vs coach-facing in-app surfaces)
- `Anti-scope / does-not-belong rules`
- `Escalation criteria`
- `Next assignments created`
- `Decision needed items`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and prepare a docs-only follow-up spec that clarifies the operational purpose and boundaries of admin coaching ops surfaces: what belongs in /admin/coaching/audit vs a separate notification ops view vs coach-facing in-app surfaces. Use owner feedback that the current page purpose is unclear. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W6-W7-COACH-PORTAL-NOTIFICATION-RESCOPE-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6/W7 coaching+notifications rescoping (docs-only sequencing/package split)`
- `Persona:` `Coach`, `Admin operator` (super-admin troubleshooting only), downstream `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / notifications / portal` (`W6/W7 rescope + sequencing`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (rescope/sequencing package; no new parity requirement)
- `Dependency note:` Follows accepted W5 coach-persona realignment, W6 notifications readiness, W6 backend notification read-model shaping, blocked W6 prefs/ops assignment, and `COACHING-OPS-SURFACE-BOUNDARY-CLARITY-SPEC-A` owner-direction continuation.
- `Worker note (2026-02-26, Coach-1 execution start):` Board status/blocker check complete. Preparing docs-only W6/W7 rescoping package to move coaching notifications and coach operations toward app surfaces + coach web portal, and reduce `/admin/coaching/audit` to optional super-admin AI troubleshooting only.
- `Current blocker status (2026-02-26, Coach-1):` `none` at spec-drafting start. This pass is board-only sequencing and assignment rescoping; no app/backend/schema/API/spec implementation changes.
- `Completion note (2026-02-26, Coach-1):` Completed docs-only W6/W7 rescoping package on the board. The package reclassifies `/admin/coaching/audit` as optional super-admin AI troubleshooting (non-primary workflow), places coaching notifications in app surfaces + separate coach web portal, defines coach portal surface set (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`), and updates assignment sequencing by keeping W6 app notification surfaces + backend read-model work as primary, freezing W6 `/admin/coaching/audit` notification expansion, and queuing W7 coach portal foundation plus optional super-admin troubleshooting follow-on swaths.
- `Validation note (2026-02-26, Coach-1):` Board-only docs update. Rescope wording and sequencing were cross-checked against accepted W5 coach-persona realignment and W6 notification readiness/backend read-model assignments. No app/backend/schema/API/spec docs changed in this pass.
- `Current blocker status (2026-02-26, Coach-1, completion):` `none` for rescoping package creation. Implementation remains gated on owner acceptance of W6/W7 sequencing and coach portal host/ownership decisions.
- `Worker note (2026-02-26, Coach-1 owner-direction continuation #2):` Reopened to apply additional owner direction to the W6/W7 rescoping package: coaches are first-class runtime operators in host surfaces/channels (including cohort-based channels for non-team individuals), and Team Leaders can participate in challenges they create (`creator != non-participant`).
- `Current blocker status (2026-02-26, Coach-1, owner-direction continuation #2):` `none` for board-only package refinement. Updating rescope assumptions/sequencing language only; no implementation changes in this pass.
- `Completion note (2026-02-26, Coach-1 owner-direction continuation #2):` Refined W6/W7 rescoping package and related row summaries to explicitly preserve coach runtime operator status across host surfaces/channels (including cohort-based channels for non-team individuals) and challenge participation semantics where Team Leaders may participate in challenges they create. Updated W6/W7 assignment sequencing language to keep runtime host/channel notifications and challenge-participant notifications aligned with those rules.
- `Validation note (2026-02-26, Coach-1 owner-direction continuation #2):` Board-only docs update. Runtime-coach/channel wording and challenge participation semantics were checked against accepted W5 coach-persona realignment and existing challenge participation API direction (`creator` does not imply exclusion from participation). No app/backend/schema/API/spec docs changed.
- `Worker note (2026-02-26, Coach-1 owner-direction continuation #3):` Reopened to apply additional owner-direction constraint to W6/W7 rescoping docs/package: Solo User challenge creation is not a standalone primary flow; if supported, solo challenge creation routes via Sponsored Challenges. Updating board + intended wiring/screenmap/coaching addendum to remove generic solo challenge creation as a primary destination.
- `Current blocker status (2026-02-26, Coach-1, owner-direction continuation #3):` `none` for docs-only refinement. Changes are planning-model updates only (destination/flow modeling), no runtime/backend implementation edits.
- `Completion note (2026-02-26, Coach-1 owner-direction continuation #3):` Updated the W6/W7 rescoping package and companion planning docs to remove generic solo challenge creation as a primary destination. Solo User challenge creation is now modeled as sponsored-routed only (if enabled) via `Sponsored Challenges` entry points, while preserving coach-first runtime channel/operator modeling and creator-participant challenge notification assumptions.
- `Validation note (2026-02-26, Coach-1 owner-direction continuation #3):` Docs-only update across board + planning appendices. Cross-checked that solo challenge creation is no longer presented as a primary runtime destination in intended screenmap/wiring and that coaching addendum W6/W7 clarifications now carry the sponsored-routed-only rule. No app/backend/schema/API files changed.
- `Worker note (2026-02-26, Coach-1 owner-direction continuation #4):` Reopened to apply additional owner direction to the W6/W7 rescoping package and companion planning docs: `Challenge Sponsor` is a distinct persona (not just a challenge type), sponsors do not log KPIs, and sponsor permissions/surfaces must explicitly cover sponsor-scoped communication tools, content library access, and visibility into challenge member KPIs.
- `Current blocker status (2026-02-26, Coach-1, owner-direction continuation #4):` `none` for docs-only refinement. This pass updates persona/surface/permission modeling and sequencing notes only; no runtime/backend/schema/API implementation edits.
- `Completion note (2026-02-26, Coach-1 owner-direction continuation #4):` Updated the W6/W7 rescoping package requirements and row summaries to model `Challenge Sponsor` as a distinct persona with sponsor-scoped communications/content/KPI-visibility responsibilities, explicitly prohibit sponsor KPI logging, and require companion planning docs (persona model + wiring/screenmap/coaching docs) to reflect sponsor persona surfaces/permissions alongside coach runtime/operator and sponsored-routing rules.
- `Validation note (2026-02-26, Coach-1 owner-direction continuation #4):` Board-first docs update. Sponsor persona/no-KPI-logging direction was added to rescope objectives, constraints, deliverables, validation, and report-back requirements before companion planning-doc edits. No app/backend/schema/API files changed by this board-step.

#### Primary Objective
Prepare an implementation-guiding docs-only rescoping package for W6/W7 that reflects owner direction:
- `/admin/coaching/audit` is likely unnecessary as a primary workflow and should be treated as optional super-admin AI troubleshooting only
- coaching notifications belong in app surfaces and a separate coach web portal
- coaches are first-class runtime operators in host surfaces/channels (including cohort-based channels for non-team individuals)
- challenge notification/participation assumptions must preserve Team Leader participation in challenges they create (`creator != non-participant`)
- Solo User challenge creation is not a standalone primary flow; if supported, it routes via `Sponsored Challenges`
- `Challenge Sponsor` is a distinct persona (not merely a challenge type) with sponsor-scoped communication/content/member-KPI visibility responsibilities and no KPI logging rights
- define the coach web portal surface set and update W6/W7 assignment sequencing accordingly

#### Required Reads
- `/Users/jon/compass-kpi/AGENTS.md`
- `/Users/jon/compass-kpi/architecture/ARCHITECTURE.md`
- `/Users/jon/compass-kpi/architecture/NON_NEGOTIABLES.md`
- `/Users/jon/compass-kpi/architecture/CURRENT_SPRINT.md`
- `/Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

#### Constraints (Hard)
- Planning/docs only (board-first rescoping package)
- Preserve accepted W5 coach-persona realignment: coach-facing in-app recommendations/next-best-actions remain primary
- `/admin/coaching/audit` must be treated as secondary/optional troubleshooting in this package unless explicitly promoted by a policy decision
- Preserve coach runtime operator status in host surfaces/channels; portal surfaces complement runtime operations and do not replace runtime participation
- Preserve challenge participation semantics: challenge creators (including Team Leaders) may also be participants unless an explicit policy says otherwise
- Do not model generic Solo User challenge creation as a primary runtime destination in this package; use sponsored-routed creation wording only (if supported)
- Model `Challenge Sponsor` as a distinct persona with sponsor-scoped communication/content/member-KPI visibility access and an explicit no-KPI-logging rule
- Preserve W6 notification queue/dispatch backend ownership and no authz widening
- Any route/module/API family changes remain `decision needed` and require `DECISIONS_LOG.md` if implemented later

#### Deliverables (Required)
1. W6/W7 surface ownership rescope summary:
   - app surfaces (coaching notifications + coach runtime guidance + coach runtime operator channel workflows)
   - coach web portal surfaces (coach operations/content/channels)
   - optional `/admin/coaching/audit` super-admin troubleshooting
2. Coach web portal surface set definition (minimum):
   - `content_upload`
   - `content_library`
   - `journeys`
   - `cohorts`
   - `channels`
   - explicit companion rule for runtime host surfaces/channels (including cohort-based runtime channels for non-team individuals)
3. `/admin/coaching/audit` role demotion note:
   - optional super-admin AI troubleshooting only
   - not a primary coach workflow
   - not the owner of coaching notification operations
4. Runtime participation semantics note:
   - Team Leaders can participate in challenges they create (`creator != non-participant`)
   - notification sequencing and UI assumptions must not exclude creator-participants from challenge/cohort coaching notifications
5. Solo challenge creation routing note:
   - generic solo challenge creation is not a primary destination
   - if supported, solo challenge creation routes via `Sponsored Challenges` with sponsor/policy gating
6. W6 sequencing updates (what stays in W6 vs what is paused/deferred)
7. W7 sequencing updates (new portal foundation and optional troubleshooting swaths)
8. Updated follow-on assignment rows/specs to reflect the rescope
9. Sponsor persona boundary note:
   - `Challenge Sponsor` is a distinct persona (not a challenge type label)
   - sponsor-scoped tools include communications, content library access, and challenge member KPI visibility
   - sponsor persona must not log KPIs (no KPI logging routes/actions)

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- Owner direction is explicitly reflected (`/admin/coaching/audit` optional super-admin troubleshooting only)
- Coach portal surface set is explicitly named (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`)
- Coach runtime operator status in host surfaces/channels (including cohort-based channels) is explicit
- Team Leader challenge participation semantics (`creator != non-participant`) are explicit
- Solo challenge creation sponsored-routed-only rule is explicit and generic solo create is not modeled as primary
- `Challenge Sponsor` persona surfaces/permissions are explicit and distinct from generic challenge typing
- no-KPI-logging rule for sponsor persona is explicit
- W6/W7 sequencing changes are concretely represented in board rows and/or follow-on assignment specs

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `Owner direction applied`
- `Coach web portal surface set`
- `Coach runtime operator / cohort-channel rule`
- `Team Leader challenge participation rule`
- `Solo challenge creation routing rule`
- `Challenge Sponsor persona surfaces / permissions`
- `Sponsor no-KPI-logging rule`
- `Role of /admin/coaching/audit` (rescope)
- `W6 sequencing changes`
- `W7 sequencing changes`
- `Next assignments created / updated`
- `Decision needed items`
- `Files touched`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and create/complete a docs-only rescoping package for W6 that reflects owner direction: /admin/coaching/audit is likely unnecessary as a primary workflow and should be treated as optional super-admin AI troubleshooting only; coaching notifications belong in app surfaces and a separate coach web portal; define the coach web portal surface set (content upload/library/journeys/cohorts/channels) and update W6/W7 assignment sequencing accordingly. Update the board status/blocker/completion notes first, then send a brief report back.`


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

### `COACHING-W7-COACH-PORTAL-FOUNDATION-SURFACES-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `W7/W8 coach portal implementation spec pack (docs-only; implementation-ready)`
- `Persona:` `Coach`, `Team Leader` (team-scoped content upload only), `Challenge Sponsor` (sponsor-scoped tools only), `Admin operator` (limited governance)
- `Flow:` `coach portal / content operations` (`IA + surface shells`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred)
- `Figma refs:` `manual-spec-driven` (IA/foundation package; no parity export requirement in this pass)
- `Dependency note:` Follows accepted W6/W7 rescope package and owner-direction refinements (coach runtime operator, cohort-channel support, Team Leader creator-participant rule, solo challenge sponsored-routed creation, Challenge Sponsor distinct persona + no sponsor KPI logging).
- `Worker note (2026-02-26, Admin-1/Coach-1 docs execution start):` Board status updated first. Preparing docs-first W7 coach portal foundation surfaces package using accepted W6/W7 rescope direction, with explicit coach/sponsor surface permissions and runtime-companion boundaries.
- `Current blocker status (2026-02-26, Admin-1/Coach-1):` `none` for docs packaging. This pass defines IA/surface boundaries and sequencing guidance only; no app/backend/schema/API implementation edits.
- `Completion note (2026-02-26, Admin-1/Coach-1):` Completed/advanced the W7 coach portal foundation surfaces package in planning docs. Defined portal foundation surface set (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`) with per-surface purpose, coach/admin/sponsor access boundaries, runtime companion links, and explicit no-sponsor-KPI-logging rules. Clarified `/admin/coaching/audit` remains secondary super-admin troubleshooting/governance and not a primary coach portal workflow.
- `Validation note (2026-02-26, Admin-1/Coach-1):` Board updated first. Cross-doc consistency check completed across coaching matrix, wiring addendum, screenmap, and intended wiring diagram for coach runtime-operator carry-through, sponsor persona access, cohort-channel support, and no sponsor KPI logging. No app/backend/schema/API files changed.
- `Current blocker status (2026-02-26, Admin-1/Coach-1, completion):` `none` for docs package preparation. Implementation remains gated on host choice confirmation (`Admin Shell extension` vs hybrid portal split) and route/module boundary decisions during build.
- `Worker note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #2):` Reopened for docs refinement: Team Leaders can upload content only in team-scoped capacity. Updating W7 package + companion docs so Team Leader upload permissions do not imply org-wide authoring ownership or sponsor-scoped package authority.
- `Current blocker status (2026-02-26, Admin-1/Coach-1, owner-direction continuation #2):` `none` for docs-only refinement. This pass updates role-permission boundaries and surface notes only; no runtime/backend/schema/API implementation edits.
- `Completion note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #2):` Refined W7 portal foundation docs to add Team Leader team-scoped content-upload permissions on `content_upload` while explicitly prohibiting org-wide authoring ownership and sponsor-scoped package authority for Team Leaders. Maintained coach runtime operator model, sponsor persona boundaries, and no sponsor KPI logging constraints.
- `Validation note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #2):` Board-first update completed. Cross-doc consistency check confirms Team Leader upload permission is limited to team scope and does not widen sponsor/package governance authority. No app/backend/schema/API files changed.
- `Worker note (2026-02-26, Admin-1 continuation pickup):` Reopened from `review` for owner-requested execution confirmation focused on foundational coach portal/admin-extension surfaces (`content_upload`, `content_library`, `cohorts`, `channels`) and explicit role-gated access boundaries (Coach, Team Leader team-scoped upload only, Challenge Sponsor sponsor-scoped access, no sponsor KPI logging). This continuation remains docs-only.
- `Completion note (2026-02-26, Admin-1 continuation pickup):` Confirmed and tightened docs-first W7 foundation coverage with primary emphasis on `content_upload`, `content_library`, `cohorts`, and `channels` while preserving the full surface set. Role boundaries are explicit: Coach primary ownership, Team Leader team-scoped upload only, Challenge Sponsor sponsor-scoped access only, and no sponsor KPI logging routes/actions.
- `Validation note (2026-02-26, Admin-1 continuation pickup):` Board status updated first (`review` -> `committed`). Cross-doc sync verified across matrix, wiring addendum, screenmap, and intended wiring diagram for foundational surfaces + role-gated boundaries and `/admin/coaching/audit` secondary-role demotion.
- `Current blocker status (2026-02-26, Admin-1 continuation pickup):` `none` for docs-only package completion. Runtime build execution remains separately gated by host/route/module implementation decisions.
- `Worker note (2026-02-26, Admin-1 implementation phase start):` Board status updated first for this pass. Starting route/shell implementation for `/admin/coaching/uploads`, `/admin/coaching/library`, `/admin/coaching/cohorts`, and `/admin/coaching/channels` with role-gated boundaries for Coach, Team Leader (team-scoped upload only), and Challenge Sponsor (sponsor-scoped access only).
- `Current blocker status (2026-02-26, Admin-1 implementation phase start):` `none` for UI-shell route implementation. This pass does not introduce backend/schema/API boundary changes and keeps `/admin/coaching/audit` as secondary troubleshooting.
- `Completion note (2026-02-26, Admin-1 implementation phase completion):` Implemented W7 coach portal foundation UI shells/routes inside Admin Shell for `/admin/coaching/uploads`, `/admin/coaching/library`, `/admin/coaching/cohorts`, and `/admin/coaching/channels` with route-level role gating. Added role normalization + route definitions for `coach` and `challenge_sponsor`, allowed Team Leader access only on uploads route, and kept explicit no-KPI-logging/no-KPI-edit boundaries in each shell. `/admin/coaching/audit` remains present as secondary troubleshooting/governance only.
- `Validation note (2026-02-26, Admin-1 implementation phase completion):` Route/guard wiring compiles and unit tests pass (`cd app && npx tsc --noEmit`, `cd app && npm run test:unit -- adminAuthz`). No backend/schema/API contract changes were made in this pass.
- `Current blocker status (2026-02-26, Admin-1 implementation phase completion):` `none` for scoped implementation. Browser interaction spot-check is recommended as normal follow-up before push.
- `Worker note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #3):` Reopened for a large W7/W8 docs swath to finalize the coach portal implementation spec pack with explicit surface contracts, role gates, sponsor constraints, Team Leader team-scoped upload boundaries, and no-sponsor-KPI-logging enforcement, plus implementation-ready checklists for admin and mobile lanes.
- `Current blocker status (2026-02-26, Admin-1/Coach-1, owner-direction continuation #3):` `none` for docs-only refinement. This pass is documentation packaging and checklist preparation only; no app/backend/schema/API implementation edits.
- `Completion note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #3):` Finalized W7/W8 docs implementation spec pack with explicit per-surface contracts (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`), role-gate boundaries (Coach/Admin/Challenge Sponsor/Team Leader upload-scope), sponsor constraints, and no-sponsor-KPI-logging enforcement rules. Added implementation-ready lane checklists for Admin Web and Mobile Runtime integration while keeping `/admin/coaching/audit` secondary-only governance/troubleshooting.
- `Validation note (2026-02-26, Admin-1/Coach-1 owner-direction continuation #3):` Board updated first. Cross-doc consistency check completed across matrix, wiring addendum, screenmap, and intended wiring diagram for finalized contract language, role-gate constraints, Team Leader team-scope upload boundary, sponsor enforcement rules, and admin/mobile checklist alignment. No app/backend/schema/API files changed.
- `Worker note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #4):` Reopened for next large docs/control-plane swath to finalize W8 package/flow sequencing for coach portal + runtime handoff, preserving team-leader team-scope upload limits, sponsor constraints, and no sponsor KPI logging, and to add implementation-ready acceptance checklists for Admin, Mobile, and Backend lanes.
- `Current blocker status (2026-02-27, Admin-1/Coach-1, owner-direction continuation #4):` `none` for docs-only refinement. This pass focuses on control-plane sequencing + acceptance checklist packaging only; no app/backend/schema/API implementation edits.
- `Completion note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #4):` Finalized W8 control-plane sequencing and portal/runtime handoff package with implementation-ready acceptance checklists across Admin, Mobile, and Backend lanes. Maintained coach runtime-operator model, Team Leader upload team-scope boundary, sponsor-scoped constraints, no sponsor KPI logging enforcement, and `/admin/coaching/audit` secondary-only treatment.
- `Validation note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #4):` Board updated first. Cross-doc consistency check confirmed W8 sequencing language, portal/runtime handoff contracts, and Admin/Mobile/Backend acceptance checklist alignment without widening sponsor or Team Leader authority boundaries. No app/backend/schema/API files changed in this docs swath.
- `Worker note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #5):` Reopened for W8 control-plane closeout swath to convert the current W7/W8 package into a final implementation acceptance pack with lane-by-lane done criteria, blocked criteria, rollback criteria, and owner checkpoint checklist while preserving Team Leader team-scope upload and sponsor no-KPI-logging guardrails.
- `Current blocker status (2026-02-27, Admin-1/Coach-1, owner-direction continuation #5):` `none` for docs-only closeout. This pass finalizes acceptance packaging/checkpoint criteria only; no app/backend/schema/API implementation edits.
- `Completion note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #5):` Converted W7/W8 control-plane docs into a final implementation acceptance pack with explicit per-lane done/blocked/rollback criteria (Admin, Mobile, Backend) and owner checkpoint checklist gating. Guardrails remain explicit: Team Leader upload is team-scoped only, sponsor scope is constrained, sponsor KPI logging is prohibited, and `/admin/coaching/audit` stays secondary-only.
- `Validation note (2026-02-27, Admin-1/Coach-1 owner-direction continuation #5):` Board updated first. Cross-doc consistency check confirms final acceptance pack references and guardrail wording are aligned across matrix/addendum/screenmap/wiring without widening role authority or introducing structural/API changes.

#### Primary Objective
Prepare/advance an implementation-guiding W7 docs-first foundation package for coach portal surfaces that:
- defines the coach web portal surface set (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`) as companion surfaces to runtime host surfaces/channels (not a replacement),
- finalizes implementation-ready surface contracts and role gates for portal surfaces,
- preserves accepted W6/W7 rescope rules (coach is a first-class runtime operator; cohort-based channels for non-team individuals are valid),
- models `Challenge Sponsor` as a distinct persona with sponsor-scoped portal/channel access and challenge-member KPI visibility,
- allows Team Leader content upload only in team-scoped capacity (no org-wide authoring ownership, no sponsor-scoped package authority),
- explicitly prohibits sponsor KPI logging routes/actions,
- produces implementation-ready checklists for Admin Web and Mobile Runtime lanes,
- produces implementation-ready acceptance checklists for Admin Web, Mobile Runtime, and Backend lanes,
- finalizes a W8 implementation acceptance pack with per-lane done/blocked/rollback criteria and owner checkpoint gates,
- keeps `/admin/coaching/audit` as secondary/optional super-admin troubleshooting/governance rather than a primary coach workflow.

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

#### Constraints (Hard)
- Docs/planning only in this pass (no implementation files)
- Preserve accepted W6/W7 rescope owner direction (coach runtime operator + cohort channels + creator-participant + solo sponsored-routed create)
- `Challenge Sponsor` is a distinct persona with sponsor-scoped access only (not generic member/admin parity)
- Team Leader content upload access is team-scoped only and must not grant org-wide authoring ownership
- Team Leader content upload access must not grant sponsor-scoped package authority
- Sponsor persona must not log KPIs or receive KPI logging/edit routes/actions
- Portal surfaces complement runtime host surfaces/channels and do not replace runtime participation/comms paths
- `/admin/coaching/audit` remains secondary/optional troubleshooting/governance in W7 foundation planning
- Any route/module/API structural changes remain `decision needed` and require `DECISIONS_LOG.md` if implemented

#### Deliverables (Required)
1. W7 coach portal foundation surface set package:
   - `content_upload`
   - `content_library`
   - `journeys`
   - `cohorts`
   - `channels`
2. Per-surface purpose/ownership/access boundaries (Coach/Admin/Challenge Sponsor + Team Leader team-scope upload boundary)
3. Runtime-companion mapping for each surface (what runtime host/channel flows it supports; no replacement rule)
4. Sponsor persona access + no-KPI-logging rules on relevant surfaces (`content_library`, `cohorts`, `channels`, KPI visibility)
5. `/admin/coaching/audit` demotion reaffirmed (secondary governance/troubleshooting only)
6. W7 sequencing guidance / follow-on implementation notes for portal foundation shells
7. Team Leader upload boundary note:
   - Team Leader may upload content only within team-scoped contexts
   - no org-wide authoring ownership granted
   - no sponsor-scoped package authority granted
8. Implementation-ready lane checklists:
   - Admin Web lane checklist (portal surfaces, role gates, governance hooks, audit-secondary rule)
   - Mobile Runtime lane checklist (runtime companion wiring, visibility, no-authoring/no-KPI-mutation boundaries)
   - Backend lane checklist (authz/scope enforcement, read-model handoff outputs, contract readiness, no sponsor KPI logging writes)
9. Final W8 implementation acceptance pack:
   - lane-by-lane done criteria (Admin, Mobile, Backend)
   - lane-by-lane blocked criteria (Admin, Mobile, Backend)
   - lane-by-lane rollback criteria (Admin, Mobile, Backend)
   - owner checkpoint checklist for release-gate sign-off

#### Validation (Required)
- Board updated first with status + completion/blocker notes
- W7 coach portal foundation surface set is explicitly documented (`content_upload`, `content_library`, `journeys`, `cohorts`, `channels`)
- Coach runtime operator companion rule is explicit
- Challenge Sponsor access is sponsor-scoped and explicit
- Team Leader upload permission is explicit and team-scoped only
- Team Leader upload permission does not widen org-wide authoring or sponsor package authority
- No-sponsor-KPI-logging rule is explicit in updated docs
- `/admin/coaching/audit` is not modeled as a primary coach portal workflow
- Admin and Mobile implementation-ready checklists are explicit and aligned with role gates/surface contracts
- Admin, Mobile, and Backend implementation-ready acceptance checklists are explicit and aligned with role gates/surface contracts
- Final W8 acceptance pack criteria (done/blocked/rollback + owner checkpoint) are explicit and lane-scoped
- Screenmap + intended wiring diagram remain in sync for persona/surface access changes

#### Report-Back Format (Required)
- First update this board status + completion/blocker notes
- `Program status`
- `Persona(s) affected`
- `W7 coach portal foundation surface set`
- `Coach runtime companion rule`
- `Challenge Sponsor scoped access`
- `Team Leader team-scoped upload boundary`
- `Sponsor no-KPI-logging rule`
- `Role of /admin/coaching/audit`
- `W7 sequencing / follow-on guidance`
- `W8 package/flow sequencing + runtime handoff guidance`
- `W8 final implementation acceptance pack` (done/blocked/rollback criteria + owner checkpoint checklist)
- `Docs updated` (exact files)
- `Validation`
- `Commit hash(es)`

#### Worker Launch (Short Form)
`Check /Users/jon/compass-kpi/architecture/AGENT_ASSIGNMENT_BOARD.md and execute assignment COACHING-W7-COACH-PORTAL-FOUNDATION-SURFACES-A exactly as written. Use the accepted W6/W7 coach/sponsor/cohort rescope direction (coach runtime operator, sponsor persona, no sponsor KPI logging) and prepare/advance the W7 coach portal foundation surfaces package. Update the board status/blocker/completion notes first, then send a brief report back.`

### `COACHING-W7-RUNTIME-COACH-SPONSOR-VISIBILITY-A`

#### Snapshot
- `Status:` `committed+pushed`
- `Program status:` `W7 runtime coaching visibility swath (mobile)`
- `Persona:` `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / notifications / participation visibility`
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree preferred)
- `Figma refs:` `manual-spec-driven` (W6/W7 rescope package; runtime visibility swath)
- `Worker pickup note (2026-02-26, Mobile-1):` Board status updated first. Executing W7 runtime swath in `KPIDashboardScreen.tsx` for coach+sponsor visibility modules across Home/Team/Challenge/Journeys/Inbox surfaces using existing notification/package read-model outputs with no backend/schema/API changes.
- `Current blocker status (2026-02-26, Mobile-1, start):` `none` (owner approved W6/W7 direction; runtime swath unblocked).
- `Completion note (2026-02-26, Mobile-1):` Added W7 runtime visibility modules for coach runtime operator, challenge sponsor scoped visibility, cohort channel context, and team-leader creator+participant behavior on in-scope host/runtime surfaces. Preserved no-sponsor-KPI-logging boundaries and did not add backend/schema/API changes.
- `Current blocker status (2026-02-26, Mobile-1, completion):` `none`. Remaining work is UX polish/tuning only.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.

### `COACHING-W8-RUNTIME-STATE-HARDENING-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `W8 runtime hardening (coach/sponsor/team-leader state resilience)`
- `Persona:` `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching runtime states`
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass`
- `Figma refs:` `manual-spec-driven` (state-hardening swath)
- `Worker pickup note (2026-02-26, Mobile-1):` Board status updated first. Executing large W8 runtime swath in `KPIDashboardScreen.tsx` to harden loading/empty/error/permission-denied/partial-read-model states across Home/Team/Challenge/Journeys/Inbox/thread surfaces with copy/state-transition tightening and screenshot evidence capture.
- `Current blocker status (2026-02-26, Mobile-1, start):` `none`.
- `Completion note (2026-02-26, Mobile-1):` Implemented runtime-state hardening model + banners on in-scope surfaces, tightened permission-denied/error copy in coaching/channels/thread write/read flows, and preserved no sponsor KPI logging action boundaries.
- `Validation note (2026-02-26, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Screenshot evidence note (2026-02-26, Mobile-1):` Captured runtime evidence artifacts:
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-state-evidence-overlay.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-state-evidence-panel-full.png` (loading/empty/error/permission-denied/partial-read-model/ready key-state panel)
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-state-current-1.png` (runtime error modal example)
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-state-current-2.png` (runtime ready baseline)
- `Current blocker status (2026-02-26, Mobile-1, completion):` `none` for implementation scope.
- `Worker note (2026-02-27, Mobile-1, continuation):` Board status updated first for large W8 runtime polish+proof continuation. Scope held to runtime UX states/copy only in `KPIDashboardScreen.tsx` (Home/Team/Challenge/Journeys/Inbox/thread), with no backend/schema/API boundary changes.
- `Completion note (2026-02-27, Mobile-1, continuation):` Finalized route-clarity copy and state-transition messaging for coach/sponsor/team-leader runtime state banners and preserved no-sponsor-KPI-logging action boundaries across Home/Team/Challenge/Journeys/Inbox/thread surfaces.
- `Validation note (2026-02-27, Mobile-1, continuation):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Screenshot evidence matrix note (2026-02-27, Mobile-1, continuation):`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-loading.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-empty.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-error.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-permission-denied.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-partial-read-model.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-read-model-ready.png`
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/w8-matrix-all-states.png`
- `Current blocker status (2026-02-27, Mobile-1, continuation completion):` `none`.

### `COACHING-W10-MOBILE-UI-EVALUATION-READINESS-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W10 mobile UI evaluation readiness`
- `Persona:` `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / team / challenge evaluability`
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass`
- `Figma refs:` `manual-spec-driven` (runtime evaluation readiness swath)
- `Worker note (2026-02-27, Mobile-1, start):` Board status updated first. Starting large-swatch evaluation-readiness pass in `KPIDashboardScreen.tsx` to tighten CTA integrity, condense diagnostic/placeholder wall text, add compact known-limited-data labels, and preserve end-to-end route continuity for Team/Challenge and Coaching/Journeys surfaces.
- `Current blocker status (2026-02-27, Mobile-1, start):` `none`.
- `Completion note (2026-02-27, Mobile-1):` Completed CTA integrity + runtime state-copy condensation pass in `KPIDashboardScreen.tsx` only. Removed/replaced misleading/dead controls (`Create (Soon)`, Team Challenges create misroute, package-gated dead action buttons) with actionable routes or compact limited-data chips; condensed runtime/gate/fallback copy to concise product-facing state cards/chips; preserved Team -> Team Challenges -> Challenge Details -> Leaderboard/Results and coaching entry -> journeys -> journey detail -> lesson detail route continuity.
- `Validation note (2026-02-27, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Screenshot note (2026-02-27, Mobile-1):` Runtime screenshot capture started via simulator capture script. Captured baseline frame:
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/codex-shot-2026-02-26_22-11-49.png`
- `Screenshot blocker note (2026-02-27, Mobile-1):` scripted multi-surface simulator navigation for expanded screenshot matrix is blocked locally by macOS assistive access denial for UI automation (`osascript` click control unavailable). Capture command works, but cross-surface tab navigation could not be automated in this session.
- `Owner review note (2026-02-27):` Navigation works but UI clarity failed: coaching journey/lesson surfaces are too note-heavy and confusing to evaluate.

### `COACHING-W11-MOBILE-PRODUCT-CLARITY-PASS-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W11 mobile product-clarity pass`
- `Persona:` `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching / challenge / team UX clarity`
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required)
- `Controller launch note (2026-02-27):` Owner hard review outcome: route connectivity passes, but product readability fails due note-heavy UI and unclear action intent. W11 converts in-app coaching/challenge/team surfaces into concise, product-readable UX.

#### Primary Objective
Ship a readability-first mobile pass so owner can evaluate flow quality without parsing diagnostic policy notes.

#### Scope / Ownership
- Own only `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`.
- No admin web edits in this assignment.

#### Hard Constraints
- No backend/API/schema changes.
- No Home/Priority KPI logging mechanic changes.
- Preserve Team/Challenge route continuity already verified.
- Preserve sponsor no-KPI-logging rule.

#### Required Work
1. Remove stacked diagnostic/legalistic note cards from in-scope mobile surfaces.
2. Replace with concise product states:
   - one-line state label
   - one short supporting sentence
   - one primary CTA (or explicit disabled reason chip)
3. Clarify primary action hierarchy on:
   - `coaching_journeys*`, `coaching_journey_detail`, `coaching_lesson_detail`
   - `inbox*`, `channel_thread`
   - Team Challenges / Challenge Details / Leaderboard touchpoints when coaching CTAs appear
4. Keep copy specific and user-facing; no “contract-gap triage” language in runtime UI.

#### Validation
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Static CTA map for touched surfaces (`control -> destination/action`)
- Runtime screenshot set (changed surfaces only)

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + personas
- Surfaces changed
- Before/after copy-state examples (short)
- CTA map
- Files + line refs
- Home/Priority unchanged (`yes/no`)
- Shared logging mechanics unchanged (`yes/no`)
- `tsc` result
- Screenshot paths
- Commit hash
- `Completion note (2026-02-27, Mobile-1):` Completed W11 clarity pass in `KPIDashboardScreen.tsx` for in-scope mobile surfaces: removed contract-gap/legalistic runtime copy, trimmed note-heavy coaching/challenge state text, reduced stacked runtime notification blocks, and tightened CTA intent wording/destinations across Inbox/Channels/Thread/Journeys/Journey Detail/Lesson Detail and Team/Challenge coaching touchpoints.
- `Validation note (2026-02-27, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Screenshot note (2026-02-27, Mobile-1):` Existing runtime evidence reused for changed Team/Challenge surfaces and new baseline simulator capture logged:
  - `/var/folders/zb/9w69k6j97x5dltcvt6pw91500000gn/T/codex-shot-2026-02-26_22-11-49.png`
  - `/Users/jon/compass-kpi/app/test-results/team-member-parity-a/team_member_team_challenges.png`
  - `/Users/jon/compass-kpi/app/test-results/team-member-parity-a/challenge_details_member.png`
  - `/Users/jon/compass-kpi/app/test-results/team-member-parity-a/challenge_leaderboard_results_member.png`
- `Current blocker status (2026-02-27, Mobile-1):` `none` for implementation scope. Expanded multi-surface screenshot automation remains limited by local macOS assistive-access restrictions for scripted Simulator tab navigation.

### `COACHING-W12-JOURNEY-LESSON-HIERARCHY-UX-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W12 mobile hierarchy UX pass`
- `Persona:` `Coach`, `Challenge Sponsor`, `Team Leader`, `Team Member`, `Solo User`
- `Flow:` `coaching journeys` (`hierarchical tap flow`, `explicit back path`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required)
- `Figma refs:` `manual-spec-driven + accepted W11 runtime baseline`
- `Worker note (2026-02-27, Mobile-1, start):` Board status updated first. Starting W12 hierarchy UX pass in `KPIDashboardScreen.tsx` to replace button-led `Open Journey/Open Detail` navigation with list-tap hierarchy (`Journey list -> Journey detail -> Lesson detail`) and explicit in-context back path controls.
- `Current blocker status (2026-02-27, Mobile-1, start):` `none`.

#### Primary Objective
Make journey/lesson navigation evaluable and intuitive by removing redundant deep-link buttons and enforcing a clear hierarchical tap flow with explicit back actions.

#### Scope / Ownership
- Own only `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`.
- No admin web edits in this assignment.

#### Hard Constraints
- No backend/API/schema changes.
- No Home/Priority KPI logging mechanic changes.
- Keep sponsor no-KPI-logging boundaries unchanged.
- Preserve existing Team/Challenge participation wiring.

#### Required Work
1. Remove button-led journey/lesson open controls that bypass hierarchy (`Open Journey Detail`, `Open Lesson Detail`).
2. Keep/strengthen tap hierarchy:
   - `coaching_journeys` row tap opens `coaching_journey_detail`
   - lesson row tap opens `coaching_lesson_detail`
3. Add explicit back path controls:
   - `coaching_journey_detail` -> back to `coaching_journeys`
   - `coaching_lesson_detail` -> back to `coaching_journey_detail` (and optional back to journeys shortcut if consistent)
4. Preserve existing progress actions and AI draft actions.

#### Validation
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Screenshot set for changed journey/lesson surfaces

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + persona(s)
- Screens changed
- CTA map (`control -> destination`)
- Files + line refs
- Home/Priority unchanged (`yes/no`)
- Shared logging mechanics unchanged (`yes/no`)
- `tsc` result
- Screenshot paths
- Commit hash
- `Completion note (2026-02-27, Mobile-1):` Completed W12 hierarchy UX pass in `KPIDashboardScreen.tsx`: removed button-led journey/lesson jump controls (`Open Journey Detail`, `Open Lesson Detail`), preserved list-tap flow (`coaching_journeys` -> `coaching_journey_detail` -> `coaching_lesson_detail`), and added explicit back controls in-content (`Back to Journeys`, `Back to Journey`) while keeping existing AI draft/progress actions intact.
- `Validation note (2026-02-27, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Screenshot note (2026-02-27, Mobile-1):` Captured runtime screenshot for this pass:
  - `/Users/jon/compass-kpi/app/test-results/w12-journey-lesson-hierarchy-ux-a/w12-current.png`
- `Screenshot blocker note (2026-02-27, Mobile-1):` scripted multi-screen Simulator navigation remains blocked by macOS assistive-access denial for `osascript` click automation (`-25211`) in this session; direct screenshot capture via `simctl io booted screenshot` works.
- `Current blocker status (2026-02-27, Mobile-1, completion):` `none` for implementation/validation scope; screenshot automation permission remains environment-limited.

### `COACHING-W12-COMMS-HUB-REORG-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W12 mobile comms hub IA reorg`
- `Persona:` `Coach`, `Team Leader`, `Challenge Sponsor`, `Team Member`, `Solo User`
- `Flow:` `coaching / communication hub` (`bottom-tab comms semantics`, `single hub entry`, `persona-specific in-hub layout`)
- `Owner:` `Mobile-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (dedicated mobile worktree required)
- `Figma refs:` `manual-spec-driven + accepted W12 journey hierarchy baseline`
- `Worker note (2026-02-27, Mobile-1, start):` Board status updated first. Starting Comms hub reorg in `KPIDashboardScreen.tsx`: replace bottom Coaching/User tab semantics with Comms hub, keep one hub entry, render persona-specific in-hub layouts, and keep Journeys first-class in-hub without backend/schema/API changes.
- `Current blocker status (2026-02-27, Mobile-1, start):` `none`.

#### Primary Objective
Make communication access intuitive via a single Comms hub entry with role-aware in-hub presentation while preserving existing route contracts and guardrails.

#### Scope / Ownership
- Own only `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`.
- No admin web edits in this assignment.

#### Hard Constraints
- No backend/API/schema changes.
- Preserve existing endpoint families and route contracts.
- Preserve Home/Priority KPI logging mechanics.
- Preserve sponsor no-KPI-logging rule and existing role gates.

#### Required Work
1. Replace bottom Coaching/User tab semantics with Comms semantics.
2. Keep one Comms hub entry point in bottom navigation.
3. Render persona-specific in-hub layout states for coach/team-leader/sponsor/member/solo.
4. Keep Journeys first-class within the hub (not hidden behind secondary/dead CTA patterns).
5. Preserve existing `inbox*`, `channel_thread`, `coach_broadcast_compose`, and `coaching_journeys*` route contracts.

#### Validation
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + personas
- Surfaces/flows changed
- CTA map before/after
- File + line refs
- Guardrail confirmation (Home/Priority logging + sponsor no-KPI-logging + endpoint families unchanged)
- Validation result
- Commit hash
- `Completion note (2026-02-27, Mobile-1):` Completed Comms hub IA reorg in `KPIDashboardScreen.tsx`: bottom nav key/semantics changed from user/coaching tab treatment to `comms`, in-hub experience now opens as a single Comms hub with persona-specific summary layout (coach/team-leader/sponsor/member/solo), and hub quick actions keep Journeys first-class while preserving existing channel/thread/broadcast/journey route contracts.
- `Guardrail note (2026-02-27, Mobile-1):` No backend/API/schema changes. Existing endpoint families (`/api/channels*`, `/api/messages*`, `/api/coaching*`, `/api/ai/suggestions*`) remain unchanged. Sponsor no-KPI-logging and role-gated broadcast behavior remain intact.
- `Validation note (2026-02-27, Mobile-1):` `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Current blocker status (2026-02-27, Mobile-1, completion):` `none`.

### `COACHING-W11-COACH-PORTAL-STANDALONE-UX-PASS-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W11 coach portal standalone UX pass`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools)
- `Flow:` `coach portal IA/UX` (`standalone feel`, `de-admin framing`, `coach-first clarity`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred)
- `Controller launch note (2026-02-27):` Owner hard review outcome: `/coach/*` routes work, but portal still visually reads as admin panel. W11 delivers standalone coach UX framing.
- `Worker note (2026-02-27, Admin-1, start):` Board status reviewed and W11 standalone shell pass started on coach web routes only; scope held to coach shell framing/copy/readability improvements with no backend/schema/API changes.
- `Completion note (2026-02-27, Admin-1):` Coach shell now uses coach-specific frame styling and copy on `/coach/*` (sidebar/brand/nav/header de-admin treatment), keeps role-scoped route visibility, and improves section affordance wording for Library/Journeys/Cohorts/Channels while preserving existing route map and sponsor/team-leader boundaries.
- `Validation note (2026-02-27, Admin-1):` `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz` passed; `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed; runtime screenshots captured for `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels`, `/coach/uploads`, and compatibility alias check path `/admin/coaching/library`.
- `Current blocker status (2026-02-27, Admin-1):` `none`.
- `Worker note (2026-02-27, Admin-1, reopen correction):` Reopened by owner for correction pass. Scope narrowed to removing remaining admin shell chrome from `/coach/*` runtime (no left admin nav/header in coach mode), preserving role gates, preserving `/admin/coaching/*` compatibility redirects, and refreshing review screenshots.
- `Completion note (2026-02-27, Admin-1, correction):` Coach mode now omits admin shell chrome entirely (left admin sidebar removed; admin header removed) and renders a dedicated coach-only top frame + section nav + context card on canonical `/coach/*` routes. Existing route map, guard behavior, team-leader/sponsor boundaries, and sponsor no-KPI-logging stance remain unchanged.
- `Validation note (2026-02-27, Admin-1, correction):` `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz` passed; `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed; refreshed runtime screenshots captured for `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels`, `/coach/uploads`, and `/admin/coaching/library` compatibility path.
- `Worker note (2026-02-27, Admin-1, hard correction + polish):` Reopened for structural host-boundary correction: canonical `/coach/*` must render in a dedicated coach host (not inside `AdminShellScreen`). This pass includes route-host split, coach-first UX polish, preserved role gates/sponsor rules, and a same-change-set `DECISIONS_LOG.md` entry.
- `Completion note (2026-02-27, Admin-1, hard correction + polish):` Implemented route-host split at app shell: canonical `/coach/*` now renders in dedicated `CoachPortalScreen` with coach-first layout and no admin left-nav/header framing. `AdminShellScreen` remains admin-host only, while `/admin/coaching/uploads|library|journeys|cohorts|channels` continue as compatibility alias paths resolving to canonical `/coach/*`.
- `Decision log note (2026-02-27, Admin-1):` Structural boundary decision logged as `DEC-0047` in `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md`.
- `Validation note (2026-02-27, Admin-1, hard correction + polish):` `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz` passed; `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed; route checks + refreshed screenshots captured for all canonical `/coach/*` routes and all `/admin/coaching/*` compatibility alias paths.

#### Primary Objective
Make `/coach/*` feel like a distinct coach product area, not an admin surface with coach labels.

#### Hard Constraints
- No backend/API/schema changes.
- Keep `/admin/coaching/*` compatibility aliases operational.
- Do not expand `/admin/coaching/audit` as primary workflow.
- Preserve role boundaries and sponsor no-KPI-logging.

#### Required Work
1. Reduce admin-shell visual dominance on `/coach/*`:
   - coach-specific header/nav framing
   - coach-product section hierarchy
   - remove admin-centric phrasing in viewport content
2. Improve in-page affordance clarity for:
   - Library, Journeys, Cohorts, Channels
3. Keep existing route map intact; prioritize readability and intent clarity over new functionality.

#### Validation
- `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz`
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route check:
  - `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels`
  - `/admin/coaching/library` redirects to canonical `/coach/*`
- Runtime screenshots for all touched `/coach/*` routes

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + persona
- Routes changed
- Before/after UI framing summary
- Files + line refs
- Redirect behavior status
- Validation summary
- Screenshot paths
- Commit hash

### `COACHING-W12-COACH-PORTAL-IA-SIMPLIFY-A`

#### Snapshot
- `Status:` `review`
- `Program status:` `M6 W12 coach portal IA simplify pass`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped upload), `Challenge Sponsor` (sponsor-scoped tools)
- `Flow:` `coach portal IA/UX` (`merge uploads into library`, `simplify nav`, `remove redundant progression actions`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred)
- `Worker note (2026-02-27, Admin-1, start):` Board updated first. Starting W12 IA simplification pass to merge Uploads into Library, remove top-level `/coach/uploads` nav, preserve compatibility redirects, and remove per-page next-tab progression actions.
- `Completion note (2026-02-27, Admin-1):` Uploads were merged into Library ownership/copy and removed from coach top-level nav; canonical sections now focus on Library/Journeys/Cohorts/Channels. Compatibility paths `/coach/uploads` and `/admin/coaching/uploads` now resolve into `/coach/library`, and per-page next-tab progression controls were removed from detail actions.
- `Validation note (2026-02-27, Admin-1):` `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz` passed; `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed; route checks captured for canonical coach routes and compatibility redirects (`/coach/uploads`, `/admin/coaching/library`, `/admin/coaching/uploads`).
- `Current blocker status (2026-02-27, Admin-1):` `none`.
- `Worker note (2026-02-27, Admin-1, re-execution):` Re-executed assignment per controller instruction and verified IA simplify behavior remains intact in current branch state before drag/drop MVP pass verification.
- `Validation note (2026-02-27, Admin-1, re-execution):` Re-ran required checks (`adminAuthz`, `tsc`) and confirmed route behavior wiring for `/coach/uploads` compatibility redirect and canonical coach route set is still preserved.

#### Primary Objective
Simplify coach portal top-level IA and action model while preserving existing host split, role gates, and compatibility route behavior.

#### Hard Constraints
- No backend/API/schema changes.
- Keep role gates unchanged.
- Keep sponsor no-KPI-logging rule unchanged.
- Keep `/admin/coaching/*` compatibility redirects intact.

#### Required Work
1. Merge Uploads into Library ownership and UX copy.
2. Remove `/coach/uploads` from top-level coach nav.
3. Keep `/coach/uploads` path as compatibility redirect to `/coach/library`.
4. Remove per-page “next tab” progression actions; keep top-tab navigation only.
5. Preserve canonical coach routes for Library/Journeys/Cohorts/Channels.

#### Validation
- `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz`
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Route checks:
  - canonical `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels`
  - compatibility `/coach/uploads` -> `/coach/library`
  - compatibility `/admin/coaching/*` foundation aliases
- Runtime screenshots:
  - `/coach/library`
  - `/coach/journeys`

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + persona
- IA delta summary
- Files + line refs
- Redirect behavior status
- Validation summary
- Screenshot paths
- Commit hash

### `COACHING-W12-DRAGDROP-LIBRARY-TO-JOURNEY-MVP-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `M6 W12 coach portal journey authoring MVP`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped only), `Challenge Sponsor` (sponsor-scoped read context only)
- `Flow:` `coach portal authoring UX` (`Library -> Journey drag/drop assignment`)
- `Owner:` `Admin-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (coach/admin web worktree preferred)
- `Spec source:` `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md`
- `Worker note (2026-02-27, Admin-1, start):` Board updated first. Starting W12 MVP implementation pass for client-side drag/drop assignment from Library assets into Journey builder on `/coach/journeys`, including reorder/remove/save status handling and role-gated boundaries.
- `Current blocker status (2026-02-27, Admin-1, start):` `none` for UI-only MVP pass.
- `Completion note (2026-02-27, Admin-1):` Implemented W12 drag/drop MVP in `CoachPortalScreen` with drag source cards in Library, drop zones in Journey milestones, block move/reorder/remove interactions, and draft save feedback states (`idle/pending/success/error`) for authoring flow clarity.
- `Validation note (2026-02-27, Admin-1):` `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz` passed; `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false` passed.
- `Contract-gap note (2026-02-27, Admin-1):` No backend/schema/API changes made in this swath. Save/publish is MVP UI-state only and remains ready for future in-family contract wiring (`G1-G5`) from the committed W12 spec.
- `Current blocker status (2026-02-27, Admin-1, completion):` `none` for committed MVP UI pass.
- `Worker note (2026-02-27, Admin-1, re-execution):` Re-executed assignment per controller instruction after IA simplify verification. MVP drag/drop authoring flow (`add/move/reorder/remove/save`) remains present and in-scope with unchanged role gates.
- `Validation note (2026-02-27, Admin-1, re-execution):` Re-ran required checks (`adminAuthz`, `tsc`) and reconfirmed coach route wiring for `/coach/library`, `/coach/journeys`, and compatibility aliases under `/admin/coaching/*`.

#### Primary Objective
Implement an MVP coach authoring loop where a coach can assign Library assets into Journey milestones by drag/drop, then reorder/remove and save draft state feedback without backend/schema changes.

#### Hard Constraints
- No backend/API/schema changes in this pass.
- Keep role boundaries unchanged:
  - Coach primary authoring
  - Team Leader limited/team-scoped
  - Challenge Sponsor scoped-only and no KPI logging actions
- Keep `/admin/coaching/*` compatibility redirect behavior intact.
- `/admin/coaching/audit` remains secondary troubleshooting only.

#### Required Work
1. Implement drag/drop source cards in `/coach/library` and target milestone slots in `/coach/journeys`.
2. Support add/move/reorder/remove interactions in journey draft canvas.
3. Add save-state UX (`idle/pending/success/error`) with explicit operator feedback.
4. Keep role-denied controls visibly locked with reason text.
5. Stay within existing route/surface boundaries and preserve current navigation shell.

#### Validation
- `cd /Users/jon/compass-kpi/app && npm run test:unit -- adminAuthz`
- `cd /Users/jon/compass-kpi/app && npx tsc --noEmit --pretty false`
- Manual route checks:
  - `/coach/library`
  - `/coach/journeys`
  - compatibility redirects from `/admin/coaching/library` and `/admin/coaching/journeys`

#### Report-Back
- Update assignment row/block status first (`review`/`blocked`)
- Program status + persona
- Drag/drop behavior implemented (`add/move/reorder/remove/save`)
- Contract gaps/blockers (if any)
- Files + line refs
- Validation summary
- Commit hash

### `COACHING-W9-COACH-PORTAL-EXPERIENCE-PLANNING-A`

#### Snapshot
- `Status:` `committed`
- `Program status:` `W9 coach portal experience planning (docs/control-plane)`
- `Persona:` `Coach` (primary), `Team Leader` (team-scoped content upload only), `Challenge Sponsor` (sponsor-scoped tools only), `Admin operator` (foundation host/governance)
- `Flow:` `coach portal IA/UX` (`dedicated experience direction + migration path + production sequencing`)
- `Owner:` `Coach-1`
- `Branch/worktree:` `codex/a2-admin-list-usability-pass` (docs-only; separate worktree preferred)
- `Figma refs:` `manual-spec-driven` (IA/control-plane planning pack)
- `Dependency note:` Follows committed W7/W8 implementation spec + acceptance pack and must preserve Team Leader team-scope upload, sponsor constraints, no sponsor KPI logging, and `/admin/coaching/*` secondary transition-host treatment.
- `Worker note (2026-02-27, Coach-1 W9 swath start):` Board updated first. Executing large W9 planning swath to define dedicated polished coach portal IA/UX direction (outside admin-shell presentation), migration path from current admin-hosted foundation routes, persona visibility model, and implementation sequencing from shell/foundation to production coach experience.
- `Current blocker status (2026-02-27, Coach-1 W9 swath start):` `none` for docs/control-plane packaging. This pass is docs-only and does not introduce app/backend/schema/API implementation edits.
- `Completion note (2026-02-27, Coach-1 W9 swath completion):` Completed W9 control-plane planning pack with dedicated coach portal IA/UX direction (outside admin-shell presentation), explicit transition-host rule for `/admin/coaching/*`, phase-based migration path to production dedicated coach experience, and persona visibility model lock (Coach primary, Team Leader team-scoped upload only, Challenge Sponsor scoped tools only) with sponsor no-KPI-logging enforcement.
- `Validation note (2026-02-27, Coach-1 W9 swath completion):` Cross-doc sync check completed across coaching addendum, matrix, screenmap, and intended wiring. Guardrails preserved (Team Leader team-scope upload, sponsor no-KPI-logging, `/admin/coaching/audit` secondary-only). No app/backend/schema/API implementation files changed.
- `Current blocker status (2026-02-27, Coach-1 W9 swath completion):` `none` for docs/control-plane package finalization.
- `Worker note (2026-02-27, Coach-1 W9 implementation swath start):` Board updated first. Implementing first large W9 UI swath: dedicated coach-branded shell/layout/navigation in app using existing `/admin/coaching/*` routes as transition-host wiring, adding role-gated coach/sponsor/team-leader visibility treatment, and stripping admin-heavy non-coaching chrome from coach-facing views.
- `Current blocker status (2026-02-27, Coach-1 W9 implementation swath start):` `none` for scoped frontend implementation. This swath is UI-only and explicitly avoids backend/schema/API contract changes.
- `Completion note (2026-02-27, Coach-1 W9 implementation swath completion):` Implemented first large W9 coach portal shell swath in admin web app: coach-branded shell/frame copy and navigation treatment now activates for coaching transition-host routes (`/admin/coaching/uploads`, `/admin/coaching/library`, `/admin/coaching/cohorts`, `/admin/coaching/channels`) for coach-facing personas. Coach-facing mode limits nav to role-allowed coaching routes, auto-falls back from forbidden non-coaching routes to first allowed coaching route, and removes admin-heavy summary/checklist/dev panels from coach-facing views while preserving existing `/admin/coaching/*` route wiring.
- `Validation note (2026-02-27, Coach-1 W9 implementation swath completion):` Frontend validation passed (`cd app && npx tsc --noEmit`, `cd app && npm run test:unit -- adminAuthz`). No backend/schema/API files changed.
- `Current blocker status (2026-02-27, Coach-1 W9 implementation swath completion):` `none` for committed swath. Manual browser pass for coach/team-leader/sponsor role rendering is recommended before push.
- `Worker note (2026-02-27, Coach-1 W10 route-decoupling swath start):` Board updated first. Starting large W10 decoupling swath to establish dedicated coach portal routes/shell under `/coach/*` for uploads/library/cohorts/channels, migrate coach-facing navigation there, and convert `/admin/coaching/*` foundation routes to temporary compatibility redirect paths.
- `Current blocker status (2026-02-27, Coach-1 W10 route-decoupling swath start):` `none` for scoped frontend route/shell changes. This swath remains UI/route wiring only with no backend/schema/API contract edits.
- `Completion note (2026-02-27, Coach-1 W10 route-decoupling swath completion):` Implemented dedicated `/coach/*` canonical routes for coach portal surfaces (`/coach/uploads`, `/coach/library`, `/coach/cohorts`, `/coach/channels`) and migrated coach-facing shell/navigation copy to customer-facing `/coach/*` experience. Legacy `/admin/coaching/*` foundation routes now resolve as compatibility aliases and redirect to canonical `/coach/*` paths through existing path-sync routing behavior.
- `Validation note (2026-02-27, Coach-1 W10 route-decoupling swath completion):` Route contract + alias updates compile and unit tests pass (`cd app && npx tsc --noEmit`, `cd app && npm run test:unit -- adminAuthz`). No backend/schema/API files changed.
- `Current blocker status (2026-02-27, Coach-1 W10 route-decoupling swath completion):` `none` for committed route decoupling swath. Manual browser validation for legacy-path redirects (`/admin/coaching/*` -> `/coach/*`) is recommended before push.
- `Worker note (2026-02-27, Coach-1 W10 customer-facing shell pass start):` Board updated first. Executing large-swatch customer-facing shell pass on canonical `/coach/*` routes: stronger top-nav + section-nav IA, coach-product copy (not admin-ops wording), actionable table/card surfaces for Library/Journeys/Cohorts/Channels, and lightweight detail drill-ins while preserving role boundaries and legacy compatibility redirects.
- `Completion note (2026-02-27, Coach-1 W10 customer-facing shell pass completion):` Delivered customer-facing coach portal shell baseline with canonical `/coach/*` IA connectivity across Library/Journeys/Cohorts/Channels/Uploads. Added `/coach/journeys` + legacy `/admin/coaching/journeys` compatibility alias, customer-facing top nav and section nav, consistent page header/subheader treatment, actionable table-style list cards, and in-panel detail drill-ins for each major section. Dense admin diagnostics remain removed from coach-facing main viewport.
- `Validation note (2026-02-27, Coach-1 W10 customer-facing shell pass completion):` `adminAuthz` unit tests pass; repo-wide app typecheck still reports pre-existing unrelated `KPIDashboardScreen.tsx` style-key errors (`knownLimitedDataChip`, `knownLimitedDataChipText`) outside this swath. Captured route screenshots for each touched `/coach/*` page under `app/test-results/w10-coach-portal-shell-pass/`.
