# Mobile Team + Challenge Screen Map and Build Sequence

## Purpose
Create a single planning reference for mobile `Challenge` + `Team` screen buildout across the `M3 / M4 / M5` boundary so future implementation work:
- builds the right screens in the right order,
- uses the correct Figma references,
- preserves shared KPI logging mechanics,
- avoids one-screen-at-a-time thrash.

This is a planning/spec pass only (no runtime behavior changes).

## Inputs and constraints used
- Current architecture guardrails (`ARCHITECTURE.md`, `NON_NEGOTIABLES.md`, `CURRENT_SPRINT.md`)
- M3 completion IA guidance:
  - `/Users/jon/compass-kpi/docs/spec/appendix/M3_COMPLETION_PLAN_PRIORITY_CONTEXT_SURFACES.md`
- Product scope context:
  - `/Users/jon/compass-kpi/docs/spec/appendix/Master Spec.md`
- Current API surface:
  - `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`
- Figma traceability:
  - `/Users/jon/compass-kpi/design/figma/FIGMA_INDEX.md`
  - `/Users/jon/compass-kpi/docs/spec/appendix/FIGMA_BUILD_MAPPING.md`
- Current implementation baseline:
  - mobile `Challenge` and `Team` surfaces scaffolded inside `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`

## Canonical references (current known)
- Challenge details/progress root (locked for current correction work): `173-13190`
- Team dashboard / participation root (locked for current correction work): `388-8814`

Note:
- Repo Figma mapping is still incomplete for isolated Team/Challenge exports and node links in some places.
- Future UI parity passes should record exact frame path + export filename + node id in the prompt and report.

---

## 1) Screen Inventory (Mobile Team + Challenge Subsystem)

### Classification legend
- `Participation`: end-user/member logging/progress usage
- `Detail`: inspect progress/leaderboard/details for one entity
- `Management`: create/edit/admin/team-leader setup operations

### Screen inventory table

| Screen name | Purpose | Type | Likely sprint | Data dependency | Figma reference |
|---|---|---:|---|---|---|
| `Challenge Tab Surface (M3 transitional)` | M3 first-class challenge logging surface grouped by KPI type | Participation | `M3` | Existing dashboard payload + placeholder challenge relevance | Current impl in `KPIDashboardScreen.tsx`; not a final Figma screen |
| `Challenge List` | Browse active/upcoming/completed challenges | Participation | `M4` | `GET /challenges` exists | Figma challenge list variants in Challenge/Leaderboard groups (node IDs vary); canonical export still needed |
| `Challenge Details / Progress` | Primary challenge participation detail page (progress, timing, leaderboard preview, CTA) | Detail + Participation | `M4` (structure can be scaffolded late `M3`) | Placeholder-ok for layout; real challenge progress/leaderboard data needed for parity | **Locked root `173-13190`** |
| `Challenge Leaderboard (full)` | Expanded leaderboard standings and rank changes | Detail | `M4` | `GET /challenges` baseline leaderboard payload may be enough for v1; richer rank metrics may need response expansion later | Figma leaderboard frames (e.g. `Leaderboard` in Manage Challenge sets); exact canonical export pending |
| `Challenge Results` | Final/completed challenge results summary | Detail | `M4` | Challenge completion + leaderboard finalization data; likely needs explicit result payload shape if `GET /challenges` list summary is insufficient | Likely same challenge flow family as `173-13190`; canonical results export pending |
| `Join Challenge` | Join flow / challenge summary before participation | Participation | `M4` | `POST /challenge-participants` exists; `GET /challenges` detail/list data available | Figma `Join Challenge` frames present in inventory; canonical export pending |
| `Invite Friend / Teammates (Challenge)` | Invite others into challenge context | Participation (social) | `M4/M5` | Existing invite routes may be partial; no dedicated mobile invite API family should be assumed | Figma invite frames in challenge flow; canonical export pending |
| `Create Challenge Wizard` (solo/team) | Create custom challenge with KPI selection and duration | Management | `M4/M5` (tier-gated) | Backend support partly present (`/admin/challenge-templates` for admin, challenge participation exists), but mobile creation-specific payloads/flows may need clarified contract | Mapped in build docs as `challenge_create_wizard`; export pending |
| `Team Tab Surface (M3 transitional)` | M3 first-class team logging surface grouped by KPI type | Participation | `M3` | Existing dashboard payload + placeholder team relevance | Current impl in `KPIDashboardScreen.tsx`; not a final Figma screen |
| `Team Dashboard / Participation` | Team summary + participation hub (team performance, focus actions, team challenge links) | Participation + Detail | `M5` (structure can be scaffolded in `M3/M4`) | Placeholder-ok for shell; real team aggregates require `GET /teams/{id}` + likely dashboard/team aggregate payload composition | **Locked root `388-8814`** |
| `Team Member Details` | Drill into one team member’s status/progress/KPIs | Detail | `M5` | `GET /teams/{id}` gives membership but may not provide full member KPI dashboard detail; likely needs composed member detail response or reuse dashboard-style payload | Figma team member profile/detail frames present (e.g. `Sarah Johns` variants); canonical export pending |
| `Team Leaderboard / Team Challenge Standings` | Ranking view for team members/challenge performance | Detail | `M5` | May be partially derivable from team + challenge payloads, but likely needs explicit aggregate payloads for smooth mobile UX | Figma leaderboard/team challenge frames present; canonical export pending |
| `Team Challenges List` | Team-specific challenge list/filtering (upcoming/completed) | Participation + Detail | `M5` | Challenge list endpoint + team membership context likely sufficient for v1 filter, but payload shape may need richer grouping | Figma `Team Challenges` frames present; canonical export pending |
| `Team Invite Member` | Leader invite flow | Management | `M5` | `POST /teams/{id}/members` exists | Figma `Invite Member` frames present; canonical export pending |
| `Pending Invitations` | Leader/admin invitation state management | Management | `M5` | Existing team membership endpoints may not expose full pending invitation list shape; likely needs contract clarification | Figma `Pending Invitations` frames present; canonical export pending |
| `Team KPI Settings` | Leader sets team-relevant/mandatory KPIs | Management | `M5` | Existing `/teams` routes may be insufficient for KPI settings specifics; likely new/extended team config payload needed later | Figma `Team KPI Settings` frames present; canonical export pending |
| `Team Pipeline` | Team-level pipeline overview | Detail | `M5+` | Existing `GET /teams/{id}` likely insufficient for aggregated pipeline series/summary; new composed endpoint likely needed later | Figma `Pipeline` team frames present; canonical export pending |

