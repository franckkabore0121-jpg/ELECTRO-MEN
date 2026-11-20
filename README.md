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

## Application data and persistence

Accounts already use PostgreSQL. At startup, the server creates the application tables and, under a PostgreSQL advisory lock, imports each recognized legacy `data/*.json` resource only when its target table is empty. A migration marker records the result, including empty files, so deleted collections are not re-imported on later restarts. After migration, CRUD uses PostgreSQL; production requests do not read or write those JSON files. Legacy clients and investors are imported into `app_users`.

The application tables are `app_products`, `app_operations`, `app_subscriptions`, `app_courses`, `app_course_categories`, `app_activities`, `app_documents`, `app_audit_logs`, `app_groups`, and `app_admin_config`. Import markers are stored in `app_data_migrations`; the pre-reset snapshot is stored in `app_backups`. Existing identity/session/security tables remain in use.

Uploads under `public/uploads` are still written to the local filesystem, and bundled videos are read from `public/assets/videos` or `dist/assets/videos`. Render's default filesystem is ephemeral, so uploaded media can be lost on restart or redeploy. Move uploads to Supabase Storage (or another object store) before relying on them in production; keep deployed static assets in the build or an object store.
