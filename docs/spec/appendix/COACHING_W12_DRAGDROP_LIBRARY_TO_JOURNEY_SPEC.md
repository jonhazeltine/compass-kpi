# W12 Drag/Drop Library-to-Journey Spec

## Purpose
Provide an implementation-ready spec for coach-portal authoring where content from Library is dragged into Journey Builder, with explicit UX behavior, data model needs, contract mapping, and phased delivery.

## Scope and Guardrails
- Docs/control-plane only.
- No net-new endpoint family.
- No schema-breaking changes in this assignment.
- Coach is primary authoring persona.
- Team Leader capabilities are team-scoped only (no org-wide authoring ownership).
- Challenge Sponsor is sponsor-scoped only.
- Sponsor has no KPI logging/edit actions.
- `/admin/coaching/audit` remains secondary governance/troubleshooting only.

## Target Surfaces
- Canonical workspace mode:
  - `/coach/journeys` (`Journeys` mode: Library tree/source pane + Journey Builder pane)
- People workspace companion mode:
  - `/coach/people` (`People` mode: People list + Cohorts/Channels split)
- Compatibility aliases only:
  - `/coach/library` -> `/coach/journeys` (open source-pane library context)
  - `/coach/uploads` -> `/coach/journeys` (open source-pane library context)
  - `/admin/coaching/uploads` -> `/coach/journeys` (open source-pane library context)
- Runtime validation surfaces:
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`

## UX Baseline (Intuitive/High-Signal)
- Direct manipulation first: drag cards, visible drop zones, insertion indicator, immediate visual confirmation.
- Folder/files first: Library is `Collections -> Assets` (folder -> files) with no duplicate Assets tab model.
- Folder behavior rules: collections allow nested assets with multi-expand support (multiple collections may stay expanded simultaneously).
- Low-friction layout: two-column Journey authoring (`source pane` + `journey builder`), not multi-pane duplication.
- Progressive disclosure: advanced controls hidden until item is selected.
- Fast confidence loops: builder action-bar `Save Draft` with explicit status chip (`idle`/`pending`/`saved`/`error`), undo affordance, and publish-readiness badge always visible.
- Clean boundaries: role-denied controls are visible but locked with clear reason text.
- Mandatory behavior: drag/drop interactions are required runtime behavior (asset<->collection, asset->lesson/task, reorder/remove), not placeholder states.

## Interaction Primitives Lock (Coach Portal)
- Buttons are for primary actions only (`Create New Journey`, `Save Draft`, `Publish`).
- Tabs/segmented controls are for section switching only (top-tab route sections + local builder section pivots).
- Menus are for secondary actions only (row/card overflow actions like rename, duplicate, archive, remove).
- List/row selection rules:
  - row/card selection opens detail context or marks selected state
  - row/card primary buttons execute direct action and must not duplicate selection-open behavior
  - bulk actions (if enabled later) are menu-driven from explicit multi-select state
- Scroll behavior rules:
  - one primary scroll container for each coach portal route
  - builder action bar remains sticky/visible while content scrolls
  - nested vertical scroll is avoided except constrained builder-canvas regions where drag and keyboard behavior must remain reliable

## UX Flow Map

```mermaid
flowchart LR
  A["Open /coach/journeys"] --> B["Select Journey Draft"]
  B --> C["Open 2-Column Builder or Create New Journey"]
  C --> D["Name Journey Draft"]
  D --> E["Browse Source Pane: Collections -> Assets"]
  E --> F["Drag Asset or Collection Item"]
  F --> G{"Valid Drop Zone?"}
  G -->|Yes| H["Drop into Milestone or Collection"]
  G -->|No| I["Reject Drop + Reason Chip"]
  H --> J["Reorder / Move / Remove"]
  J --> K["Save Draft from Builder Action Bar"]
  K --> L{"Publish Readiness Passes?"}
  L -->|Yes| M["Publish Journey"]
  L -->|No| N["Show Blocking Checks"]
  M --> O["Runtime Surfaces Consume Published Order"]
