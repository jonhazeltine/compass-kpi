# Ops README

## Tooling
- Cursor
- Codex
- Supabase
- VS Code
- Replit
- Lovable
- cloudflared
- Expo Go (for physical-device dev)

## How We Work
- Builders implement features.
- Codex audits all work against `/architecture`.
- Read `/architecture/ARCHITECTURE.md` before major implementation.
- Enforce `/architecture/NON_NEGOTIABLES.md` for every design/engineering choice.
- Keep `/architecture/CURRENT_SPRINT.md` current and explicit.
- Update `/architecture/DECISIONS_LOG.md` for structural changes.
- Keep specs modular in `/docs/spec`.
- Keep Figma exports in `/design/figma/exports`.
- Prefer simple, readable solutions.
- Leave clear handoff notes for next contributors.

## Ops Validation (No UI)
- Run read-only sprint summaries from backend:
- `cd backend && npm run ops:summary`
- This command:
- builds backend,
- starts local API,
- creates a temporary auth user,
- calls `GET /ops/summary/sprint1`, `GET /ops/summary/sprint2`, and `GET /ops/summary/sprint3`,
- prints JSON summaries,
- deletes temporary auth user.

Interpretation quick guide:
- Sprint 1 integrity checks should ideally be `0` for violation counters.
- Sprint 2 integrity checks should ideally be `0` for:
- `teams_without_team_leader`
- `active_challenges_without_kpi_mapping`
- `team_mode_participants_not_on_team`

## Launch Checklist (Sprint 5)
- Preflight:
- Confirm environment variables are set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL`.
- Confirm latest SQL migrations are applied in target environment (`backend/sql/001` through `backend/sql/006`).
- Confirm no open production blockers in `architecture/CURRENT_SPRINT.md` dependency section.
- Regression Gate:
- Run `cd backend && npm run test:release`.
- Run `cd backend && npm run test:backend-mvp` for explicit backend MVP validation.
- Require pass status for Sprint 1 through Sprint 10 acceptance chains.
- Smoke Test (post-deploy):
- Verify `GET /health` returns `200`.
- Verify authenticated `GET /me` returns caller context.
- Verify `GET /dashboard` returns projection/actual separation payload.
- Verify one restricted endpoint denies unauthorized caller (`403`) and allows authorized caller (`200/201`).
- Rollback:
- If launch-gate fails before deploy, do not deploy and triage failing suite first.
- If smoke test fails after deploy, rollback to previous backend release artifact.
- Re-run `npm run test:release` in staging before re-attempt.


## Browser Admin / Coach Dev

Use `/Users/jon/compass-kpi/dev-web.sh` when you want stable browser access to admin and coach surfaces.

Run:
```bash
cd /Users/jon/compass-kpi
./dev-web.sh
```

Defaults to the seeded `admin` persona. You can override with `coach`, `leader`, `member`, `sponsor`, or `solo`.

Stable URLs:
- `http://localhost:8082/?path=/admin`
- `http://localhost:8082/?path=/admin/users`
- `http://localhost:8082/?path=/admin/kpis`
- `http://localhost:8082/?path=/coach/journeys`
- `http://localhost:8082/?path=/coach/library`

Why `?path=` exists:
- Expo web dev mode reliably serves the root page, not arbitrary deep links.
- The app reads `?path=` and rewrites the browser path internally.
- This gives a stable browser entry path for admin and coach surfaces.

## iOS Simulator Dev

Use `/Users/jon/compass-kpi/dev-sim.sh` for simulator startup.

Run:
```bash
cd /Users/jon/compass-kpi
./dev-sim.sh
```

Defaults to the seeded `member` persona. You can override with `coach`, `admin`, `leader`, `sponsor`, or `solo`.

What it guarantees:
1. Backend restarts on `127.0.0.1:4000`
2. `app/.env` is rewritten to local backend API
3. Expo starts in `--localhost` mode on `8081`
4. Expo Go is opened on the booted simulator with `exp://127.0.0.1:8081`

This path is stable regardless of Wi-Fi changes because everything stays local to the Mac.

## Physical Device Dev (El Guapo)

Use `/Users/jon/compass-kpi/dev-phone.sh` for physical-device startup on the connected iPhone `El Guapo`.

This workflow is specifically for the phone. It is not the preferred path for iOS simulators.

Run:
```bash
cd /Users/jon/compass-kpi
./dev-phone.sh
```

Defaults to the seeded `member` persona. You can override with `coach`, `admin`, `leader`, `sponsor`, or `solo`.

What it guarantees:
1. Cleans up stale listeners on backend `4000` and Expo `8081`
2. Starts backend and waits for `/health`
3. Starts a fresh `cloudflared` quick tunnel for backend traffic
4. Captures the new tunnel URL automatically
5. Rewrites `/Users/jon/compass-kpi/app/.env` with the current `EXPO_PUBLIC_API_URL`
6. Starts Expo in tunnel mode with cache clear on port `8083`
7. Pushes Expo Go to the physical device `El Guapo` using the Expo tunnel URL
8. Cleans up child processes on `Ctrl-C`

Why this exists:
- `cloudflared` quick tunnels get a new random hostname every restart
- stale `EXPO_PUBLIC_API_URL` values in `app/.env` break phone startup
- manually juggling backend tunnel URLs is the main cause of broken device sessions

Current script assumptions:
- device name: `El Guapo`
- Expo phone session uses tunnel mode, so it does not depend on a fixed LAN IP
- Expo port: `8081`
- backend port: `4000`

If those change, update `/Users/jon/compass-kpi/dev-phone.sh`.

Useful logs:
- `/tmp/compass-backend.log`
- `/tmp/compass-tunnel.log`
- `/tmp/compass-expo.log`

Do not:
- manually hard-code a `trycloudflare.com` URL in `app/.env`
- use this script as the simulator quick-start path
- leave a stale `dev-phone.sh` terminal running and then start a second one on top of it

## SQL Migration Method (Codex Standard)
- Use Node + `pg` against `SUPABASE_DATABASE_URL` (do not assume `DATABASE_URL` exists in this repo).
- This works even when `psql` is not installed locally.

Apply a migration file:
```bash
cd backend && node <<'NODE'
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) throw new Error('SUPABASE_DATABASE_URL is not set');
  const sql = fs.readFileSync('sql/015_sprint14_kpi_catalog_spec_hardening.sql', 'utf8');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  await client.end();
  console.log('migration applied');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
```

Post-apply verification pattern:
```bash
cd backend && node <<'NODE'
require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const counts = await client.query("select type,count(*)::int as count from public.kpis where is_active=true group by type order by type");
  console.log(counts.rows);
  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
```


Concurrent use rule:
- Browser can run with simulator.
- Browser can run with phone.
- Simulator and phone can now run at the same time because they use different Expo ports (`8081` and `8083`).
