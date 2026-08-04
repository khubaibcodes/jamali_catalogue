-- Jamaali catalogue — access control
--
-- Three audiences:
--   anon           customers browsing the public catalogue
--   staff          add and edit articles and photos
--   owner          everything, including trade rates
--
-- Two independent mechanisms are used together, deliberately:
--   RLS            decides WHICH ROWS you may touch
--   column GRANTs  decide WHICH COLUMNS you may read
-- RLS alone cannot hide `notes` from a customer who can read the row, which is
-- why the grants below are not redundant.

-- --------------------------------------------------------- role helper ----

-- Named `current_staff_role`, not `current_role` — the latter is a reserved
-- PostgreSQL function.
create or replace function public.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$ select public.current_staff_role() = 'owner'; $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$ select public.current_staff_role() is not null; $$;

alter table public.profiles            enable row level security;
alter table public.products            enable row level security;
alter table public.product_trade_rates enable row level security;
alter table public.product_photos      enable row level security;

-- ------------------------------------------------------------- profiles ----

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_owner());

-- Only an owner may change roles — this is what stops a staff account from
-- promoting itself and reading trade rates.
create policy "owner manages profiles"
  on public.profiles for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ------------------------------------------------------------- products ----

create policy "customers read published articles"
  on public.products for select
  to anon
  using (published);

create policy "staff read every article"
  on public.products for select
  to authenticated
  using (public.is_staff());

create policy "staff write articles"
  on public.products for insert
  to authenticated
  with check (public.is_staff());

create policy "staff update articles"
  on public.products for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Deletion is destructive and cascades to photos and rates: owner only.
create policy "owner deletes articles"
  on public.products for delete
  to authenticated
  using (public.is_owner());

-- Column grants. `notes` is withheld from customers; everything else on the
-- table is safe to publish. Revoking first makes the allow-list exhaustive, so
-- a column added later is private until someone grants it explicitly.
revoke all on public.products from anon;
grant select (
  id, code, name, fabric, category, collection,
  stitch, pieces, colours, status, retail_price, updated_at
) on public.products to anon;

-- ---------------------------------------------------------- trade rates ----

-- Owner only. There is intentionally no policy for `anon` or for staff, and
-- with RLS enabled a table with no applicable policy denies everything.
create policy "owner reads trade rates"
  on public.product_trade_rates for select
  to authenticated
  using (public.is_owner());

create policy "owner writes trade rates"
  on public.product_trade_rates for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Belt and braces: even if a policy is added by mistake later, anon holds no
-- grant on this table and cannot read it.
revoke all on public.product_trade_rates from anon, authenticated;
grant select, insert, update, delete on public.product_trade_rates to authenticated;

-- ----------------------------------------------------------------- photos --

create policy "customers read photos of published articles"
  on public.product_photos for select
  to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_photos.product_id and p.published
    )
  );

create policy "staff read every photo"
  on public.product_photos for select
  to authenticated
  using (public.is_staff());

create policy "staff manage photos"
  on public.product_photos for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.product_photos from anon;
grant select (id, product_id, storage_path, width, height, position)
  on public.product_photos to anon;

-- ---------------------------------------------------------------- storage --

-- Photos are world-readable once uploaded; the catalogue is a shopfront and
-- the images are the product. Only staff may write or replace them.
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "anyone views product photos"
  on storage.objects for select
  using (bucket_id = 'product-photos');

create policy "staff upload product photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-photos' and public.is_staff());

create policy "staff replace product photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-photos' and public.is_staff());

create policy "staff remove product photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-photos' and public.is_staff());
