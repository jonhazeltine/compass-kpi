# W12 Drag/Drop Library-to-Journey Spec

## Purpose
Define an implementation-ready authoring UX and build map for drag/drop journey composition using existing Compass route/contract families, with explicit in-family contract gaps called out.

## Scope and Guardrails
- Docs/control-plane only.
- No net-new endpoint family.
- No schema-breaking change in this assignment.
- Preserve role boundaries:
  - Coach is primary journey author.
  - Team Leader upload rights are team-scoped only.
  - Challenge Sponsor access is sponsor-scoped only.
  - Sponsor has no KPI logging actions.
- `/admin/coaching/audit` remains secondary governance/troubleshooting only.

## Route Targets
- Coach portal foundation/canonical routes:
  - `/coach/library`
  - `/coach/journeys`
  - `/coach/uploads`
  - `/coach/cohorts`
  - `/coach/channels`
- Runtime read-only consumption routes:
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`

## Existing Contract Families (Allowed)
- `/api/coaching/journeys*`
- `/api/coaching/progress`
- `/api/coaching/lessons/{id}/progress`
- `/api/channels*`
- `/api/messages/*`
- `/api/coaching/broadcast`
- `/api/ai/suggestions*` (advisory only)
- `/sponsored-challenges*` (sponsor visibility context only)
- `/dashboard` (summary badges/context only)

## Authoring UX Spec (Drag/Drop)

### Surface Model
- Primary surface: `/coach/journeys`.
- Supporting source surface: `/coach/library` (asset catalog and filters).
- Authoring mode: `Journey Builder` panel in `/coach/journeys/{journeyId}/edit` (or equivalent in current state-router implementation).

### Layout
- Left rail: Library list with filters (`type`, `topic`, `duration`, `scope`, `sponsor-linked`).
- Center: Journey timeline canvas grouped by milestone.
- Right rail: Selected item properties and publish-readiness checks.

### Core Interactions
1. Drag library item onto milestone drop zone to add lesson/content block.
2. Drag block within milestone to reorder.
3. Drag block across milestones to re-sequence.
4. Multi-select + bulk move (same destination milestone only).
5. Remove block (soft remove in draft state).

### Keyboard/Accessibility Contract
- Every drag action has keyboard parity:
  - `Pick up` (space/enter), `Move` (arrow keys), `Drop` (space/enter), `Cancel` (esc).
- Every drop zone exposes textual state:
  - `can_drop`, `cannot_drop` with reason chip.
- Reduced-motion mode disables animated drag previews and uses static insertion markers.

### Mobile Parity Contract
- No mobile drag gesture required for W12.
- Mobile coach/runtime parity uses action-sheet fallback:
  - `Add to milestone`
  - `Move up/down`
  - `Move to milestone`
- Member mobile routes remain read-only for authored structure.

## Build Map (Implementation Ready)

| Slice | Surface | Persona | UX outcome | Contract dependency | Lane |
|---|---|---|---|---|---|
| B1 | `/coach/library` list rows | Coach, Team Leader (team scope), Sponsor (scope-limited) | Draggable library cards with scope badges | existing read from coaching family; gap for normalized library read | Admin web |
| B2 | `/coach/journeys` builder canvas | Coach primary | Milestone drop zones + reorder handles + draft save states | in-family write gaps under `/api/coaching/journeys*` | Admin web |
| B3 | Role-gate denied states | Team Leader, Sponsor | Team/sponsor scope denies with clear reason chips | existing authz + scope metadata; gap for explicit action-availability fields | Backend + Admin web |
| B4 | Publish handoff preview | Coach, Admin operator | Draft diff + publish readiness checks | in-family publish/readiness gaps in coaching family | Backend + Admin web |
| B5 | Runtime verification | Team Leader, Team Member, Solo User, Sponsor | Authored order appears in `coaching_journeys*` read surfaces | existing `GET /api/coaching/journeys*` outputs; additive fields if needed | Mobile + Backend |

## Contract Mapping (Current vs Needed)

### Works Today (No Family Expansion Needed)
- Journey read/consumption:
  - `GET /api/coaching/journeys`
  - `GET /api/coaching/journeys/{id}`
- Lesson progress writes (member runtime):
  - `POST /api/coaching/lessons/{id}/progress`
- Channel/broadcast follow-up notifications after publish:
  - `/api/channels*`, `/api/coaching/broadcast`

### Explicit Gaps (In-Family Extensions Required)

| Gap ID | Needed for drag/drop authoring | Suggested in-family contract extension | Notes |
|---|---|---|---|
| G1 | Library source payload normalized for builder | `GET /api/coaching/library` or additive `library_items` include on `GET /api/coaching/journeys/{id}` | Same coaching family; includes `scope_type`, `scope_id`, `item_type`, `duration_estimate`, `is_sponsor_scoped` |
| G2 | Draft block add/remove/move writes | `POST /api/coaching/journeys/{id}/draft/ops` with op list (`add`, `move`, `remove`, `reorder`) | Keep operation-log semantics for deterministic replay and rollback |
| G3 | Draft retrieval with sequence metadata | `GET /api/coaching/journeys/{id}/draft` | Returns milestone-block ordered structure and validation flags |
| G4 | Publish action and readiness validation | `POST /api/coaching/journeys/{id}/publish` and `GET /api/coaching/journeys/{id}/publish-readiness` | Coach/Admin only; blocks publish if scope/authz rules fail |
| G5 | Role-aware action-availability metadata | Add `action_capabilities` object to journey/library responses | Avoid client policy inference for team-leader/sponsor restrictions |

## Contract Boundary Notes
- All authoring write paths remain within `/api/coaching/*` family.
- No new chat/messaging family for authoring operations.
- Sponsor scope is read/link visibility only unless explicit sponsor-authoring policy is later approved.
- Team Leader authoring remains limited to team-scoped upload/link actions; no org-wide ownership.
- Runtime surfaces consume published artifacts only; runtime does not mutate draft structures.

## Role Gate Matrix (Authoring)

| Persona | Library browse | Drag/drop compose | Publish journey | KPI logging actions |
|---|---|---|---|---|
| Coach | yes | yes | yes | no |
| Admin operator | yes | governance-only (optional) | yes (governance override) | no |
| Team Leader | team-scoped only | team-scoped only (if enabled) | no org-wide publish authority | no |
| Challenge Sponsor | sponsor-scoped browse/link only | no default draft-authoring ownership | no | no |

## UI State Contracts
- `draft_dirty`: unsaved drag/drop operations present.
- `draft_saving`: in-flight ops batch.
- `draft_conflict`: version mismatch; requires refresh/merge.
- `publish_blocked`: readiness checks failed.
- `publish_ready`: all required checks passed.

These states must be returned or derivable from in-family contract outputs and not inferred from local-only heuristics.

## Acceptance Checklist

### Admin lane
- `/coach/journeys` supports drag/drop add/move/remove with keyboard parity.
- Role-gated denied states exist for Team Leader out-of-scope actions.
- Sponsor cannot access draft-authoring affordances.

### Backend lane
- In-family draft ops contract enforces authz and scope (`coach/admin/team-scope` only).
- Operation order is deterministic and auditable.
- No endpoint-family expansion beyond `/api/coaching/*`.

### Mobile lane
- Runtime consumption renders published sequence consistently.
- Mobile fallback actions exist for coach-authoring parity where drag is unavailable.
- No sponsor KPI logging action appears in any authored-content flow.

## Build Sequencing Recommendation
1. Ship G1 + G3 read contracts (library + draft fetch).
2. Ship G2 draft ops writes with operation-log semantics.
3. Ship builder UI drag/drop + keyboard parity on `/coach/journeys`.
4. Ship G4 publish-readiness + publish action.
5. Validate runtime rendering on `coaching_journeys*` and sponsor/team-leader boundaries.

## Validation for This Assignment
- Verified route/surface alignment against:
  - `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`
  - `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`
- Verified contract-family boundary against:
  - `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Verified no new endpoint family is required by this spec.
