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
| `SUPABASE_URL` | Yes for media | The Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for media | Server-only Storage credential. Never expose it to Vite or commit it. |
| `SUPABASE_STORAGE_BUCKET` | No | Storage bucket name; defaults to `media`. |
| `ADMIN_INITIAL_EMAIL` | Yes on a fresh database | Initial principal administrator email. |
| `ADMIN_INITIAL_PASSWORD` | Yes on a fresh database | Initial password, 12–128 characters. |
| `ADMIN_MASTER_PASSWORD` | Optional | Initial master code, at least 12 characters if set. |
| `ADMIN_INITIAL_NAME` | Optional | Initial administrator display name. |
| `ADMIN_INITIAL_PHONE` | Optional | Initial administrator phone. |

`NODE_ENV` and `NODE_VERSION` are set by the Blueprint. Do not set `PORT` manually; Render provides it.

## Application data and persistence

Accounts already use PostgreSQL. At startup, the server creates the application tables and, under a PostgreSQL advisory lock, imports each recognized legacy `data/*.json` resource only when its target table is empty. A migration marker records the result, including empty files, so deleted collections are not re-imported on later restarts. After migration, CRUD uses PostgreSQL; production requests do not read or write those JSON files. Legacy clients and investors are imported into `app_users`.

The application tables are `app_products`, `app_operations`, `app_subscriptions`, `app_courses`, `app_course_categories`, `app_activities`, `app_documents`, `app_audit_logs`, `app_groups`, and `app_admin_config`. Import markers are stored in `app_data_migrations`; the pre-reset snapshot is stored in `app_backups`. Existing identity/session/security tables remain in use.

## Existing investor accounts

Investor profiles and portfolio totals are stored in `app_users.payload` with `role = 'investor'`. From the administrator's **Investisseurs** tab, choose one of these actions:

- **Activate an existing investor:** use the exact email already on that investor's record and enter a 12–128 character password. The principal-admin-only `POST /api/admin/investors` endpoint updates only password hash fields on the matched row; it preserves the investor ID, email, phone, profile, status, totals, and history.
- **Create a new investor:** provide the same identity fields as public registration (first name, last name, email, phone) and a 12–128 character initial password. Initial invested amount, share count, and dividends may be entered if these values were recorded outside the application. The new account starts with `en_attente` status.
- **Manage an investor:** open **Dossier complet** to review identity, status, portfolio totals, and subscription history. The principal administrator can edit the profile/totals through `PATCH /api/admin/investors/:id`, correct an attached history row through `PATCH /api/admin/investors/:id/subscriptions/:subscriptionId`, and reset a password through `PUT /api/admin/investors/:id/password`. Resetting a password revokes the investor's existing sessions. Passwords are never returned by these endpoints.

Investors can change their own password in their dashboard. `POST /api/investor/change-password` requires the existing authenticated session and the current password; the server stores only a PBKDF2 hash.

No schema migration is required: investor records and profile totals remain in `app_users`, and subscription history remains in `app_subscriptions`. When an administrator changes an investor's email, the application updates only subscription rows with no investor/user ID whose legacy email matches the old address, and does so in the same PostgreSQL transaction as the profile update. Rows with IDs are left intact and continue to be matched by ID. Do not run manual `UPDATE`, `INSERT`, or `DELETE` statements to create or link accounts.

Investor sign-in uses `POST /api/investor/login` with email and password. The server verifies the password hash and issues an HttpOnly session cookie. `GET /api/investor/me` returns the authenticated profile, while `GET /api/investor/subscriptions` returns only history matched to that session's email or investor/user ID aliases. Email is used only when a history row has no investor/user ID; rows with conflicting IDs are excluded. The admin-only detail endpoint uses the same identity matching rules. Do not query or expose all subscription payloads to investor clients.

Wallet balances, cash transactions, and detailed dividend distributions that the current interface stores in browser `localStorage` are not part of the PostgreSQL investor dossier and are not synchronized across devices. The dossier's `totalInvested`, `sharesCount`, and `dividendsEarned` are PostgreSQL profile totals; keep separately recorded local cash histories intact and reconcile them explicitly before attempting any future migration.

Before provisioning, these read-only Supabase SQL checks can confirm the existing record and history. Replace the sample email/ID with the values from the investor's old record; do not run manual `UPDATE`, `INSERT`, or `DELETE` statements to create the account.

```sql
SELECT id, email_normalized, payload->>'name' AS name,
       payload->>'sharesCount' AS shares_count,
       payload->>'totalInvested' AS total_invested
FROM app_users
WHERE role = 'investor'
  AND email_normalized = lower(btrim('investor@example.com'));

SELECT id, payload->>'investorId' AS investor_id,
       payload->>'investorEmail' AS investor_email,
       payload->>'shares' AS shares,
       payload->>'totalAmount' AS total_amount
FROM app_subscriptions
WHERE lower(btrim(payload->>'investorEmail')) = lower(btrim('investor@example.com'))
   OR lower(btrim(payload->>'investor_email')) = lower(btrim('investor@example.com'))
   OR payload->>'investorId' = 'legacy-investor-id'
   OR payload->>'investor_id' = 'legacy-investor-id'
   OR payload->>'userId' = 'legacy-investor-id'
   OR payload->>'user_id' = 'legacy-investor-id'
ORDER BY position ASC, id ASC;
```

## Supabase Storage for media

Uploads and videos are stored in the public Supabase Storage bucket configured by `SUPABASE_STORAGE_BUCKET` (default `media`). Create that bucket in Supabase Storage and mark it **public** so the browser can read the returned public URLs. Keep write access private: uploads are sent by the authenticated admin API using `SUPABASE_SERVICE_ROLE_KEY`, which must remain server-side and must never use a `VITE_` variable name. Configure a 50 MiB file limit and allow `image/avif`, `image/gif`, `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/quicktime`, and `video/webm`.

The server stores uploaded objects under `uploads/` and `videos/`. New uploads return their Supabase public URL. Existing `/uploads/<filename>` and `/assets/videos/<filename>` links are redirected to the matching Storage object after it has been migrated. If Storage credentials are absent, new uploads fail explicitly; the local filesystem is only a development fallback for old files and bundled videos. Render's filesystem is ephemeral, so do not depend on that fallback in production.

The admin interface still retains its existing fallback: if `/api/upload` fails, files smaller than 3 MiB may be stored as base64 data URLs in application data. This behavior was intentionally left unchanged, so complete removal of media from PostgreSQL requires disabling that frontend fallback.

To migrate files still present locally, copy the Storage variables into the local `.env`, create the public bucket first, and preview the transfer:

```sh
npm run migrate:media -- --dry-run
```

Then upload them:

```sh
npm run migrate:media
```

The script scans `public/uploads` and `public/assets/videos`, preserves relative filenames, validates file types and sizes, skips existing objects, and never deletes local originals. It can be rerun safely. After checking that migrated media loads from Supabase, deploy the same three Storage variables to Render. The repository's local media files may remain as source assets, but runtime uploads are not written to Render's disk.
