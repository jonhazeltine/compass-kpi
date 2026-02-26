# Coaching Capability and Persona Matrix (Fourth Reason Integration)

## Purpose
Define how coaching capabilities (communication, content, goals, sponsor-linked coaching) map into Compass KPI by persona.

This is a planning/control-plane document for features that are:
- only partially represented in current Figma,
- cross-cutting across Team + Challenge + Sponsored flows,
- informed by Fourth Reason as a reference implementation.

Use with:
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`

## Source References
- Fourth Reason integration reference:
  - `/Users/jon/compass-kpi/docs/spec/appendix/FOURTH_REASON_INTEGRATION_MATRIX.md`
  - `/Users/jon/compass-kpi/references/the fourth reason integration`
- Compass coaching/sponsored contracts:
  - `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
  - `/Users/jon/compass-kpi/docs/spec/05_acceptance_tests.md`

## Guardrails (inherits non-negotiables)
- Coaching reads KPI/forecast outputs; it does not redefine KPI engine behavior.
- Forecast confidence is display/context for coaching, not mutable base forecast state.
- Coaching/sponsor/challenge overlap must preserve KPI logging as the single source of activity truth.
- Role/tier access must be enforced server-side.

## Capability Groups (Canonical)
These are the coaching capability groups Compass should use for planning and implementation.

1. `communication`
- Direct messages / threads
- Team/challenge/sponsor channels
- Broadcast messaging
- Unread counts / inbox
- Push notifications

2. `coaching_content`
- Journeys
- Milestones
- Lessons
- Lesson progress
- Team/member coaching content delivery

3. `goal_setting_momentum`
- Goal tiles / goals
- Check-ins
- Weekly scorecards / momentum views (if adopted)
- Coaching nudges tied to goal progress

4. `sponsor_challenge_coaching`
- Sponsor-branded challenge comms
- Sponsor campaign coaching nudges
- Sponsor CTA + disclaimer + content linkage
- Challenge participation + coaching content coordination

5. `ai_coach_assist` (later, approval-first)
- AI suggestion drafts
- Context assembly from KPI + coaching interactions
- Approval queue and audit trail

## Persona Access Matrix (Intended)

Legend:
- `full`: can create/manage/send
- `participant`: can view/respond/consume/complete
- `limited`: subset only
- `none`: no direct access

| Capability group | Team Leader | Team Member | Solo User | Notes |
|---|---|---|---|---|
| `communication` | `full` | `participant` | `participant/limited` | Solo access may be community/challenge scoped, no team admin comms. |
| `coaching_content` | `full` (assign/broadcast + view progress) | `participant` | `participant` | Team leader may also be coach depending on DEP-003. |
| `goal_setting_momentum` | `full` (team view + own) | `participant` (own + team visibility) | `participant` (own) | Must not mutate KPI source-of-truth. |
| `sponsor_challenge_coaching` | `full/limited` (campaign delivery) | `participant` | `participant` | Overlaps sponsored challenges and challenge participation flows. |
| `ai_coach_assist` | `full` (approval + send) | `none/limited` | `none/limited` | Phase-later; approval-first required. |

## Coach / Ops Access Model (Authoring + Publishing)

This extends the runtime persona matrix with content-operations personas that primarily live in admin/portal surfaces, not member runtime delivery screens.

Legend:
- `author`: create/edit/publish content or campaigns
- `ops`: approve/package/assign/govern
- `delivery_only`: can target/link published content but not author canonical assets
- `none`: no direct authoring/ops access

| Capability group | Coach | Admin operator | Sponsor ops | Notes |
|---|---|---|---|---|
| `communication` | `author` (coach broadcasts/templates/channels within scope) | `ops` (policy, moderation, audit, support) | `delivery_only/limited` (sponsor campaign comms in approved scopes) | Runtime send permissions remain server-enforced by org/team/sponsor scope. |
| `coaching_content` | `author` (journeys, lessons, curation, publishing drafts) | `ops` (review, lifecycle governance, rollback, QA) | `none/limited` (may request packaging, not canonical lesson authoring by default) | Coach persona is the primary content authoring owner. |
| `goal_setting_momentum` | `limited` (templates/guidance content, not KPI source data) | `ops` (configuration/policy support) | `none` | Goals/coaching guidance cannot mutate KPI source-of-truth. |
| `sponsor_challenge_coaching` | `author` (campaign-linked coaching modules/content) | `ops` (sponsor approvals, entitlement/publishing governance) | `author/ops` (sponsor campaign assets + audience approvals within sponsor scope) | Explicit boundary: challenge participation state stays challenge-owned. |
| `ai_coach_assist` | `author/approver` (approval queue participant) | `ops` (audit/compliance oversight) | `none/limited` | Phase-later, approval-first. |

