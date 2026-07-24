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
  "carrier", "trackingNumber", "trackingUrl", "labelUrl",
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


-- ----------------------------------------------------------------------------
-- SECTION 4 — Role-scoped RLS policies on sales/purchases/expenses
-- ----------------------------------------------------------------------------
-- Why: canWrite()/canDelete() in the app only hide buttons — they were never
-- enforced by the database for these three tables. sales/purchases/expenses
-- only had a blanket "auth_all" policy (ALL commands, any authenticated user,
-- no role check), so any logged-in account — including 'user' or 'viewer' —
-- could INSERT/UPDATE/DELETE these directly via the API, bypassing the UI
-- entirely. product_details and skus already had the correct pattern
-- (separate policies per operation, checking get_user_role()); this section
-- replicates that same pattern here. Discovered 2026-07-23 while reviewing
-- Supabase Dashboard → Database → Policies together with the user.
--
-- The old "auth_all" policy must be dropped, not just left alongside the new
-- ones — RLS policies are OR'd together (permissive by default), so as long
-- as an unconditional blanket policy exists, any more-restrictive policy
-- added alongside it has no effect.

drop policy if exists "auth_all" on public.sales;
drop policy if exists "auth_all" on public.purchases;
drop policy if exists "auth_all" on public.expenses;

create policy "select_all" on public.sales
  for select to authenticated using (true);
create policy "write_admins" on public.sales
  for all to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));
create policy "delete_dba" on public.sales
  for delete to authenticated using (get_user_role() = 'dba');

create policy "select_all" on public.purchases
  for select to authenticated using (true);
create policy "write_admins" on public.purchases
  for all to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));
create policy "delete_dba" on public.purchases
  for delete to authenticated using (get_user_role() = 'dba');

create policy "select_all" on public.expenses
  for select to authenticated using (true);
create policy "write_admins" on public.expenses
  for all to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));
create policy "delete_dba" on public.expenses
  for delete to authenticated using (get_user_role() = 'dba');


-- ----------------------------------------------------------------------------
-- SECTION 5 — Fix: 'write_admins' (FOR ALL) let admin delete too
-- ----------------------------------------------------------------------------
-- Why: Postgres RLS policies are permissive-by-default and OR'd together per
-- command. "write_admins" in Section 4 is declared FOR ALL, which includes
-- DELETE — so even though "delete_dba" only allows 'dba', an admin can still
-- delete via write_admins' own ALL grant. The delete_dba policy was never
-- actually narrowing anything. Fix: split write_admins into INSERT-only and
-- UPDATE-only policies, so DELETE is governed exclusively by delete_dba.
-- Caught independently by two rounds of external (Codex) review.
--
-- NOTE: product_details/skus have this exact same "write_admins FOR ALL"
-- pattern too (it's what Section 4 was modeled on) and have the same bug,
-- but weren't in scope here — ask if you want those fixed the same way.

drop policy if exists "write_admins" on public.sales;
create policy "insert_admins" on public.sales
  for insert to authenticated
  with check (get_user_role() = any (array['dba','admin']));
create policy "update_admins" on public.sales
  for update to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));

drop policy if exists "write_admins" on public.purchases;
create policy "insert_admins" on public.purchases
  for insert to authenticated
  with check (get_user_role() = any (array['dba','admin']));
create policy "update_admins" on public.purchases
  for update to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));

drop policy if exists "write_admins" on public.expenses;
create policy "insert_admins" on public.expenses
  for insert to authenticated
  with check (get_user_role() = any (array['dba','admin']));
create policy "update_admins" on public.expenses
  for update to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));

drop policy if exists "write_admins" on public.product_details;
create policy "insert_admins" on public.product_details
  for insert to authenticated
  with check (get_user_role() = any (array['dba','admin']));
create policy "update_admins" on public.product_details
  for update to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));
-- delete_dba and select_all on product_details are unchanged and already correct.

-- skus is worse than the others: it never got Section 4 at all. "auth_all"
-- (qual=true, with_check=true) grants every operation, unconditionally, to
-- any authenticated user — canWrite()/canDelete() are purely cosmetic for
-- the SKU catalog. "role_select_viewer" is also qual=true despite its name;
-- it doesn't check role and is redundant with select_all below. Confirmed
-- via: select policyname, cmd, roles, qual, with_check from pg_policies
-- where tablename = 'skus';  (run together with the user, 2026-07-24)

drop policy if exists "auth_all" on public.skus;
drop policy if exists "role_select_viewer" on public.skus;
create policy "select_all" on public.skus
  for select to authenticated using (true);
create policy "insert_admins" on public.skus
  for insert to authenticated
  with check (get_user_role() = any (array['dba','admin']));
create policy "update_admins" on public.skus
  for update to authenticated
  using (get_user_role() = any (array['dba','admin']))
  with check (get_user_role() = any (array['dba','admin']));
create policy "delete_dba" on public.skus
  for delete to authenticated using (get_user_role() = 'dba');


-- ----------------------------------------------------------------------------
-- SECTION 6 — Audit trail for sales/purchases/expenses/skus/product_details
-- ----------------------------------------------------------------------------
-- Why: there was no record of who changed or deleted a row, or what it looked
-- like before. Trigger-based (not app-level) so it catches every write
-- regardless of path — the app's DB.save*/delete* calls, a direct edit in the
-- Supabase table editor, a future Edge Function — not just the ones the JS
-- client happens to log itself.
--
-- Query it directly in the SQL editor, e.g.:
--   select * from public.audit_log where table_name = 'sales' order by changed_at desc limit 50;
-- No in-app viewer yet — add one later if this turns out to be needed often.

create table if not exists public.audit_log (
  id          bigserial primary key,
  table_name  text        not null,
  op          text        not null,               -- INSERT | UPDATE | DELETE
  row_id      text,                                -- the app's own id (e.g. 'S-42'), not audit_log's own id
  old_data    jsonb,
  new_data    jsonb,
  changed_by  uuid,                                -- auth.uid(); null for non-authenticated/system writes
  changed_by_role text,
  changed_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "select_dba_admin" on public.audit_log;
create policy "select_dba_admin" on public.audit_log
  for select to authenticated
  using (get_user_role() = any (array['dba','admin']));
-- No insert/update/delete policy for authenticated — rows are only ever
-- written by the SECURITY DEFINER trigger function below, never directly
-- by a client, so the log itself can't be edited or deleted through the API.

create or replace function public.audit_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, op, row_id, old_data, new_data, changed_by, changed_by_role)
  values (
    TG_TABLE_NAME,
    TG_OP,
    coalesce((case when TG_OP = 'DELETE' then old.id else new.id end)::text, null),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    auth.uid(),
    get_user_role()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_sales on public.sales;
create trigger audit_sales
  after insert or update or delete on public.sales
  for each row execute function public.audit_trigger_fn();

drop trigger if exists audit_purchases on public.purchases;
create trigger audit_purchases
  after insert or update or delete on public.purchases
  for each row execute function public.audit_trigger_fn();

drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.audit_trigger_fn();

drop trigger if exists audit_skus on public.skus;
create trigger audit_skus
  after insert or update or delete on public.skus
  for each row execute function public.audit_trigger_fn();

drop trigger if exists audit_product_details on public.product_details;
create trigger audit_product_details
  after insert or update or delete on public.product_details
  for each row execute function public.audit_trigger_fn();