```

## Interaction State Matrix

| State | Trigger | UI Behavior | Persistence Impact | Error/Fallback |
|---|---|---|---|---|
| `drag_idle` | no active drag | cards static, handles visible on hover/focus | none | n/a |
| `drag_start` | pick up card | ghost card + origin highlight | none | cancel returns to `drag_idle` |
| `drag_hover_valid` | dragged item over compatible zone | drop zone glow + insertion line | none | n/a |
| `drag_hover_invalid` | dragged item over incompatible zone | red outline + reason chip | none | drop blocked |
| `drop_commit_collection` | release asset on collection target | asset assigned/moved in collection file list | staged draft op queued | failure moves to `save_error` |
| `drop_commit_journey` | release asset on lesson/task slot target | card inserted; builder animates to new order | staged draft op queued | failure moves to `save_error` |
| `reorder` | move within milestone or across milestones | positional swap animation + index badge update | staged draft op queued | conflict fallback to `draft_conflict` |
| `remove` | remove action on placed card | card fades out + undo toast | staged draft op queued | restore via undo if available |
| `save_pending` | action-bar `Save Draft` starts | status chip `Saving...` in builder action bar | sends draft ops batch | timeout -> `save_error` |
| `save_saved` | draft ops acknowledged | status chip `Saved` + timestamp in builder action bar | server draft version advanced | n/a |
| `save_error` | save request fails | inline error + retry CTA | no version advance | retry or refresh draft |
| `draft_conflict` | stale version/write race | blocking banner + diff/reload options | requires rebase/reload | preserve local op queue for retry |

## Required Frontend Data Model

```ts
export type ScopeType = 'org' | 'team' | 'sponsor';
export type LibraryItemType = 'lesson' | 'module' | 'template' | 'asset' | 'collection_item';

export interface LibraryItem {
  id: string;
  title: string;
  itemType: LibraryItemType;
  scopeType: ScopeType;
  scopeId: string | null;
  sponsorScoped: boolean;
  tags: string[];
  estimatedMinutes?: number;
  status: 'active' | 'archived';
  collectionId?: string | null;
}

export interface LibraryCollection {
  id: string;
  title: string;
  scopeType: ScopeType;
  scopeId: string | null;
  itemIds: string[];
  status: 'active' | 'archived';
}

export interface JourneyMilestoneBlock {
  blockId: string;
  libraryItemId: string;
  milestoneId: string;
  orderIndex: number;
  required: boolean;
}

export interface JourneyDraft {
  journeyId: string;
  draftVersion: number;
  milestones: Array<{
    milestoneId: string;
    title: string;
    blocks: JourneyMilestoneBlock[];
  }>;
  dirty: boolean;
  saveState: 'idle' | 'pending' | 'saved' | 'error' | 'conflict';
  publishReadiness: {
    status: 'ready' | 'blocked';
    checks: Array<{ code: string; severity: 'error' | 'warning'; message: string }>;
  };
}

export interface JourneyDraftOp {
  opId: string;
  type: 'add' | 'move' | 'reorder' | 'remove';
  blockId?: string;
  libraryItemId?: string;
  fromMilestoneId?: string;
  toMilestoneId?: string;
  toIndex?: number;
  actorRole: 'coach' | 'admin' | 'team_leader' | 'sponsor';
  clientTimestamp: string;
}

