# Fourth Reason Integration Matrix

## Purpose
Map the communication + coaching capabilities from `references/the fourth reason integration` into Compass KPI, with a clear recommendation on what to reuse, adapt, or defer.

## Source Snapshot
- Source repo: `references/the fourth reason integration`
- Branch: `main`
- Architecture style: Expo client + Express API + Drizzle ORM + Postgres/Supabase
- Notable service surface: messaging, channels, journeys/lessons, AI suggestions, push notifications, member invites, subscription hooks

## Alignment to Compass KPI Non-Negotiables
- PC vs Actual GCI separation: no direct conflict; coaching module should consume KPI outputs, not redefine them.
- GP/VP not generating PC: no direct conflict; preserve KPI engine ownership in Compass backend.
- Forecast Confidence display-only: coaching should reference confidence state, never mutate base forecast.
- Pipeline Anchors as required inputs: coaching insights may read anchors, but anchor logic remains in KPI/forecast engine.

## Foundational Decision Required Before Phase 1
- Define Compass tenancy boundary first: `organization` + `team` ownership model.
- All communication/coaching tables must include a tenancy key strategy from day 1 (recommended: `org_id` required, `team_id` optional where relevant).

## Integration Matrix (First Pass)

| Capability | Fourth Reason Evidence | Recommendation | Integration Notes |
|---|---|---|---|
| 1:1 / group messaging | `server/routes.ts` (`/api/threads`, `/api/messages`, unread endpoints), `shared/schema.ts` (`threads`, `messages`) | Reuse pattern, rebuild in Compass namespace | Keep data model style; remap auth/roles to Compass org/team roles. |
| Channels (cohort-style comms) | `channels`, `channelMemberships`, `channelMessages` + `channelService.ts` | Reuse concept, adapt to team/challenge context | Make channel type explicit: `team | challenge | sponsor | cohort`, with typed context linkage. |
| Coaching journeys + lesson progress | `journeys`, `milestones`, `lessons`, `lessonProgress`, unlock logic | Reuse concept, phased adoption | Introduce after core KPI app stability; align content to coaching module boundaries. |
| Broadcast messaging | `/api/cohorts/:id/broadcast`, `broadcastService.ts` | Reuse concept | Useful for team leader nudges and forecast/coaching campaigns. |
| Member invite + onboarding flows | `memberInvites`, `/api/coach/members/invite` | Adapt | Map invite domain to Compass team membership and role assignment rules. |
| Push notifications | `pushTokens`, notification services, `expo-notifications` | Reuse infrastructure approach | Keep categories aligned to KPI/challenge/coaching events in Compass. |
| AI coach suggestions | `/api/ai/*`, `aiSuggestionService.ts`, `aiContextService.ts` | Defer to Phase 3 | Guardrails required: action-oriented suggestions, no source-of-truth conflicts with KPI engine. |
| Knowledge base ingestion | `/api/knowledge/*`, web/PDF/import workflows | Defer | Valuable for coaching context, but not required for initial communication integration. |
| Subscription hooks | RevenueCat webhook + subscription service | Defer until billing authority decision | Keep Phase 1/2 billing-agnostic; no RevenueCat webhook code in Compass pre-decision. |
| Media/video coaching assets | Mux upload + transcript flows | Defer | Keep as optional advanced coaching module after messaging/channels land. |

## API and Integration Recommendations

### Keep / Reuse
- Supabase auth + token verification pattern (already aligned to Compass stack).
- Drizzle schema discipline and typed inserts/selects for comms/coaching entities.
- React Query style client data fetching conventions for real-time-ish UX.

### Adopt with Caution
- RevenueCat:
  - Do not implement in Compass until billing authority is explicitly decided.
  - If adopted later, document ownership split with Stripe and platform-native purchase validation.
- AI services:
  - Keep separate service boundary (`/api/ai/*`) with strict prompt and audit logging.
  - Never let AI service modify KPI base forecast values.

### Do Not Import Directly
- Any environment files, service account artifacts, or attached assets from source repo.
- Existing source webhook secrets/keys and media credentials.

## Proposed Compass Module Boundaries
- `Communication Module`
  - Threads, direct messages, team channels, unread counts, push dispatch.
- `Coaching Module`
  - Journeys, milestones, lessons, progress, optional coach broadcasts.
- `AI Coaching Assist Module` (later)
  - Suggestion generation, context assembly, approval queue.
- `KPI Core Module` (existing Compass ownership)
  - KPI logging, PC/GP/VP logic, forecast, confidence, anchors.

## Phase Plan

