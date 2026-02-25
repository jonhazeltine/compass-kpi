# A3 Users + Analytics + Reports Manual Checklist

Last updated: 2026-02-25
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

## Notes / Results
- Record observed endpoint statuses here (e.g., `404 not implemented` is acceptable until backend implementation lands).
- Record any overlapping layout or state-sync issues here before checkpoint commit.
