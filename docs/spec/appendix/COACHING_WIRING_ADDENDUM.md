# Coaching Wiring Addendum (Intended Integration)

## Purpose
Define where coaching and communication capabilities plug into the intended app wiring, without forcing a separate “coaching app” architecture.

This addendum is intentionally wiring-focused:
- where coaching enters existing flows,
- what is a new dedicated screen vs embedded module,
- what overlaps Team/Challenge/Sponsored systems.

Use with:
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`

## Core Wiring Principle
Coaching is implemented as a mix of:
1. **embedded modules** inside existing screens (Team Dashboard, Challenge Details, Home)
2. **dedicated flows** for communication and journeys (Inbox/Channels, Coaching Journeys)
3. **authoring/ops portal surfaces** for coach/admin/sponsor packaging and publishing (admin-web extension or dedicated coach portal)

This keeps the app coherent and avoids fragmenting the user experience.

## New/Expanded Destinations (Intended)

### Authoring / ops surfaces (admin-web extension or hybrid portal; manual-spec-driven)
- `Coach Content Library` (`coach_content_library`)
  - assets/templates/journeys/lessons catalog and curation
- `Journey Authoring Studio` (`coach_journey_authoring`)
  - journey composition, lesson sequencing, draft/review workflow
- `Publishing & Targeting` (`coach_publish_targeting`)
  - audience targeting, channel/journey linkage, effective windows, package assignment
- `Coaching Packages / Entitlements` (`coach_packages_entitlements`)
  - team/sponsored/paid coaching packaging, visibility, and operational status
- `Coach Ops Audit / Approvals` (`coach_ops_audit`)
  - publish approvals, rollback, moderation/audit review (admin/ops heavy)

### Dedicated flows (net-new or expanded)
- `Inbox / Channels` (`inbox`, `inbox_channels`)
  - channel list / inbox
  - thread view (`channel_thread`)
  - broadcast composer (role-gated, `coach_broadcast_compose`)
- `Coaching Journeys` (`coaching_journeys`)
  - journey list
  - journey detail (`coaching_journey_detail`)
  - lesson detail/progress (`coaching_lesson_detail`)
- `Community` (optional later, if enabled from Fourth Reason patterns)

### Embedded coaching modules (within existing flows)
- `Home / Priority`
  - coaching nudge card(s)
  - reminder prompts
- `Challenge Details / Results`
  - challenge-linked coaching guidance
  - sponsor/challenge campaign CTA + content block
- `Team Dashboard`
  - leader: coaching summary + broadcast preview + member progress highlights
  - member: progress snapshot + lesson prompt + updates
- `Profile / Settings`
  - goals/coaching preferences/notification prefs

## Intended Wiring Insert Points

### Admin / Coach authoring-ops surfaces (new companion layer)
- `Admin Shell` remains the current web host baseline.
- `Coach` persona may be modeled as:
  - admin-web extension (shared shell, role-gated coach sections), or
  - hybrid portal experience (shared auth + dedicated coach routes)
- Authoring/ops destinations hand off published outputs to runtime delivery surfaces, not direct member runtime state mutation.

### Member app shell
- Existing shell remains:
  - `Home / Priority`
  - `Challenge`
  - `Team`
  - `User/Profile`
- Future addition:
  - `Inbox/Comms` entry point (either bottom tab or top-level route from Team/Challenge/Profile)

### Team flow (leader/member)
- `Team Dashboard` routes to:
  - Team management screens (existing Team parity program)
  - Coaching surfaces:
    - `Inbox / Team Channel`
    - `Broadcast Composer` (leader)
    - `Team Coaching Summary` (embedded)
    - `Member Coaching Progress` (embedded / drilldown later)

### Challenge flow
- `Challenge Details` routes/embeds:
  - leaderboard/results (existing)
  - challenge channel / challenge updates (new comms integration)
  - sponsor campaign CTA / coaching content (when sponsored)

### Sponsored challenge overlap
- `Sponsored challenge detail` should link to:
  - sponsor channel (if enabled)
  - sponsor challenge coaching journey/lesson (if enabled)
  - challenge participation flow
- Ownership boundary remains:
  - challenge system owns participation/progress
  - coaching system owns content/messaging

## Publishing / Targeting Integration Seam (Authoring -> Runtime Delivery)

### Authoring/ops side owns
- canonical content assets (journeys, lessons, templates)
- draft/review/publish lifecycle state
- package composition (`team`, `sponsored`, `paid`)
- audience targeting rules and activation windows
- sponsor/admin approvals and operational rollback

### Runtime delivery side owns
- rendering published journeys/lessons/messages in member-facing surfaces
- routing/context (team/challenge/sponsor/user scope)
- local loading/error state and CTA presentation
- explicit user progress actions (lesson completion, acknowledgements) within allowed contracts

### Handoff contract (planning boundary)
Runtime surfaces should consume a published assignment/read model that references:
- published content/version identifiers
- package type (`team_coaching_program`, `sponsored_challenge_coaching_campaign`, `paid_coaching_product`)
- target scope metadata (team/challenge/sponsor/user segment)
- entitlement/visibility flags
- optional linked channel and challenge identifiers

This addendum does not approve new endpoint families or schemas; it defines the ownership seam to avoid authoring logic leaking into member runtime UI.

## Sponsored vs Paid Coaching Packaging Boundary (Portal + Runtime)

### Sponsored coaching packages
- Co-authored inputs may come from `Coach` + `Sponsor ops`, with `Admin operator` approval/governance.
- Must preserve sponsored challenge boundary:
  - challenge system owns participation/results/eligibility mechanics
  - coaching package owns content/comms experience linked to that challenge
- Runtime may render sponsor CTA/disclaimer/content links, but package definition/approval stays in portal/ops surfaces.

### Paid coaching products
- `Coach` authors content; `Admin operator` governs catalog visibility/ops lifecycle.
- Entitlement gating is packaging/access logic, not journey authoring logic.
- Runtime delivery surfaces consume entitlement result + published package assignment; they do not author or repackage content.

## Wiring Phases (Recommended)

### Phase W1 — Allocation + shells (docs + route stubs)
- Reserve destinations and route names for:
  - `inbox`
  - `inbox_channels`
  - `channel_thread`
  - `coach_broadcast_compose` (role-gated shell)
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`
- Add embedded module placeholders in intended screens (docs + implementation placeholders)
- No deep backend dependency required