## Authoring vs Delivery Ownership Model (Canonical Planning Boundary)

| Capability group | Authoring / ops owner (portal surfaces) | Runtime delivery owner (member app surfaces) | Packaging / entitlement owner | Boundary note |
|---|---|---|---|---|
| `communication` | Coach + Admin operator (templates, moderation policy, broadcast governance) | Coaching/comms runtime surfaces (`inbox*`, `channel_thread`, `coach_broadcast_compose`) | Admin operator (org policy) + role rules server-side | Runtime UI sends/reads; portal surfaces define templates/governance, not KPI data. |
| `coaching_content` | Coach (primary) + Admin operator (approval/governance) | `coaching_journeys*` + embedded coaching modules | Coach defines publishable content units; Admin governs lifecycle | Runtime surfaces consume published content snapshots/versions, not authoring state. |
| `goal_setting_momentum` | Coach (guidance content/templates), Admin operator (policy) | Home/Profile/Team embedded coaching modules | Org policy + role/tier rules | Coaching guidance overlays may reference KPI outputs but never rewrite KPI logs/base values. |
| `sponsor_challenge_coaching` | Coach + Sponsor ops (campaign content) + Admin operator (approval) | Challenge overlays + `inbox*`/`coaching_journeys*` linked experiences | Sponsor/admin entitlements and package assignment | Challenge system owns participation/results; coaching owns linked content/comms experience. |
| `ai_coach_assist` | Coach + Admin operator (approval/audit) | Future coaching suggestion review surfaces | Admin/compliance policy | Deferred; no auto-send. |

## Packaging Model (Team vs Sponsored vs Paid Coaching)

Planning model only; no schema/API changes implied by this section.

### Packaging units (conceptual)
- `Content Asset`: lesson, milestone, journey, message template (coach-authored canonical content)
- `Publishable Bundle`: curated set of content assets plus metadata/version for a target use case
- `Delivery Package`: published bundle + targeting rules + entitlements + optional challenge/sponsor links

### Package types (intended)
| Package type | Primary owner | Typical targets | May link to sponsor challenge? | Paid entitlement support | Runtime delivery surfaces |
|---|---|---|---|---|---|
| `team_coaching_program` | Coach (author) + Admin operator (ops approval) | org/team/team segments | optional | optional (org subscription-tier gated) | Team modules + `coaching_journeys*` + team comms |
| `sponsored_challenge_coaching_campaign` | Coach + Sponsor ops (co-authoring inputs) + Admin operator (approval) | sponsor-eligible participants / challenge cohorts | required/primary | optional (sponsor-funded entitlement, no user paywall assumption by default) | Challenge overlays + `channel_thread` + `coaching_journeys*` |
| `paid_coaching_product` | Coach (content owner) + Admin operator (catalog/ops) | entitled users/teams | optional | required/primary | `coaching_journeys*`, `inbox*`, profile/account surfaces |

### Packaging boundary rules (required)
- `Coach` authors/cures content and composes bundles; runtime mobile surfaces do not own authoring.
- `Admin operator` owns policy/governance, approval gates, catalog visibility, and operational rollback.
- `Sponsor ops` contributes campaign assets/audience constraints for sponsor packages, but challenge participation and leaderboard logic remain challenge-owned.
- `Paid coaching` entitlement gating is an access/packaging concern, not a journey-authoring concern.
- Runtime delivery surfaces consume published package assignments and content metadata; they do not mutate package definitions.

## Packaging Lifecycle + Ownership Approval Matrix (Implementation-Ready Planning)

Planning-level only. These are target states/workflows for future UI/backend work and are not approved schema enums.

