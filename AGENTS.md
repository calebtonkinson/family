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
- **Database**: The `DATABASE_URL` secret points to a hosted Neon PostgreSQL instance. The `@neondatabase/serverless` driver connects directly over HTTP — no local PostgreSQL or proxy is needed when the secret is present. If `NEON_LOCAL_PROXY` is set in the env, the `@home/db` client redirects queries to that URL instead (see `packages/db/src/client.ts`).
- **Environment files**: `apps/server/.env` and `apps/web/.env.local`. The Cursor secrets `DATABASE_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are injected as process env vars and take precedence over values in these files. The `.env` / `.env.local` files supply the remaining config (`NEXTAUTH_SECRET`, `PORT`, `ALLOWED_ORIGINS`, `DEV_LOGIN_*`, etc.).
- **PORT gotcha**: The backend `.env` sets `PORT=3001`. If the backend was started first (or its `.env` was sourced), this `PORT` leaks into the shell and causes `next dev` to bind to 3001 instead of 3000. Always start the frontend with `PORT=3000 yarn workspace @home/web dev`.
- **Lint/typecheck/build**: `yarn lint`, `yarn typecheck`, `yarn build` from root. No automated tests exist in the codebase.
- After any change to `auth.ts` or the login page, clear the Next.js cache (`rm -rf apps/web/.next`) and restart the dev server, otherwise stale server-action hashes cause `UnrecognizedActionError`.

### Dev login

A credentials-based login provider bypasses Google OAuth for local development. It is controlled by two env vars in `apps/web/.env.local`:

| Env var | Purpose | Default |
|---|---|---|
| `DEV_LOGIN_ENABLED` | Set to `true` to show the dev login form | `false` (disabled) |
| `DEV_LOGIN_PASSWORD` | Shared password for all dev logins | (none) |

When enabled, the login page (`/login`) renders a "Dev Login" form below the Google button with email and password fields.

**How it works:**
- Enter any email address and the configured `DEV_LOGIN_PASSWORD` (currently `devpass123`).
- On first login with a new email, the JWT callback auto-creates a household, family member, and user row in the database. Subsequent logins with the same email reuse the existing user.
- The `signIn` callback skips the `ALLOWED_EMAILS` check for `dev-credentials` logins, so any email works.
- The session and access-token generation is identical to the Google OAuth path — the backend API cannot distinguish dev logins from real ones.

**Browser testing (computerUse / manual):**
1. Navigate to `http://localhost:3000/login`.
2. Type an email (e.g. `dev@example.com`) and the dev password (`devpass123`).
3. Click "Dev Login". After redirect you land on `/dashboard`.
4. All features work: Tasks, Projects, Themes, Lists, Meals, Family, Chat.

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
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql('SELECT id, household_id, email FROM users').then(r => console.table(r));
"
```

**Important notes:**
- The dev login provider is defined in `apps/web/lib/auth.ts` and is only registered when `DEV_LOGIN_ENABLED === "true"`. It is **not** compiled into the app when the flag is absent or `false`.
- Google OAuth also works when real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` secrets are provided. Both login methods can coexist.

### Starting services

```bash
# 1. Start backend (port 3001)
cd /workspace/apps/server && npx tsx watch --env-file=.env src/index.ts &

# 2. Start frontend (port 3000) — explicit PORT avoids the PORT=3001 leak
cd /workspace && PORT=3000 yarn workspace @home/web dev &
```