### W1 explicit entry points (allocation + shell intent)
- `Home / Priority`
  - all personas: coaching nudge card CTA -> `coaching_journeys` (primary), optional secondary CTA -> `inbox`
- `Team Dashboard (leader)`
  - `Broadcast preview` CTA -> `coach_broadcast_compose`
  - `Team coaching summary` CTA -> `coaching_journeys`
  - `Team updates` CTA -> `inbox_channels` (team-context filtered in later implementation)
- `Team Dashboard (member)`
  - `My coaching progress / lesson prompt` CTA -> `coaching_journeys`
  - `Team updates` CTA -> `inbox_channels`
- `Challenge Details / Results`
  - `Challenge updates` CTA -> `inbox_channels` (challenge-context filtered)
  - `Coaching prompt / sponsor coaching CTA` -> `coaching_journey_detail` or `coaching_journeys` (context-dependent, shell in W1)
- `Profile / Settings`
  - `Coaching preferences / notifications` CTA -> `inbox` (notification prefs) and/or profile settings subsection (manual-spec-driven allocation)

### W1 scope boundary (required)
- W1 creates route intent and shell placeholders only.
- W1 does not introduce channel membership management, message send/read behavior, or lesson progress writes.
- W1 does not merge sponsor challenge payload ownership into coaching payloads.

### Phase W2 — Communication integration
- Channel/inbox/thread wiring
- Team/challenge/sponsor channel context linkage
- Broadcast entry points for leader/admin roles

### W2 recommended first functional entry points
- `Team Leader`
  - Team Dashboard -> `inbox_channels` (team channel list or direct team channel landing)
  - Team Dashboard -> `coach_broadcast_compose` (role-gated functional send flow using documented broadcast endpoints)
- `Team Member`
  - Team Dashboard member module -> `inbox_channels`
  - Challenge Details -> `channel_thread` (challenge channel context)
- `Solo User`
  - Challenge Details -> `inbox_channels` or `channel_thread` (sponsor/challenge/community-scoped only)
  - Home / Priority coaching nudge -> `coaching_journeys` shell (functional content may remain deferred)

### W2 sponsored overlap boundaries (must remain explicit)
- `Sponsored challenge detail` may host links to:
  - `inbox_channels` / `channel_thread` for sponsor/challenge channel context
  - `coaching_journeys` / `coaching_journey_detail` for sponsor-linked coaching content
- `Sponsored challenge` continues to own challenge eligibility, participation states, and leaderboard/results behavior.
- `Coaching` continues to own message/content delivery surfaces and progression UI.
- KPI logging remains the activity source of truth for challenge/coaching attribution.

