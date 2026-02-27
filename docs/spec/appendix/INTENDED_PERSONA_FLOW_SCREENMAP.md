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
- `Coach` (authoring/ops persona; admin-web extension or hybrid portal, manual-spec-driven)
- `Challenge Sponsor` (distinct sponsor persona; sponsor-scoped comms/content/KPI visibility, no KPI logging)

## Canonical Shared Flows
- `onboarding`
- `dashboard_kpi`
- `challenge`
- `team`
- `coaching_communication`
- `coach_ops_authoring` (manual-spec-driven portal/admin extension planning)
- `sponsor_ops_portal` (manual-spec-driven sponsor-scoped portal companion planning)
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

#### `coaching_communication`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Priority coaching nudge (embedded) | Lightweight coaching reminder / journey CTA allocation | `manual-spec-driven (COACHING_* docs)` | `🟡 stub` | W1 placeholder CTA shell added in KPI Dashboard Home; runtime package visibility fallback banner now shown when entitlement outcomes are absent. |
| Team Dashboard coaching summary + broadcast preview (embedded) | Leader coaching summary + role-gated broadcast entry point | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W2 wires leader Team Dashboard updates CTA to team-scoped `inbox_channels` and role-gated broadcast composer entry context; runtime package visibility banner/fallback added and CTA disable is reserved for explicit server gated/blocked outcomes. |
| Team-Scoped Content Upload (portal companion) | Upload team-scoped coaching assets/content inputs for own team context only | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | W7 portal companion scope only: Team Leader can upload content in team scope; no org-wide authoring ownership and no sponsor-scoped package authority. |
| Inbox / Channels | Leader comms hub (team/challenge/sponsor channels) | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W4 adds API-backed `GET /api/channels`, thread reads/sends (`GET/POST /api/channels/{id}/messages`), and mark-seen (`POST /api/messages/mark-seen`) with scoped filtering/fallbacks. Runtime package visibility banners/fallback states now surface missing entitlement outcomes. |
| Broadcast Composer (role-gated) | Compose/send team or scoped coaching broadcast | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W4 leader-only send path wired via `/api/channels/{id}/broadcast` with UI role gating + API error handling; package visibility gating banners are UI-only until explicit entitlement outcomes are returned. |
| Coaching Journeys | Journey list/detail/lesson progress destination | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W3 adds API-backed journey list/detail rendering and explicit lesson progress actions on `coaching_journeys*`; runtime package visibility banners/fallback states now expose entitlement contract gaps without local policy inference. |
| Sponsored challenge coaching overlays (embedded) | Sponsor CTA + coaching link modules on challenge detail | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W2 routes challenge/sponsor updates CTA into scoped `channel_thread` shell context; challenge ownership remains separate from coaching content/messaging. |

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

#### `coaching_communication`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Priority coaching nudge (embedded) | Lightweight coaching reminder / lesson/journey prompt allocation | `manual-spec-driven (COACHING_* docs)` | `🟡 stub` | W1 placeholder Home CTA shell added; no coaching content payload wiring. |
| Team Dashboard member coaching progress (embedded) | Coaching progress snapshot + updates entry | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W2 wires Team Member updates CTA to team-scoped `inbox_channels`; runtime package visibility banner/fallback added while participant visibility remains server-enforced. |
| Challenge Details coaching + updates (embedded) | Challenge channel/update CTA + coaching content prompt | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W2 routes challenge updates CTA directly to scoped `channel_thread` shell context (`challenge`/`sponsor`); challenge coaching block now surfaces package fallback/gating copy without changing challenge ownership. |
| Inbox / Channels | Member communication inbox and channels | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W4 adds API-backed channel list/thread read/send + mark-seen behavior on documented channel endpoints; runtime package visibility banners/fallback states now surface missing entitlement outcomes while participant permissions remain server-enforced. |
| Coaching Journeys | Journey and lesson progress destination | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W3 adds API-backed journey list/detail rendering and explicit lesson progress actions on `coaching_journeys*`; runtime package visibility banners/fallback states now surface contract gaps while participant visibility remains server-enforced. |

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
| Create Challenge (sponsored-routed only, if enabled) | Solo challenge creation entry must route via sponsored challenge flow; no generic standalone solo create destination | `Solo User / Create Challenge` | `⚪ missing` | Generic solo challenge creation should not be modeled as a primary runtime destination. If supported later, route via `Sponsored Challenges` flow with sponsor/policy gating. |
| Subscription challenge variants | gated challenge experiences | `Solo User / Sub...` | `⚪ missing` | Not implemented. |

