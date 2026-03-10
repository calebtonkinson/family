# Runtime And Environment

## Local Runtime

### Frontend

- Package: `@home/web`
- Default port: `3000`
- Start command: `PORT=3000 yarn workspace @home/web dev`

Use an explicit `PORT=3000` when starting the frontend. The backend environment sets `PORT=3001`, and that value can leak into a reused shell.

### Backend

- Package: `@home/server`
- Default port: `3001`
- Start command: `yarn workspace @home/server dev`

The backend bootstraps DBOS and the Hono server. Future tests should import the app without starting the runtime side effects.

## Environment Files

### Frontend

- Local file: `apps/web/.env.local`
- Example file: `apps/web/.env.example`

Expected frontend variables:

- `DATABASE_URL`: database connection for the auth adapter.
- `NEXT_PUBLIC_API_URL`: backend base URL for browser requests.
- `NEXTAUTH_URL`: frontend origin used by auth flows.
- `NEXTAUTH_SECRET`: shared auth signing secret.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: browser push public key.
- `DEV_LOGIN_ENABLED`: enables the local credentials login.
- `DEV_LOGIN_PASSWORD`: shared local development password for the dev login provider.

### Backend

- Local file: `apps/server/.env`
- Example file: `apps/server/.env.example`

Expected backend variables:

- `DATABASE_URL`: application database connection.
- `DBOS_DATABASE_URL`: DBOS metadata database connection. Defaults to `DATABASE_URL` when omitted.
- `NEXTAUTH_SECRET`: token validation secret shared with the frontend.
- `ANTHROPIC_API_KEY`: Anthropic provider access.
- `OPENAI_API_KEY`: OpenAI provider access.
- `GOOGLE_AI_API_KEY`: Google provider access for Gemini and search.
- `GOOGLE_GENERATIVE_AI_API_KEY`: alternate Google key env used by some SDKs.
- `RESEARCH_SEARCH_PROVIDER_ORDER`: preferred provider order for research search.
- `VAPID_PUBLIC_KEY`: push notification public key.
- `VAPID_PRIVATE_KEY`: push notification private key.
- `ALLOWED_ORIGINS`: comma-separated CORS allowlist.
- `PORT`: backend bind port.
- `NEON_LOCAL_PROXY`: optional override for routing Neon HTTP requests through a local proxy.
- `OPENAI_WEB_SEARCH_MODEL`: optional override for OpenAI web search model.
- `GOOGLE_WEB_SEARCH_MODEL`: optional override for Google web search model.

## Environment Contract Rules

- Do not commit real secrets to example files or docs.
- Any newly introduced `process.env.*` usage must be reflected in the appropriate example env file and this document.
- Frontend variables intended for browser use must be prefixed with `NEXT_PUBLIC_`.
- Shared secrets such as `NEXTAUTH_SECRET` must be kept aligned between web and server environments.
