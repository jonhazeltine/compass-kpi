# Intended Wiring Diagram (Persona + Flow)

## Purpose
Provide a high-level wiring diagram for the **intended app navigation and flow structure**, organized by persona and aligned to Figma flow groupings.

This is a planning diagram, not a literal runtime router definition.

Use with:
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FIGMA_BUILD_MAPPING.md`

## Key Principles
- Organize by **persona perspective** (`Solo User`, `Team Member`, `Team Leader`)
- Reuse **shared flows/screens** where possible
- Track persona-specific deltas at the screen/CTA level, not by forking the app architecture
- Current runtime implementation is state-driven (not React Navigation), so this diagram describes **intended behavior**

## Global App Entry (Current + Intended)

```mermaid
flowchart TD
  A["App Shell"] --> B{"Authenticated?"}
  B -- "No" --> C["Auth Flow"]
  B -- "Yes + web admin surface" --> D["Admin Shell"]
  B -- "Yes + member surface" --> E["Member Home Shell"]

  C --> C1["Welcome"]
  C1 --> C2["Projection Intro"]
  C2 --> C3["Measure Intro"]
  C3 --> C4["Onboarding Flow"]
  C4 --> C5["Login / Forgot"]
  C5 --> E

  E --> E1["KPI Dashboard (member app shell)"]
  E --> E2["Profile / Goals"]
```

## Persona Model (Intended)

```mermaid
flowchart LR
  P["Shared Product Flows"] --> S1["Onboarding"]
  P --> S2["Dashboard & KPI"]
  P --> S3["Challenge"]
  P --> S4["Team"]
  P --> S5["Profile"]
  P --> S6["Settings & Payment"]

  U1["Solo User"] --> S1
  U1 --> S2
  U1 --> S3
  U1 --> S5
  U1 --> S6

  U2["Team Member"] --> S1
  U2 --> S2
  U2 --> S3
  U2 --> S4
  U2 --> S5
  U2 --> S6

  U3["Team Leader"] --> S1
  U3 --> S2
  U3 --> S3
  U3 --> S4
  U3 --> S5
  U3 --> S6
```

## Member App Shell (Intended)

This maps to the current `KPIDashboardScreen` state router and its nested subflows.

```mermaid
flowchart TD
  H["Member Home Shell"] --> K["KPI Dashboard Surface"]
  H --> P["Profile / Goals"]

  K --> T1["Home / Priority"]
  K --> T2["Challenge"]
  K --> T3["New KPI (future/limited)"]
  K --> T4["Team"]
  K --> T5["User (future)"]

  T2 --> C1["Challenge List"]
  C1 --> C2["Challenge Details / Progress"]
  C2 --> C3["Challenge Leaderboard / Results"]
  C3 --> C2
  C2 --> C1

  T4 --> TD["Team Dashboard"]
  TD --> TI["Invite Member"]
  TD --> TP["Pending Invitations"]
  TD --> TK["Team KPI Settings"]
  TD --> TPL["Team Pipeline"]
  TD --> TC["Team Challenges / Single Person Challenges"]
  TD --> TL["Team Logging (shared KPI logging block)"]

  TI --> TD
  TP --> TD
  TK --> TD
  TPL --> TD
  TC --> TD
```

## Team Leader Perspective (Intended)

Primary implementation focus right now.

```mermaid
flowchart TD
  L["Team Leader"] --> LD["Dashboard & KPI"]
  L --> LT["Manage Team"]
  L --> LC["Challenge Management"]
  L --> LP["Profile"]
  L --> LS["Other Settings & Payment"]

  LD --> LDT["Team Dashboard (leader variant)"]
  LDT --> LTI["Invite Member"]
  LDT --> LTP["Pending Invitations"]
  LDT --> LTK["Team KPI Settings"]
  LDT --> LTPipe["Pipeline"]
  LDT --> LTC["Team Challenges"]

  LC --> LCC["Create Team Challenge"]
  LC --> LCM["Manage Challenge & Leaderboard"]
  LC --> LCS["Sponsored Challenges"]
```

## Team Member Perspective (Intended)

Focuses on participation and visibility, with fewer management controls.

```mermaid
flowchart TD
  M["Team Member"] --> MD["Dashboard & KPI"]
  M --> MT["See Team Challenges / Team Stats"]
  M --> MC["Challenge Participation"]
  M --> MP["Profile"]
  M --> MS["Other Settings / Payment"]

  MT --> MTD["Team Dashboard (member variant)"]
  MTD --> MTC["Team Challenges"]
  MTD --> MPipe["Pipeline / Team Stats (read-first)"]
  MTD --> MLog["Team Logging (shared KPI logging block)"]

  MC --> MCL["Challenge List"]
  MCL --> MCD["Challenge Details"]
  MCD --> MCB["Leaderboard / Results"]
```

## Solo User Perspective (Intended)

Team management routes are excluded; challenge flow remains central.

```mermaid
flowchart TD
  S["Solo User"] --> SD["Dashboard & KPI"]
  S --> SC["Manage/Run Challenge"]
  S --> SCP["Create Challenge"]
  S --> SP["Profile"]
  S --> SS["Other Settings & Payment"]

  SC --> SCL["Challenge List"]
  SCL --> SCD["Challenge Details / Progress"]
  SCD --> SCB["Leaderboard / Results"]
```

## Team Flow Canonical Screen Wiring (Current Active Parity Program)

Use these exact references for active Team implementation work:

| Screen | Canonical node | Export | Current runtime status |
|---|---:|---|---|
| Team Dashboard | `173-29934` | `team_dashboard_v1.png` | `partial` (active parity chunk) |
| Invite Member | `173-4448` | `team_invite_member_v1.png` | `stub` |
| Pending Invitations | `173-4612` | `team_pending_invitations_v1.png` | `stub` |
| Team KPI Settings | `173-4531` | `team_kpi_settings_v1.png` | `stub` |
| Pipeline | `168-16300` | `team_pipeline_v1.png` | `stub` |
| Single Person Challenges / Team Challenges | `173-4905` | `team_single_person_challenges_v1.png` | `stub` |

## Current Runtime Router Reality (Implementation Constraint)

The current member app does not use a formal navigation library for these flows. It uses state routers in:
- `/Users/jon/compass-kpi/app/screens/HomeScreen.tsx`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`

Current nested routing state:
- bottom tabs: `home`, `challenge`, `newkpi`, `team`, `user`
- challenge subflow: `list`, `details`, `leaderboard`
- team subflow: `dashboard`, `invite_member`, `pending_invitations`, `kpi_settings`, `pipeline`, `team_challenges`

## Next Diagram Update Trigger
Update this doc whenever:
- a new Team or Challenge screen becomes navigable
- a canonical Figma node changes
- persona-specific deltas become explicit in runtime (leader vs member variants)
- the app moves from state-router navigation to a formal navigator