#### `coaching_communication`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Home / Priority coaching nudge (embedded) | Lightweight solo coaching reminder / journey CTA allocation | `manual-spec-driven (COACHING_* docs)` | `🟡 stub` | W1 placeholder Home CTA shell added; runtime package visibility fallback banner now shown when entitlement outcomes are absent. |
| Challenge Details coaching / sponsor content block (embedded) | Sponsor/challenge coaching CTA or content link module | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W2 routes challenge updates CTA into scoped `channel_thread` shell context (challenge/sponsor) while keeping challenge payload ownership separate; package fallback/gating copy now highlights sponsored-vs-paid runtime boundary. |
| Inbox / Channels (scoped) | Solo comms inbox/channel entry (challenge/sponsor/community scoped) | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W4 adds API-backed channel list/thread read/send + mark-seen behavior where membership exists; runtime package visibility banners/fallback states now surface missing entitlement outcomes, with no team-admin/broadcast controls exposed for solo flows. |
| Coaching Journeys | Solo journey/lesson progress destination | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W3 adds API-backed journey list/detail rendering and explicit lesson progress actions on `coaching_journeys*`; runtime package visibility banners/fallback states now surface contract gaps while solo scope visibility remains server-enforced. |

#### `profile`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Profile | Solo profile/settings | `Solo User / Profile` | `🟡 partial` | Runtime `ProfileSettingsScreen` exists. |

#### `settings_payment`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Other Settings and Payment | Settings/payment/legal/support | `Solo User / Other Settings and Payment` | `🟡 partial` | Shared settings coverage incomplete. |

### Coach

Coach is an authoring/ops persona for coaching content and publishing. In current planning, Coach is modeled as a role-gated admin-web extension (or hybrid portal) rather than a member runtime persona.

Coach portal host recommendation (planning, manual-spec-driven):
- near-term: `Admin Shell extension` (recommended)
- later option: `hybrid coach portal` if route/workflow complexity justifies a separate shell (`decision needed` during implementation)

W9 dedicated experience direction (planning lock):
- final coach portal UX is a dedicated coach experience (outside admin-shell presentation patterns)
- during migration, `/admin/coaching/*` remains transition-host foundation for capability continuity and authz controls
- primary coach navigation should be planned toward dedicated coach workspace IA, with admin host routes treated as transitional infrastructure

#### `coach_ops_authoring`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Library Upload Intake (within Coach Content Library) | Upload/import coaching assets and sponsor-approved campaign media from Library top-tab intake controls | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Upload capability is subsumed under `coach_content_library` (not a standalone coach tab). Coach/Admin primary; Team Leader upload actions remain team-scoped only (no org-wide authoring ownership, no sponsor package authority); no KPI logging/edit actions. |
| Coach Content Library | Manage/categorize coaching content assets, collections, journeys, lessons, and templates | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Portal/admin touchpoint (`coach_content_library`) is explicitly `Assets + Collections` (uploads intake included in Library, not a standalone tab). Coach/Admin primary with optional sponsor-scoped read/link access for sponsor campaign contexts only. Authoring/curation only, not member runtime delivery UI, and no sponsor KPI logging actions. |
| Journey Authoring Studio | Compose/edit journey structure, create new journeys, and run draft lifecycle controls | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Portal/admin touchpoint (`coach_journey_authoring`) includes `Create New Journey` (blank + naming), mandatory drag/drop assignment interactions, and builder action-bar `Save Draft` with explicit status model (`idle`, `pending`, `saved`, `error`). No runtime journey rendering ownership. |
| Cohorts / Audience Segments | Manage targeting cohorts/segments (including non-team individuals) for coach/sponsor delivery planning | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Portal foundation surface (`cohorts`); complements runtime cohort-channel participation and targeting, not challenge participation ownership. |
| Channel Operations / Comms Hub (portal) | Coach communications hub for scoped channel context, templates, moderation cues, and coach/sponsor comms prep for runtime-linked channels | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | `/coach/channels` now renders coach comms-hub runtime baseline in `CoachPortalScreen` (channel roster + scoped context copy). Deep moderation/template lifecycle and publish-linked controls remain follow-up work. No KPI logging actions. |
| Publishing & Targeting | Publish bundles, define audiences, link channels/challenges, schedule activation | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Portal/admin touchpoint (`coach_publish_targeting`); handoff produces delivery assignments for runtime surfaces. |
| Coaching Packages / Entitlements | Configure team/sponsored/paid coaching package visibility and access policy | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Portal/admin touchpoint (`coach_packages_entitlements`); packaging/access layer, not content authoring. |
| Coach Ops Audit / Approvals | Approvals, rollback, moderation, audit trail review for coaching publishing actions | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | Admin shell extension route `/admin/coaching/audit` now provides approval-first AI suggestion moderation queue + audit detail companion surface (UI-first/stub-safe, no send/publish execution actions). |