### Phase W3 — Coaching content integration
- Journey list/detail/lesson progress wiring
- Embedded coaching module cards route into journey/lesson screens

### W3 contract boundary notes (post-W2 accepted baseline)
- `W2 accepted baseline` means:
  - shell destinations exist (`inbox*`, `channel_thread`, `coaching_journeys*`, `coach_broadcast_compose`)
  - context-aware entry routing exists for Team/Challenge surfaces
  - messaging reads/writes and journey content payload rendering are still placeholder/shell depth
- `W3` should prioritize coaching content (`coaching_journeys*`) using already documented coaching endpoints before expanding comms API behavior.
- `W3` UI may use documented endpoints:
  - `GET /api/coaching/journeys`
  - `GET /api/coaching/journeys/{id}`
  - `GET /api/coaching/progress`
  - `POST /api/coaching/lessons/{id}/progress` (explicit user action only)
- `W3` UI must not:
  - infer or write KPI logging activity from journey/lesson views
  - auto-complete lessons on screen view without explicit user action
  - mutate forecast base values or confidence inputs
- `W3` backend/API work is not required if current payloads support list/detail/progress rendering for shell destinations.

### Phase W4 — Sponsor/challenge coaching integration
- Sponsor challenge detail wiring to coaching/channel modules
- CTA and messaging consistency across challenge + coaching surfaces

### W4 / post-W3 communication API contract boundary notes
- `W4` comms API-backed UI integration (inbox list, channel thread reads/sends, broadcast send) may proceed only within documented channel/coaching endpoint families unless explicit scope approval extends backend work.
- Existing documented baseline (verify payload shape before coding UI assumptions):
  - `GET /api/channels`
  - `GET /api/channels/{id}/messages`
  - `POST /api/channels/{id}/messages`
  - `POST /api/channels/{id}/broadcast`
  - `POST /api/coaching/broadcast`
- UI ownership in `W4`:
  - context routing, screen state, loading/error handling, role-gated CTA visibility
  - choosing the correct broadcast path based on scoped destination/context
- Backend/contract ownership in `W4` (approval-gated if changes are needed):
  - read-model shaping for mobile inbox/channel contexts (unread, audience labels, scoped metadata)
  - server-side role/tier enforcement and throttles
  - audit logging and write semantics
- If payload shape gaps block `W4` UI, create a separate backend-prep assignment and mark it as requiring explicit sprint-scope approval when it introduces net-new endpoint behavior.

## Post-W2 Contract Boundary Checklist (Use Before Launching W3/W4 Workers)
1. Confirm destination ID remains within naming lock (`inbox*`, `channel_thread`, `coaching_journeys*`, `coach_broadcast_compose`).
2. Confirm capability group + persona + hosting surface are explicit in the assignment.
3. Confirm whether work is `UI on existing contracts` vs `backend-prep / contract change`.
4. If backend-prep is needed, state whether it fits current documented endpoint families or needs explicit scope approval.
5. Re-state sponsored challenge boundary (challenge participation state stays challenge-owned).
6. Re-state KPI non-negotiables (no KPI engine/confidence/base-value mutation by coaching UI).

## Coach / Admin Portal Touchpoints (Post-W4 Planning Targets)

These are planning targets only and intentionally separate from current member-app coaching waves.

| Portal touchpoint | Primary persona(s) | Capability group(s) | Handoff to runtime delivery | Status | Notes |
|---|---|---|---|---|---|
| `coach_content_library` | Coach, Admin operator | `coaching_content`, `communication` templates | Published assets/bundles -> `coaching_journeys*`, `inbox*` | `⚪ planned` | Manual-spec-driven; no Figma parity yet. |
| `coach_journey_authoring` | Coach | `coaching_content` | Published journeys/lessons -> `coaching_journeys*` | `⚪ planned` | Authoring concern only; no member runtime ownership. |
| `coach_publish_targeting` | Coach, Admin operator, Sponsor ops (limited) | `communication`, `sponsor_challenge_coaching` | Assignment/targeting metadata -> Team/Challenge/Profile overlays + `inbox*` | `⚪ planned` | Explicitly separate from challenge participation logic. |
| `coach_packages_entitlements` | Admin operator, Coach (limited authoring view), Sponsor ops (limited sponsor packages) | `sponsor_challenge_coaching`, paid packaging | Entitlement/package assignment -> runtime visibility | `⚪ planned` | Packaging/access policy layer; no content editing required. |
| `coach_ops_audit` | Admin operator | `communication`, `coaching_content`, `ai_coach_assist` (later) | Audit/approval constraints -> runtime allowed actions | `⚪ planned` | Ops/governance layer; UI implementation deferred. |