### Scope classification summary

#### Build now / placeholder-safe (M3 continuation)
- `Challenge Tab Surface (M3 transitional)` (existing)
- `Team Tab Surface (M3 transitional)` (existing)
- Challenge details/progress shell scaffold (placeholder-backed) if explicitly approved

#### M4 challenge system (participation-first)
- `Challenge List`
- `Challenge Details / Progress`
- `Join Challenge`
- `Challenge Leaderboard`
- `Challenge Results`

#### M5 team management + collaboration
- `Team Dashboard / Participation`
- `Team Member Details`
- `Team Challenges List`
- `Team leaderboard/standings`
- Team invite/settings/pending flows

#### Later / dependency-heavy
- Team pipeline analytics page
- Rich invite/social permutations
- Sponsored challenge advanced variants (beyond baseline list/detail/join)

---

## 2) Recommended Build Sequence (Practical Order)

## Sequence goals
- Preserve `Home / Priority` as primary daily logging surface (`M3`)
- Get useful participation flows visible early
- Avoid blocking UI progress on backend contracts where placeholder shells are safe
- Delay management/admin-heavy team flows until `M5`

### Recommended order

### Phase A — Stabilize M3 role separation (now)
1. `Challenge` M3 surface role correction (details/progress-first or participation-first, depending approved page target)
2. `Team` M3 surface role correction (team participation-first)
3. `Activity / Logs` history/backfill role clarity (already in progress/landed in recent commits)
4. Cross-surface naming/layout consistency (no backend)

Why:
- Produces visible product clarity immediately
- Preserves logging mechanics while reducing IA confusion
- Sets the visual language before deeper challenge/team functionality lands

Placeholder-safe:
- Challenge/Team hero summaries
- progress/gauge placeholders
- leaderboard preview placeholders
- focus actions ordering placeholders

### Phase B — M4 challenge subsystem (functional flow)
1. `Challenge List`
2. `Challenge Details / Progress` (real data wiring pass)
3. `Join Challenge`
4. `Leaderboard` (full)
5. `Challenge Results`

