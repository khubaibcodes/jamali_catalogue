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
import { publicVideoUrl } from "./videos";
import { anonClient } from "./supabase/clients";
import type { PhotoRow, ProductRow, VideoRow } from "./supabase/database.types";
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
/** `created_at` is not granted to anon — naming columns is mandatory here. */
const PUBLIC_VIDEO_COLUMNS = "id, product_id, storage_path, position";

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
  /**
   * Clips for the live page. Absent from every PDF: react-pdf cannot embed
   * video, and the type is separate from Photo so it can't be passed to one
   * by mistake.
   */
  videos: Photo[];
  /** Customer-facing. The internal `notes` column is never selected here. */
  designNotes: string;
  status: Status;
  retail: number | null;
  photos: Photo[];
}

/**
 * One order for the shopfront and the PDF alike: collection, then article
 * code. A catalogue whose printed sequence disagrees with the website is
 * confusing to anyone holding both, which ruled out "recently updated first".
 * Postgres sorts nulls and empties oddly, so it is applied in JS.
 */
export function catalogueOrder(a: ShopArticle, b: ShopArticle): number {
  const byCollection = (a.collection || "￿").localeCompare(b.collection || "￿");
  if (byCollection !== 0) return byCollection;
  return a.code.localeCompare(b.code, "en", { numeric: true });
}

export async function listArticles(filter?: { category?: string; collection?: string }) {
  const supabase = anonClient();

  let query = supabase
    .from("products")
    .select(PUBLIC_COLUMNS)
    .eq("published", true);

  if (filter?.category) query = query.eq("category", filter.category);
  if (filter?.collection) query = query.eq("collection", filter.collection);

  const { data, error } = await query;
  if (error || !data?.length) return [];

  const photos = await fetchPhotos(supabase, data.map((row) => row.id));
  return data
    .map((row) => toArticle(row as ProductRow, photos.get(row.id) ?? []))
    .sort(catalogueOrder);
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

  // Videos are fetched only here. The grid shows stills, so querying clips for
  // every tile would be a wasted round trip on the busiest page.
  const [photos, videos] = await Promise.all([
    fetchPhotos(supabase, [data.id]),
    fetchVideos(supabase, data.id),
  ]);
  return toArticle(data as ProductRow, photos.get(data.id) ?? [], videos);
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

async function fetchVideos(supabase: Client, productId: string): Promise<VideoRow[]> {
  const { data } = await supabase
    .from("product_videos")
    .select(PUBLIC_VIDEO_COLUMNS)
    .eq("product_id", productId)
    .order("position");
  return (data ?? []) as VideoRow[];
}

function toArticle(row: ProductRow, photos: PhotoRow[], videos: VideoRow[] = []): ShopArticle {
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
    videos: videos.map((v) => ({
      id: v.id,
      path: v.storage_path,
      url: publicVideoUrl(v.storage_path),
    })),
  };
}