#### `coach_ops_authoring` route grouping (portal planning)
| Route group (provisional) | Host surface | Persona access | Runtime status | Notes |
|---|---|---|---|---|
| `admin/coaching/uploads` | `Admin Shell extension` (compatibility alias only) | Coach, Admin operator, Team Leader (team-scoped uploads only), Challenge Sponsor (limited sponsor campaign uploads) | `⚪ missing` | Not a first-class coach tab. Route should resolve to Library upload intake (`admin/coaching/library` or `/coach/library`) and preserve scope restrictions (Team Leader own-team only; sponsor sponsor-scoped only). |
| `admin/coaching/library` | `Admin Shell extension` (recommended) | Coach, Admin operator, Challenge Sponsor (limited sponsor-scoped library access/linking only) | `⚪ missing` | Maps to `coach_content_library` with `Assets + Collections` IA; sponsor scope is campaign-limited and does not grant canonical authoring ownership or KPI logging actions. |
| `admin/coaching/authoring` | `Admin Shell extension` (recommended) | Coach | `⚪ missing` | Maps to `coach_journey_authoring`. |
| `admin/coaching/cohorts` | `Admin Shell extension` (recommended) | Coach, Admin operator, Challenge Sponsor (limited sponsor cohorts) | `⚪ missing` | W7 foundation surface for `cohorts`; supports non-team individual cohort targeting visibility. |
| `admin/coaching/channels` | `Admin Shell extension` (recommended) | Coach, Admin operator, Challenge Sponsor (limited sponsor scopes) | `🟡 partial` | Compatibility route now resolves to canonical `/coach/channels` comms-hub runtime baseline; advanced ops controls remain follow-up implementation. |
| `admin/coaching/publishing` | `Admin Shell extension` (recommended) | Coach, Admin operator, Challenge Sponsor (limited sponsor scopes) | `⚪ missing` | Maps to `coach_publish_targeting`; publish/target/schedule/link handoff. |
| `admin/coaching/packages` | `Admin Shell extension` (recommended) | Admin operator, Coach (limited), Challenge Sponsor (limited sponsor scopes) | `⚪ missing` | Maps to `coach_packages_entitlements`; packaging/entitlement policy ops. |
| `admin/coaching/audit` | `Admin Shell extension` (recommended) | Admin operator | `🟡 partial` | Maps to `coach_ops_audit`; approval-first AI moderation queue + audit detail companion UI implemented in admin shell (`AdminShellScreen.tsx`). |

#### `coaching_communication`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Broadcast Composer (coach scope, role-gated) | Compose/send scoped coaching broadcasts within approved channel/package context | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Coach runtime send path is `decision needed` pending `DEP-003` ownership model + portal/runtime routing split; do not assume member-app availability. |
| Coach inbox/channels oversight (optional later) | Monitor/respond in assigned coaching channels (not member chat parity) | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | Coach portal `/coach/channels` now provides comms-hub runtime oversight baseline; unified inbox/thread moderation workflows remain follow-up implementation. |

#### `coaching_ai_assist` (approval-first, manual-spec-driven)
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| AI Assist Draft Request / Review (runtime companion shell) | Generate/edit AI suggestion drafts from approved coaching surfaces before any send/publish action | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W5 UI shell proto adds approval-first AI draft request/review modal + approved insert-point CTAs (`channel_thread`, `coach_broadcast_compose`, `coaching_lesson_detail`, `coaching_journeys*`, Team/Challenge coaching modules). Advisory only: no KPI writes, no auto-send/publish. |
| AI Suggestion Approval Queue (coach/admin portal) | Review/approve/reject pending AI suggestions by scope/policy | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | Admin shell extension `coach_ops_audit` now includes sortable queue list + approve/reject UI workflow (approval-first, queue-only actions, no autonomous send/publish). |
| AI Suggestion Audit Detail (coach/admin portal) | Inspect suggestion history, approvals/rejections, and execution linkage refs | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | Admin shell extension `coach_ops_audit` now includes audit detail/history rendering with disclaimers/safety flags and linkage refs (stub-safe local data until backend queue shaping lands). |

