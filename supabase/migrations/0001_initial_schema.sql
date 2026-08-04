-- Jamaali catalogue — initial schema
--
-- The one structural decision worth understanding: trade rates (reseller,
-- wholesale, MOQ) live in their OWN table, not as columns on `products`.
--
-- Two groups must never see them — customers, and staff. Splitting them out
-- means that protection is a property of the schema rather than a promise that
-- every future SELECT will be written correctly. There is simply no row in
-- `products` that carries a wholesale rate.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

create type public.staff_role   as enum ('owner', 'staff');
create type public.stitch_state as enum ('Unstitched', 'Stitched');
create type public.piece_count  as enum ('1-Piece', '2-Piece', '3-Piece', '4-Piece');
create type public.article_status as enum ('Available', 'New', 'Low stock', 'Sold out');

-- ------------------------------------------------------------- profiles ----

-- One row per person who can sign in. `role` is what every policy keys off.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text        not null default '',
  role       public.staff_role not null default 'staff',
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Staff accounts. role=owner sees trade rates; role=staff never does.';

-- ------------------------------------------------------------- products ----

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  name         text not null default '',
  fabric       text not null default '',
  category     text not null default '',
  collection   text not null default '',
  stitch       public.stitch_state   not null default 'Unstitched',
  pieces       public.piece_count    not null default '3-Piece',
  colours      text not null default '',
  status       public.article_status not null default 'Available',

  -- The only price customers ever see.
  retail_price integer check (retail_price is null or retail_price >= 0),

  -- Internal working notes. Revoked from anon in 0002 — these often mention
  -- trade terms, so they must not ride along on the public catalogue.
  notes        text not null default '',

  -- Nothing is customer-visible until this is switched on deliberately.
  published    boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Article codes are how customers quote an item, so they must be unique —
-- case-insensitively, because "jm-101" and "JM-101" are the same article.
create unique index products_code_key on public.products (upper(code));
create index products_published_idx  on public.products (published) where published;
create index products_category_idx   on public.products (lower(category));
create index products_collection_idx on public.products (lower(collection));

-- ---------------------------------------------------------- trade rates ----

create table public.product_trade_rates (
  product_id uuid primary key references public.products (id) on delete cascade,
  reseller   integer check (reseller  is null or reseller  >= 0),
  wholesale  integer check (wholesale is null or wholesale >= 0),
  moq        integer check (moq       is null or moq       >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.product_trade_rates is
  'Owner-only. No anon or staff policy exists for this table by design.';

-- ---------------------------------------------------------------- photos ----

create table public.product_photos (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  -- Path inside the `product-photos` storage bucket, not a signed URL, so the
  -- rows stay valid however the files are later served.
  storage_path text not null,
  width        integer,
  height       integer,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

-- Position 0 is the cover shot used on cards and catalogue tiles.
create unique index product_photos_order_key on public.product_photos (product_id, position);
create index product_photos_product_idx on public.product_photos (product_id);

-- ------------------------------------------------------ updated_at trigger --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

create trigger trade_rates_touch_updated_at
  before update on public.product_trade_rates
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------- new sign-up handling --

-- Everyone who signs up starts as staff. Promoting someone to owner is a
-- deliberate manual act, so a new account can never grant itself rate access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
