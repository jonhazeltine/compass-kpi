# Architecture

## Purpose
This file is the plain-English system map for Compass KPI. Use it to describe what exists, what each module owns, and how data moves.

Operational companion:
- `architecture/PROJECT_CONTROL_PLANE.md` is the full-program oversight layer (roadmap, dependency/risk registers, sprint-to-roadmap traceability).

## System Map Template
- `Mobile App (Expo/React Native)`: user-facing workflows for agents, leaders, and coaching views.
- `Backend API (Node/Express)`: auth-aware APIs, business rules orchestration, integration boundary.
- `Data Layer (Supabase Postgres)`: source of truth for operational records, KPI logs, forecasts, and analytics inputs.
- `Design Source (Figma + exports)`: canonical UI flows and component references.
- `Spec Docs (/docs/spec)`: detailed product and engineering requirements.

## Module Boundaries
- App owns: presentation state, client UX, auth session handling.
- Backend owns: domain rules, validation, role-aware data access, KPI engine orchestration.
- Database owns: durable records, relational integrity, historical tracking.
- Docs/Architecture own: decisions, constraints, and implementation guardrails.

## Cross-Module Contracts (Overview)
- App <-> Backend: versioned API contracts in `/docs/spec/04_api_contracts.md`.
- Backend <-> DB: schema and query boundaries documented in `/docs/spec/02_data_model.md`.
- Product Rules <-> Engine: calculation and forecast behaviors documented in `/docs/spec/03_engines.md`.

## Core Data Objects (Overview)
- `User`: authenticated actor with role + org membership.
- `Organization`: top-level business entity.
- `Team`: grouping for reporting and management.
- `KPI Definition`: what is measured and how.
- `KPI Log Entry`: timestamped actuals and context.
- `Forecast`: model output with confidence metadata.
- `Pipeline Anchor`: key pipeline inputs used by forecast calculations.

## Open Items
- Fill concrete module responsibilities per sprint.
- Add sequence diagrams for high-risk workflows.
- Track finalized boundaries in `DECISIONS_LOG.md`.
