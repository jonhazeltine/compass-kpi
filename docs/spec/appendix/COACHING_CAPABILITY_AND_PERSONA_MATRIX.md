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

| Surface / Flow | Coaching capability hosted | Persona(s) | Type | Status |
|---|---|---|---|---|
| Team Dashboard (leader) | broadcast preview, team coaching summary, member coaching progress snapshot | Team Leader | embedded modules | planned |
| Team Dashboard (member) | coaching progress summary, team updates, lesson prompt | Team Member | embedded modules | planned |
| Team Challenges / Single Person Challenges | challenge-linked coaching prompts/content | Team Leader, Team Member | embedded + linked | planned |
| Challenge Details / Results | sponsor/challenge CTA + coaching nudge modules | Solo, Team Member, Team Leader | embedded | partial/planned |
| Home / Priority | coaching nudges (lightweight), reminders | all | embedded lightweight | planned |
| Profile / Settings | personal goals/coaching preferences/notification prefs | all | dedicated + embedded | partial/planned |
| Inbox / Channels (new) | comms, unread, threads/channels | all (role-gated actions) | dedicated flow | missing |
| Coaching Journeys (new) | journeys/milestones/lessons/progress | all (role-gated management) | dedicated flow | missing |
| Sponsored Challenge detail surfaces | sponsor content + coaching campaign messaging | eligible tiers | embedded + linked | planned |

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

