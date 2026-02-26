# A3 Users + Analytics + Reports Manual Checklist

Last updated: 2026-02-26 (A3 operator workflow push)
Sprint item: `A3 Users + Analytics + Reports`

## Purpose
Lightweight manual verification checklist for the admin A3 baseline UI in `/admin/users` and `/admin/reports`.

## Preconditions
- Admin web surface running (`EXPO_PUBLIC_APP_SURFACE=admin`)
- Signed in as `admin` or `super_admin`
- Backend API running with admin endpoints available

## Users Panel (`/admin/users`)

### Load + selection
- [ ] User list renders rows (no blank panel / crash)
- [ ] Clicking a user row populates `User Ops` panel
- [ ] `Save User Changes` button remains visible/clickable (no overlap with diagnostics cards)

### Role / tier / status edits
- [ ] Change `tier` and save -> success message shown, row updates
- [ ] Change `role` and save -> success message shown, row updates
- [ ] Change status to `deactivated` -> confirmation shown before save
- [ ] Cancel deactivation confirm -> no changes applied

### Create user (A3 test account setup)
- [ ] Create non-super-admin user from `/admin/users` with email + temporary password
- [ ] Success message includes created user summary (email/id/role/tier/status)
- [ ] Users list refreshes and shows created user
- [ ] Created user row auto-selects in `User Ops` panel (or is easy to locate/select)
- [ ] Create-user validation errors are clear (missing email / short password / duplicate email)

### Partial-save hardening (correctness)
- [ ] Simulate or trigger a failure after one field update (if possible)
- [ ] Error message states partial success fields (e.g., `role`, `tier`)
- [ ] Users list refreshes on error
- [ ] Selected user + form draft re-sync to backend state after error

### Calibration actions
- [ ] `Reset Calibration` prompts and returns success or clear backend error
- [ ] `Reinitialize From Onboarding` prompts and returns success or clear backend error
- [ ] Calibration diagnostics/cards remain readable after action

## Reports Panel (`/admin/reports`)

### Endpoint probe states
- [ ] `Check Analytics Endpoints` runs without crashing UI
- [ ] `overview` probe shows one of: `Endpoint responded`, `Forbidden`, `Not implemented`, `Error`
- [ ] `detailed-reports` probe shows one of: `Endpoint responded`, `Forbidden`, `Not implemented`, `Error`
- [ ] `POST /admin/data-exports` remains documented in UI without firing side-effecting export call

## Recorded Results (Checkpoint)

### Completed / observed
- [x] Users panel row selection populates `User Ops`
- [x] Users panel overlap issue (save button hidden behind diagnostics) was reproduced and fixed in A3 hardening
- [x] Partial-save recovery behavior implemented:
  - error message includes partial-success fields when applicable
  - user list refreshes on save error
  - selected user + draft re-sync from backend after error
- [x] Reports panel probe UI now includes clearer status chips, last checked timestamp, and expandable response previews
- [x] `POST /admin/data-exports` remains documented only (no side-effecting call)
- [x] Backend `POST /admin/users` route added on documented contract path for A3 test-user creation (same `/admin/users` endpoint family)
- [x] Create-user happy path works from `/admin/users` after restoring live backend role to `super_admin` (operator-reported)
- [x] Create-user authz failure was observed and explained during validation:
  - dev authz preview does not grant backend permissions
  - backend correctly returned `Admin access required` when live `/me` role was `agent`
- [x] Create-user invalid input behavior observed (short password) and surfaced clearly in UI (operator-reported)

### Pending operator click-through (run in browser)
- [ ] Re-run users edit/save happy path after latest operator polish
- [ ] Re-run calibration reset/reinitialize actions after latest operator polish
- [x] Record current `/admin/reports` probe outcomes (`overview`, `detailed-reports`) from live backend

## Operator Workflow Notes (Current UI)

### Test-user QA workflow (recommended loop)
1. Use `/admin/users` -> `Create Test User` to create a non-super-admin account (`agent` or `team_leader`) with a temporary password.
2. Keep `Recent First` enabled in `Find & Select User` to surface newly created users near the top of the list.
3. Enable `Test Users Only` when running repeated QA sessions to reduce noise in the user list.
4. Select the user row and use `Copy Email` / `Copy User ID` from `Quick Actions` for login/setup and debugging.
5. Make access/tier/status changes in `User Access + Tier`; verify the `Unsaved changes` indicator before saving.
6. Use `Calibration Tools` to reset or reinitialize calibration between test scenarios when needed.

### Create/select/edit/reuse continuity notes
- Users panel now preserves selected user state through list refreshes when the selected row still exists.
- Recent operator messages (create/save/copy/errors) are retained in `Recent Operator Activity` to reduce lost context during refreshes.
- Test-user mode uses a UI heuristic (email contains `test`, recently created accounts, and session-known created users) to prioritize QA accounts.

### Calibration diagnostics usage notes
- Diagnostics are shown as labeled key/value rows for faster scanning.
- `Calibration Rows` and `Calibration Events` support `Show more` / `Show fewer` expansion within the panel.
- Calibration actions remain destructive/admin-only and should be used for QA resets, not routine end-user operations.

### Reports probe usage and limitations
- `/admin/reports` is probe-only and safe for validation; it does not execute exports.
- Use `Recheck All Endpoints` for a full snapshot, or per-card `Recheck` for focused retesting.
- `Copy Details` on each endpoint card copies the interpreted status plus preview payload text (if available) for bug reports or handoff notes.

### Latest observed report probe results (operator)
- `GET /admin/analytics/overview` -> `Not implemented (404)`
- `GET /admin/analytics/detailed-reports` -> `Not implemented (404)`
- Panel behavior: rendered explicit `NOT IMPLEMENTED` chips and overall `Unavailable` state without crash (expected for current backend state)

### Known accepted limitations (this checkpoint)
- Reports endpoints may legitimately return `404 Not implemented` until backend implementation lands; UI treats this as an explicit, acceptable state.
- Users list remains a baseline list (no pagination yet); operator UI now supports `Show more` row expansion for manual inspection.
- Dev AuthZ Preview is intentionally UI-only; backend admin writes still enforce live session role from `public.users`.
- Test-user identification is heuristic-based in the UI (email/recent/session-created cues); there is no dedicated backend `is_test_user` flag.
- Operator activity history is UI-session-local and resets on page reload/sign-out.
