# Tenancy and Cross-Scope Access Model

## Purpose
Define how Compass isolates customer-owned data while still allowing valid cross-boundary participation.

This appendix clarifies the intended platform behavior for:
- unrelated teams
- unrelated coaches
- brokerages / enterprise customers
- sponsors
- users who participate across more than one relationship context

This is a platform-access model, not a hard-silo model.

## Core Rule
Compass must support two truths at the same time:

1. Each customer domain owns its own content and operational surfaces by default.
2. Users can participate across boundaries when an explicit relationship grants access.

That means:
- default ownership is isolated
- cross-scope visibility is intentional, not accidental
- no object should become visible across customer boundaries without a valid linked relationship

## Tenant Boundary
### Canonical root key
Use `org_id` as the tenant root.

In Compass, `org_id` represents the top-level customer/account boundary.

Examples:
- solo coach business = one `org_id`
- independent team = one `org_id`
- brokerage = one `org_id`
- enterprise customer = one `org_id`

### What `org_id` controls
`org_id` defines:
- default ownership
- default visibility
- default admin authority
- the meaning of "global"

### Global rule
`global` must mean:
- global within my `org_id`

It must never mean:
- global across all Compass customers

## Home Ownership Model
Every durable object must have a home ownership boundary.

At minimum, the following domains should be considered home-owned by an `org_id`:
- users
- teams
- channels
- journeys / structured programs
- coaching media assets
- coaching engagements
- cohorts
- challenges
- broadcast campaigns
- delivery/audit records
- profile tasks/goals if they are durable records outside thread-only metadata

Home ownership means:
- object belongs to one org by default
- visibility starts inside that org
- authority begins inside that org

## Cross-Scope Access Model
Cross-boundary access is allowed, but only through explicit relationships.

### Valid relationship types
Access may be granted through relationships such as:
- `team_membership`
- `channel_membership`
- `coaching_engagement`
- `journey_enrollment`
- `cohort_membership`
- `challenge_membership` / `challenge_participation`
- sponsor/challenge audience membership
- direct-message participation

### Platform rule
A user may be home-owned by one org and still gain valid access to content or communication owned elsewhere.

Example:
- user belongs to Team A (`org_id=A`)
- user accepts coaching from Coach B (`org_id=B`)
- user joins Sponsored Challenge C (`org_id=C` or sponsor-owned challenge scope)

That user may validly access:
- team content from A
- coaching content/tasks from B
- sponsored challenge content/comms from C

This is intentional platform behavior.

### Restriction rule
Cross-scope access must always be mediated by a concrete relationship record or destination membership.

No relationship means:
- no visibility
- no content reuse
- no comms access
- no assignment authority

## Role and Scope Interaction
### Coach
Coach is advisory and relationship-based.

Coach may:
- own assets
- own structured programs (`Journeys`)
- message and broadcast to clients/cohorts/in-scope audiences
- assign tasks/goals to clients in scope

Coach does not require all clients to belong to the same team or know one another.

### Team Leader
Team leader is directive and team-scoped.

Team leader may:
- use the same shared infrastructure
- own team-scoped assets and programs
- assign tasks/goals to team members
- communicate to team/channels/team cohorts

Team leader scope is limited to their team authority.

### Member
Member may:
- consume assigned content/programs
- participate in challenges and cohorts
- receive coach/team/sponsor communication when in scope
- create self tasks/goals

Member may not assign work to others by default.

### Sponsor
Sponsor is a communications/campaign role, not a coaching role.

Sponsor may:
- communicate to sponsored challenge audiences
- use sponsor-owned campaign assets/content
- send live/replay and sponsor updates within sponsor/challenge scope

Sponsor should not gain by default:
- journey authoring as a coach
- KPI logging authority
- task assignment authority

## Shared Platform Layers
Compass should continue using one shared platform with scoped ownership.

### 1. Assets
One shared asset library, scoped by ownership and visibility.

Examples of ownership buckets:
- coach-owned
- team-owned
- sponsor-owned
- org-global/admin-global

### 2. Structured Programs
One shared program engine with different product expressions:
- Coach sees `Journeys`
- Team leader sees `Team Programs` / `Team Content`
- Sponsor sees `Campaign Content`

The underlying system can stay shared.

### 3. Assignments
One assignment engine for:
- self tasks/goals
- coach-assigned tasks/goals
- team-leader-assigned tasks/goals

Sponsor task assignment remains out of scope unless explicitly approved later.

### 4. Delivery
One delivery engine that can deliver into:
- DM
- team channels
- cohort spaces
- challenge spaces
- sponsor/challenge messaging surfaces
- profile/task centers

## Current Platform Alignment
The current codebase already aligns with this model more than it appears.

### Already real
- Shared coaching media asset library foundation
- Shared structured journey/program backend
- Team leader write/read support over structured content within team scope
- Unified task/goal assignment engine across thread/profile feeds
- DM fan-out broadcast campaign engine
- Live/replay foundation that can attach to scoped communication surfaces

### Not yet fully hardened
- `org_id`-anchored ownership is not consistently present across shared domains
- DB-layer tenant enforcement is not yet the primary protection layer
- sponsor-owned assets/campaign content are not yet first-class in all shared systems
- challenge is not yet a first-class structured-content/drip target in the shared sequencing model
- UI naming and access patterns still hide the shared-platform reality

## What This Model Prevents
This model is intended to prevent:
- unrelated customers seeing one another's private assets by accident
- "global" leaking across all customers
- sponsor/coaching/team surfaces exposing data without relationship-based entitlement
- feature-by-feature reimplementation of the same content/task/delivery engines

## What This Model Enables
This model is intended to enable:
- one user participating in team + coach + challenge + sponsor contexts safely
- one shared platform reused by different personas
- clean role-scoped product expressions over the same infrastructure
- future drips/sequences for journeys, cohorts, challenges, and sponsor campaigns without backend duplication

## Immediate Structural Guidance
Use this model when hardening the current platform:

1. Anchor home-owned objects to `org_id`
2. Keep app-layer permission checks
3. Add DB-layer tenant filters and RLS as defense-in-depth
4. Preserve explicit relationship tables as the mechanism for cross-scope access
5. Treat `global` as `org-global`, not platform-global

## Product Naming Guidance
UI naming should express scope and role without forking the backend.

Suggested product expressions:
- Coach: `Journeys`, `Library`, `Cohorts`, `Channels`, `Assignments`
- Team Leader: `Team Programs`, `Team Content`, `Team Assignments`, `Team Challenges`
- Sponsor: `Campaign Content`, `Sponsored Challenge Updates`, `Audience`, `Live/Replay`
- Member: `Tasks`, `Goals`, `Programs`, `Challenge Updates`, `Sponsor Updates`

## Final Rule
Compass is a shared platform with isolated default ownership and explicit cross-scope participation.

It is not:
- a single hard wall with no crossing
- or a flat global pool where everything is visible

The governing principle is:
- private by default
- shared by relationship
