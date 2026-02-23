# A1 Admin Shell + AuthZ Manual Checklist

Purpose: quick manual validation for A1 shell/authz foundation before A2/A3 feature work starts.

Scope:
- Admin shell layout/navigation scaffold
- Auth/session wiring reuse
- UI authz route guards + unauthorized state
- Web path sync (`/admin/*`)

Out of scope:
- A2/A3 CRUD/data flows
- Backend admin endpoint behavior beyond existing `/me` fallback role read

## Preconditions
- Expo web app running from `app/` with admin surface enabled (`EXPO_PUBLIC_APP_SURFACE=admin`)
- Backend running locally (`GET /health` returns `200`)
- Test account exists with `public.users.role = 'super_admin'` (or `admin`)

## Manual Checks

1. Admin access (live role)
- In `Dev AuthZ Preview`, click `Use live role`
- Expected: Admin shell renders (no 403)
- Expected: Header shows backend role badge (for example `Backend role: super_admin`)

2. Unauthorized admin state (simulated non-admin)
- In `Dev AuthZ Preview`, click `Preview non-admin`
- Expected: URL becomes `/admin/unauthorized`
- Expected: `403` unauthorized panel renders
- Expected: warning explains dev preview override is active
- Expected: clicking `Use live role` in the warning restores admin access

3. Route path sync
- Click `Overview`
- Expected URL: `/admin`
- Click `AuthZ`
- Expected URL: `/admin/authz`
- Use browser back/forward
- Expected: active nav selection stays in sync with URL

4. Upcoming route toggle
- Default state should show A1 routes only (`Overview`, `AuthZ`)
- Enable `Show upcoming routes`
- Expected: A2/A3 placeholders appear (`Users`, `KPI Catalog`, `Templates`, `Reports`)
- Disable toggle while on an upcoming route
- Expected: shell returns to `Overview`

5. Unknown admin path handling
- Navigate manually to an unknown admin path (for example `/admin/does-not-exist`)
- Expected: shell redirects path state to `/admin/not-found`
- Expected: admin shell remains loaded and shows a 404-style not-found panel
- Expected: clicking a left-nav route returns to a valid admin path

6. Scroll behavior
- Scroll down the right content panel
- Expected: page content scrolls without clipping the unauthorized/debug/checklist sections

7. Placeholder route guard rendering
- With live admin role, open any visible admin route
- Expected: placeholder content renders (not blank)
- Expected: route stage badge reflects `A1 now`, `A2 later`, or `A3 later`

## Notes
- Frontend authz is UX gating only; backend remains the security enforcement layer.
- A1 uses backend `GET /me` as fallback role source when Supabase session metadata lacks role fields.

## Results (2026-02-23)
- Status: partial pass (agent-validated + user-assisted review), final click-through signoff still pending

Validated during this thread:
- `GET /me` fallback role flow works after promoting local user to `super_admin` in `public.users`
- Unauthorized (`403`) state renders for non-admin preview and exposes one-click reset to live role
- Scroll clipping bug in admin content panel was reproduced (user screenshot) and fixed
- Web path sync supports `/admin/unauthorized` and unknown `/admin/*` -> `/admin/not-found` shell state handling
- Pure-function authz unit tests added and passing (`npm run test:unit`)

Still recommended for final signoff (manual browser clicks):
- Live role path checks for `/admin`, `/admin/authz`, `/admin/users`
- Browser back/forward navigation after toggling between valid/unauthorized/not-found states
- Upcoming-route toggle behavior on current browser/session after latest changes
