# W13 DEP-002 Tenancy Decision Packet

## Status
- Decision type: `owner sign-off required`
- Program slice: `W13 docs/control-plane exception`
- Scope: contracts/governance only, no runtime implementation
- Dependencies touched: `DEP-002` (this packet), with rollout coupling to `DEP-004` and `DEP-005`

## Decision Needed
Approve one tenancy model for Stream/Mux-era contracts and data ownership so Wave A/B implementation can proceed when dependency gates close.

This packet provides 3 concrete models and a recommendation.

---

## Model A: Org-Centric With Optional Team Overlay (Recommended)

### Schema Key Strategy
- Required on all comms/media records: `org_id`
- Optional where context is team-scoped: `team_id` (nullable)
- Context discriminator + id for non-team channels/media linkage:
  - `context_type` (`team | challenge | cohort | sponsor | direct`)
  - `context_id` (nullable for direct)

### Stream/Mux Ownership
- Compass is system-of-record and authorization authority.
- Stream channels and Mux assets are provider projections of Compass-owned entities.
- Provider ids are mapping fields only (`provider_channel_id`, `provider_asset_id`, etc.).

### Channel Mapping
- Canonical channel identity: `(org_id, context_type, context_id, optional team_id)`
- Team channels must include `team_id`.
- Challenge/cohort/sponsor channels may omit `team_id` and rely on `context_type/context_id`.
- Direct/DM channels omit `team_id` and use participant membership under same `org_id`.

### Webhook Ownership
- Webhook receiver resolves provider event -> Compass mapping row -> validates `org_id` scope.
- Unknown mapping rows are quarantined (no blind upsert).
- Webhook side effects are tenancy-scoped by `org_id`; optional `team_id` propagated when present.

### Migration Path
1. Add `org_id` to all new comms/media tables as non-nullable.
2. Add nullable `team_id` + `context_type/context_id`.
3. Backfill:
   - derive `org_id` from owning user/team/challenge/sponsor relation
   - populate `team_id` only where context is team-owned
4. Add composite indexes and RLS filters on `org_id` first, then team-scoped predicates where relevant.
5. Enforce write-path validation: no provider call without resolved Compass tenancy keys.

### Tradeoffs
- Pros:
  - Works for both team and non-team contexts without schema forks.
  - Clean fit for Stream channel families and Mux coaching media tied to journeys/lessons.
  - Minimizes rework when sponsor/cohort scopes expand.
- Cons:
  - Requires strict validation to prevent ambiguous context rows.
  - Slightly more complex query predicates than pure team-centric model.

---

## Model B: Team-First Hierarchy

### Schema Key Strategy
- Required on most comms/media rows: `team_id`
- `org_id` inferred via team join for many operations
- Non-team contexts represented via synthetic/shared teams

### Stream/Mux Ownership
- Compass still owns authz, but provider mapping is effectively team-bound.
- Cross-team org channels and sponsor scopes require synthetic tenancy artifacts.

### Channel Mapping
- Simple for team channels.
- Complex for challenge/sponsor/cohort/direct contexts not naturally team-bound.

### Webhook Ownership
- Easy routing for team-owned events.
- Ambiguous ownership for org-wide or sponsor channels unless synthetic teams are introduced.

### Migration Path
- Requires creating and maintaining synthetic teams for non-team contexts.
- Later unwind cost is high if product expands org-level communication patterns.

### Tradeoffs
- Pros:
  - Simple for narrow team-only collaboration model.
  - Straightforward team-level moderation ownership.
- Cons:
  - Poor fit for sponsor/cohort/direct and org-wide surfaces.
  - Introduces artificial tenancy entities and future migration debt.

---

## Model C: Multi-Dimensional Composite Tenancy (Org + Team + Sponsor Always Present)

### Schema Key Strategy
- Multiple required tenancy keys on most rows (`org_id`, `team_id`, `sponsor_id`, possibly `cohort_id`)
- Context-specific keys become mandatory by broad default

### Stream/Mux Ownership
- Compass remains authority, but ownership resolution becomes heavy and brittle.
- Provider mapping and webhook routing become over-constrained.

### Channel Mapping
- High normalization but high complexity.
- Many nullable/conditional combinations or forced placeholder values.

### Webhook Ownership
- Verbose resolution logic; higher failure/edge-case probability.

### Migration Path
- Expensive up-front schema and policy complexity.
- Harder rollout and higher operational burden before value is proven.

### Tradeoffs
- Pros:
  - Maximum explicitness per row.
- Cons:
  - Over-engineered for current phase.
  - Slower to implement and validate.
  - Greater risk of policy bugs and onboarding friction.

---

## Recommendation
Adopt **Model A: Org-Centric With Optional Team Overlay**.

This is the best balance of:
- provider integration practicality (Stream/Mux mapping),
- future-proofing across team/challenge/cohort/sponsor/direct contexts,
- and enforceable tenancy boundaries without synthetic entities.

---

## Final Schema Key Recommendation (Proposed Decision)

### Required Keys
- `org_id` is **required** for every comms/media/provider-mapping row.

### Optional Keys
- `team_id` is **optional** and present only when the business context is team-scoped.

### Required Context Fields
- `context_type` and `context_id` are required for non-direct channel/media contexts.
- For direct contexts:
  - `context_type='direct'`
  - `context_id` may be null
  - participant mapping table remains authoritative.

### Enforcement Rules
1. No read/write path can execute without resolved `org_id`.
2. `team_id` is required when `context_type='team'`; must be null or validated for non-team contexts.
3. Provider token issuance must verify Compass membership/role within resolved tenancy keys.
4. Provider sync/webhook handlers must reject events that cannot be mapped to a valid Compass tenancy record.
5. RLS/policy filters are anchored on `org_id`; team-scoped constraints are additive.
6. No provider event may mutate KPI source-of-truth calculations (non-negotiable boundary).

---

## Stream/Mux-Specific Ownership Implications Under Recommendation

### Stream
- Token issuance is scoped by Compass tenancy + role (`org_id` + optional `team_id` + context membership).
- Channel sync operates against Compass canonical membership; provider drift is reconciled to Compass state.

### Mux
- Upload/playback issuance is scoped by Compass tenancy and content context (journey/lesson ownership).
- Webhook lifecycle updates are accepted only for mapped tenancy records.

---

## Rollout and Migration Plan (Docs-Level)
1. Approve DEP-002 tenancy decision (this packet).
2. Apply contract-level tenancy fields in planned API specs (already staged in W13 docs).
3. Define migration DDL/backfill plan:
   - add `org_id` non-null
   - add nullable `team_id`
   - add context discriminator fields
   - add provider mapping tables keyed by Compass ids + tenancy keys
4. Gate runtime work behind `DEP-004` and `DEP-005` closure.
5. Execute Wave A (Stream), then Wave B (Mux), then parity/hardening waves.

---

## Decision Needed (Owner Sign-Off)
- Choose one:
  - [ ] Approve Model A (recommended): `org_id` required + optional `team_id`
  - [ ] Approve Model B (team-first)
  - [ ] Approve Model C (multi-dimensional composite)
- If not Model A, specify required constraints to modify:
  - token issuance scope:
  - channel mapping identity:
  - webhook ownership routing:
  - migration constraints:

Approval target date: `TBD by owner`  
Decision log follow-up required after sign-off: `yes` (`DEP-002` closure entry)