| Package type | Lifecycle states (minimum) | Coach | Admin operator | Sponsor ops | Runtime delivery impact |
|---|---|---|---|---|---|
| `team_coaching_program` | `draft -> in_review -> approved -> scheduled -> published -> paused/retired/rolled_back` | authors content/bundle, targeting intent | approves/publishes/pauses/rolls back (or policy-configured coach self-publish) | none | Team modules + journeys/comms visible only when published + targeted + entitled |
| `sponsored_challenge_coaching_campaign` | `draft -> sponsor_review -> admin_review -> approved -> scheduled -> published -> paused/retired/rolled_back` | authors coaching content/campaign package | governance + final approval + rollback | campaign constraints/assets/audience approvals in sponsor scope | Challenge overlays + linked channels/journeys visible only to eligible sponsor-targeted participants |
| `paid_coaching_product` | `draft -> in_review -> approved_catalog -> scheduled -> published -> paused/retired/rolled_back` | authors content and package composition | catalog governance, entitlement policy ops, rollback | none (except optional sponsor-funded paid-like offers if explicitly approved) | Runtime surfaces require positive entitlement + visibility gating outcome |

### Ownership / approval rules by package type (required)
- `team_coaching_program`
  - Coach owns content/bundle authoring.
  - Admin operator owns governance and operational lifecycle controls.
  - Team leader/member runtime users are delivery consumers only.
- `sponsored_challenge_coaching_campaign`
  - Coach owns coaching content authoring.
  - Sponsor ops owns sponsor campaign constraints/assets and sponsor approval inputs.
  - Admin operator owns platform governance and final operational approval/rollback.
  - Challenge system continues to own challenge participation/results lifecycle independently.
- `paid_coaching_product`
  - Coach owns content authoring and package composition intent.
  - Admin operator owns catalog visibility, entitlement policy, and operational lifecycle.
  - Billing authority implementation details remain `decision needed` and are not implied by this planning model.

## Runtime Consumption Contract Assumptions (Packaging + Entitlements)

Member runtime delivery surfaces should consume packaging/entitlement outcomes as read-model inputs, not compute packaging rules locally.

### Assumed runtime inputs (planning-level)
- `package_type`
- `package_id` / published assignment reference
- `visibility_state` (runtime-usable state derived from lifecycle)
- `target_match` (whether current user/context matches package targeting)
- `entitlement_result`
  - `allowed`
  - `blocked_not_entitled`
  - `blocked_not_in_audience`
  - `blocked_schedule`
  - `blocked_policy`
- `linked_context_refs`
  - challenge / sponsor / team / channel / journey identifiers as applicable
- `display_requirements`
  - disclaimer / sponsor attribution / paywall CTA requirements

### Runtime behavior boundaries (required)
- Runtime may:
  - show/hide CTAs/modules based on entitlement/visibility outcomes
  - render disclaimers and package-linked content references
  - route to linked coaching/channel/challenge surfaces
- Runtime must not:
  - decide package approval/lifecycle transitions
  - rewrite package targeting rules
  - infer sponsor or paid entitlement rules beyond server-provided outcomes
  - mutate KPI logging/forecast base values as part of packaging logic

## Packaging Risks and `Decision Needed` Items (Planning)

These are explicit planning risks and should be carried into implementation prompts / RFCs.

1. `decision needed` — Billing authority and entitlement source-of-truth
- Paid coaching product gating depends on unresolved billing authority (`DEP-001` adjacent impact).
- Implementation phase must log a decision if packaging/entitlement boundaries introduce structural schema/API changes.

2. `decision needed` — Sponsor approval workflow depth
- Whether sponsor approval is mandatory for every sponsor-linked content revision vs package-level approvals only.
- Impacts lifecycle state complexity and audit requirements.

3. `decision needed` — Entitlement read-model location and shape
- Runtime UI needs stable entitlement outcomes; if current endpoints cannot provide them, backend-prep may be required.
- Any new endpoint/read-model family beyond documented contracts requires explicit scope approval.

4. `decision needed` — Multi-tenant packaging reuse rules
- Can one coach-authored package be reused across orgs/sponsors with localized disclaimers, or must publishing be org/sponsor-specific?
- Impacts package identity/versioning semantics (planning only for now).

5. `decision needed` — Role overlap (`Coach` vs `Team Leader`)
- If leaders can author or self-publish coaching content in some orgs, approval and audit paths may fork.
- Must remain server-enforced; UI visibility alone is insufficient.

## Follow-On Assignment Suggestions (If Contract Gaps Block Implementation)

- `COACHING-BACKEND-PREP-PACKAGE-READMODEL-A` (approval-gated)
  - Goal: define/implement runtime packaging + entitlement read-models within existing endpoint families where possible; flag net-new endpoint behavior explicitly.
