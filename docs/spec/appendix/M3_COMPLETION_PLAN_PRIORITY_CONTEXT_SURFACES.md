# M3 Completion Plan — Priority Surface + Context-Based KPI Logging

## Purpose
Lock the current M3 completion direction so implementation can continue with minimal interruptions while `M3b` polish proceeds.

This plan resolves KPI overlap across:
- user-selected KPIs,
- personal challenge KPIs,
- team KPIs,
- team challenge KPIs,

without duplicating KPI definitions or creating multiple logging mechanics.

## Status (2026-02-25)
- `planned / implementation guidance`
- Intended to guide M3 completion work after and alongside active `M3b` polish
- This is not a runtime code change by itself

## Core Model (Locked)

### 1) KPI identity is unified
- Users log **KPI events**, not challenge events or team events.
- Challenge/team systems subscribe to KPI logs and award progress/credit.
- The same KPI may appear in multiple screens/surfaces, but it is the same action and writes the same type of log.

### 2) Type remains the primary behavioral dimension
- KPI `type` (`PC`, `GP`, `VP`, `Actual`, `Pipeline_Anchor`, `Custom`) remains core because it drives engine behavior and user mental model.
- Do not replace type grouping with context grouping.

### 3) Context is a secondary overlay
- Context examples:
  - `personal`
  - `challenge`
  - `team`
  - `team_challenge`
  - `required`
  - `lagging`
- Context changes visibility/priority/badges, not the KPI’s underlying identity or logging behavior.

## Information Architecture (Target for M3 Completion)

### Home (Daily Cockpit)
- Primary daily logging surface.
- Type-based panels remain:
  - `Priority` (replaces `Quick`)
  - `Projections` (`PC`)
  - `Growth` (`GP`)
  - `Vitality` (`VP`)
- KPI tiles can carry context badges.
- Strongest `M3b` game-feel polish remains concentrated here first.

### Challenge (First-Class Logging Surface)
- Full challenge KPI logging surface with challenge progress context.
- Shows challenge-relevant KPIs grouped by type.
- Same KPI tile component and log action as Home.

### Team (First-Class Logging Surface)
- Full team/team-challenge KPI logging surface with team context and team-required emphasis.
- Shows team-relevant KPIs grouped by type.
- Same KPI tile component and log action as Home.

### Activity / Logs (Rewrite of current log screen)
- Historical date navigation
- Backfill logging
- Edit/delete/corrections
- Recent activity review
- Not the primary daily logging destination

### Reports / Predictions
- Projection detail, confidence, trend review
- Pipeline status visibility and entry points into pipeline check-in/edit flows

## Priority Panel (Replaces Quick) — M3 Decision

### Definition
`Priority` is a system-curated set of KPI tiles that surfaces what matters now. It is not a user-only static quick-pick list.

### Priority panel design rules (v1)
- Limited visible slots (keep current footprint; do not expand Home grid to absorb all contexts)
- Fast logging interactions remain equivalent to current quick log behavior
- Tiles may overlap with type panels and Challenge/Team surfaces (same KPI identity)

### Priority ranking inputs (v1, deterministic)
1. Team challenge KPI behind pace
2. Personal challenge KPI behind pace
3. Team-required KPI stale/missing
4. Pipeline counts missing/stale
5. Personal KPI off-goal / low recent activity
6. User favorites / selected KPI fallback fill

## Overlap / Dedupe Rules (Must-Haves)

### Same KPI across multiple surfaces
- Allowed and expected (Home, Challenge, Team)
- Must render as the same KPI identity and same action
- Logging once should update all relevant contexts (challenge/team/personal progress)

### Same KPI within the same surface
- Must be deduped by KPI ID
- If multiple contexts apply, merge badges on one tile

### User feedback on overlap crediting
- Post-log success feedback should indicate multi-context credit where applicable (for example: challenge and team progress updated)

## Surface-specific grouping rules (Locked)
- `Home`: panel-driven by type (`Priority`, `PC`, `GP`, `VP`)
- `Challenge`: filter by challenge membership, then group by type within the screen
- `Team`: filter by team/team-challenge relevance, then group by type within the screen
- Do not use a giant mixed KPI list as the default on Challenge/Team surfaces

## Daily Pipeline Check-In (M3 Must-Have)

### Why
Current pipeline counts (pending listings + buyers under contract) are forecast-critical inputs and currently easy to ignore.

### Placement (v1)
- First app open of the day: full-screen, dismissible `Daily Pipeline Check-In` overlay
- `Activity / Logs`: explicit entry point to reopen and edit current pipeline counts
- `Reports / Predictions`: optional entry point to pipeline check-in/edit (no persistent nag required)