#### `coaching_notifications` (W6 readiness, manual-spec-driven)
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Coaching Notification Banner / Badge States (member runtime) | Surface assignment/reminder/message/access-change signals on Home/Team/Challenge/`coaching_journeys*` without requiring inbox open | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W6 member runtime now renders in-app banner/badge states on Home/Team/Challenge/`coaching_journeys*` + `coaching_lesson_detail` using in-family notification read-models where present and UI fallbacks otherwise. Notification taps are route-only; no side-effect writes from notification display. |
| Coaching Notification Inbox Rows (member runtime companion to `inbox*`) | Render coaching notification list rows with route targets, context labels, and read states | `manual-spec-driven (COACHING_* docs)` | `🟡 partial` | W6 member runtime now renders `inbox`/`inbox_channels`/`channel_thread` notification rows and badges using additive shaping from existing `channels/messages` + `coaching` families plus safe fallback synthesis; push delivery remains placeholder only. |
| Coaching Notification Preferences (profile/settings) | Per-class/per-channel coaching notification toggles and mute windows (UI shell first) | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Persistence host family is `decision needed` (`/me` additive fields vs notifications family). |
| Ops Notification Queue Visibility (coach/admin portal companion) | View notification queue summaries/dispatch outcomes/policy alerts relevant to coaching + AI moderation ops | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Prefer `coach_ops_audit`/admin extension visibility companion first; no dispatch authority widening. |

### Challenge Sponsor

Challenge Sponsor is a distinct persona for sponsored challenge funding/campaign operations and sponsor-scoped coaching communications. Sponsors are not KPI loggers. They may receive sponsor-scoped content/channel tools and read-only visibility into challenge member KPIs as policy allows.

#### `sponsor_ops_portal`
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Sponsor Content Upload (scoped, via Library) | Upload sponsor campaign assets/media for sponsored coaching/challenge experiences from sponsor-scoped Library intake | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Sponsor upload is a scoped Library capability, not a standalone uploads tab; approval/policy gated and no KPI logging/edit actions. |
| Sponsor Content Library (scoped) | Access sponsor-scoped content assets/library entries for sponsored challenge campaigns | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Companion to coach portal `content_library`; sponsor-scoped access only, no canonical lesson authoring by default. |
| Sponsor Cohorts / Audience Visibility | View sponsor-linked challenge cohorts/segments and eligibility views | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Sponsor-scoped cohort visibility only; no challenge participation state ownership transfer. |
| Sponsor Channels (scoped) | Sponsor-scoped comms/channel tools for approved challenge/cohort communications | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Uses sponsor/challenge/cohort channel contexts only; no team-admin channel controls. |
| Challenge Member KPI Visibility (read-only) | View sponsor-approved challenge member KPI read models/rollups linked to sponsored challenges | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Read-only visibility surface; no KPI logging/edit routes/actions. |

#### `coaching_communication` (sponsor-scoped subset)
| Destination | Intended purpose | Figma source group | Runtime status | Notes |
|---|---|---|---|---|
| Sponsor-scoped `channel_thread` participation | Participate in approved sponsor/challenge/cohort channels | `manual-spec-driven (COACHING_* docs)` | `⚪ missing` | Sponsor persona may use sponsor-scoped communication tools in host surfaces/channels where enabled; no KPI logging controls. |

#### W7/W8 implementation checklist alignment (required)
- Admin Web, Mobile Runtime, and Backend implementation-ready acceptance checklists for this portal package are defined in `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`.
- W8 package/flow sequencing for portal + runtime handoff is defined in `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`.
- Final W8 implementation acceptance pack (lane done/blocked/rollback criteria + owner checkpoint checklist) is defined in `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`.
- W9 dedicated coach portal IA/UX direction and migration path (from `/admin/coaching/*` transition host foundation to production dedicated coach experience) are defined in `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_WIRING_ADDENDUM.md`.
- W9 sequencing preserves `/admin/coaching/*` as transition-host foundation only; dedicated coach experience presentation is the target production UX direction.
- Team Leader access in this package is limited to team-scoped upload actions inside `coach_content_library`; no org-wide authoring ownership and no sponsor-scoped package authority.
- `/admin/coaching/audit` remains secondary governance/troubleshooting only and is not part of primary coach/sponsor workflow routing.

#### W12 interaction primitives lock (coach portal)
- Buttons are for primary actions only (for example: `Create New Journey`, `Save Draft`, `Publish`).
- Tabs/segmented controls are for section switching only (`library`, `journeys`, `cohorts`, `channels` and in-page section toggles).
- Menus are for secondary actions only (overflow/row-level options such as rename, duplicate, archive, remove).
- List/row selection patterns:
  - Row click/select opens detail context or marks selection state.
  - Primary action buttons in rows trigger direct action only and must not duplicate row-open behavior.
  - Multi-select (if enabled) uses explicit selection affordances and bulk-action menu, not overloaded primary buttons.
