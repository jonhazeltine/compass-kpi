# W12 Fourth Reason Chat/Journey Parity Map

## Purpose
Extract reusable chat + journey UX patterns from Fourth Reason and map them to current Compass routes/contracts so mobile and `/coach/*` can ship parity improvements without adding endpoint families.

## Scope and Guardrails
- Docs/control-plane only.
- No new endpoint family.
- No schema changes.
- Preserve persona boundaries: coach primary, sponsor scoped visibility, no sponsor KPI logging.

## Source Evidence (Fourth Reason)
- `/Users/jon/compass-kpi/references/the fourth reason integration/design_guidelines.md`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/member/InboxScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/ChannelsScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/ChannelDetailScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/coach/MessagesScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/coach/ComposeMessageScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/JourneyDetailScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/screens/member/MemberJourneyScreen.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/navigation/InboxStackNavigator.tsx`
- `/Users/jon/compass-kpi/references/the fourth reason integration/client/navigation/CoachTabNavigator.tsx`

## Compass Targets (Current)
- Mobile runtime shells in `/Users/jon/compass-kpi/app/screens/KPIDashboardScreen.tsx`:
  - `inbox`
  - `inbox_channels`
  - `channel_thread`
  - `coach_broadcast_compose`
  - `coaching_journeys`
  - `coaching_journey_detail`
  - `coaching_lesson_detail`
- Coach portal foundation in `/Users/jon/compass-kpi/app/screens/AdminShellScreen.tsx`:
  - `/coach/library`
  - `/coach/journeys`
  - `/coach/cohorts`
  - `/coach/channels`

## Contract Families Allowed (Existing)
- `/api/channels*`
- `/api/messages/unread-count`
- `/api/messages/mark-seen`
- `/api/coaching/journeys*`
- `/api/coaching/lessons/{id}/progress`
- `/api/coaching/progress`
- `/api/coaching/broadcast`
- `/api/ai/suggestions*` (approval-first assist only)
- `/sponsored-challenges*` (sponsor-scoped context only)
- `/dashboard` (summary badges/context only)

## Pattern Parity Map
| Fourth Reason UX pattern | Source evidence | Compass target route/surface | Compass contract family | Parity action | Build lane |
|---|---|---|---|---|---|
| Inbox triage with filter chips (`All`, DMs, Channels), recency sort, unread badges | `member/InboxScreen.tsx`, `coach/MessagesScreen.tsx` | `inbox`, `inbox_channels` | `/api/channels`, `/api/messages/unread-count` | Normalize list row shape and badge behavior per route context; keep filter tabs local UI state | Mobile |
| Channel list rows: type badge + preview + timestamp + unread pill | `ChannelsScreen.tsx` | `inbox_channels` | `/api/channels` | Promote `channel_type`/preview/unread as first-class row chips; keep empty/loading/error states compact | Mobile |
| Thread detail with optimistic send, pending items, role-gated composer affordances | `ChannelDetailScreen.tsx`, `ThreadDetailScreen.tsx` | `channel_thread` | `/api/channels/{id}/messages`, `/api/messages/mark-seen` | Keep optimistic local queue and retry statuses in-shell; no new transport family | Mobile |
| Broadcast composer flow: audience pick -> compose -> preview -> send | `coach/MessagesScreen.tsx`, `coach/ComposeMessageScreen.tsx`, `design_guidelines.md` | `coach_broadcast_compose` | `/api/coaching/broadcast` or `/api/channels/{id}/broadcast`, optional `/api/ai/suggestions*` | Formalize 3-step state machine in UI shell with approval-first AI draft insertion | Mobile |
| Journey list cards with progress percentage and cohort/context chips | `member/MemberJourneyScreen.tsx` | `coaching_journeys` | `/api/coaching/journeys`, `/api/coaching/progress` | Keep list card hierarchy: title, progress, next-action CTA; avoid placeholder-heavy card copy | Mobile |
| Journey detail milestone timeline with lock/unlock semantics | `JourneyDetailScreen.tsx` | `coaching_journey_detail` | `/api/coaching/journeys/{id}` | Render milestone/lesson progression hierarchy and lock/read-only states from existing payload semantics | Mobile |
| Lesson detail with clear primary CTA (`mark progress`, `next lesson`) | `LessonPlayerScreen.tsx`, `design_guidelines.md` | `coaching_lesson_detail` | `/api/coaching/lessons/{id}/progress` | Keep explicit user-triggered progress writes only; no auto-complete behavior | Mobile |
| Coach workspace IA: top-tab sections + library-first authoring | `CoachTabNavigator.tsx`, `server/templates/coach-studio.html` | `/coach/library`, `/coach/journeys`, `/coach/cohorts`, `/coach/channels` | Existing in-family coaching/channel/sponsor reads | Keep top-tab navigation only; treat uploads as Library intake (not standalone tab); prioritize drag `Library -> Journey` authoring path | Coach portal |
| Sponsor/context visibility in communication and journey surfaces | `coach/MessagesScreen.tsx`, `design_guidelines.md` | `channel_thread`, `coaching_journeys*`, `/coach/channels` | `/sponsored-challenges*`, `/api/channels*`, `/api/coaching/journeys*` | Keep sponsor scoped visibility only; explicitly deny sponsor KPI logging affordances | Mobile + Coach portal |

## Mobile Implementation-Ready Screen/Flow Spec

### 1) `inbox` + `inbox_channels`
- Primary goal: recency-first communication triage.
- Required visible data:
  - channel/thread title
  - preview text
  - relative timestamp
  - unread count badge
  - context/type badge (`team`, `challenge`, `sponsor`, `cohort`)
- Entry points:
  - Home/Team/Challenge coaching modules
  - notification rows with `route_target`
- Actions:
  - open thread/channel
  - mark seen on thread open
- States:
  - loading skeleton
  - empty state by persona
  - partial read-model banner (compact)
  - permission denied row fallback

### 2) `channel_thread`
- Primary goal: reliable messaging thread participation.
- Required visible data:
  - ordered message history
  - sender role label
  - pending send status (`sending`, `failed`, retry)
  - optional linked context chips (journey/challenge/sponsor)
- Actions:
  - send text
  - leader/admin broadcast affordance only when role allows
  - retry failed local pending messages
- Rules:
  - no autonomous AI send/publish
  - no sponsor team-broadcast privilege escalation

### 3) `coach_broadcast_compose`
- Primary goal: coach/leader-targeted outbound communication with explicit scope.
- Step sequence:
  1. Select scope (`team`, `journey`, `global` where authorized)
  2. Compose message + optional AI draft suggestion
  3. Preview + confirm send
- Required checks:
  - scope permission check from existing broadcast endpoint response
  - daily throttle feedback from existing broadcast family
  - approval-first AI suggestion flow remains advisory

### 4) `coaching_journeys` -> `coaching_journey_detail` -> `coaching_lesson_detail`
- Primary goal: clear next-best lesson progression.
- Required visible data:
  - journey progress summary
  - milestone/lesson status chips
  - locked/available lesson state
  - explicit progress write button
- Actions:
  - open lesson detail from journey detail
  - mark progress with explicit user trigger
- Rules:
  - no KPI logging side effects from journey/lesson interactions
  - no implicit completion on view

## Coach Portal Implementation-Ready Screen/Flow Spec (`/coach/*`)

### IA Direction (existing route set)
- `/coach/library`: searchable reusable content registry with integrated upload intake + metadata tagging.
- `/coach/journeys`: journey roster + edit/status actions.
- `/coach/cohorts`: cohort assignment and channel linkage panel.
- `/coach/channels`: channel roster with membership and context scopes.
- Primary coach IA navigation is top-tab-only for these sections; do not model sequential helper-button navigation between sections.
- Primary authoring target: drag from Library items into Journey builder composition.

### Required role gates
- Coach: full surface access.
- Team Leader: team-scoped upload only, no org-wide authoring/package authority.
- Sponsor: sponsor-scoped tools only.
- Sponsor and Team Leader: no KPI logging affordances on portal surfaces.

### Flow contracts
- Publish handoff is metadata-only into runtime surfaces (`coaching_journeys*`, `inbox*`, `channel_thread`).
- `/admin/coaching/audit` remains secondary governance/troubleshooting, not primary coach workflow.
- No portal flow introduces new API family; all wiring stays inside current coaching/channels/sponsored/AI families.

## Build-Now vs Defer

### Build now (W12 parity-ready)
- Inbox/channel row hierarchy + unread chip parity in mobile shells.
- Thread pending-send UX and retry handling polish.
- Broadcast composer step model using existing broadcast contracts.
- Journey card/timeline/lesson CTA hierarchy improvements in existing coaching shells.
- `/coach/*` IA copy + action consistency pass with strict role gate labels.

### Defer (not required for W12 parity map)
- Net-new realtime transport layer (websocket/eventstream family).
- Net-new API family for chat/journey aggregation.
- Schema changes for new message object types.
- Admin-audit-primary workflow expansion.

## Acceptance Checklist (Docs/Lane Readiness)
- Every mapped pattern references an existing Compass route.
- Every mapped pattern references an existing endpoint family in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`.
- Persona boundaries remain explicit for coach/team-leader/sponsor.
- No-KPI-logging sponsor rule is preserved in both mobile and portal spec notes.
