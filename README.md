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