- Scroll behavior requirements:
  - Coach portal pages use a single primary page scroll container per route.
  - Sticky header/action bars remain visible while content lists/canvases scroll.
  - Nested scroll containers are avoided unless required for builder canvas; when present, they must preserve pointer and keyboard usability.

#### W12 interaction primitives lock (admin surfaces)
- Primary buttons are for commit actions only (create/save/publish/approve/reject/confirm).
- Tabs/segmented controls are for view switching only (for example: `users/reports`, queue/status slices, detail subviews).
- Row-selection/table behavior:
  - row selection opens detail context or enables batch-selection state
  - table-header sorting is the canonical list-sort interaction (asc/desc toggles on sortable columns)
  - row-level commit buttons execute explicit actions and must not also trigger row-open navigation
- Menus are for secondary actions only (overflow actions such as duplicate, export, archive, soft-remove).
- Scroll behavior requirements:
  - admin pages should use one primary scroll container per route
  - sticky table headers/action bars remain visible during vertical scroll where supported
  - nested scroll regions are avoided unless the child pane is explicitly bounded (for example audit detail pane), with keyboard/pointer access preserved.

## Shared Runtime Router Map (Current Implementation Anchor)
Use this to map intended screens to current code constraints.

### Coach persona routing note (planning boundary)
- No dedicated Coach runtime/mobile router is implemented or planned in current member shell.
- Coach authoring/ops surfaces are currently modeled as:
  - admin web extension routes (preferred near-term), or
  - hybrid portal routes sharing auth but separate from member `KPIDashboardScreen` state router.
- Member runtime coaching destinations (`inbox*`, `coaching_journeys*`, `coach_broadcast_compose`) are delivery surfaces and must not absorb authoring/package-definition concerns.
- Coach portal IA uses top-tab navigation only for primary sections (`library`, `journeys`, `cohorts`, `channels`); avoid sequential helper-button navigation patterns between these sections.
- `/coach/channels` is the primary coach communications hub entry for channel-level operations and runtime comms handoff context.
- Drag `Library -> Journey` is the primary coach authoring interaction target for content composition.
- Drag/drop authoring interactions are mandatory runtime behavior for coach journey composition (not placeholder-only affordances).
- Journey Builder includes `Create New Journey` and an in-builder action bar with `Save Draft` status feedback (`idle`, `pending`, `saved`, `error`).
- If implementation adopts a hybrid portal route split, mark `decision needed` and log the structural boundary change in `/Users/jon/compass-kpi/architecture/DECISIONS_LOG.md` in that implementation change set.

### Challenge Sponsor persona routing note (planning boundary)
- `Challenge Sponsor` is a distinct persona and should be modeled as sponsor-scoped access into coach-portal companion surfaces and approved sponsor/challenge/cohort channel contexts.
- Sponsor persona surfaces may expose challenge member KPI visibility read models, but must not expose KPI logging/edit routes or actions.
- Do not model Sponsor persona as a generic member runtime KPI logger.

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
  - bottom tabs: `home`, `challenge`, `newkpi`, `team`, `user` (W1 coaching shell host)
  - challenge subflow: `list`, `details`, `leaderboard`
  - team subflow: `dashboard`, `invite_member`, `pending_invitations`, `kpi_settings`, `pipeline`, `team_challenges`
  - user/coaching shell subflow (W1 stubs): `inbox`, `inbox_channels`, `channel_thread`, `coach_broadcast_compose`, `coaching_journeys`, `coaching_journey_detail`, `coaching_lesson_detail`

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
- Capability group (for coaching/comms work)
- Canonical Figma node IDs + export filenames
- Expected wiring transitions
- Out-of-scope personas/flows

For `Coach` persona assignments (manual-spec-driven), also specify:
- portal host (`Admin Shell extension` vs `hybrid coach portal`)
- authoring vs delivery boundary
- packaging type in scope (`team`, `sponsored`, `paid`)
- AI boundary mode (`approval-first`) + disallowed mutation actions (`KPI`, forecast base/confidence, challenge participation/results)
- notification class(es) in scope + allowed delivery channels (`in-app`, `badge`, `push`, etc.) + `build now` vs `defer`

Do not assign work as generic “polish Team” or “fix challenge screen.”

## Sync Update Rule (Enforcement)
When a worker changes screen availability, routing, or completion status, they must update both:
1. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_PERSONA_FLOW_SCREENMAP.md`
2. `/Users/jon/compass-kpi/docs/spec/appendix/INTENDED_WIRING_DIAGRAM.md`

These updates should be in the same commit as the implementation change (or in an immediately paired docs commit in the same PR/branch slice).