### Trigger examples (v1)
- First app open of the day (show at most once per day unless manually reopened)
- Missing pipeline counts
- Stale pipeline counts beyond configured recency threshold
- Optional later enhancement: post-log contextual prompt after likely pipeline-changing KPI logs

### UX language (locked direction)
- Use agent-facing language:
  - `Update your pipeline`
  - `Pending listings`
  - `Buyers under contract`
- Avoid internal terms in UI copy:
  - `pipeline anchor`
  - `anchor`

### Daily overlay flow (v1)
1. Show current counts in fast stepper-style inputs (`-` / count / `+`)
2. Save updated counts as current pipeline status (rolling values)
3. If a count decreases vs previous saved value, prompt for reason:
   - `Deal closed`
   - `Deal lost`
   - `Just correcting my count`
4. If `Deal closed`, route into close detail capture (GCI + close date)
5. If `Deal lost`, show a short randomized encouragement message
6. Overlay is dismissible and can be reopened later from `Activity / Logs`

## Implementation Strategy (Low-Interruption / Long-Tail Checkpoints)

This sequence is designed to avoid blocking `M3b` polish and to produce visible value in small slices.

### M3-G1: Context Tile Metadata + Badge Rendering (Low interruption)
- Add context overlay model to tile render data (badges/tags/required flags)
- Render badges on existing Home type panels
- No new screens yet
- No change to logging endpoint behavior

**Checkpoint outcome:** overlap becomes visible without changing dashboard IA

### M3-G2: `Quick` → `Priority` Surface Rename + v1 Ranking
- Rename panel label and player-facing copy from `Quick` to `Priority`
- Introduce deterministic priority ranking (v1)
- Keep current panel size/layout to avoid animation/layout churn

**Checkpoint outcome:** Home reflects what matters now, not only a static quick set

### M3-G3: Daily Pipeline Check-In Overlay (First open of day)
- Add once-per-day, dismissible full-screen pipeline check-in overlay
- Use simple count entry for:
  - pending listings
  - buyers under contract
- Add decrease follow-up branch (`closed` / `lost` / `correction`)
- Add `Activity / Logs` entry point to reopen/edit counts
- Avoid persistent Home dashboard nags in v1

**Checkpoint outcome:** forecast-critical pipeline counts are captured at a high-probability moment without crowding the Home dashboard

### M3-G4: Challenge Screen (Functional-first logging surface)
- Add first-class Challenge screen with challenge KPI logging
- Group challenge KPIs by type
- Reuse shared KPI tile action/feedback
- Animation polish can be reduced relative to Home

**Checkpoint outcome:** challenge KPI logging is first-class and not relegated to overflow

### M3-G5: Team Screen (Functional-first logging surface)
- Add first-class Team screen for team/team-challenge KPI logging
- Group team-relevant KPIs by type
- Reuse shared KPI tile action/feedback

**Checkpoint outcome:** team obligations are visible and actionable without overloading Home

### M3-G6: Activity/Logs Screen Rewrite (Role clarification)
- Reframe current log screen as `Activity` / `Logs & History`
- Emphasize history, backfill, corrections, and review
- De-emphasize daily quick logging loop

**Checkpoint outcome:** cleaner mental model across Home vs History

### M3-G7: Cross-surface consistency + overlap credit UX
- Finalize dedupe rules and badge consistency across Home/Challenge/Team
- Add post-log multi-context credit messaging
- Validate no duplicate KPI tiles within a single surface

**Checkpoint outcome:** overlap behaves as a feature, not a source of confusion

## M3 Completion Criteria (Practical)
M3 is considered complete enough when:
- Home supports fast daily logging with a functional `Priority` panel
- Challenge and Team each provide first-class logging surfaces
- KPI overlap is visible, deduped, and non-confusing
- Activity/Logs supports history/backfill/corrections as a separate role
- Daily pipeline check-in overlay exists and drives current pipeline count updates
- Type-based behavior separation (`PC/GP/VP/...`) remains preserved across all surfaces

## Scope Boundary / Deferrals
- Full animation parity across Challenge/Team surfaces can be deferred beyond initial functional release
- Richer priority scoring (weights/ML/coaching personalization) is deferred; use deterministic v1 ranking
- Deep challenge/team screen visual polish can roll into later M4/M7 work as needed

## Implementation Notes for Agents
- Prefer additive changes over rewrites in early gates (`M3-G1` to `M3-G3`), but `M3-G3` may replace prior dashboard nag experiments
- Keep KPI tile interaction plumbing shared across surfaces to avoid timing drift
- Do not create separate logging APIs or context-specific log writes
- Preserve non-negotiables:
  - PC vs Actual separation
  - GP/VP never generating PC
  - confidence display-only
  - pipeline anchors (user-facing: pipeline counts) remain explicit forecast inputs
