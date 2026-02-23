# 02 Data Model

## Core Entities (First Pass)
- `users`
  - identity, role, tier, onboarding financial inputs, goals, account status, last activity timestamp.
- `subscriptions`
  - plan metadata, gateway IDs, lifecycle state, renewal dates.
- `kpis`
  - typed master catalog: `PC | GP | VP | Custom | Actual | Pipeline_Anchor`.
  - includes PC weight/TTC/decay config where applicable.
  - PC timing supports explicit `delay_days` + `hold_days` and optional `ttc_definition` (`X-Y days` or `Z days`) with backward-compatible `ttc_days`.
- `kpi_logs`
  - event stream of user logging with timestamp and optional logged value.
  - for PC logs: stores generated and current contribution, payoff start, TTC end, decay end, and applied timing snapshots (`delay_days_applied`, `hold_days_applied`, `decay_days_applied`).
- `pipeline_anchor_status`
  - user-level anchor counts by type (`Listings_Pending`, `Buyers_UC`) with timestamps.
- `challenge_templates`
  - reusable challenge definitions and KPI sets.
- `challenges` (instances)
  - active/completed challenge runs for user/team.
- `challenge_participants`
  - participant membership and progress state.
  - includes optional `sponsored_challenge_id`.
- `teams`
  - team identity, members, leaders, permissions.
- `forecast_confidence_data`
  - confidence inputs + computed score snapshots and coaching references.
- `sponsors`
  - sponsor identity, branding assets, CTA/disclaimer metadata.
- `sponsored_challenges`
  - sponsor-linked challenge objects with tier requirement and schedule.
- `admin_activity_log`
  - auditable record of admin actions.

## Relationships (First Pass)
- `users 1..n subscriptions`
- `users 1..n kpi_logs`
- `kpis 1..n kpi_logs`
- `users 1..n pipeline_anchor_status`
- `challenge_templates 1..n challenges`
- `challenges 1..n challenge_participants`
- `users 1..n challenge_participants`
- `teams 1..n users` (membership)
- `sponsors 1..n sponsored_challenges`
- `sponsored_challenges 1..n challenge_participants` (optional linkage)
- `users 1..n forecast_confidence_data`

## Data Integrity Rules
- Keep projected and realized values separate:
  - projected: PC-related contribution/projection fields.
  - realized: Actual GCI and Deals Closed metrics.
- GP/VP logs must never write PC generation fields.
- Custom KPI logs are currency-neutral (no PC/GP/VP generation).
- Pipeline anchor updates must be timestamped and queryable over a relevance window.
- KPI log ingestion must preserve original event time for offline-sync events.
- Account deactivation retains data but suppresses active processing/visibility.

## Open Modeling Decisions to Finalize
- Idempotency key strategy for offline sync.
- Rule for retroactive effects when KPI definitions are edited.
- Snapshot vs. on-read recompute approach for dashboard aggregates.
