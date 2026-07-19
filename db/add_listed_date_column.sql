-- ============================================================================
-- Adds a "listedDate" column to the purchases table.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Needed because "Date" on a purchase is when the item was bought, not when
-- it went up for sale. Without a separate listed-on date, the real time an
-- item sat on the shelf before selling (listed -> sold) can't be measured --
-- only purchased -> sold, which conflates acquisition lag with selling time.
-- ============================================================================

alter table public.purchases
  add column if not exists "listedDate" text;
