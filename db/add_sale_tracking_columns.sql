-- ============================================================================
-- Adds shipping-label tracking columns to the sales table.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run (including if
-- you already ran an earlier version of this file).
--
-- Needed because the app now stores, per sale:
--   - carrier: USPS or UPS (manual selection, or auto-filled from the
--     Shippo rate's carrier when a label is bought via Shippo)
--   - trackingNumber: carrier tracking number (manual entry, or auto-filled
--     when a label is bought via Shippo)
--   - trackingUrl: link to the carrier's tracking page (Shippo purchases only)
--   - labelUrl: link to the purchased label PDF, so it can be re-downloaded
--     later without relying on the one-shot popup right after purchase
-- ============================================================================

alter table public.sales
  add column if not exists "carrier" text,
  add column if not exists "trackingNumber" text,
  add column if not exists "trackingUrl" text,
  add column if not exists "labelUrl" text;
