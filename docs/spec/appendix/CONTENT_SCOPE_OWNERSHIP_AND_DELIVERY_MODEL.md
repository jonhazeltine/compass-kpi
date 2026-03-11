# Content Scope, Ownership, and Delivery Model

## Purpose
Untangle how journeys, team guidance, challenge support content, sponsor campaign content, tasks, goals, and broadcasts should relate to each other.

This appendix is a product-model clarification document. It is meant to prevent duplicate systems and clarify where existing infrastructure should be reused.

This is not a new backend proposal. It reflects the current platform direction and the current implemented foundations.

Use with:
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`
- `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- `/Users/jon/compass-kpi/docs/spec/05_acceptance_tests.md`

## Core Product Model

There are 4 platform layers:

1. `assets`
- videos
- images
- PDFs/docs
- lesson assets
- replay videos
- message attachments/templates

2. `structured programs`
- journeys
- lesson sequences
- future drips
- challenge nurture sequences
- cohort sequences
- sponsor campaign sequences

3. `assignments`
- tasks
- goals
- reminders/check-ins

4. `delivery scopes`
- self
- DM
- team
- coach roster
- cohort
- challenge
- sponsor campaign audience

## Critical Product Rule
Journeys are not the whole content system.

Journeys are the primary structured-program surface for coaches, but the reusable platform pieces are:
- shared asset library
- shared sequencing/drip infrastructure
- shared assignment engine
- shared delivery engine

Team leaders, challenges, cohorts, and sponsors should reuse those same foundations where appropriate.

## Role Boundaries

### Coach
Coach is advisory and relationship-based.

Coach should be able to:
- create and manage assets
- build and assign journeys
- assign tasks
- assign goals
- message/broadcast to coach clients and cohorts
- run live sessions for clients/cohorts
- use structured sequences/drips

Coach audience is not necessarily one connected team. Coach clients may be unrelated to each other except through a cohort or coaching relationship.

### Team Leader
Team leader is directive and team-scoped.

Team leader should be able to:
- use the same asset infrastructure
- send structured content to their team
- assign tasks
- assign goals
- run team challenges
- broadcast to team/channels/team cohorts where allowed

Team leader should be limited to team scope only.

### Team Leader Who Is Also a Coach
Capabilities are additive.

If a person is both `coach` and `team_leader`, they should get:
- the full coach toolset
- plus team-leader directive authority for their own team

The difference is scope and posture, not a second backend.

### Member
Members should be able to:
- receive content
- participate in journeys/challenges
- receive tasks/goals
- create self-tasks
- create self-goals

Members should not gain assignment authority over others.

### Sponsor
Sponsor is a distinct persona.

Sponsor should be able to:
- communicate with sponsored challenge audience
- send asset-based campaign content
- send live invites/replays
- eventually use scheduled campaign/drip content

Sponsor should not:
- be treated as a coaching role
- gain KPI logging/editing rights
- gain team management rights
- gain task-assignment rights by default

## Current Platform Alignment

## Already Real in Current Platform

### Shared asset library foundation
The system already has one coaching/library asset backend and it already supports scoped visibility patterns such as:
- my assets
- team assets
- global assets

This means the product does not need a second asset library for team leaders or sponsors.

### Structured journey backend
The system already has:
- journey CRUD
- lesson CRUD
- lesson task CRUD/reorder
- runtime journey viewing
- lesson progress

This means the platform already has one structured-program backend. It should be expanded and relabeled where necessary rather than duplicated.

### Team leader access into structured-program infrastructure
Current permissions already allow team leaders to work inside the structured journey/content area for their team scope.

This means the system already supports the intended rule:
- coach = broad advisory author
- team leader = scoped team author/operator

### Unified assignment engine
The system already has:
- self tasks
- coach/team-leader assigned tasks
- profile tasks
- thread-linked tasks
- unified assignments feed
- goals on profile surfaces

This means tasks/goals should continue to be one shared assignment layer, not separate “coach tasks” and “team tasks” systems.

### Broadcast campaign fan-out engine
The system already has a campaign service that can:
- compose once
- resolve audience from targets
- dedupe recipients
- deliver individualized DM messages/cards
- support message/video/live/task content types

This means broadcast fan-out infrastructure already exists and should be widened/clarified rather than rewritten.

## Current Gaps

### Sponsor scope is underpowered
Sponsor is present in the system, but not yet fully integrated into the newer shared content/broadcast infrastructure.

Main current gap:
- sponsor is not yet a first-class sender/operator in all of the newer content/broadcast paths