- `COACHING-UI-PACKAGE-VISIBILITY-GATING-A`
  - Goal: apply server-provided packaging/entitlement outcomes to runtime coaching/challenge surfaces without embedding policy logic in UI.

## Backend-Prep Package Read-Model Output Requirements (Planning-Level Matrix)

This matrix translates runtime UI gating/visibility needs into planning-level backend read-model outputs. It does not approve schema or endpoint changes.

| Runtime surface / use-case | Consumer persona(s) | Required output fields (minimum) | Nice-to-have output fields | Candidate endpoint family | Notes |
|---|---|---|---|---|---|
| `coaching_journeys` list cards | Leader, Member, Solo | `package_type`, `visibility_state`, `entitlement_result`, `linked_context_refs` (challenge/sponsor/team if any), `display_requirements` (disclaimer/paywall flags) | package label, publish window summary, package badge copy | coaching (`GET /api/coaching/journeys`) | Additive to current journey aggregates. |
| `coaching_journey_detail` / `coaching_lesson_detail` | Leader, Member, Solo | `entitlement_result`, `display_requirements`, `linked_context_refs`, package assignment ref | package version metadata, audit-safe reason codes | coaching (`GET /api/coaching/journeys/{id}`) | Must remain explicit-user-action for lesson progress writes. |
| Team coaching module cards | Leader, Member | `visibility_state`, `entitlement_result`, `package_type`, `linked_context_refs`, route-ready destination refs | targeting explanation (why shown), audience label | dashboard/team/coaching family (`decision needed`) | Keep KPI payload ownership separate from coaching packaging logic. |
| Challenge Details sponsor/coaching overlay | Leader, Member, Solo | sponsor disclaimer flags, `package_type`, `entitlement_result`, linked journey/channel refs, sponsor attribution | activation window summary, campaign phase label | sponsored-challenges family (possibly challenge detail family) | Preserve challenge participation/results ownership. |
| `inbox_channels` rows | Leader, Member, Solo | package/context labels, `visibility_state` (if hidden/degraded), disclaimer flags where applicable | unread gating reason codes, package badge metadata | channels (`GET /api/channels`) | Existing unread and role fields are a strong baseline. |
| `channel_thread` header/context | Leader, Member, Solo | package/context attribution, disclaimer requirements, entitlement outcome (if thread display restricted) | moderation/compliance display flags | channels/messages (`GET /api/channels/{id}/messages` + companion channel metadata) | Message rows may not need package fields if thread header carries context. |
| `coach_broadcast_compose` preflight UI | Leader (Coach/Admin later per policy) | supported broadcast path, scope validation outcome, package linkage eligibility, disclaimer requirements | rate-limit window summary, audience estimate | channels/coaching broadcast families (`decision needed`) | Server remains permission/throttle source of truth. |

## Gap Classification Summary (Backend-Prep Planning)

### `in-family extension` candidates (preferred)
- coaching journeys family (`/api/coaching/journeys*`)
- channels/messages family (`/api/channels*`, `/api/messages/*`)
- sponsored challenge family (`/sponsored-challenges*`)

### `decision needed` / likely cross-family coordination
- Team coaching module package outputs (endpoint-family host selection)
- broadcast path preflight semantics across channel vs coaching broadcast endpoints
- shared field naming/normalization standard across families

## Follow-On Implementation Assignment Recommendations (Post-Planning)

1. `COACHING-BACKEND-IMPL-PACKAGE-READMODEL-INFAMILY-A` (backend-prep implementation; approval-gated)
- Implement additive packaging/entitlement read-model outputs in existing endpoint families where feasible.
- Must explicitly stop and split a new assignment if net-new endpoint family/schema changes become necessary.

2. `COACHING-UI-PACKAGE-READMODEL-CONSUME-A` (runtime UI follow-up; queue behind backend-prep outputs or partial backend readiness)
- Consume server-provided packaging/entitlement outputs on W3/W4 coaching surfaces and replace temporary fallback heuristics with contract-driven gating.
- Must not embed policy logic or compute entitlement decisions client-side.

## Intended Surface Hosting Matrix (Where Capabilities Live)

This defines where coaching appears in the app. Coaching is often a module/overlay inside an existing screen, not always a dedicated new screen.

Build wave markers:
- `W1 build-now` = allocation + shells/placeholders/docs alignment only
- `W2 recommended` = first functional communication entry points
- `Later` = after communication baseline / explicit approval