Why:
- Unlocks end-user challenge participation loop end-to-end
- Aligns with existing challenge endpoints (`GET /challenges`, `POST /challenge-participants`)
- Provides owner-reviewable product value before team management complexity

Potential placeholder-safe in early M4:
- progress breakdown copy
- participant cards
- some leaderboard row decorations/animations

### Phase C — M5 team participation + management
1. `Team Dashboard / Participation` (real team aggregates)
2. `Team Member Details`
3. `Team Challenges List / standings`
4. `Invite Member`
5. `Pending Invitations`
6. `Team KPI Settings`

Why:
- Team screens depend on clearer team aggregation and membership management behavior
- Management flows should follow participation shell clarity, not precede it

### Phase D — Refinement and parity hardening
1. Challenge and Team parity pass 2 (visual/component parity)
2. Parity pass 3 (motion/polish)
3. Cross-surface reconciliation after real data wiring

---

## 3) Navigation Map (Simple, Mobile)

## Current M3 mental model (locked direction)
- `Home / Priority` = primary daily logging
- `Challenge` = challenge context + challenge-relevant logging
- `Team` = team context + team-relevant logging
- `Activity / Logs` = history/backfill/corrections

## Recommended navigation flow map (target state)

### Primary loop
- `Home / Priority`
  - tap challenge CTA/tab -> `Challenge`
  - tap team CTA/tab -> `Team`
  - tap activity/logs tab -> `Activity / Logs`

### Challenge flow
- `Challenge` (M3 transitional surface OR M4 Challenge List, depending build stage)
  - if list view: tap challenge row/card -> `Challenge Details / Progress`
  - from details:
    - tap leaderboard preview -> `Challenge Leaderboard`
    - tap join/participate CTA -> join action / challenge participation state
    - optional invite action -> `Invite Friend / Teammates`
    - challenge KPI logging section remains in details or links to embedded logging panel
  - completed challenge -> `Challenge Results`

### Team flow
- `Team`
  - team summary cards/challenge area -> `Team Challenges` / `Challenge Details`
  - member row -> `Team Member Details`
  - leaderboard preview -> `Team Leaderboard / Standings`
  - leader actions -> `Invite Member` / `Pending Invitations` / `Team KPI Settings`

### Activity / Logs flow
- `Activity / Logs`
  - date nav -> same screen (selected-day context)
  - pipeline check-in CTA -> pipeline overlay/editor
  - backfill logging grid -> same screen (selected-day log writes)
  - correction/delete entry points -> same screen or modal

---

## 4) Figma Parity Correction Plan (by prioritized screen)

## Parity pass definitions
- `Pass 1: Structural parity`
  - Screen anatomy, hierarchy, section order, major blocks, CTA placement
- `Pass 2: Visual/component parity`
  - Typography scale, spacing cadence, shell language, card/header/pill styles, density
- `Pass 3: Motion/polish parity`
  - Entrance animation cadence, transitions, micro-feedback, finishing details (only after behavior is stable)

### Priority screens and parity plan

### A. Challenge Details / Progress (`173-13190`)
- `Pass 1`
  - Rebuild page anatomy to challenge details/progress structure (nav, title, hero progress, participant summary, metadata rows, leaderboard preview, CTA block)
  - Move or subordinate challenge KPI logging blocks
- `Pass 2`
  - Match gauge/hero composition, spacing rhythm, typography hierarchy, leaderboard card stacking
  - Align CTA styling/order with Figma
- `Pass 3`
  - Add progress gauge animation, rank change transitions, card reveal cadence (only if behavior remains stable)

### B. Team Dashboard / Participation (`388-8814`)
- `Pass 1`
  - Rebuild to team dashboard anatomy (team summary hero, member summary/performance blocks, challenge/leaderboard preview, action areas)
  - Keep team KPI logging accessible but not mis-typed as the entire page
- `Pass 2`
  - Align metrics cards, chart/summary modules, list density, CTA hierarchy to Figma
- `Pass 3`
  - Add transitions/animations for rank/performance updates if payload + UX are stable

### C. Challenge List
- `Pass 1`
  - Structural list segmentation (active/upcoming/completed/sponsored as applicable), challenge cards, filter tabs
- `Pass 2`
  - Card states, badges, progress snippets, sponsor differentiation parity
