-- Video for the live shopfront. Never appears in a PDF — a PDF cannot hold one.
--
-- A separate bucket rather than reusing product-photos: that bucket is capped
-- at 10 MB and its allowed_mime_types list is images only, so a video upload
-- would be refused by Storage before RLS ever saw it.

create table if not exists public.product_videos (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

-- Same shape as product_photos: position 0 first, one row per clip.
create unique index if not exists product_videos_order_key
  on public.product_videos (product_id, position);
create index if not exists product_videos_product_idx
  on public.product_videos (product_id);

comment on table public.product_videos is
  'Clips shown on the live article page. Excluded from PDF exports.';

alter table public.product_videos enable row level security;

-- Customers see clips only for articles that are published, mirroring photos.
create policy "customers read videos of published articles"
  on public.product_videos for select
  to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = product_videos.product_id and p.published
    )
  );

create policy "staff read every video"
  on public.product_videos for select
  to authenticated
  using (public.is_staff());

create policy "staff manage videos"
  on public.product_videos for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- The anon grant is an allow-list, exactly as on products and product_photos.
-- `created_at` is deliberately omitted, which is why the shopfront query must
-- name its columns and must never use select("*").
revoke all on public.product_videos from anon;
grant select (id, product_id, storage_path, position)
  on public.product_videos to anon;

-- ---------------------------------------------------------------- storage --

-- 25 MB: Supabase's own ceiling on this plan is higher, but a clip larger than
-- this is unusable to a customer on mobile data, which is most of them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-videos', 'product-videos', true, 26214400,
  -- quicktime included because iPhones record .mov, not .mp4.
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

create policy "anyone views product videos"
  on storage.objects for select
  using (bucket_id = 'product-videos');

create policy "staff upload product videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-videos' and public.is_staff());

create policy "staff replace product videos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-videos' and public.is_staff());

create policy "staff remove product videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-videos' and public.is_staff());
