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