### Challenge is not yet a first-class structured-content target
Challenges exist and are real, but challenge support content/drips are not yet clearly expressed as part of the shared sequencing/program infrastructure.

Main current gap:
- challenges still feel adjacent to coaching content rather than another scoped delivery expression of the same platform

### UI naming and access patterns are inconsistent
Current infrastructure is more unified than the app language suggests.

The same platform pieces are currently expressed with too many labels:
- journey
- coaching
- team
- sponsor
- challenge
- profile tasks/goals

This makes the product feel more fragmented than it actually is.

## Canonical Ownership Model

### Asset ownership
Use one shared asset system with scoped ownership:
- `coach-owned`
- `team-owned`
- `sponsor-owned`
- `admin/global`

Do not build separate libraries by persona.

### Program ownership
Use one shared structured-program/sequencing system, but allow different product expressions:
- coach sees `Journeys`
- team leader sees `Team Programs` or equivalent label
- sponsor sees `Campaign Content` or equivalent label
- challenge uses the same sequencing engine for challenge drips/support content

Do not force everything to be called a journey in the UI.

### Assignment ownership
Use one shared assignment engine:
- self task/goal
- coach-assigned task/goal
- team-leader-assigned task/goal

Sponsor should remain outside task-assignment authority by default.

### Delivery ownership
Use one shared delivery engine that can deliver into:
- DM
- team channel
- cohort
- challenge
- sponsor audience
- profile/task center
- live/replay cards

## Naming Guidance

### Coach-facing naming
- `Journeys`
- `Library`
- `Channels`
- `Cohorts`
- `Assignments`

### Team leader-facing naming
Reuse the same infrastructure, but prefer language that feels operational:
- `Team Programs`
- `Team Content`
- `Team Assignments`
- `Team Challenges`

The underlying backend may still be journey/library/assignment based.

### Sponsor-facing naming
Prefer campaign language:
- `Campaign Content`
- `Sponsored Challenge Updates`
- `Audience`
- `Live Invite`
- `Replay`

Do not make sponsor feel like a coach.

### Member-facing naming
Members should not have to care which backend powered the item.

They should experience:
- tasks
- goals
- lessons/programs
- challenge updates
- sponsor updates
- live/replay

with clear scope labels, not system jargon.

## Permissions Guidance

### Can create structured programs
- Coach: yes
- Team leader: yes, but team-scoped
- Sponsor: not as coach journeys; only sponsor campaign sequences/content when approved
- Member: no

### Can assign tasks
- Coach: yes
- Team leader: yes, team-scoped
- Member: self only
- Sponsor: no by default

### Can use asset library for authoring/delivery
- Coach: yes
- Team leader: yes, team-scoped
- Sponsor: yes, sponsor-scoped
- Member: consume only

## What Not To Build

Do not build:
1. a second asset library for team leaders
2. a sponsor-only parallel media/content backend
3. a second assignment engine
4. a second broadcast fan-out engine
5. a second structured-program backend for team guidance

Current platform direction is to extend shared systems with cleaner role/scope handling.

## Immediate Product Direction

The next work should focus on:

1. `scope and ownership clarity`
- who owns assets
- who can author programs
- who can deliver what to whom

2. `UI access unification`
- same infrastructure should be accessed in more consistent ways by coach, team leader, sponsor, and member

3. `naming clarity`
- reduce the gap between what the infrastructure already is and what the UI makes it feel like

## UI Unification Direction

### Coach
Should experience one coherent content/communication workspace:
- library
- journeys
- cohorts
- channels
- assignments
- live/broadcast

### Team Leader
Should experience a team-scoped version of that workspace:
- same foundations
- fewer global controls
- clearer team-specific labels

### Sponsor
Should experience a campaign workspace:
- campaign content
- challenge audience
- sponsor updates
- live/replay

### Member
Should see content and assignments delivered in clear runtime surfaces:
- profile
- thread
- journey/program detail
- challenge detail

## Build Guidance

When adding new content features:
1. start with existing shared systems
2. extend scope/ownership where needed
3. only add new backend families if a real gap is proven

When cleaning up UI:
1. unify access patterns by persona
2. rename surfaces to match user mental model
3. avoid exposing backend nouns directly when they create confusion

## Relationship To DEP-003
`DEP-003` (coaching ownership model) remains open in the control plane.

This appendix does not close that dependency formally.

What it does do:
- clarify the intended direction
- show that current infrastructure already supports much of the shared-platform model
- define a safe product/UI cleanup direction that avoids duplicating systems while the final ownership decision matures
