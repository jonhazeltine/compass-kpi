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
| 1:1 / group messaging | `server/routes.ts` (`/api/threads`, `/api/messages`, unread endpoints), `shared/schema.ts` (`threads`, `messages`) | Planned Wave A (`Stream Chat` via Compass adapter/facade) | Keep Compass as authority; reuse pattern semantics while mapping roles/tenancy before provider token issue. |
| Channels (cohort-style comms) | `channels`, `channelMemberships`, `channelMessages` + `channelService.ts` | Planned Wave A (`Stream Chat` channel sync) | Preserve channel type model `team | challenge | sponsor | cohort`; add provider mapping fields through Compass contracts only. |
| Coaching journeys + lesson progress | `journeys`, `milestones`, `lessons`, `lessonProgress`, unlock logic | Reuse concept, phased adoption | Introduce after core KPI app stability; align content to coaching module boundaries. |
| Broadcast messaging | `/api/cohorts/:id/broadcast`, `broadcastService.ts` | Reuse concept | Useful for team leader nudges and forecast/coaching campaigns. |
| Member invite + onboarding flows | `memberInvites`, `/api/coach/members/invite` | Adapt | Map invite domain to Compass team membership and role assignment rules. |
| Push notifications | `pushTokens`, notification services, `expo-notifications` | Reuse infrastructure approach | Keep categories aligned to KPI/challenge/coaching events in Compass. |
| AI coach suggestions | `/api/ai/*`, `aiSuggestionService.ts`, `aiContextService.ts` | Defer to Phase 3 | Guardrails required: action-oriented suggestions, no source-of-truth conflicts with KPI engine. |
| Knowledge base ingestion | `/api/knowledge/*`, web/PDF/import workflows | Defer | Valuable for coaching context, but not required for initial communication integration. |
| Subscription hooks | RevenueCat webhook + subscription service | Defer until billing authority decision | Keep Phase 1/2 billing-agnostic; no RevenueCat webhook code in Compass pre-decision. |
| Media/video coaching assets | Mux upload + transcript flows | Planned Wave B (`Mux` via Compass adapter/facade) | Implement direct upload + signed playback + verified webhooks, with media metadata surfaced through existing coaching/journey contracts. |

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
- W13 lock-in note:
  - Runtime implementation target uses `Stream Chat` through Compass service adapters and API facade.

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
- Media/video ingestion + transcript enrichment (Mux locked as canonical provider).
- Subscription/integration hardening and analytics expansion.
- Deliverable: mature coaching platform capabilities.

## W13 Managed Provider Implementation Sequence (Locked)
1. Docs-first exception (current slice):
   - architecture/spec/contracts/tests/board sequencing only; no runtime code.
2. Pre-implementation dependency gates:
   - `DEP-002` tenancy key strategy final
   - `DEP-004` retention/compliance final
   - `DEP-005` vendor security/legal checklist final
3. Wave A:
   - Stream token issuance, channel sync mapping, audit trail.
4. Wave B:
   - Mux upload/playback tokenization, webhook verification, media lifecycle mapping.
   - Planned contract depth (dependency-gated):
     - upload session contract includes Compass correlation id + idempotency key handling.
     - playback token contract includes role-scoped authorization claims and bounded TTL.
     - webhook contract enforces signature verification, replay protection, and duplicate delivery idempotency.
   - Planned lifecycle model (dependency-gated):
     - `queued_for_upload` -> `uploaded_pending_asset` -> `processing` -> `ready|failed` -> `deleted`.
     - lifecycle state is read-model only and additive to coaching/journey payloads.
   - Planned failure handling (dependency-gated):
     - deterministic Compass error envelopes for upload/playback/webhook failure classes.
     - failed-processing and invalid-signature events are auditable and visible in admin diagnostics.
     - fallback behavior must keep journey/coaching navigation functional when media is not ready.
   - Rollout constraints (dependency-gated):
     - no runtime activation before `DEP-002`, `DEP-004`, and `DEP-005` close.
     - staged rollout: internal/staff -> coach/team-leader scoped -> sponsor-scoped visibility where policy permits.
     - rollback path keeps Compass media metadata intact while disabling provider token issuance.
5. Wave C:
   - mobile + `/coach/*` parity, fallback states, moderation/audit hardening.
6. Wave D:
   - regression matrix, scale/perf checks, rollout/rollback runbooks.

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

## W12 Parity Mapping Deliverable (Landed)
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_FOURTHREASON_CHAT_PARITY_MAP.md`
  - Extracts reusable Fourth Reason chat/journey UX patterns.
  - Maps each pattern to current Compass mobile shell routes and `/coach/*` portal surfaces.
  - Constrains implementation to existing endpoint families in `/Users/jon/compass-kpi/docs/spec/04_api_contracts.md`.
  - Provides implementation-ready flow specs and `build now` vs `defer` boundaries for W12 planning.
- `/Users/jon/compass-kpi/docs/spec/appendix/COACHING_W12_DRAGDROP_LIBRARY_TO_JOURNEY_SPEC.md`
  - Defines implementation-ready drag/drop authoring UX from library assets into journey builder.
  - Maps required interactions to existing `/api/coaching/*` family and calls out explicit in-family contract gaps.
  - Preserves coach/team-leader/sponsor guardrails (team-scoped team-leader upload, sponsor no KPI logging).

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
