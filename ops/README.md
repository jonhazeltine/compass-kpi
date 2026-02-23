# Ops README

## Tooling
- Cursor
- Codex
- Supabase
- VS Code
- Replit
- Lovable

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