| Surface / Flow | Coaching capability hosted | Persona(s) | Type | Current status | Build marker | Notes |
|---|---|---|---|---|---|---|
| Team Dashboard (leader) | broadcast preview, team coaching summary, member coaching progress snapshot | Team Leader | embedded modules | `⚪ planned` | `W1 build-now` | W1 = placeholder slots + CTA shells only; no leader broadcast send UX yet. |
| Team Dashboard (member) | coaching progress summary, team updates, lesson prompt | Team Member | embedded modules | `⚪ planned` | `W1 build-now` | W1 = module allocation only; route shells target `coaching_journeys` / `inbox`. |
| Team Challenges / Single Person Challenges | challenge-linked coaching prompts/content | Team Leader, Team Member | embedded + linked | `⚪ planned` | `W2 recommended` | First functional challenge comms/content prompts should follow W1 destination naming. |
| Challenge Details / Results | sponsor/challenge CTA + coaching nudge modules | Solo, Team Member, Team Leader | embedded | `🟡 partial/planned` | `W1 build-now` | W1 = sponsor/coaching CTA slot allocation + planned links; no content payload merge. |
| Home / Priority | coaching nudges (lightweight), reminders | all | embedded lightweight | `⚪ planned` | `W1 build-now` | Allocation only in current sprint-adjacent planning; no UI implementation in this assignment. |
| Profile / Settings | personal goals/coaching preferences/notification prefs | all | dedicated + embedded | `🟡 partial/planned` | `W1 build-now` | W1 = route/destination naming + status rows; W2 = functional prefs entry points. |
| Inbox / Channels (new) | comms, unread, threads/channels | all (role-gated actions) | dedicated flow | `⚪ missing` | `W1 build-now` | W1 shell routes + stubs; W2 adds channel list/thread flows. |
| Coaching Journeys (new) | journeys/milestones/lessons/progress | all (role-gated management) | dedicated flow | `⚪ missing` | `W1 build-now` | W1 shell routes + entry points; W2 can stay shell while comms is implemented first. |
| Sponsored Challenge detail surfaces | sponsor content + coaching campaign messaging | eligible tiers | embedded + linked | `⚪ planned` | `W2 recommended` | Preserve sponsor/challenge/coaching boundary; module links only, challenge state remains challenge-owned. |

## First Slice Scope Lock (Implementation Planning: W1 then W2)

