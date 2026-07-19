-- ============================================================================
-- One-time backfill: for purchases that are already sold, set "listedDate"
-- equal to the purchase date ("date"), since historical listings weren't
-- tracked separately. Run once in the Supabase SQL editor.
--
-- Safe to re-run — only touches rows where "listedDate" is still empty, so
-- it will never overwrite a value you (or the app) set afterward. Going
-- forward, listedDate is entered separately per purchase in the app.
--
-- A purchase counts as "sold" if purchases.sold = true OR there's a
-- matching row in sales.purchaseId.
-- ============================================================================

update public.purchases p
set "listedDate" = p.date
where ("listedDate" is null or "listedDate" = '')
  and (
    p.sold = true
    or exists (
      select 1 from public.sales s where s."purchaseId" = p.id
    )
  );