## Coach Ops Portal Host Recommendation and Route Grouping (Docs-First)

### Near-term host recommendation (recommended)
- `Admin Shell extension` (recommended near-term)
  - rationale: existing authenticated web admin surface already exists and matches the ops-heavy nature of coach publishing/governance work
  - reduces premature router/platform split while coach touchpoints remain manual-spec-driven
  - keeps admin/operator and coach governance collaboration in one place
- `Hybrid coach portal` (deferred option)
  - consider only after touchpoints stabilize and role/workflow complexity justifies a dedicated portal shell
  - treat as `decision needed` during implementation if route ownership, auth context, or UX isolation requirements force a split

### Route grouping plan (manual-spec-driven, planning only)

| Route group (provisional) | Host choice (near-term) | Touchpoints | Primary persona(s) | Status | Notes |
|---|---|---|---|---|---|
| `admin/coaching/library` | Admin Shell extension | `coach_content_library` | Coach, Admin operator | `⚪ planned` | Content catalog/curation and template management. |
| `admin/coaching/authoring` | Admin Shell extension | `coach_journey_authoring` | Coach | `⚪ planned` | Journey/lesson draft editing and review prep. |
| `admin/coaching/publishing` | Admin Shell extension | `coach_publish_targeting` | Coach, Admin operator, Sponsor ops (limited) | `⚪ planned` | Publish/target/schedule/link to channels/challenges. |
| `admin/coaching/packages` | Admin Shell extension | `coach_packages_entitlements` | Admin operator, Coach (limited), Sponsor ops (limited) | `⚪ planned` | Team/sponsored/paid package visibility and entitlement policy ops. |
| `admin/coaching/audit` | Admin Shell extension | `coach_ops_audit` | Admin operator | `⚪ planned` | Approvals, rollback, moderation, audit review. |

### Hybrid portal fallback grouping (deferred planning only)
- If a dedicated coach portal becomes necessary, preserve touchpoint IDs and regroup into:
  - `coach-portal/library`
  - `coach-portal/authoring`
  - `coach-portal/publishing`
  - `coach-portal/packages`
- Keep `coach_ops_audit` in admin governance routes unless coach governance ownership is explicitly widened.
- `DECISIONS_LOG.md` update required in implementation phase if route host ownership or module boundary changes are adopted.

## Coach Ops Touchpoint Workflow Sequences (Authoring -> Publishing -> Runtime)

### `coach_content_library`
1. Coach uploads/curates content assets/templates/journey building blocks.
2. Admin operator optionally reviews metadata/policy compliance flags.
3. Assets become available to `coach_journey_authoring` and `coach_publish_targeting`.

### `coach_journey_authoring`
1. Coach creates/edits journey draft and lesson sequence.
2. Coach marks draft ready for review/publish.
3. Admin operator reviews/approves if governance policy requires.
4. Approved content version becomes eligible for package inclusion and targeting.

### `coach_publish_targeting`
1. Coach selects approved content/bundles.
2. Coach configures target scope (team/challenge/sponsor/user segment) and schedule window.
3. Sponsor ops contributes campaign constraints/assets for sponsor-linked packages (limited scope).
4. Admin operator approves/activates when required.
5. Published assignment metadata is emitted for runtime delivery surfaces.

### `coach_packages_entitlements`
1. Admin operator defines/updates package visibility and entitlement policy (team, sponsored, paid).
2. Coach verifies content mapping and package composition.
3. Sponsor ops manages sponsor package constraints/eligibility inputs in sponsor-scoped cases.
4. Active package/entitlement state becomes runtime visibility input (not runtime authoring state).

### `coach_ops_audit`
1. Admin operator reviews publish/send actions, approval history, and rollback needs.
2. Admin operator executes rollback/suspend actions when policy/compliance issues occur.
3. Runtime surfaces react to updated publish/visibility state via subsequent reads; no direct runtime mutation path from members.

## Publish / Approval / Rollback Lifecycle States (Planning-Level)

Use these lifecycle states for portal planning and worker prompts. These are conceptual states, not approved schema values.

