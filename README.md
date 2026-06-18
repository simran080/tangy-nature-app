# Tangy Nature LLC — Inventory Tracker

A mobile-friendly PWA for tracking camera gear purchases, sales, SKUs, and expenses. Backed by Supabase with role-based access control (DBA / Admin / User).

## Live app
Once GitHub Pages is enabled, this app will be available at:
`https://<your-username>.github.io/<repo-name>/`

## Tech
- Single-file HTML/CSS/JS, no build step
- Supabase (PostgreSQL) for data storage
- Row Level Security with role-based policies

## Note
This repo intentionally does NOT include the database setup/migration script, since that file contains a `service_role` key that must never be made public. Run any future migrations from a local copy only.
