/**
 * The customer-facing read path.
 *
 * These queries run on the server and name their columns explicitly. Row level
 * security already denies trade rates and notes to a signed-out visitor, but
 * `published` is filtered here too rather than relying on the policy alone: an
 * owner browsing the shopfront should see exactly what a customer sees, not a
 * preview salted with their own drafts.
 */

import { publicUrl } from "./photos";
import { anonClient } from "./supabase/clients";
import type { PhotoRow, ProductRow } from "./supabase/database.types";
import type { Photo, Pieces, Status, Stitch } from "./types";

/**
 * Only the fields a customer is allowed to see. `notes` is absent on purpose.
 *
 * Never use `select("*")` on these tables. The customer's grant is a
 * column-level allow-list, and `*` asks for every column including ones that
 * were never granted — Postgres then refuses the whole query, which reads as
 * "no results" rather than as an error. That is exactly how the photos
 * silently disappeared from the shopfront.
 */
const PUBLIC_COLUMNS =
  "id, code, name, fabric, category, collection, stitch, pieces, colors, design_notes, status, retail_price, updated_at";

const PUBLIC_PHOTO_COLUMNS = "id, product_id, storage_path, width, height, position";

export interface ShopArticle {
  id: string;
  code: string;
  name: string;
  fabric: string;
  category: string;
  collection: string;
  stitch: Stitch;
  pieces: Pieces;
  colours: string[];
  /** Customer-facing. The internal `notes` column is never selected here. */
  designNotes: string;
  status: Status;
  retail: number | null;
  photos: Photo[];
}

export async function listArticles(filter?: { category?: string; collection?: string }) {
  const supabase = anonClient();

  let query = supabase
    .from("products")
    .select(PUBLIC_COLUMNS)
    .eq("published", true)
    .order("updated_at", { ascending: false });

  if (filter?.category) query = query.eq("category", filter.category);
  if (filter?.collection) query = query.eq("collection", filter.collection);

  const { data, error } = await query;
  if (error || !data?.length) return [];

  const photos = await fetchPhotos(supabase, data.map((row) => row.id));
  return data.map((row) => toArticle(row as ProductRow, photos.get(row.id) ?? []));
}

export async function findArticle(code: string): Promise<ShopArticle | null> {
  const supabase = anonClient();

  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_COLUMNS)
    .eq("published", true)
    .ilike("code", code)
    .maybeSingle();

  if (error || !data) return null;

  const photos = await fetchPhotos(supabase, [data.id]);
  return toArticle(data as ProductRow, photos.get(data.id) ?? []);
}

/** Distinct categories and collections across the published catalogue. */
export async function browseFacets() {
  const supabase = anonClient();
  const { data } = await supabase
    .from("products")
    .select("category, collection")
    .eq("published", true);

  const categories = new Set<string>();
  const collections = new Set<string>();
  for (const row of data ?? []) {
    if (row.category?.trim()) categories.add(row.category.trim());
    if (row.collection?.trim()) collections.add(row.collection.trim());
  }
  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    collections: [...collections].sort((a, b) => a.localeCompare(b)),
  };
}

/* ---------------------------------------------------------------- helpers */

type Client = ReturnType<typeof anonClient>;

async function fetchPhotos(supabase: Client, productIds: string[]) {
  if (!productIds.length) return new Map<string, PhotoRow[]>();
  const { data } = await supabase
    .from("product_photos")
    .select(PUBLIC_PHOTO_COLUMNS)
    .in("product_id", productIds)
    .order("position");

  const grouped = new Map<string, PhotoRow[]>();
  for (const row of (data ?? []) as PhotoRow[]) {
    const bucket = grouped.get(row.product_id);
    if (bucket) bucket.push(row);
    else grouped.set(row.product_id, [row]);
  }
  return grouped;
}

function toArticle(row: ProductRow, photos: PhotoRow[]): ShopArticle {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    fabric: row.fabric,
    category: row.category,
    collection: row.collection,
    stitch: row.stitch as Stitch,
    pieces: row.pieces as Pieces,
    colours: row.colors ?? [],
    designNotes: row.design_notes ?? "",
    status: row.status as Status,
    retail: row.retail_price,
    photos: photos.map((p) => ({ id: p.id, path: p.storage_path, url: publicUrl(p.storage_path) })),
  };
}
