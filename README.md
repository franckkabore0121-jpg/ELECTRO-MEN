<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# ELECTRO-MEN

## Run locally

Prerequisite: Node.js 24.22.1 (or a Vite-compatible Node.js version).

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `ADMIN_INITIAL_EMAIL`, and `ADMIN_INITIAL_PASSWORD`.
3. Start the development server with `npm run dev`.

The initial administrator email and password must be set together. The initial password must contain 12–128 characters. `ADMIN_MASTER_PASSWORD` is optional and, when set, must contain at least 12 characters. Secrets belong in environment variables, never in source control.

## PostgreSQL identity store

Client, investor, and administrator accounts, roles, OTP challenges, sessions, administrator security settings, and operation inventory use PostgreSQL through `DATABASE_URL`. Supabase is supported because it provides PostgreSQL. Startup fails if the database cannot be initialized.

For a fresh database, set `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` to bootstrap the principal administrator. Passwords are stored hashed. Changing these variables later does not reset an existing administrator password. Legacy account data is imported at startup.

## Deploy to Render

The root `render.yaml` configures a Node.js web service:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health` (checks PostgreSQL availability)
- Render supplies `PORT`; the server binds to `0.0.0.0`.

Set these variables in Render's environment:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase/PostgreSQL connection string; use the connection string from Supabase **Connect**. |
| `ADMIN_INITIAL_EMAIL` | Yes on a fresh database | Initial principal administrator email. |
| `ADMIN_INITIAL_PASSWORD` | Yes on a fresh database | Initial password, 12–128 characters. |
| `ADMIN_MASTER_PASSWORD` | Optional | Initial master code, at least 12 characters if set. |
| `ADMIN_INITIAL_NAME` | Optional | Initial administrator display name. |
| `ADMIN_INITIAL_PHONE` | Optional | Initial administrator phone. |

`NODE_ENV` and `NODE_VERSION` are set by the Blueprint. Do not set `PORT` manually; Render provides it.

## Persistence warning

The identity store is in PostgreSQL, but products, operations, subscriptions, courses, categories, audit logs, administrator configuration, and uploaded files are still read from or written to local JSON files and `public/uploads`. Render's default filesystem is ephemeral, so runtime changes to those files can be lost on redeploy or restart. The recommended production design is to move structured application data into PostgreSQL and store uploaded media in Supabase Storage. A Render persistent disk is a paid, single-instance fallback, not a substitute for shared object storage or a database.
