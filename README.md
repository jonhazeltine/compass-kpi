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


### Browser Admin / Coach Dev

Use this when you want the browser-facing admin shell or coach portal on localhost.

```bash
./dev-web.sh
```

Defaults to the seeded `admin` persona for immediate access. You can override it:
```bash
./dev-web.sh coach
./dev-web.sh leader
```

Stable browser URLs:
- App root: `http://localhost:8082`
- Admin shell: `http://localhost:8082/?path=/admin`
- Admin users: `http://localhost:8082/?path=/admin/users`
- Admin KPI catalog: `http://localhost:8082/?path=/admin/kpis`
- Coach portal: `http://localhost:8082/?path=/coach/journeys`
- Coach library: `http://localhost:8082/?path=/coach/library`

Why these URLs use `?path=`:
- Expo web reliably serves the root page on localhost.
- The app then converts `?path=/admin` or `?path=/coach/journeys` into the correct in-app route.
- This avoids broken deep-link reload behavior in Expo web dev mode.

### iOS Simulator Dev

Use this when you want Expo Go relaunched in a booted iOS simulator.

```bash
./dev-sim.sh
```

Defaults to the seeded `member` persona. You can override it:
```bash
./dev-sim.sh coach
./dev-sim.sh admin
```

What it does:
1. Kills stale backend and Expo processes.
2. Starts backend on `127.0.0.1:4000`.
3. Rewrites `app/.env` to use local backend API.
4. Starts Expo in `--localhost` mode on `8081`.
5. Opens Expo Go on the booted simulator using `exp://127.0.0.1:8081`.

This path is network-independent because simulator and backend run on the same Mac.

### Physical Device Dev (El Guapo)

Use this when you want to run the app on the connected physical iPhone `El Guapo`.

This path is for the device only. It is not the normal simulator workflow.

```bash
./dev-phone.sh
```

Defaults to the seeded `member` persona. You can override it:
```bash
./dev-phone.sh coach
./dev-phone.sh admin
```

What `dev-phone.sh` does:
1. Kills stale backend, Expo, and `cloudflared` processes.
2. Starts the backend on port `4000` and waits for `/health`.
3. Starts a fresh `cloudflared` quick tunnel for the backend.
4. Captures the new tunnel URL and writes it into `app/.env` as `EXPO_PUBLIC_API_URL`.
5. Starts Expo in tunnel mode on port `8081` with cache cleared.
6. Pushes Expo Go to the connected device named `El Guapo` using the Expo tunnel URL.
7. Cleans up all spawned processes on `Ctrl-C`.

Important assumptions:
- The target device name is hard-coded in `/Users/jon/compass-kpi/dev-phone.sh` as `El Guapo`.
- Expo now runs in tunnel mode for the phone path, so it no longer depends on your current Wi-Fi LAN address.
- `cloudflared` quick tunnels generate a new random backend URL every run, which is why the script rewrites `app/.env`.
- Expo tunnel also generates a fresh `exp.direct` URL each run, and the script captures it automatically.
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


Concurrent use rule:
- Browser can run with simulator.
- Browser can run with phone.
- Simulator and phone can now run at the same time because they use different Expo ports (`8081` and `8083`).