| Lifecycle state | Primary actor | Meaning | Runtime delivery effect |
|---|---|---|---|
| `draft` | Coach | Work in progress; not reviewable for delivery | Not visible in runtime delivery |
| `in_review` | Coach / Admin operator | Submitted for review/approval | Not visible in runtime delivery |
| `approved` | Admin operator (or policy-approved coach flow) | Content/package may be scheduled/published | Not yet visible unless activated |
| `scheduled` | Coach / Admin operator | Approved with future activation window | Visible only when activation window starts |
| `published` | Coach / Admin operator | Active for targeted audiences | Runtime surfaces may render if entitlement/targeting passes |
| `paused` | Admin operator | Temporarily suspended without full retirement | Runtime hides or disables affected content/comms surfaces |
| `retired` | Admin operator | No longer active for new delivery | Runtime may preserve historical references only |
| `rolled_back` | Admin operator | Reverted due to issue/policy/error | Runtime should stop presenting replaced assignment/version |

### Ops responsibilities by lifecycle stage
- `Coach`: authoring quality, content curation, package composition inputs, targeting intent
- `Admin operator`: approval governance, lifecycle enforcement, rollback, audit/compliance
- `Sponsor ops` (limited): sponsor campaign asset/constraint inputs for sponsor-scoped packages only

## Runtime Handoff Artifact Definition (Planning-Level, No Schema Approval)

Runtime delivery surfaces should consume a published handoff artifact/read model with at least:
- `package_type`
  - `team_coaching_program`
  - `sponsored_challenge_coaching_campaign`
  - `paid_coaching_product`
- `publish_state` (effective runtime-visible state only)
- `content_refs`
  - published journey IDs / lesson IDs / template IDs
- `target_scope`
  - org/team/challenge/sponsor/segment references
- `entitlement_visibility`
  - access flags / gating outcome inputs for runtime UI
- `channel_links` (optional)
  - linked channel IDs / broadcast template refs
- `schedule_window`
  - activation/deactivation timing metadata
- `compliance_flags` (optional, portal-governed)
  - disclaimer or moderation requirements for runtime display

### Planning boundary reminder
- This is a contract/read-model planning definition only.
- It is not an approved schema or endpoint addition.
- If implementation requires new endpoint families or structural schema changes, mark `decision needed` and update `DECISIONS_LOG.md` in the implementation change set.

## Sponsored vs Paid Packaging Runtime Consumption Rules (Planning)

This section formalizes how runtime delivery surfaces should treat sponsored and paid coaching packages without absorbing authoring or entitlement policy logic.

### Sponsored coaching package runtime rules
- Runtime may render:
  - sponsor attribution/disclaimer requirements
  - linked challenge context CTA(s)
  - linked channel/journey entry points
- Runtime must not:
  - compute sponsor eligibility rules locally
  - redefine challenge participation/results ownership
  - treat sponsor-linked coaching content as challenge state
- Required boundary remains:
  - challenge system owns participation/eligibility/progress/results
  - coaching runtime surfaces render content/comms experiences linked to sponsor/challenge context

### Paid coaching product runtime rules
- Runtime may render:
  - entitlement-gated access states (allowed/blocked) using server-provided results
  - paywall/upgrade CTA routing if provided by product policy
  - package-linked journeys/channels when entitlement passes
- Runtime must not:
  - compute billing entitlement rules locally
  - embed billing-authority-specific assumptions in coaching content rendering flows
  - couple package access state to journey authoring state

### Runtime fallback behavior when packaging/entitlement fields are missing
- Show safe fallback (`unavailable` / `not currently accessible`) with non-destructive UX.
- Do not infer entitlement from partial metadata.
- Log/flag exact field gaps for backend-prep follow-on planning.

## Packaging / Entitlement Contract-Gap Triage (Use Before UI Implementation)

When launching packaging-aware runtime UI work, classify gaps explicitly:

1. `UI-only` (no contract gap)
- Existing endpoints/read models already provide package visibility + entitlement outcome + linked refs.

2. `Backend-prep within existing endpoint families` (`decision needed` if scope impact is non-trivial)
- Existing endpoint families can be extended/read-model shaped without net-new families.
- Requires approval if it expands current sprint scope materially.

3. `Net-new endpoint family or structural schema need` (`decision needed`, explicit approval required)
- Do not proceed in UI assignment.
- Create backend-prep assignment and require `DECISIONS_LOG.md` update in implementation change set.

## Backend-Prep Package Read-Model Coverage Map (Planning; Handler-Inspected)

