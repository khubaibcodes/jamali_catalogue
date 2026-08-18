-- Two genuinely new things for the public catalogue. Everything else the
-- Phase 3 brief asked for already existed under a different name.

-- 1. Colours become a real array.
--
-- They were a comma-separated string, which is fine to display and useless to
-- query or render as swatches. An array also stops "Ivory,Rose" and
-- "Ivory, Rose" being different values.
alter table public.products
  add column if not exists colors text[] not null default '{}';

update public.products
set colors = coalesce(
  (
    select array_agg(trimmed)
    from (
      select btrim(part) as trimmed
      from unnest(string_to_array(colours, ',')) as part
      where btrim(part) <> ''
    ) cleaned
  ),
  '{}'
)
where colours is not null and colours <> '' and colors = '{}';

alter table public.products drop column if exists colours;

-- 2. A customer-facing notes field.
--
-- `notes` stays internal and stays revoked from anon: it routinely carries
-- trade terms like "min 5 pcs wholesale". Repurposing it would have published
-- exactly the thing the schema was split to protect, so design_notes is a
-- separate column with its own grant.
alter table public.products
  add column if not exists design_notes text not null default '';

comment on column public.products.notes is
  'Internal only. Never granted to anon — may contain trade terms.';
comment on column public.products.design_notes is
  'Customer-facing. Embroidery, cut, styling detail. Safe to publish.';

-- The anon grant is an allow-list, so new columns are private until named
-- here. Without this the shopfront simply would not see them.
grant select (colors, design_notes) on public.products to anon;
