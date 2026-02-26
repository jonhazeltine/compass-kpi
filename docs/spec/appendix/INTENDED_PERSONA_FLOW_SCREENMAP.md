# Intended Persona Flow Screenmap (Figma-First)

## Purpose
Create a single reference for what the app is intended to contain, organized by **persona** and **flow**, using Figma as the primary source of truth.

This document is the planning/control-plane companion to:
- `/Users/jon/compass-kpi/docs/spec/appendix/FIGMA_BUILD_MAPPING.md`
- `/Users/jon/compass-kpi/design/figma/FIGMA_INDEX.md`

Use this for:
- worker prompt scoping (`persona + flow + screen`)
- implementation sequencing
- gap tracking (`implemented` vs `stub` vs `missing`)
- avoiding guessed UI work

## Maintenance Rule (Required)
This doc and `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md` must be updated **in the same change set** whenever any of the following changes:
- a screen is added/removed/renamed
- screen status changes (`⚪/🔵/🟡/🟢/🔴`)
- wiring status or intended transitions change
- persona access to a screen changes

## Organizing Model (Required)
We do **not** treat Team Leader / Team Member / Solo User as separate apps.

We use:
1. **Shared product flows** (Onboarding, Dashboard/KPI, Challenge, Team, Profile, Settings/Payment)
2. **Persona variants / access** (Solo User, Team Member, Team Leader)

This allows one canonical screen target per destination, with persona-specific deltas tracked explicitly.

## Status Legend (Standard)
Use the same status scheme as `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`.

- `⚪ missing` = not started / not implemented in runtime
- `🔵 implemented` = MVP complete (working baseline)
- `🟡 partial` = framed/existing but not parity-complete or missing behavior
- `🟡 stub` = navigable placeholder/shell exists
- `🟢 production_ready` = production-ready implementation
- `🔴 blocked` = blocked/broken (use only for active regressions/blockers)

## Personas
- `Solo User`
- `Team Member`
- `Team Leader`

## Canonical Shared Flows
- `onboarding`
- `dashboard_kpi`
- `challenge`
- `team`
- `profile`
- `settings_payment`

## Current Priority Rule (Controller)
Current forward-progress priority:
1. `Team Leader / team` flow parity (dashboard + management screens)
2. `Team Member / challenge+team participation` parity
3. `Solo User / challenge` parity tightening
4. cross-persona reconciliation

## Figma Canonical References (currently locked for active Team work)
- `team_dashboard`: node `173-29934` (corrected canonical; prior `388-8814` was a profile screen mismatch)
- `team_invite_member`: node `173-4448`
- `team_pending_invitations`: node `173-4612`
- `team_kpi_settings`: node `173-4531`
- `team_pipeline`: node `168-16300`
- `team_single_person_challenges`: node `173-4905`

