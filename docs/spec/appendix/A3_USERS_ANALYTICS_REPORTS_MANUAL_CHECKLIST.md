# A3 Users + Analytics + Reports Manual Checklist

Last updated: 2026-02-25 (A3 operator usability pass)
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

### Pending operator click-through (run in browser)
- [ ] Re-run users edit/save happy path after latest operator polish
- [ ] Re-run calibration reset/reinitialize actions after latest operator polish
- [ ] Record current `/admin/reports` probe outcomes (`overview`, `detailed-reports`) from live backend

### Known accepted limitations (this checkpoint)
- Reports endpoints may legitimately return `404 Not implemented` until backend implementation lands; UI treats this as an explicit, acceptable state.
- Users list remains a baseline list (no pagination yet); operator UI now supports `Show more` row expansion for manual inspection.
