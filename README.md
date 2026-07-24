# Tangy Nature LLC — Inventory Tracker

A mobile-friendly PWA for tracking camera gear purchases, sales, SKUs, and expenses. Backed by Supabase with role-based access control (DBA / Admin / User / Viewer).

## Live app
`https://simran080.github.io/tangy-nature-app/`

## Tech
- Modular HTML/CSS/JS (`js/*.js`), no build step or framework
- Supabase (PostgreSQL) for data storage
- Row Level Security with role-based policies (`db/security_migration.sql`)
- Supabase Edge Functions (`supabase/functions/`) for privileged server-side operations — buying Shippo shipping labels and managing user roles — so secrets and the `service_role` key never reach the browser
- Financial data for masked roles is enforced at the database level via views (`sales_v`/`purchases_v`/`expenses_v`), not just hidden in the UI

## Database migrations
`db/*.sql` files are committed and contain no secrets — they're plain SQL run manually in the Supabase SQL editor. `db/security_migration.sql` is the main one; read the comments in each section before running, some are one-time and some depend on an earlier section already being applied.

## Edge Functions
See `supabase/functions/*/README.md` for setup and deploy instructions for each function.

## Tests
`node --test` — see `tests/README.md` for scope.
