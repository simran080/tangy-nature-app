-- ============================================================================
-- Tangy Nature — Security & integrity migration
-- Run in the Supabase SQL editor (as the project owner). No secrets in this file.
-- Each section is idempotent and safe to re-run. Read the notes before running.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 1 — Move role out of user_metadata (SELF-EDITABLE) into app_metadata
--             (admin-only). REQUIRED — this closes a privilege-escalation hole.
-- ----------------------------------------------------------------------------
-- Why: Supabase lets a signed-in user rewrite their own `user_metadata` via the
-- standard auth API. If roles live there, a "viewer" can promote themselves to
-- "dba". `app_metadata` can only be written with the service_role key, so roles
-- belong there. RLS must key off app_metadata, not user_metadata.

-- 1a. Copy every existing user's role from user_metadata -> app_metadata.
update auth.users
set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', raw_user_meta_data->>'role')
where raw_user_meta_data ? 'role';

-- 1b. Redefine the role helper to read app_metadata first, with a temporary
--     fallback to user_metadata so nobody is locked out until every session has
--     refreshed its JWT. Remove the fallback (SECTION 1d) once confirmed.
create or replace function public.get_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json -> 'app_metadata'  ->> 'role', ''),
    nullif(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role', ''),
    'user'
  );
$$;

-- 1c. Have every user re-login (or wait ~1h for token refresh) so their JWT
--     carries app_metadata.role. The web app already prefers app_metadata.

-- 1d. AFTER everyone has a fresh token, harden by dropping the fallback and
--     scrubbing the old copy. Run these two statements on a later day:
--
--   create or replace function public.get_user_role()
--   returns text language sql stable as $$
--     select coalesce(
--       nullif(current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role', ''),
--       'user');
--   $$;
--
--   update auth.users
--   set raw_user_meta_data = raw_user_meta_data - 'role'
--   where raw_user_meta_data ? 'role';


-- ----------------------------------------------------------------------------
-- SECTION 2 — Hide financial columns from "viewer" role at the DATABASE
--             (DECISION REQUIRED — needs a matching app change, see notes).
-- ----------------------------------------------------------------------------
-- Why: the app's hideFin() only blurs numbers in the DOM. A viewer can still
-- read every profit/cost value from the raw API with their own token. Real
-- enforcement means the database must not return those columns to viewers.
--
-- Approach: expose masking VIEWS that null out money columns for viewers,
-- revoke direct table reads from the `authenticated` role, and point the app's
-- reads at the views. RLS (row filtering) stays on the base tables.
--
-- NOTE: after creating these, the app must SELECT from sales_v / purchases_v /
-- expenses_v instead of sales / purchases / expenses. Tell me to wire that up.

create or replace view public.sales_v
with (security_invoker = true) as
select
  id, "purchaseId", "skuId", date, source, state,
  "isTrade", "tradePurchaseIds", "paypalReleased", comments,
  "trackingNumber", "trackingUrl", "labelUrl",
  case when get_user_role() = 'viewer' then null else "unitPrice"       end as "unitPrice",
  case when get_user_role() = 'viewer' then null else "grossSale"       end as "grossSale",
  case when get_user_role() = 'viewer' then null else fees              end as fees,
  case when get_user_role() = 'viewer' then null else "feesPct"         end as "feesPct",
  case when get_user_role() = 'viewer' then null else "feesFixed"       end as "feesFixed",
  case when get_user_role() = 'viewer' then null else "shippingCharged" end as "shippingCharged",
  case when get_user_role() = 'viewer' then null else "shippingPaid"    end as "shippingPaid",
  case when get_user_role() = 'viewer' then null else ga                end as ga,
  case when get_user_role() = 'viewer' then null else "netSale"         end as "netSale",
  case when get_user_role() = 'viewer' then null else "netCost"         end as "netCost",
  case when get_user_role() = 'viewer' then null else profit            end as profit,
  case when get_user_role() = 'viewer' then null else margin            end as margin
from public.sales;

create or replace view public.purchases_v
with (security_invoker = true) as
select
  id, "skuId", date, source, state, qty, "paymentVia", condition,
  "isTrade", "tradeSaleIds", sold, comments,
  case when get_user_role() = 'viewer' then null else "pricePerPiece" end as "pricePerPiece",
  case when get_user_role() = 'viewer' then null else shipping        end as shipping,
  case when get_user_role() = 'viewer' then null else gas             end as gas,
  case when get_user_role() = 'viewer' then null else "netCost"       end as "netCost"
from public.purchases;

create or replace view public.expenses_v
with (security_invoker = true) as
select
  id, type, product, source, date, qty,
  case when get_user_role() = 'viewer' then null else price       end as price,
  case when get_user_role() = 'viewer' then null else discount    end as discount,
  case when get_user_role() = 'viewer' then null else "taxAmount" end as "taxAmount",
  case when get_user_role() = 'viewer' then null else "netAmount" end as "netAmount"
from public.expenses;

-- Lock direct reads once the app points at the views (uncomment when ready):
--   revoke select on public.sales, public.purchases, public.expenses from authenticated;
--   grant  select on public.sales_v, public.purchases_v, public.expenses_v to authenticated;


-- ----------------------------------------------------------------------------
-- SECTION 3 — Remove client-side ID collision risk (OPTIONAL)
-- ----------------------------------------------------------------------------
-- Why: the app computes the next P-/S- id as max+1 locally. Two devices adding
-- at once can mint the same id and silently overwrite. Generate ids server-side
-- so they're allocated atomically. After running, the app must OMIT id on insert
-- for purchases/sales (let the default fill it). Tell me to make that change.

create sequence if not exists public.purchase_id_seq;
create sequence if not exists public.sale_id_seq;

-- Seed the sequences past the current max so we never reuse an existing id.
select setval('public.purchase_id_seq',
  greatest(1, coalesce((select max((regexp_replace(id,'\D','','g'))::int) from public.purchases), 0)));
select setval('public.sale_id_seq',
  greatest(1, coalesce((select max((regexp_replace(id,'\D','','g'))::int) from public.sales), 0)));

alter table public.purchases
  alter column id set default 'P-' || lpad(nextval('public.purchase_id_seq')::text, 5, '0');
alter table public.sales
  alter column id set default 'S-' || lpad(nextval('public.sale_id_seq')::text, 5, '0');