export interface ActionCapabilities {
  canComposeDraft: boolean;
  canPublish: boolean;
  canMoveAcrossScopes: boolean;
  denialReason?: string;
}
```

## API Contract Mapping (Existing)

| UX Need | Existing contract | Current fit |
|---|---|---|
| Journey read for builder baseline | `GET /api/coaching/journeys`, `GET /api/coaching/journeys/{id}` | partial (read exists; draft structure not explicit) |
| Runtime lesson progress | `POST /api/coaching/lessons/{id}/progress` | sufficient for runtime, not authoring |
| Context distribution after publish | `/api/channels*`, `POST /api/coaching/broadcast` | partial, publish integration not formalized |
| Sponsor context visibility | `GET /sponsored-challenges*` | partial, authoring link metadata not explicit |
| Coach assist copy (advisory only) | `/api/ai/suggestions*` | optional support for draft-copy suggestions |

## Explicit Contract Gaps (In-Family Only)

| Gap ID | Required capability | Proposed in-family extension | Rationale |
|---|---|---|---|
| G1 | Library payload normalized for `Collections -> nested Assets` drag sources | `GET /api/coaching/library` OR add `library_items` + `library_collections` to journey detail payload | Builder needs stable asset/collection metadata, hierarchy state, and scope labels |
| G2 | Draft operation writes for add/move/reorder/remove | `POST /api/coaching/journeys/{id}/draft/ops` | Deterministic operation-log model, auditable changes |
| G3 | Draft fetch with versioning | `GET /api/coaching/journeys/{id}/draft` | Required for conflict handling and resume |
| G4 | Publish readiness and publish action | `GET /api/coaching/journeys/{id}/publish-readiness`, `POST /api/coaching/journeys/{id}/publish` | Prevent invalid publish and keep checks server-authoritative |
| G5 | Action capability metadata by role/scope | `action_capabilities` additive object on coaching responses | Prevent client-side policy inference |

## Contract Boundary Notes
- All new authoring operations stay in `/api/coaching/*` family.
- No net-new endpoint family for drag/drop workflow.
- Runtime mobile/member surfaces consume published output only.
- Team Leader write scope remains own-team only.
- Sponsor remains read/link scoped with no KPI logging/edit routes.

## Role Gate Matrix

| Persona | Browse library | Drag/drop compose | Publish | KPI logging in this flow |
|---|---|---|---|---|
| Coach | yes | yes | yes | no |
| Admin operator | yes | governance-assist only | yes (policy-gated) | no |
| Team Leader | yes (team-scoped items) | team-scoped only (if enabled) | no org-wide authority | no |
| Challenge Sponsor | yes (sponsor scope) | no default draft authoring | no | no |

## Phased Build Plan

### Phase 1: MVP (functional drag/drop authoring)
- Builder shell on `/coach/journeys` with two-column layout (`source pane` + `journey builder`).
- Source pane follows folder/files IA (`Collections -> Assets`) with no duplicate Assets tab model.
- `Create New Journey` (blank + name) available in Journey Builder.
- Add/move/reorder/remove interactions plus asset<->collection and asset->lesson/task drag behavior.
- Action-bar `Save Draft` control with status model (`idle`, `pending`, `saved`, `error`) and retry path.
- Basic role-gated denied states.
- In-family contract slices: G1, G2, G3.

### Phase 2: Hardening (publish and policy confidence)
- Publish readiness panel with blocking checks.
- Server-authoritative publish endpoint integration.
- Conflict resolution UX (`draft_conflict`) and version recovery.
- In-family contract slices: G4, G5.

### Phase 3: Polish (sexy/intuitive finish)
- Refined motion timing for drag hover/drop/reorder.
- Keyboard parity polish and reduced-motion treatment.
- Multi-select bulk move and undo stack quality pass.
- Optional AI assist insertion for draft-copy only (`/api/ai/suggestions*`, advisory).

## Build Steps (Implementation Checklist)
1. Add builder information architecture contract for `/coach/library` + `/coach/journeys`.
   - Lock `Collections -> Assets` folder/files model.
   - Remove duplicate Assets tab framing from source model.
2. Implement frontend draft model and op queue (`JourneyDraft`, `JourneyDraftOp`).
3. Wire mandatory drag lifecycle (asset<->collection, asset->lesson/task, drag/hover/drop/reorder/remove) to queued draft ops and save states.
4. Enforce role/scope gates from `action_capabilities` (or temporary conservative client deny until available).
5. Add publish-readiness and publish action wiring.
6. Validate runtime result consistency on `coaching_journeys*` surfaces.

## Validation for This Assignment
- Route/surface alignment verified against:
  - `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`
  - `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`
- Contract boundary verified against:
  - `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- No new endpoint family required by this spec.
