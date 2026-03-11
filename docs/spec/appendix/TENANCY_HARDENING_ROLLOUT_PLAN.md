# Tenancy Hardening Rollout Plan

## Purpose
Define the smallest safe rollout to harden the existing Compass platform around tenant ownership plus explicit cross-scope access.

This plan assumes the platform should be extended, not rebuilt.

## Current-State Assessment
Compass already has most of the shared platform layers needed for the final model:
- shared asset library
- shared structured program/journey backend
- unified assignment engine
- DM fan-out broadcast campaign engine
- cross-scope participation concepts (team, coaching engagement, challenge, cohort, channel)

The current gap is not missing infrastructure.
The current gap is that tenant ownership is not yet consistently anchored to a root boundary in the data model.

## Hardening Objective
Move the platform toward:
1. `org_id` as the default ownership boundary
2. explicit relationship records for cross-scope access
3. `global` meaning `within my org`
4. DB-layer tenant protection plus app-layer checks

## Rollout Principles
1. Do not rebuild shared systems that already exist.
2. Add tenant anchoring incrementally.
3. Start with highest-risk shared domains first.
4. Preserve explicit cross-scope participation as a supported platform behavior.
5. Avoid breaking current product flows while hardening.

## Phases

### Phase 0: Docs and control-plane lock
Deliverables:
- `TENANCY_AND_CROSS_SCOPE_ACCESS_MODEL.md`
- decision-log entry locking `org_id` + explicit cross-scope relationship model
- sprint/control-plane note that tenancy hardening is an approved prerequisite scope exception

Status:
- required before structural changes

### Phase 1: Ownership inventory and schema map
Goal:
Map which current tables are home-owned, relationship-owned, or delivery/audit tables.

Initial high-priority tables:
- `users`
- `teams`
- `team_memberships`
- `channels`
- `channel_members`
- `channel_messages`
- `journeys`
- `journey_enrollments`
- `coaching_media_assets`
- `coaching_engagements`
- `challenges`
- `challenge_participants`
- `sponsors`
- `sponsored_challenges`
- `broadcast_campaigns`
- `broadcast_deliveries`

Output:
- table-by-table map of:
  - home owner (`org_id` required?)
  - relationship bridge
  - cross-scope allowed source
  - current risk level

### Phase 2: Add `org_id` to highest-risk shared ownership tables
Goal:
Anchor default ownership where leakage risk is highest.

Priority order:
1. `users`
2. `teams`
3. `channels`
4. `journeys`
5. `coaching_media_assets`
6. `coaching_engagements`
7. `challenges`
8. `sponsored_challenges`
9. `broadcast_campaigns`
10. `broadcast_deliveries`

Approach:
- additive migrations first
- backfill from existing ownership relationships where possible
- nullable during migration window only if required
- convert to required once backfill is stable

### Phase 3: Query hardening
Goal:
Ensure all shared-object queries are tenant-aware by default.

Priority endpoint families:
1. asset library
2. journeys/program reads and writes
3. channels/messages/broadcast
4. profile assignments/tasks/goals reads
5. sponsor/challenge content surfaces

Rule:
Any query over a home-owned table should filter by `org_id` unless the code path is intentionally traversing a valid cross-scope relationship.

### Phase 4: Relationship-driven cross-scope access normalization
Goal:
Make cross-scope reads and writes explicit rather than incidental.

Examples:
- coach access to a client from `coaching_engagements`
- challenge/sponsor communication from challenge participation or campaign audience membership
- cohort access from cohort membership
- direct messaging from direct channel membership

Rule:
Cross-org or cross-owner visibility must be explained by a relationship row or scoped destination membership.

### Phase 5: RLS / defense-in-depth
Goal:
Add DB-layer protection on the highest-risk shared tables after application filters are tenant-aware.

First-wave RLS candidates:
- `coaching_media_assets`
- `journeys`
- `channels`
- `channel_messages`
- `broadcast_campaigns`
- `broadcast_deliveries`

Principle:
RLS is defense-in-depth, not a replacement for app-layer permission logic.

### Phase 6: Product semantics cleanup
Goal:
Align UI and product language with the hardened ownership model.

Examples:
- `global` => `org global` in product and implementation thinking
- coach-facing `Journeys`
- team-leader-facing `Team Programs`
- sponsor-facing `Campaign Content`

This phase should happen alongside persona UI unification, not in isolation.

## Highest-Risk Current Domains
### 1. Asset library
Risk:
- shared media/content objects are valuable and easy to leak across unrelated customers if visibility is only app-filtered

Need:
- explicit `org_id`
- ownership bucket semantics
- cross-scope grant logic for shared coach/member/challenge/sponsor access

### 2. Channels/messages/broadcast
Risk:
- DM fan-out and multi-scope channels make accidental bleed more costly

Need:
- tenant-aware channels/messages ownership
- relationship-driven delivery
- no platform-global broadcast semantics

### 3. Structured programs / journeys
Risk:
- coach/team-leader reuse is desirable, but ownership must remain explicit

Need:
- `org_id` on programs
- explicit enrollment/relationship access rules
- clear home owner vs enrolled participant distinction

### 4. Assignments/profile feeds
Risk:
- profile read models pull from multiple sources and can leak across scopes if not consistently constrained

Need:
- hard tenant-aware source filtering
- relationship-based exceptions only

## Non-Goals
This rollout does not require:
- separate backends per persona
- a separate asset library for sponsor/team/coach
- a second task engine
- a second broadcast engine
- removing valid cross-scope participation

## Recommended First Structural Slice
The safest first code/database hardening slice is:
1. `users` -> add/confirm `org_id`
2. `teams` -> add `org_id`
3. `channels` -> add `org_id`
4. `coaching_media_assets` -> add `org_id`
5. update the asset library and channel read paths to filter by `org_id` plus valid relationship scope

Why first:
- highest leakage risk
- most shared usage across coach/team/sponsor/challenge work
- smallest slice that proves the pattern

## Recommended Follow-On Slice
Second slice:
1. `journeys` and enrollments
2. `coaching_engagements`
3. profile assignments read sources

## Recommended Final Slice
Third slice:
1. `challenges`
2. `sponsored_challenges`
3. `broadcast_campaigns`
4. `broadcast_deliveries`
5. RLS on highest-risk tables

## Acceptance Criteria for Hardening
A slice is not complete unless:
1. ownership tables are explicitly tenant-anchored
2. `global` no longer means cross-customer global
3. cross-scope access is relationship-based and testable
4. current valid product flows still work:
   - coach invite across org boundary if explicitly allowed by relationship model
   - sponsored challenge participation
   - team member + coach + challenge coexistence
5. unrelated customers cannot access each other's assets or operational content by default

## Owner Guidance
This rollout should be judged by one question:

Can an unrelated customer accidentally see or reuse another customer's content without an explicit relationship?

If the answer is still yes, hardening is incomplete.

## Measurable Validation
Use the backend tenancy audit as the concrete pass/fail check.

Command:
```bash
cd /Users/jon/compass-kpi/backend
npm run test:tenancy-audit
```

Passing result:
- exit code `0`
- output includes:
  - `TENANCY HARDENING AUDIT`
  - `PASS: org_id ownership and high-risk relationship checks are clean.`

What this proves:
1. home ownership is tenant-anchored with `org_id`
2. high-risk shared tables are populated with `org_id`
3. key relationship tables still line up with their parent/home ownership rules
4. the database is no longer relying on implicit global visibility for these hardened domains
