# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Turborepo monorepo for a "Home Management" household app. Two main services:

| Service | Port | Package | Command |
|---|---|---|---|
| **Frontend** (Next.js 15 PWA) | 3000 | `@home/web` | `yarn workspace @home/web dev` |
| **Backend** (Hono + DBOS API) | 3001 | `@home/server` | `yarn workspace @home/server dev` |

Shared packages: `@home/db` (Drizzle ORM / Neon), `@home/shared` (types/constants), `@home/ai` (AI tool defs).

### Key development caveats

- **Node 20** is required (see `.nvmrc`). Enable corepack: `corepack enable && corepack prepare yarn@4.6.0 --activate`.
- **Yarn 4 (Berry)** with `node-modules` linker. Use `yarn install` (not npm/pnpm).
- **Build order matters**: `@home/db` → `@home/shared` → `@home/ai` → `@home/server`. The server's `dev` script handles this chain automatically.
- **Neon serverless driver** (`@neondatabase/serverless`) uses HTTP, not standard `pg` TCP. A local PostgreSQL alone won't work. You must run the `local-neon-http-proxy` Docker container and preload `neon-local-config.mjs` via `NODE_OPTIONS="--import=/workspace/neon-local-config.mjs"`.
- **PostgreSQL** must be running locally (`sudo pg_ctlcluster 16 main start`) with a database `home_management` and a superuser role (needed for the neon proxy to access `pg_authid`).
- **Docker** must be running (`sudo dockerd &`) for the neon-http-proxy container: `sudo docker start neon-proxy` (or create with `sudo docker run -d --name neon-proxy -p 4444:4444 -e PG_CONNECTION_STRING="postgresql://homeuser:homepass@172.17.0.1:5432/home_management" ghcr.io/timowilhelm/local-neon-http-proxy:main`).
- **Schema push**: Use `DATABASE_URL="postgresql://homeuser:homepass@localhost:5432/home_management" npx drizzle-kit push` from `packages/db/` to sync schema to local PG.
- **Environment files**: `apps/server/.env` and `apps/web/.env.local` (see `.env.example` files in each). Set `DATABASE_URL` host to `db.localtest.me` for the neon HTTP driver; set `DBOS_DATABASE_URL` to `localhost` for DBOS direct connection.
- **Google OAuth** credentials are required for login (set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Without them, the login page loads but auth won't work.
- **Lint/typecheck/build**: `yarn lint`, `yarn typecheck`, `yarn build` from root. No automated tests exist in the codebase.

### Dev login

A credentials-based login provider bypasses Google OAuth for local development. It is controlled by two env vars in `apps/web/.env.local`:

| Env var | Purpose | Default |
|---|---|---|
| `DEV_LOGIN_ENABLED` | Set to `true` to show the dev login form | `false` (disabled) |
| `DEV_LOGIN_PASSWORD` | Shared password for all dev logins | (none) |

When enabled, the login page (`/login`) renders a "Dev Login" form below the Google button with email and password fields.

**How it works:**
- Enter any email address and the configured `DEV_LOGIN_PASSWORD`.
- On first login with a new email, the JWT callback auto-creates a household, family member, and user row in the database. Subsequent logins with the same email reuse the existing user.
- The `signIn` callback skips the `ALLOWED_EMAILS` check for `dev-credentials` logins, so any email works.
- The session and access-token generation is identical to the Google OAuth path — the backend API cannot distinguish dev logins from real ones.

**Browser testing (computerUse / manual):**
1. Navigate to `http://localhost:3000/login`.
2. Type an email (e.g. `dev@example.com`) and the dev password (`devpass123`).
3. Click "Dev Login". After redirect you land on `/dashboard`.

**API testing (curl / scripts):**
Generate a JWT matching the `NEXTAUTH_SECRET` and pass it as a Bearer token. Example:

```bash
TOKEN=$(node -e "
const jose = require('jose');
(async () => {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'LQGgNuqIjDQSOT1IINndh5weI6SF4wbHOs5oeIouEIg=');
  const jwt = await new jose.SignJWT({
    email: 'dev@example.com',
    userId: '<uuid from users table>',
    householdId: '<uuid from households table>'
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
  console.log(jwt);
})();
")
curl -s http://localhost:3001/api/tasks -H "Authorization: Bearer $TOKEN"
```

To find the user/household UUIDs after a dev login:

```bash
PGPASSWORD=homepass psql -h localhost -U homeuser -d home_management \
  -c "SELECT u.id AS user_id, u.household_id, u.email FROM users u;"
```

**Important notes:**
- The dev login provider is defined in `apps/web/lib/auth.ts` and is only registered when `DEV_LOGIN_ENABLED === "true"`. It is **not** compiled into the app when the flag is absent or `false`.
- After making changes to `auth.ts` or the login page, clear the Next.js cache (`rm -rf apps/web/.next`) and restart the dev server, otherwise stale server-action hashes cause `UnrecognizedActionError`.
- Google OAuth credentials (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) are still placeholders in the local `.env.local` — the Google button will fail, but dev login works independently.

### Starting services

```bash
# 1. Start PostgreSQL
sudo pg_ctlcluster 16 main start

# 2. Start Docker + neon proxy
sudo dockerd &
sleep 3
sudo docker start neon-proxy

# 3. Start backend (port 3001)
cd /workspace/apps/server && npx tsx watch --env-file=.env src/index.ts &

# 4. Start frontend (port 3000)
cd /workspace && yarn workspace @home/web dev &
```
