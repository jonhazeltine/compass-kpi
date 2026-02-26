# Intended Wiring Diagram (Persona + Flow)

## Purpose
Provide a high-level wiring diagram for the **intended app navigation and flow structure**, organized by persona and aligned to Figma flow groupings.

This is a planning diagram, not a literal runtime router definition.

Use with:
- `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/FIGMA_BUILD_MAPPING.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_CAPABILITY_AND_PERSONA_MATRIX.md`
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`

## Key Principles
- Organize by **persona perspective** (`Solo User`, `Team Member`, `Team Leader`)
- Reuse **shared flows/screens** where possible
- Track persona-specific deltas at the screen/CTA level, not by forking the app architecture
- Model coaching as a cross-cutting capability layer (embedded modules + dedicated flows)
- Current runtime implementation is state-driven (not React Navigation), so this diagram describes **intended behavior**

## Visual Status Legend (Node + Wiring)

Node color meanings (for key screens/modules in diagrams below), using a conventional delivery-status palette:
- `⚪` Not started / not existing yet (intended only)
- `🔵` MVP complete (working, usable baseline)
- `🟡` Framed/existing (partial, stub, or parity pending)
- `🟢` Production ready
- `🔴` Blocked / broken (reserved for regressions or active blockers)

Wiring line meanings:
- `-->` solid arrow = successful/currently wired (or validated route shell)
- `-.->` dashed arrow = intended/planned wiring (not fully implemented)

```mermaid
flowchart LR
  A["🔵 MVP Complete"] --> B["Solid = wired"]
  C["🟢 Production Ready"] --> D["Dashed = planned/intended"]
  E["🟡 Framed / Existing"]
  F["⚪ Not Started / Missing"]
  G["🔴 Blocked / Broken"]

  classDef mvp fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
  classDef prod fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
  classDef framed fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px;
  classDef missing fill:#f3f4f6,stroke:#9ca3af,color:#111827,stroke-width:2px;
  classDef blocked fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;
  class A mvp;
  class C prod;
  class E framed;
  class F missing;
  class G blocked;
```

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
  P --> S7["Coaching / Communication (cross-cutting)"]

  U1["Solo User"] --> S1
  U1 --> S2
  U1 --> S3
  U1 --> S5
  U1 --> S6
  U1 --> S7

  U2["Team Member"] --> S1
  U2 --> S2
  U2 --> S3
  U2 --> S4
  U2 --> S5
  U2 --> S6
  U2 --> S7

  U3["Team Leader"] --> S1
  U3 --> S2
  U3 --> S3
  U3 --> S4
  U3 --> S5
  U3 --> S6
  U3 --> S7
```

## Coaching / Communication Overlay (Intended)

Coaching is a capability layer across Team, Challenge, Home, and Profile, plus new dedicated flows.

```mermaid
flowchart TD
  CC["Coaching / Communication Layer"] --> CC1["Inbox / Channels (dedicated)"]
  CC --> CC2["Coaching Journeys (dedicated)"]
  CC --> CC3["Embedded Coaching Modules"]

  CC3 --> CC3A["Home / Priority nudges"]
  CC3 --> CC3B["Team Dashboard coaching summary / broadcast preview"]
  CC3 --> CC3C["Challenge Details coaching + sponsor campaign blocks"]
  CC3 --> CC3D["Profile / goals / coaching prefs"]

  CC1 --> CCT["Team channel"]
  CC1 --> CCC["Challenge channel"]
  CC1 --> CCS["Sponsor channel"]
  CC1 --> CCB["Broadcast composer (leader/admin role-gated)"]

  CC2 --> J1["Journey list"]
  CC2 --> J2["Journey detail"]
  CC2 --> J3["Lesson detail / progress"]
```

## Member App Shell (Intended)

This maps to the current `KPIDashboardScreen` state router and its nested subflows.