Exports in repo:
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_dashboard_v1.png`
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_invite_member_v1.png`
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_pending_invitations_v1.png`
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_kpi_settings_v1.png`
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_pipeline_v1.png`
- `/Users/jon/compass-kpi/design/figma/exports/screens/team_single_person_challenges_v1.png`

## Persona Flow Registry (Intended)

### Team Leader

#### `onboarding`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Onboarding flow | leader setup + KPI/pipeline baseline + optional team create/join branch | `Team Leader / Onboarding` | `🟡 partial` | Runtime onboarding exists as shared flow with `teamMode` + branch screens. |
| Team code branch | Join existing team during onboarding | `Team Leader / Onboarding` | `🟡 partial` | Runtime branch screen exists (`teamCode`). |
| Invite teammate branch | Invite teammate during onboarding | `Team Leader / Onboarding` | `🟡 partial` | Runtime branch screen exists (`inviteFriend`). |

#### `dashboard_kpi`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Dashboard & KPI | Primary daily logging and KPI cockpit | `Team Leader / Dashboard and KPI` | `🔵 implemented` | Implemented in `KPIDashboardScreen.tsx`; ongoing parity and IA refinement. |
| Challenge tab (leader perspective) | Challenge participation/management entry | `Team Leader / Manage Challenge...` + challenge groups | `🟡 partial` | Challenge subflow exists (`list/details/leaderboard`) and is functional, parity incomplete. |
| Team tab (leader perspective) | Team dashboard + management entry + Team Logging | `Team Leader / Manage Team` | `🟡 partial` | Dashboard+route-shell work in progress; parity program active. |

#### `team`
| Destination | Figma node | Export | Runtime status | Wiring status | Notes |
|---|---:|---|---|---|---|
| Team Dashboard | `173-29934` | `team_dashboard_v1.png` | `🟡 partial` | `🟢 wired` | Team dashboard parity implemented in Team sub-router; Team Logging remains below dashboard. |
| Invite Member | `173-4448` | `team_invite_member_v1.png` | `🟡 partial` | `🟢 wired` | Team sub-router screen implemented with parity-first placeholder data; dashboard CTA wired. |
| Pending Invitations | `173-4612` | `team_pending_invitations_v1.png` | `🟡 partial` | `🟢 wired` | Team sub-router screen implemented with parity-first placeholder data; dashboard CTA wired. |
| Team KPI Settings | `173-4531` | `team_kpi_settings_v1.png` | `🟡 partial` | `🟢 wired` | Team sub-router screen implemented with parity-first placeholder data; dashboard CTA wired. |
| Pipeline | `168-16300` | `team_pipeline_v1.png` | `🟡 partial` | `🟢 wired` | Team sub-router screen implemented with parity-first placeholder data; dashboard CTA wired. |
| Single Person Challenges / Team Challenges | `173-4905` | `team_single_person_challenges_v1.png` | `🟡 partial` | `🟢 wired` | Team sub-router screen implemented with parity-first placeholder data as `team_challenges`; dashboard CTA wired. |

#### `challenge`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Create Team Challenge | Team challenge creation wizard | `Team Leader / Create Team Challenge` | `⚪ missing` | Not yet implemented in runtime mobile flow. |
| Manage Challenge & Leaderboard | Leader challenge management/results/leaderboard | `Team Leader / Manage Challenge & Lead...` | `🟡 partial` | Challenge list/details/leaderboard exists but not fully leader-specific parity. |
| Sponsored Challenges | Sponsored challenge variants | `Team Leader / Sponsored Challenges` | `⚪ missing` | Not implemented as dedicated runtime flow. |

#### `profile`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Profile / Profile settings | Leader account/profile settings | `Team Leader / Profile` | `🟡 partial` | Runtime `ProfileSettingsScreen` exists; parity incomplete. |

#### `settings_payment`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Other Settings and Payment | settings, legal, support, payment/subscription | `Team Leader / Other Settings and Payment` | `🟡 partial` | Mixed coverage; runtime profile/settings screens are limited. |

### Team Member

#### `onboarding`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Onboarding flow | Shared onboarding with join/create/solo branching | `Team Member / Onboarding` | `🟡 partial` | Shared onboarding runtime exists; persona-specific parity varies. |

#### `dashboard_kpi`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Dashboard & KPI | Primary KPI logging surface | `Team Member / Dashboard and KPI` | `🔵 implemented` | Shared runtime surface exists. |
| Team challenge participation entry | See team challenges and progress | `Team Member / See Team Challen...` and challenge groups | `🟡 partial` | Team/challenge surfaces exist but parity and role distinctions are incomplete. |

#### `team`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Team dashboard (member perspective) | View team performance + member role-appropriate actions | `Team Member / See Team Challen...` | `🟡 partial` | Runtime Team tab exists; leader/member distinctions not fully modeled yet. |
| Team challenge list/detail | Participate in team challenges | `Team Member / Challenge & ...` | `🟡 partial` | Transitional routing exists via Team/Challenge surfaces. |

#### `profile`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Profile | Member profile/settings | `Team Member / Profile` | `🟡 partial` | Shared runtime profile screen exists. |

#### `settings_payment`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Other Settings | Settings subset | `Team Member / Other Settings` | `🟡 partial` | Not fully separated in runtime; covered partially by profile/settings. |
| Other Settings and Payment | Payment/subscription/settings | `Team Member / Other Settings and Payment` | `🟡 partial` | Shared settings/payment concepts, no dedicated parity-complete flow yet. |

### Solo User

#### `onboarding`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Onboarding flow (solo path) | Shared onboarding with `solo` branch | `Solo User / Onboarding` | `🟡 partial` | Runtime onboarding supports `teamMode='solo'`. |

#### `dashboard_kpi`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Dashboard & KPI | Primary KPI cockpit and logging | `Solo User / Dashboard and KPI` | `🔵 implemented` | Shared runtime KPI dashboard exists. |

#### `challenge`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Manage/Run Challenge | Solo challenge participation/results | `Solo User / Manage/Run Challenge` | `🟡 partial` | Runtime Challenge flow list/details/leaderboard exists; parity tightening ongoing. |
| Create Challenge | Solo challenge creation | `Solo User / Create Challenge` | `⚪ missing` | Not wired in runtime mobile flow (CTA currently placeholder-labeled). |
| Subscription challenge variants | gated challenge experiences | `Solo User / Sub...` | `⚪ missing` | Not implemented. |

#### `profile`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Profile | Solo profile/settings | `Solo User / Profile` | `🟡 partial` | Runtime `ProfileSettingsScreen` exists. |

#### `settings_payment`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Other Settings and Payment | Settings/payment/legal/support | `Solo User / Other Settings and Payment` | `🟡 partial` | Shared settings coverage incomplete. |

## Shared Runtime Router Map (Current Implementation Anchor)
Use this to map intended screens to current code constraints.

### App shell
- `/Users/jon/compass-kpi/app/App.tsx`
  - unauthenticated -> `AuthFlowScreen`
  - authenticated member -> `HomeScreen`
  - authenticated admin web -> `AdminShellScreen`

### Member shell
- `/Users/jon/compass-kpi/app/screens/HomeScreen.tsx`
  - `KPIDashboardScreen`
  - `ProfileSettingsScreen`

### KPI Dashboard internal routers
- `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`
  - bottom tabs: `home`, `challenge`, `newkpi`, `team`, `user(coming next)`
  - challenge subflow: `list`, `details`, `leaderboard`
  - team subflow: `dashboard`, `invite_member`, `pending_invitations`, `kpi_settings`, `pipeline`, `team_challenges`

## Forward Progress Build Order (Controller)
1. Team Leader `team.dashboard` parity + route wiring (`Chunk A`)
2. Team Leader `team.invite_member` + `team.pending_invitations`
3. Team Leader `team.kpi_settings` + `team.pipeline`
4. Team Leader `team.team_challenges`
5. Team Member perspective deltas on Team/Challenge surfaces
6. Solo User challenge parity pass
7. Cross-persona cleanup/reconciliation

## Prompting Rule (for all future workers)
Every implementation prompt must identify:
- Persona
- Flow
- Screen(s)
- Canonical Figma node IDs + export filenames
- Expected wiring transitions
- Out-of-scope personas/flows

Do not assign work as generic “polish Team” or “fix challenge screen.”

## Sync Update Rule (Enforcement)
When a worker changes screen availability, routing, or completion status, they must update both:
1. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
2. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

These updates should be in the same commit as the implementation change (or in an immediately paired docs commit in the same PR/branch slice).