### `W1` (build now: allocation + shells)
- Reserve dedicated destination names and route intent for:
  - `inbox`
  - `inbox_channels`
  - `channel_thread`
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`
  - `coach_broadcast_compose` (role-gated shell only)
- Define embedded insert points (docs-only) on:
  - `Home / Priority`
  - `Challenge Details / Results`
  - `Team Dashboard` (leader + member variants)
  - `Profile / Settings`
- Add intended status rows in screenmap + wiring docs using standard legend.
- No app code, backend code, schema, or API contract changes.

### `W2` (recommended next: communication entry points)
- Implement `Inbox / Channels` shell-to-list and `channel_thread` navigation.
- Add first role-gated broadcast entry points:
  - Team Leader from Team Dashboard
  - optional admin/coach role entry from Inbox if role model permits
- Add challenge/team/sponsor channel entry CTAs on existing surfaces as scoped stubs or first wired routes.
- Keep coaching journeys functional depth limited if comms scope consumes wave capacity.

### `Later` (after W1/W2 baseline)
- Rich journey/lesson progress UI parity
- Sponsor campaign coaching content modules beyond CTA/link placement
- AI coach assist (`approval-first`)

## Post-W2 Accepted State and Next Coding-Wave Planning Notes

### Accepted baseline from W1/W2 (implementation landed)
- `W1` shell destinations + placeholder CTA allocation are landed.
- `W2` context-aware communication entry routing is landed for Team/Challenge surfaces.
- Current accepted state still defers:
  - API-backed message read/send behavior
  - broadcast send writes
  - journey content rendering beyond shell depth
  - lesson progress writes from UI actions

### Next coding-wave recommendation (planning order after accepted W2)
1. `W3 coaching_content integration` (UI-first on existing coaching endpoints if payloads are sufficient)
- Focus on `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail`
- Use `GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}`, `GET /api/coaching/progress`
- Allow `POST /api/coaching/lessons/{id}/progress` only for explicit user actions

2. `W4 communication API integration` (UI + contract verification; backend-prep only if needed and approved)
- Inbox/channel thread read/send + broadcast send integration on existing channel/coaching endpoint families
- If mobile read-model payload gaps appear, split backend-prep into a separate approval-gated assignment rather than expanding the UI assignment ad hoc

### Contract-boundary reminder (post-W2)
- Coaching UI may consume coaching/channel contracts and context metadata, but must not mutate KPI engine values or write KPI logs.
- Sponsored challenge flows continue to own participation/progress/results; coaching overlays link content/comms only.
- Server-side role/tier enforcement remains backend-owned even when role-gated CTA visibility exists in UI.

## Overlap with Sponsored Challenge Creation (Important)
This is the overlap you called out and should be treated as explicit design/implementation territory.

### Shared concerns
- audience targeting
- messaging / broadcasts
- branded CTA content
- challenge participation states
- eligibility/tier gating
- reminders / notification cadence

### Separation of concerns (required)
- **Sponsored challenge creation** owns challenge definition + sponsor metadata + rules
- **Coaching system** owns content/journey/messaging delivery
- **Challenge participation** owns participation + progress/leaderboard state

### Integration seam (recommended)
- Sponsor challenge can reference:
  - channel id(s)
  - coaching journey id(s)
  - campaign/broadcast templates
- Coaching content can reference challenge context for timing/personalization
- Neither module rewrites KPI logs or forecast base values

## Backend/Contract Readiness Snapshot (from current specs)

### Already documented/implemented baseline (relevant)
- Coaching:
  - `GET /api/coaching/journeys`
  - `GET /api/coaching/journeys/{id}`
  - `POST /api/coaching/lessons/{id}/progress`
  - `GET /api/coaching/progress`
  - `POST /api/coaching/broadcast`
- Sponsored challenge:
  - `GET /sponsored-challenges`
  - `GET /sponsored-challenges/{id}`
  - admin sponsored challenge endpoints (`/admin/sponsored-challenges*`, `/admin/sponsors*`)

### Likely missing for mobile UX integration
- Mobile-friendly inbox/channel endpoints (or client surfaces) mapped to Compass UI
- Channel/challenge/sponsor context read models optimized for mobile
- Team dashboard aggregate payload + coaching summary combined view model

## Forward Progress Implementation Order (Coaching)
This is sequenced to avoid disrupting current Team parity work.

1. `UI wiring + surface allocation` (docs + route placeholders)
- define where coaching modules appear in Team/Challenge/Home/Profile
- no heavy backend changes required

2. `Communication core integration`
- inbox/channels/threads/broadcast entry points
- team/challenge/sponsor channel types

3. `Coaching content integration`
- journeys/lessons/progress surfaces
- team member + solo user progress views

4. `Sponsored challenge overlap integration`
- sponsor campaign messaging + challenge-linked coaching modules
- CTA + disclaimer + content link consistency

5. `AI coach assist` (approval-first)
- suggestions + queue + audit
- human review and approval gates before any runtime send/publish action

## W5 AI Coach Assist Readiness Boundary (Planning Package)

This section defines the first implementation-ready AI boundary for coaching surfaces. It is planning-only and does not approve schema/API changes by itself.

### Allowed vs disallowed AI action classes (W5)

| Action class | W5 status | Human approval requirement | Boundary note |
|---|---|---|---|
| Draft coaching reply/message copy | `build now` | requester review; escalates by scope/policy | Advisory text only; execution still uses existing message/broadcast endpoints. |
| Draft broadcast copy variants | `build now` | coach/admin approval when scope exceeds requester authority | No audience/scope override by AI. |
| Rewrite/summarize coach-authored coaching content copy | `build now` | coach review; admin review for governed/sponsor content as policy requires | Content authoring lifecycle remains portal-owned. |
| Reflection/check-in prompt suggestions | `build now` | requester review | No implicit lesson progress write or KPI mutation. |
| KPI log writes/edits | `defer / disallowed` | N/A | Violates non-negotiables; AI may not mutate KPI source-of-truth. |
| Forecast base/confidence mutation | `defer / disallowed` | N/A | AI may explain forecasts but not modify base values or confidence data. |
| Auto-send messages/broadcasts/push | `defer / disallowed` | N/A | W5 is approval-first; no autonomous dispatch. |
| Auto-publish packages/targeting/entitlements | `defer / disallowed` | N/A | Packaging/entitlement approvals remain human-owned ops functions. |
| Challenge participation/results mutation | `defer / disallowed` | N/A | Challenge ownership boundary remains unchanged. |

### AI assist surface insertion map (planning)

| Surface / destination | Persona(s) | Primary W5 AI assist use-case | Approval gate baseline | Notes |
|---|---|---|---|---|
| `channel_thread` | Team Leader (member later optional) | draft/rewrite coaching reply | requester review + policy escalation | No direct send; send remains explicit human action. |
| `coach_broadcast_compose` | Team Leader (Coach/Admin later per `DEP-003`) | draft scoped broadcast copy | coach/admin approval for elevated scope | Server remains role/throttle source of truth. |
| `coaching_lesson_detail` | Team Leader, Team Member, Solo User | reflection/check-in prompt drafting | requester review | No auto-complete or progress mutation. |
| `coaching_journeys` / `coaching_journey_detail` | Team Leader, Team Member, Solo User | journey-context coaching prompt suggestions | requester review | Advisory content only. |
| Team coaching modules (embedded) | Team Leader | route to AI draft request/review | requester review + policy escalation | Embedded CTA only for first slice; no inline autonomous actions. |
| Challenge coaching block (embedded) | Team Leader, Solo User | sponsor/challenge coaching copy assist (policy-limited) | likely coach/admin/sponsor approval (`decision needed`) | Must preserve sponsor/challenge ownership seam. |
| `coach_ops_audit` (portal) | Coach, Admin operator | approval queue + audit review | approver action | Governance surface for approvals/rejections/audit trail review. |

### Minimum AI contract/read-model outputs (planning requirements)

These are planning-level requirements for a first safe W5 slice, preferably as additive shaping in existing AI suggestion endpoints (`/api/ai/suggestions*`) before any net-new family is proposed.

| Consumer surface | Required outputs (minimum) | Optional later outputs | Boundary note |
|---|---|---|---|
| Runtime AI request/review shells | `suggestion_id`, `status`, `draft_content`, `source_surface`, `source_context_refs`, `required_approval_tier`, `disclaimer_requirements`, `safety_flags` | token usage summary, rationale summary | Client must not infer policy if explicit fields are absent; render fallback copy instead. |
| Approval queue (`coach_ops_audit`) | requester summary, target scope summary, `status`, timestamps, approval history summary, edited indicator | priority/risk scoring, moderation labels | Queue is review/audit UI; no direct KPI/challenge mutation ownership. |
| Audit detail / reporting | immutable status transitions, reviewer actor IDs, reasons, linked execution refs (if executed), model label/version family | richer diff history, policy rule traces | If persistence shape requires schema changes, mark `decision needed` + `DECISIONS_LOG.md` in implementation. |

### W5 AI work split (`build now` vs `defer`)

`Build now`:
1. Manual-spec-driven UI shell/prototype for approved AI entry/review surfaces.
2. Approval queue read-model shaping and additive contract fields inside existing AI suggestion endpoint family (if sufficient).
3. Coach/Admin moderation + audit UI pass on portal companion surfaces.

`Defer`:
1. Autonomous send/publish paths.
2. AI-driven entitlement/package/targeting decisions.
3. KPI/forecast/challenge state mutations.
4. Long-lived AI memory/personalization stores or cross-tenant inference.

### AI-specific `decision needed` items (adds to existing open decisions)
1. `decision needed` — Approval authority matrix by actor/surface/scope (`Leader` self-review vs `Coach/Admin` approval)
2. `decision needed` — Sponsor ops participation in sponsor-linked AI copy approval
3. `decision needed` — Whether `/api/ai/suggestions*` additive shaping is sufficient vs a net-new AI queue family (requires explicit approval + `DECISIONS_LOG.md`)
4. `decision needed` — Audit linkage persistence shape for suggestion-to-send/publish traceability (schema impact may require separate implementation slice)

## Open Decisions (must remain explicit)
- `DEP-003` Coaching ownership model (team leader vs dedicated coach role)
- Tenancy key strategy for comms/coaching tables (`org_id`, `team_id`, context ownership)
- Notification/event taxonomy for KPI/challenge/coaching/community
- Sponsor challenge content ownership and approval workflow

## Prompting Rules for Coaching Work (Controller)
Every coaching-related implementation prompt must specify:
- capability group (`communication`, `coaching_content`, etc.)
- persona(s)
- hosting surface(s) (Team Dashboard, Challenge Details, Inbox, etc.)
- whether Figma-backed or manual-spec-driven
- overlap boundaries with sponsored challenges
- API/contract assumptions and what is deferred
