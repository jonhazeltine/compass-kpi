# Refactor Guardrails

## Purpose
Block regression-prone monolith growth and enforce lane-safe edits during concurrent development.

## Commands
- Repo root: `node ops/scripts/refactor_guardrails_check.js`
- App workspace: `cd app && npm run guardrails:refactor`
- Backend workspace: `cd backend && npm run guardrails:refactor`

## What is enforced
- Legacy no-growth lock:
  - `app/screens/KPIDashboardScreen.tsx`
  - `app/screens/AdminShellScreen.tsx`
  - `backend/src/index.ts`
- Hard line caps for extracted module directories:
  - `app/screens/admin-shell/**`
  - `app/screens/kpi-dashboard/**`
  - `backend/src/services/**`
- Lane collision check using `ops/refactor_guardrails.json` lane manifest.

## Lane source of truth
- `ops/refactor_guardrails.json`
- Board policy mirror: `architecture/AGENT_ASSIGNMENT_BOARD.md` (Refactor Lane Lock section)
