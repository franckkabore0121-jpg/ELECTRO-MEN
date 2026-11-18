<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/212dba6c-fd8c-4b5e-a447-37b6892d27bb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## PostgreSQL identity store

All client, investor, and administrator accounts, roles, OTP challenges, and server-side sessions use the same PostgreSQL connection and `app_users`/`app_sessions` tables. There is no SQLite or in-memory fallback. Set `DATABASE_URL` before starting the server; startup fails explicitly if it is missing or the database cannot be initialized. PostgreSQL creates the schema and unique indexes at startup.

On the first deployment, set `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` (12–128 characters) to bootstrap the principal administrator if no principal account is migrated. The credentials are stored hashed in PostgreSQL; do not commit them. Existing client and investor JSON files and administrator records are imported once, then the legacy client/investor files are archived with a `.migrated` suffix. Import collisions stop startup instead of silently discarding an account. Investor password changes require the authenticated investor session.

On Render, configure `DATABASE_URL`, `ADMIN_INITIAL_EMAIL`, and `ADMIN_INITIAL_PASSWORD` as secrets and connect `DATABASE_URL` to a managed PostgreSQL database. The application does not provide a production database URL. Other application content (such as products and operations) still uses local JSON files and is not included in this account-store migration.
