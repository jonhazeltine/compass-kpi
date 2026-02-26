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

This keeps the app coherent and avoids fragmenting the user experience.

## New/Expanded Destinations (Intended)

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

### Phase W4 — Sponsor/challenge coaching integration
- Sponsor challenge detail wiring to coaching/channel modules
- CTA and messaging consistency across challenge + coaching surfaces

### Phase W5 — AI coaching assist (approval-first)
- Route from coaching surfaces to AI suggestion review/approval queues (leader/admin/coach)
- No direct AI auto-send path

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

## Assignment Hand-off Naming Lock (W1/W2)
Use these exact destination IDs in next-wave UI assignment specs unless a controller-approved rename is logged:
- `inbox`
- `inbox_channels`
- `channel_thread`
- `coach_broadcast_compose`
- `coaching_journeys`
- `coaching_journey_detail`
- `coaching_lesson_detail`

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