This coverage map is based on current documented contracts in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md` and read-only handler inspection in `/Users/jon/compass-kpi/backend/src/index.ts`.

### In-scope runtime surfaces / use-cases
- `coaching_journeys*` package visibility + entitlement-aware rendering
- `Challenge Details/Results` sponsor/coaching overlay visibility + disclaimers
- `Team coaching modules` package visibility + targeting-aware surfacing
- `inbox*` / `channel_thread` package-scoped communication visibility and labels

### Endpoint-family coverage summary (current baseline)

| Runtime surface / use-case | Existing endpoint family candidates | Current coverage | Packaging/entitlement output coverage | Classification |
|---|---|---|---|---|
| `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail` | `GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}`, `GET /api/coaching/progress`, `POST /api/coaching/lessons/{id}/progress` | Journey content + user progress baseline exists | No explicit `package_type`, entitlement outcome, publish visibility state, linked sponsor/challenge refs | `in-family extension` likely (coaching family) |
| Challenge sponsor/coaching overlay display | `GET /sponsored-challenges`, `GET /sponsored-challenges/{id}` + existing challenge endpoints | Sponsor metadata, tier gating, CTA/disclaimer baseline exists | No explicit linked coaching package assignment/journey refs/channel refs in sponsored challenge payloads | `in-family extension` likely (`/sponsored-challenges*`) |
| Team coaching module package visibility | `GET /dashboard` and/or `GET /teams/{id}` (documented), `GET /api/coaching/journeys` | Team + dashboard context exists; journey team scoping exists | No explicit package visibility outcome or targeted coaching assignments returned to team modules | `in-family extension` possible, endpoint choice `decision needed` |
| `inbox_channels` list package-aware labels/visibility | `GET /api/channels`, `GET /api/messages/unread-count` | Channel list + unread summary baseline exists | No package visibility/entitlement labels, sponsor/package attribution, display requirements | `in-family extension` likely (channels family) |
| `channel_thread` package-aware disclaimers/context | `GET /api/channels/{id}/messages`, `POST /api/channels/{id}/messages`, `POST /api/messages/mark-seen` | Thread read/write + unread reset baseline exists | No package attribution/disclaimer requirements surfaced in thread payload/read model | `in-family extension` likely (channels/messages family) |
| `coach_broadcast_compose` package-scoped send guards/labels | `POST /api/channels/{id}/broadcast`, `POST /api/coaching/broadcast` | Broadcast write endpoints + role enforcement baseline exists | No explicit package assignment / entitlement validation output for UI preflight context | `in-family extension` possible; path-selection policy `decision needed` |

### Current handler-observed payload baseline (selected)
- `GET /api/channels` currently returns channel list + membership role + unread counters (`my_role`, `unread_count`, `last_seen_at`) but no package visibility metadata.
- `GET /api/channels/{id}/messages` returns messages only (`id`, `channel_id`, `sender_user_id`, `body`, `message_type`, `created_at`) with no package/disclaimer context.
- `GET /api/coaching/journeys` returns journey aggregates (`milestones_count`, `lessons_total`, `lessons_completed`, `completion_percent`) but no package/entitlement metadata.
- `GET /api/coaching/journeys/{id}` returns journey/milestones/lessons + lesson progress fields but no package assignment metadata.
- `GET /sponsored-challenges*` returns sponsor metadata + CTA/disclaimer + tier gating baseline, but no linked coaching package/journey/channel identifiers.

## Gap Classification Rules for This Backend-Prep Planning Slice

### `in-family extension` (preferred first)
Use when the needed runtime packaging/entitlement outputs can be added to an existing family response (coaching, channels/messages, sponsored-challenges, dashboard/team) without introducing a new endpoint family.

Examples:
- Add packaging visibility outcomes to `GET /api/coaching/journeys*`
- Add package attribution/disclaimer display metadata to `GET /sponsored-challenges/{id}`
- Add package/channel context labels to `GET /api/channels`

### `net-new family/schema need` (`decision needed`)
Use when the runtime requires:
- a dedicated packaging/entitlement evaluation endpoint family, or
- structural schema changes that cannot be represented as additive read-model shaping in existing families

This assignment does not approve either; it only isolates and documents them.

## Backend-Prep `Decision Needed` List (Read-Model Outputs)

1. `decision needed` — Preferred endpoint family for Team coaching module package visibility
- `GET /dashboard` vs `GET /teams/{id}` vs `GET /api/coaching/journeys` composite shaping.
- Impacts coupling between KPI dashboard payload and coaching packaging read-models.

2. `decision needed` — Broadcast path packaging semantics
- Should package-scoped broadcast preflight/context be surfaced via channels family, coaching family, or both?
- Impacts UI path selection and duplication risk between `/api/channels/{id}/broadcast` and `/api/coaching/broadcast`.

3. `decision needed` — Entitlement outcome granularity in runtime payloads
- Minimal boolean (`allowed`) vs structured outcome (`blocked_not_entitled`, `blocked_schedule`, etc.).
- UI fallback/gating behavior benefits from structured outcomes; backend complexity may increase.

4. `decision needed` — Sponsored challenge detail linkage source
- Should sponsor-linked coaching refs live directly on `/sponsored-challenges/{id}` payload or be resolved through coaching family lookup?
- Affects ownership seam clarity and payload duplication risk.

5. `decision needed` — Cross-family consistency contract
- Whether packaging read-model fields should be normalized across coaching/channels/sponsored families (same field names) in implementation phase.
- If yes, implementation likely requires a documented contract standard and may trigger `DECISIONS_LOG.md`.

### Phase W5 — AI coaching assist (approval-first)
- W5 must remain `approval-first` and planning-gated before any AI UI/backend expansion.
- Route from coaching surfaces to AI suggestion review/approval queues (`leader`, `coach`, `admin`) using explicit human review and audit transitions.
- No direct AI auto-send path.

#### W5 runtime insertion points (planning map)
| Host surface / destination | Persona(s) | AI assist entry intent | Allowed first-slice action | Defer note |
|---|---|---|---|---|
| `coaching_lesson_detail` | Team Leader, Team Member, Solo User | "Draft a coaching reply/nudge" helper entry | generate/editable draft text only | no auto-complete of lesson progress; no KPI write suggestions that execute actions |
| `channel_thread` | Team Leader (member later optional) | draft response / rewrite coaching message | suggestion draft + tone variants + disclaimer | no direct send; human send uses existing message/broadcast path after approval |
| `coach_broadcast_compose` | Team Leader (Coach/Admin later per `DEP-003`) | draft scoped broadcast copy from current channel/package context | advisory draft only + required approval label | no auto-send, no audience override, no scope expansion |
| Team coaching module (embedded) | Team Leader | quick CTA into AI draft request/review | route to review shell with context refs | no inline autonomous messaging |
| Challenge coaching block (embedded) | Team Leader, Solo User | sponsor/challenge coaching copy assistance CTA (if policy allows) | route to review shell with challenge-context disclaimers | sponsor approvals and challenge ownership boundaries remain explicit |
| `coaching_journeys` / `coaching_journey_detail` | Team Leader, Team Member, Solo User | optional reflection/check-in prompt drafting | advisory text suggestions only | no lesson state writes without explicit user action |
| `coach_ops_audit` (portal/admin) | Coach, Admin operator | approval queue + audit review | approve/reject/edit-review AI suggestions | runtime delivery stays separate from portal authoring/audit ownership |

#### Allowed vs disallowed AI actions (W5 planning boundary)
Allowed (`approval-first`, advisory only):
- Draft coaching messages, channel replies, and broadcast copy variants from explicit current-surface context.
- Rewrite/summarize coach-authored content for tone/clarity while preserving human review before publish/send.
- Produce suggested lesson/check-in prompts or reflection questions tied to coaching context.
- Surface disclaimer requirements and approval-needed flags in suggestion metadata.

Disallowed (must remain blocked/deferred):
- Any direct KPI log creation/update/delete.
- Any forecast base-value mutation, confidence mutation, or hidden forecast recalculation.
- Any direct message/broadcast/push dispatch without human send action and required approval.
- Auto-approval/publish of coaching packages, targeting, entitlements, or sponsor campaign assets.
- Challenge participation/progress/results mutation (challenge module ownership boundary).
- Client-side entitlement or role-enforcement decisions beyond UI display/fallback (server remains source of truth).

#### Human approval and escalation gates (planning)
1. `Request` (runtime or portal)
- Actor opens AI assist entry from an approved surface.
- Request payload is context-reference based (IDs + summaries), not a permission bypass.

2. `Draft generated` (AI advisory output)
- Draft is returned with disclaimer/safety flags, source surface, and required approval tier.
- Draft remains non-executable until human review.

3. `Human review/edit`
- Requesting actor may edit draft and either submit for approval or discard.
- If policy or scope requires higher approval (sponsor, paid, broad audience), route to approval queue.

4. `Approval queue` (coach/admin ops)
- Coach/Admin approve or reject with reason.
- Escalate to Admin operator when policy, sponsor approval, compliance flags, or audience scope exceeds requester authority.

5. `Execution` (existing runtime send/write path only)
- Approved content is sent/published only via existing endpoint families (`channels/messages`, `broadcast`) with normal authz + throttles.
- Execution records linkage to suggestion/audit context when contract support exists (planning requirement; no schema/API change in this doc pass).

#### Minimum contract/data outputs for first safe AI slice (planning only)
Runtime request context (client -> server, via approved AI suggestion family):
- `source_surface` (`channel_thread`, `coach_broadcast_compose`, `coaching_lesson_detail`, etc.)
- `source_context_refs` (channel/journey/lesson/challenge/team/package IDs as available)
- `request_intent` (`draft_reply`, `draft_broadcast`, `rewrite`, `reflection_prompt`)
- caller role/scope is inferred server-side; client may include UI hint only

Suggestion draft response (server -> client):
- `suggestion_id`
- `status` (`draft_pending_review`, `pending_approval`, `approved`, `rejected`, `expired`)
- `draft_content` (text only for first slice)
- `disclaimer_requirements[]`
- `safety_flags[]`
- `required_approval_tier` (`self_review`, `coach`, `admin`, `sponsor_admin` if later approved)
- `source_surface` + `source_context_refs`
- `model_meta` (non-secret model label/version family for audit display)

Approval/audit read-model outputs (server -> client):
- queue list items with `status`, requester, target scope summary, source surface, created/updated timestamps
- review detail with approval history, reviewer decisions/reasons, edited-content indicator, linked execution refs (if executed)
- immutable audit trail ownership remains server-side; UI only reads and renders

#### `build now` vs `defer` split (W5 AI work)
`Build now` (implementation-ready, approval-first):
1. AI assist UI shell/prototype entry points + review screens on approved coaching surfaces (manual-spec-driven)
2. In-family AI suggestion contract shaping inside existing `/api/ai/suggestions*` endpoints (approval queue/list/detail metadata only)
3. Coach/admin moderation + audit queue UI pass (`coach_ops_audit` companion surfaces) consuming approval/audit read-model outputs

`Defer` (explicitly out of first W5 slice):
1. Autonomous send/publish execution paths
2. AI-authored package targeting/entitlement decisions
3. AI actions that mutate KPI logs, forecast base values, or challenge participation/results
4. Rich multimodal generation/attachments and file handling
5. Cross-tenant memory/personalization stores and long-lived profile inference

#### W5 AI `decision needed` items (implementation phase)
1. `decision needed` — Approval authority matrix by surface/scope
- Clarify when Team Leader self-review is sufficient vs Coach/Admin approval is mandatory.

2. `decision needed` — AI suggestion endpoint contract expansion scope
- If `/api/ai/suggestions*` additive shaping is insufficient and a new endpoint family is proposed, require explicit approval + `DECISIONS_LOG.md` in implementation change set.

3. `decision needed` — Audit linkage persistence shape
- If suggestion-to-send/publish linkage requires structural schema changes, log decision and split schema work from UI shell pass.

4. `decision needed` — Sponsor/co-branded AI content approval depth
- Sponsor ops approval requirements for sponsor-linked coaching copy remain policy-dependent and must stay explicit.

## Runtime Constraint Notes (Current App)
- Current member navigation is state-driven inside `KPIDashboardScreen.tsx`, not a formal navigation library.
- Near-term coaching wiring may begin as:
  - Team/Challenge route shells
  - embedded cards
  - explicit CTA stubs
- A future router migration should preserve this addendum’s destination naming and flow boundaries.

## Naming Guidance (for future implementation)
Use stable destination names by capability and context, for example:
- `inbox`
- `inbox_channels`
- `channel_team`
- `channel_challenge`
- `channel_sponsor`
- `channel_thread`
- `coaching_journeys`
- `coaching_journey_detail`
- `coaching_lesson_detail`
- `coach_broadcast_compose`

## Assignment Hand-off Naming Lock (W1+ runtime and coach-ops planning)
Use these exact destination IDs in next-wave UI assignment specs unless a controller-approved rename is logged:
- `inbox`
- `inbox_channels`
- `channel_thread`
- `coach_broadcast_compose`
- `coaching_journeys`
- `coaching_journey_detail`
- `coaching_lesson_detail`

For coach/admin authoring-ops planning, use these provisional manual-spec-driven IDs until Figma-backed names or controller-approved renames exist:
- `coach_content_library`
- `coach_journey_authoring`
- `coach_publish_targeting`
- `coach_packages_entitlements`
- `coach_ops_audit`

Avoid vague names like:
- `coach_screen`
- `messages2`
- `community_new`

## Review Checklist (Controller)
Before approving coaching-related UI work, confirm:
1. Persona + capability group is explicit
2. Hosting surface is explicit (embedded vs dedicated)
3. Sponsored challenge overlap boundaries are explicit
4. KPI/forecast non-negotiables are not violated
5. Role/tier gating assumptions are stated
6. Figma-backed vs manual-spec-driven status is stated
