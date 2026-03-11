## CompassKPI

Monorepo for the CompassKPI platform.

### Structure

- **backend/**: Express + TypeScript API using Supabase Postgres (via Drizzle).
- **app/**: Expo / React Native mobile app for agents, team leaders, and (eventually) coaching.

### Tech Stack

- **Mobile**: Expo / React Native
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase Postgres
- **ORM**: Drizzle

### High-Level Modules

- **Core**: Auth, organizations/teams, roles, subscriptions.
- **KPI Engine**: KPI definitions, logging, projections (PC), GP/VP logic.
- **Dashboards**: Individual and team dashboards.
- **Challenges**: Standard + sponsored challenges.
- **Coaching**: Coaching flows migrated from the existing Fourth Reason app.

### Quick Start

**Backend** (already running):
```bash
cd backend && npm install && npm run dev
```

**App** (Expo + Supabase auth):
1. Copy `app/.env.example` to `app/.env` and fill in Supabase URL + anon key.
2. `cd app && npm install && npx expo start`
3. Press `i` for iOS simulator or scan QR with Expo Go.

### Physical Device Dev (El Guapo)

Use this when you want to run the app on the connected physical iPhone `El Guapo`.

This path is for the device only. It is not the normal simulator workflow.

```bash
./dev-phone.sh
```

What `dev-phone.sh` does:
1. Kills stale backend, Expo, and `cloudflared` processes.
2. Starts the backend on port `4000` and waits for `/health`.
3. Starts a fresh `cloudflared` quick tunnel for the backend.
4. Captures the new tunnel URL and writes it into `app/.env` as `EXPO_PUBLIC_API_URL`.
5. Starts Expo in LAN mode on port `8081` with cache cleared.
6. Pushes Expo Go to the connected device named `El Guapo`.
7. Cleans up all spawned processes on `Ctrl-C`.

Important assumptions:
- The target device name is hard-coded in `/Users/jon/compass-kpi/dev-phone.sh` as `El Guapo`.
- The Expo LAN address is hard-coded in the same script as `192.168.86.32`.
- `cloudflared` quick tunnels generate a new random URL every run, which is why the script rewrites `app/.env`.
- This script is the source of truth for physical-device startup. Do not manually pin a tunnel URL in `app/.env`.

What to expect:
- Backend logs: `/tmp/compass-backend.log`
- Tunnel logs: `/tmp/compass-tunnel.log`
- Expo logs: `/tmp/compass-expo.log`

How to stop it:
- Press `Ctrl-C` in the terminal running `./dev-phone.sh`

If device launch fails:
1. Confirm the phone is connected and trusted by the Mac.
2. Confirm Expo Go is installed on the device.
3. Re-run `./dev-phone.sh`; it is designed to reset stale state first.
