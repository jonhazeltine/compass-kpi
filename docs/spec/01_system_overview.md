# 01 System Overview

## Components
- Mobile App (Expo/React Native): onboarding, KPI logging, dashboards, challenges, profile/settings.
- Backend API (Node/Express or cloud functions): auth-aware API layer, KPI/forecast/challenge logic, subscription/tier enforcement, admin endpoints.
- Data Layer (Supabase Postgres preferred): users, KPIs, logs, challenges, team entities, forecasts, sponsorship entities.
- Admin Surface (web): KPI catalog, challenge templates, sponsored challenge management, analytics, user operations.
- Design/Spec Source: Figma exports + markdown specs in this repo.

## Module Responsibilities
- App:
  - Captures logs and user actions.
  - Displays PC, GP, VP, Actual GCI, Deals Closed, and confidence overlays.
  - Handles offline queueing and sync for log events.
- Backend:
  - Computes PC contributions and decay timelines.
  - Maintains Forecast Confidence score inputs and output.
  - Enforces team/tier rules and role-based access.
  - Exposes user and admin APIs.
- Database:
  - Stores durable user, KPI, challenge, and forecast records.
  - Preserves history for auditability and reactivation flows.

## High-Level Data Flow
1. User logs KPI in app (online or offline queue).
2. Backend receives/syncs log and validates user/tier/role.
3. Backend updates KPI logs, PC contribution state, and activity timestamp.
4. Backend recalculates derived dashboard outputs (PC windows, GP/VP totals, confidence inputs).
5. App fetches dashboard payload and renders:
   - Base PC projection line and 90-day PC metric.
   - Actual GCI / Deals Closed as separate realized metrics.
   - Forecast Confidence layer as an overlay/indicator.

## Key User Flows Covered by Architecture
- Onboarding and profile/goal setup.
- KPI logging (PC/GP/VP/Actual/Custom/Pipeline Anchors).
- Individual dashboard interpretation.
- Team dashboard with drill-down.
- Challenge discovery/join/active tracking.
- Sponsored challenge discovery/details/join/CTA.

## Risks and Architectural Watchpoints
- Forecast correctness drift if PC, anchors, and confidence inputs are not traceable.
- Contract drift between app and backend if API docs are not maintained.
- Tier/role leakage without strict server-side checks.
- Offline log sync duplication/order issues without idempotency strategy.