```mermaid
flowchart TD
  H["Member Home Shell"] --> K["KPI Dashboard Surface"]
  H --> P["Profile / Goals"]
  H -.-> I["Inbox / Channels (future dedicated flow)"]

  K --> T1["Home / Priority"]
  K --> T2["Challenge"]
  K -.-> T3["New KPI (future/limited)"]
  K --> T4["Team"]
  K -.-> T5["User (future)"]

  T2 --> C1["Challenge List"]
  C1 --> C2["Challenge Details / Progress"]
  C2 --> C3["Challenge Leaderboard / Results"]
  C2 -.-> C4["Challenge Channel / Updates (future)"]
  C2 -.-> C5["Sponsor Coaching CTA / Content (when sponsored)"]
  C3 --> C2
  C2 --> C1

  T4 --> TD["Team Dashboard"]
  TD --> TI["Invite Member"]
  TD --> TP["Pending Invitations"]
  TD --> TK["Team KPI Settings"]
  TD --> TPL["Team Pipeline"]
  TD --> TC["Team Challenges / Single Person Challenges"]
  TD -.-> TComm["Team Channel / Broadcast (future)"]
  TD -.-> TCoach["Team Coaching Summary (embedded)"]
  TD --> TL["Team Logging (shared KPI logging block)"]

  TI --> TD
  TP --> TD
  TK --> TD
  TPL --> TD
  TC --> TD

  classDef mvp fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
  classDef prod fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
  classDef framed fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px;
  classDef missing fill:#f3f4f6,stroke:#9ca3af,color:#111827,stroke-width:2px;

  class H,K,T1,T2,C1,C2,C3 mvp;
  class P,T4,TD,TI,TP,TK,TPL,TC,TL framed;
  class I,T3,T5,C4,C5,TComm,TCoach missing;
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
  LDT -.-> LB["Broadcast Composer / Team Channel"]
  LDT -.-> LJP["Team Coaching Progress / Journey entry"]

  LC -.-> LCC["Create Team Challenge"]
  LC --> LCM["Manage Challenge & Leaderboard"]
  LC -.-> LCS["Sponsored Challenges"]
  LCS -.-> LSC["Sponsor Campaign / Coaching Content Overlays"]

  classDef mvp fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
  classDef prod fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
  classDef framed fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px;
  classDef missing fill:#f3f4f6,stroke:#9ca3af,color:#111827,stroke-width:2px;

  class LD,LC,LP,LS,LDT,LCM framed;
  class LTI,LTP,LTK,LTPipe,LTC framed;
  class LB,LJP,LCC,LCS,LSC missing;
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
  MTD -.-> MJP["My Coaching Progress / Lesson prompt"]
  MTD --> MLog["Team Logging (shared KPI logging block)"]

  MC --> MCL["Challenge List"]
  MCL --> MCD["Challenge Details"]
  MCD --> MCB["Leaderboard / Results"]
  MCD -.-> MCC["Challenge Channel / Updates"]

  classDef mvp fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
  classDef prod fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
  classDef framed fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px;
  classDef missing fill:#f3f4f6,stroke:#9ca3af,color:#111827,stroke-width:2px;

  class MD,MC,MCL,MCD,MCB mvp;
  class MT,MTD,MTC,MPipe,MLog,MP,MS framed;
  class MJP,MCC missing;
```

## Solo User Perspective (Intended)

Team management routes are excluded; challenge flow remains central.

```mermaid
flowchart TD
  S["Solo User"] --> SD["Dashboard & KPI"]
  S --> SC["Manage/Run Challenge"]
  S -.-> SCP["Create Challenge"]
  S --> SP["Profile"]
  S --> SS["Other Settings & Payment"]

  SC --> SCL["Challenge List"]
  SCL --> SCD["Challenge Details / Progress"]
  SCD --> SCB["Leaderboard / Results"]
  SCD -.-> SCN["Solo coaching prompt / sponsored content block"]

  classDef mvp fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px;
  classDef prod fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
  classDef framed fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px;
  classDef missing fill:#f3f4f6,stroke:#9ca3af,color:#111827,stroke-width:2px;

  class SD,SC,SCL,SCD,SCB mvp;
  class SP,SS framed;
  class SCP,SCN missing;
```

## Sponsored Challenge + Coaching Overlap (Intended)

This is a deliberate overlap and should be implemented as linked modules, not a merged ownership model.

```mermaid
flowchart LR
  SCH["Sponsored Challenge"] --> SCP["Challenge Participation / Progress"]
  SCH --> SCM["Sponsor Metadata + CTA + Disclaimer"]
  SCH --> SCC["Sponsor/Challenge Channel (optional)"]
  SCH --> SCL["Coaching Content / Journey Link (optional)"]

  SCP --> KPI["KPI Logging (single source of activity truth)"]
  SCL --> CJ["Coaching Journeys / Lessons"]
  SCC --> INB["Inbox / Channels"]
```

## Team Flow Canonical Screen Wiring (Current Active Parity Program)

Use these exact references for active Team implementation work:

| Screen | Canonical node | Export | Current runtime status |
|---|---:|---|---|
| Team Dashboard | `173-29934` | `team_dashboard_v1.png` | `🟡 partial` (active parity chunk) |
| Invite Member | `173-4448` | `team_invite_member_v1.png` | `🟡 stub` |
| Pending Invitations | `173-4612` | `team_pending_invitations_v1.png` | `🟡 stub` |
| Team KPI Settings | `173-4531` | `team_kpi_settings_v1.png` | `🟡 stub` |
| Pipeline | `168-16300` | `team_pipeline_v1.png` | `🟡 stub` |
| Single Person Challenges / Team Challenges | `173-4905` | `team_single_person_challenges_v1.png` | `🟡 stub` |

## Current Runtime Router Reality (Implementation Constraint)

The current member app does not use a formal navigation library for these flows. It uses state routers in:
- `/Users/jon/compass-kpi/app/screens/HomeScreen.tsx`
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`

Current nested routing state:
- bottom tabs: `home`, `challenge`, `newkpi`, `team`, `user`
- challenge subflow: `list`, `details`, `leaderboard`
- team subflow: `dashboard`, `invite_member`, `pending_invitations`, `kpi_settings`, `pipeline`, `team_challenges`

Coaching/communication runtime routing is not yet established in the member app shell and should follow the destination naming and boundaries in `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`.

## Next Diagram Update Trigger
Update this doc whenever:
- a new Team or Challenge screen becomes navigable
- a canonical Figma node changes
- persona-specific deltas become explicit in runtime (leader vs member variants)
- coaching/communication destinations or embedded module entry points are added
- the app moves from state-router navigation to a formal navigator
