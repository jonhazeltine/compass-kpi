# M6 Realism Data Pack For UI Evaluation

## Purpose
Provide deterministic, repeatable seeded coaching runtime data so `/coach/*` and mobile coaching reads like product reality rather than placeholder shells.

Scope is backend seed/test data and docs alignment only. No UI layout edits.

## Command Runbook
Run from `/Users/jon/compass-kpi/backend`.

1. `npm run seed:coaching:realism:reset`
2. `npm run seed:coaching:realism`
3. `npm run seed:coaching:realism:smoke`

Notes:
- `seed:coaching:realism` performs deterministic reset + seed + endpoint smoke checks in one run.
- `seed:coaching:realism:smoke` is an explicit smoke alias for owner/dev runbooks.
- Default deterministic seed tag is `seed-m6-realism-ui-eval` and can be overridden with `COACHING_SAMPLE_SEED_TAG`.

## Seeded Personas
- Coach: primary operator for journeys and global coaching broadcasts.
- Team Leader: team/channel operator with team-scoped coaching visibility.
- Team Member: receives team/cohort/sponsor-thread coaching content.
- Solo User: non-team member with global journey + cohort visibility.
- Challenge Sponsor: sponsor-scoped channel/challenge visibility only; no team broadcast privilege.

## Dataset Coverage (Deterministic Baseline)
- `users`: 5 seeded auth/runtime personas.
- `team`: 1 seeded team.
- `challenge`: 1 team challenge.
- `journeys`: 4 total.
- `milestones`: 5 total.
- `lessons`: 10 total.
- `lesson_progress`: 10 rows spanning `not_started`, `in_progress`, `completed`.
- `channels`: 3 (`team`, `sponsor`, `cohort`).
- `channel_messages`: 13 with meaningful thread history.
- `sponsors`: 1.
- `sponsored_challenges`: 2 (`free`, `teams` tier visibility).
- `kpis`: 2 (active + inactive visibility examples).

## Endpoint Smoke Coverage
- `/api/coaching/journeys`
- `/api/coaching/journeys/{id}`
- `/api/coaching/progress`
- `/api/coaching/broadcast` (permission enforcement)
- `/api/channels`
- `/api/channels/{id}/messages` (`team`, `sponsor`, `cohort`)
- `/dashboard`
- `/sponsored-challenges`
- `/sponsored-challenges/{id}`

## Persona Visibility Assertions
- Coach sees seeded team + coach-owned + global journeys.
- Team Leader sees team-scoped journeys/channels and can broadcast to team scope.
- Team Member sees team + sponsor + cohort channels and mixed lesson statuses.
- Solo User sees global journeys and cohort membership channel only.
- Challenge Sponsor sees sponsor channel + sponsored challenge visibility, but team broadcast is blocked.

## Boundary Guardrails
- No net-new endpoint family.
- No schema changes.
- Sponsor remains sponsor-scoped (no team broadcast privilege and no sponsor KPI logging actions introduced by this pack).