### Phase 1: Communication Core (Recommended first)
- Threads, messages, channel membership, unread tracking.
- Team leader broadcast to channel/team.
- Push token registration and message notifications.
- Explicit channel model:
  - `channels.type = team | challenge | sponsor | cohort`
  - `channels.context_id` (points to `team_id`, `challenge_id`, or `sponsor_id` by type)
- Delivery model (simple/reliable):
  - DB-backed unread counters
  - Expo push notifications
  - Client polling for message updates (short interval only on active message screens)
- Explicitly defer websockets unless a measured need appears.
- Day-1 abuse controls:
  - broadcast audit log
  - per-role broadcast throttles/rate limits
- Deliverable: stable communication surface inside Compass auth/role model.

### Phase 2: Coaching Content
- Journey, milestone, lesson and progress tracking.
- Minimal coach content delivery UI.
- Deliverable: coaching content tied to members/teams.

### Phase 3: AI Assist + Context
- AI suggestion endpoints with human approval queue.
- Context assembled from KPI summary + coaching interactions.
- Deliverable: coach copilot that proposes, not auto-sends.

### AI Governance Shape (Define Early, Implement in Phase 3)
- Reserve approval queue model now to avoid retrofit:
  - `ai_suggestions(id, user_id, scope, proposed_message, status, created_by, approved_by, sent_at, created_at, updated_at)`
  - `status`: `pending | approved | rejected`

### Phase 4: Advanced Integrations
- Media/video ingestion + transcript enrichment (Mux or alternative).
- Subscription/integration hardening and analytics expansion.
- Deliverable: mature coaching platform capabilities.

## Required Pre-Implementation Decisions
1. Billing authority: Stripe-only vs Stripe + RevenueCat hybrid.
2. Tenancy strategy for comms/coaching tables (`org_id`, `team_id`, and context ownership rules).
3. Real-time transport choice: poll + push first, websocket only with explicit justification.
4. Coaching ownership model: team leader only vs dedicated coach role in Compass.
5. Data retention + compliance policy for messages and AI context.
6. Event taxonomy for notifications (KPI/challenge/coaching/community).

## Security and Hygiene Checklist
- Remove/ignore imported asset dumps and potential credential artifacts from any migration path.
- Create clean env templates for Compass-owned integrations only.
- Add audit logging for admin/coach actions in comms/coaching surfaces.
- Apply role/tier enforcement server-side on every new endpoint.
- Add rate limiting and spam controls on broadcast and high-volume message endpoints.

## Do-Not-Get-Tricked Warning
- Reuse patterns, not architecture lock-in. Fourth Reason is a reference implementation, not Compass's backend blueprint.
- Do not let comms schema choices force global backend direction before Compass tenancy and module boundaries are finalized.

## Next Deliverable (Recommended)
Create a technical migration RFC that defines:
- target schema additions in Compass
- endpoint list for Phase 1
- permission model mapping (coach/member/team leader/super admin)
- incremental rollout plan and fallback strategy

## Phase 1 RFC Starter Table (One-Page)

| New table | Tenancy key | Purpose |
|---|---|---|
| `channels` | `org_id` (required), `team_id` (nullable), `type`, `context_id` | Channel container for team/challenge/sponsor/cohort comms. |
| `channel_memberships` | inherited from channel + `user_id` | Membership + role in channel. |
| `channel_messages` | inherited from channel + `sender_user_id` | Message body + metadata/audit fields. |
| `message_unreads` (or equivalent counters) | `org_id`, `user_id`, `channel_id` | Fast unread counts for inbox/channel list. |
| `push_tokens` | `org_id`, `user_id` | Device token registration and lifecycle. |
| `broadcast_log` | `org_id`, `actor_user_id` | Audit trail for broadcasts and throttle enforcement. |
| `ai_suggestions` (future) | `org_id`, `user_id` | Approval queue for AI-proposed coaching content. |

| New endpoint | Role access | Rate limit |
|---|---|---|
| `GET /api/channels` | member, team_leader, admin | standard |
| `POST /api/channels` | team_leader, admin | strict |
| `GET /api/channels/:id/messages` | channel member | standard |
| `POST /api/channels/:id/messages` | channel member | medium |
| `GET /api/messages/unread-count` | authenticated user | standard |
| `POST /api/messages/mark-seen` | authenticated user | standard |
| `POST /api/channels/:id/broadcast` | team_leader, admin | strict + daily cap |

| Event name | Trigger | Push category |
|---|---|---|
| `message.created` | New message posted in subscribed channel/thread | communication |
| `message.mentioned` | User is explicitly mentioned | communication_urgent |
| `broadcast.sent` | Leader/admin sends broadcast | coaching_or_team_update |
| `challenge.channel.message` | Message in challenge-typed channel | challenge |