- `Pass 3`
  - Motion polish for list filters/progress animations

### D. Team Member Details
- `Pass 1`
  - Structural detail anatomy (member header, KPI summary, challenge progress modules, actions)
- `Pass 2`
  - Card/layout density + chart/list styling parity
- `Pass 3`
  - Micro-transitions and polish

### E. Challenge Leaderboard / Results
- `Pass 1`
  - Structural leaderboard/results sections, ranking rows, top-3 highlights, CTA placement
- `Pass 2`
  - Visual stacking, badges, typography parity
- `Pass 3`
  - Rank animation/polish

---

## 5) Dependency Mapping (Implementation-facing)

## Existing endpoints usable now / soon
- `GET /dashboard`
  - Current M3 challenge/team surfaces use dashboard payload for loggable KPIs + activity + projection context
  - Good for placeholder-backed challenge/team logging surfaces
- `GET /challenges`
  - Foundation for challenge list + participation summaries + baseline leaderboard preview
- `POST /challenge-participants`
  - Join challenge flow
- `GET /teams/{id}`
  - Team membership + basic details (sufficient for early team shell scaffolding, not necessarily full dashboard aggregates)
- `POST /teams`, `POST /teams/{id}/members`
  - Team creation/member management primitives (leader flows)

## Likely needs clarified/expanded contracts later (do not implement yet)
- Team dashboard aggregate payload (team-wide KPI/projection summaries for mobile parity)
- Team member detail payload with dashboard-like KPI snapshots
- Dedicated challenge detail/result payload if `GET /challenges` list summary is too thin
- Team invitations read models (pending invite list/status)
- Team KPI settings/config payloads for leader workflows

## Placeholder-safe seams (recommended)
- Challenge progress % / pace label / gauge values
- Team performance summary cards
- Leaderboard preview top-3
- Team focus action ordering
- CTA labels that imply future routes

---

## 6) Guardrails for Future Team/Challenge UI Prompts (Reusable)

Use this checklist in every future Team/Challenge mobile UI prompt.

### Prompt guardrails checklist
1. `Dashboard lock`
   - State explicitly whether `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx` Home/Priority changes are approved.
   - Default: `Home/Priority locked`.
2. `Exact Figma references required`
   - Provide frame name/path + node id(s) + export filename(s).
   - If export is missing, require a reference-acquisition step first.
3. `Mismatch list before coding`
   - Require top 5-10 mismatches tied to the exact reference.
   - Must include anatomy/hierarchy, spacing, shell style, CTA placement.
4. `No generic polish rule`
   - Changes must map to listed mismatches.
   - Reject untargeted “polish” that drifts scope.
5. `Behavior freeze`
   - Preserve logging mechanics, haptics/audio/tap timing unless the prompt explicitly reopens behavior.
6. `Scope fences`
   - State exactly which surfaces are in scope (`Challenge only`, `Team only`, or both).
7. `Validation requirement`
   - Require simulator/phone screenshot(s) of the actual target surface before commit.
8. `Report back structure`
   - Figma ref used
   - mismatches
   - what changed
   - what now matches
   - what still differs/deferred
   - behavior checks
   - validation

### Suggested prompt suffix (copyable)
- `Home/Priority locked unless explicitly approved`
- `Use exact Figma frame(s): <node ids>`
- `List top mismatches before coding`
- `Do not do generic polish`
- `Provide screenshot of the target surface before commit`

---

## 7) Recommended next planning-to-build handoff

### Immediate next move (recommended)
1. Lock canonical Challenge and Team isolated exports in repo (`FIGMA_INDEX` + `FIGMA_BUILD_MAPPING`)
2. Run `Challenge Details / Progress` structural parity pass (Pass 1) using `173-13190`
3. Review/accept before Team rebuild
4. Run `Team Dashboard / Participation` structural parity pass (Pass 1) using `388-8814`
5. Run cross-surface reconciliation pass (Challenge/Team only)

### Why this reduces thrash
- Defines target page types before styling iterations
- Separates participation/detail pages from management flows
- Keeps M3 logging mechanics intact while preparing clean M4/M5 UI sequencing

---

## Review notes
- This document is intended to be reviewed before the next Team/Challenge implementation pass.
- If the chosen Figma references change, update this file first (screen inventory + build sequence + parity plan rows).
