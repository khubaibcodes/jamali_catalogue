/**
 * Catalogue persistence against Supabase. This is the file that replaced
 * lib/storage.ts; everything else in lib/ was unaffected by the move.
 *
 * An article is spread over three tables — products, product_trade_rates and
 * product_photos — so that trade rates can be denied to staff and customers by
 * the database itself. This module is where that split is stitched back into
 * the single `Product` the UI works with.
 *
 * A staff session reads *zero rows* from product_trade_rates. That is not an
 * error and must not be reported as one: it is the design working.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { publicUrl } from "./photos";
import { publicVideoUrl } from "./videos";
import type {
  Database,
  PhotoRow,
  ProductRow,
  TradeRateRow,
  VideoRow,
} from "./supabase/database.types";
import type { Pieces, Product, ProductDraft, Status, Stitch } from "./types";

type Client = SupabaseClient<Database>;

const PRODUCT_COLUMNS =
  "id, code, name, fabric, category, collection, stitch, pieces, colors, design_notes, status, retail_price, notes, published, created_at, updated_at";

/* ------------------------------------------------------------------ read */

export async function fetchProducts(supabase: Client): Promise<Product[]> {
  const [products, rates, photos, videos] = await Promise.all([
    supabase.from("products").select(PRODUCT_COLUMNS).order("code"),
    supabase.from("product_trade_rates").select("*"),
    supabase.from("product_photos").select("*").order("position"),
    supabase.from("product_videos").select("*").order("position"),
  ]);

  if (products.error) throw describe(products.error, "load the catalogue");
  // Rates failing is expected for staff — treat it as "none visible", not a fault.
  if (photos.error) throw describe(photos.error, "load the photos");
  if (videos.error) throw describe(videos.error, "load the videos");

  const rateFor = new Map((rates.data ?? []).map((r) => [r.product_id, r]));
  const photosFor = groupBy(photos.data ?? [], (p) => p.product_id);
  const videosFor = groupBy(videos.data ?? [], (v) => v.product_id);

  return (products.data ?? []).map((row) =>
    toProduct(
      row as ProductRow,
      rateFor.get(row.id),
      photosFor.get(row.id) ?? [],
      videosFor.get(row.id) ?? [],
    ),
  );
}

/* ----------------------------------------------------------------- write */

/**
 * Creates or updates an article and its rates together.
 *
 * The two writes are separate statements, so a staff member editing an article
 * updates `products` and simply never touches the rate row — which is what
 * keeps their edit from wiping rates they cannot see.
 */
export async function saveProduct(
  supabase: Client,
  draft: ProductDraft,
  id: string | undefined,
  canWriteTradeRates: boolean,
): Promise<Product> {
  const record = {
    code: draft.code.trim().toUpperCase(),
    name: draft.name,
    fabric: draft.fabric,
    category: draft.category,
    collection: draft.collection,
    stitch: draft.stitch,
    pieces: draft.pieces,
    colors: draft.colours,
    design_notes: draft.designNotes,
    status: draft.status,
    retail_price: draft.prices.retail,
    notes: draft.notes,
    published: draft.published,
  };

  const saved = id
    ? await supabase.from("products").update(record).eq("id", id).select(PRODUCT_COLUMNS).single()
    : await supabase.from("products").insert(record).select(PRODUCT_COLUMNS).single();

  if (saved.error) throw describe(saved.error, "save the article");
  const row = saved.data as ProductRow;

  let rate: TradeRateRow | undefined;
  if (canWriteTradeRates) {
    const written = await supabase
      .from("product_trade_rates")
      .upsert({
        product_id: row.id,
        reseller: draft.prices.reseller,
        wholesale: draft.prices.wholesale,
        moq: draft.moq,
      })
      .select("*")
      .single();
    if (written.error) throw describe(written.error, "save the trade rates");
    rate = written.data as TradeRateRow;
  }

  const [photos, videos] = await Promise.all([
    supabase.from("product_photos").select("*").eq("product_id", row.id).order("position"),
    supabase.from("product_videos").select("*").eq("product_id", row.id).order("position"),
  ]);

  return toProduct(row, rate, photos.data ?? [], videos.data ?? []);
}

export async function deleteProduct(supabase: Client, id: string): Promise<void> {
  // Rates and photo rows cascade; the storage objects are removed by the caller,
  // which knows the paths.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw describe(error, "delete the article");
}

/** Rewrites the photo order for one article, cover first. */
export async function savePhotoOrder(
  supabase: Client,
  productId: string,
  photoIdsInOrder: string[],
): Promise<void> {
  // A unique (product_id, position) index means positions can't be shuffled
  // in place without colliding, so they're parked out of range first.
  const park = photoIdsInOrder.map((photoId, index) =>
    supabase.from("product_photos").update({ position: -(index + 1) }).eq("id", photoId),
  );
  for (const step of park) {
    const { error } = await step;
    if (error) throw describe(error, "reorder the photos");
  }

  for (const [index, photoId] of photoIdsInOrder.entries()) {
    const { error } = await supabase
      .from("product_photos")
      .update({ position: index })
      .eq("id", photoId);
    if (error) throw describe(error, "reorder the photos");
  }
}

export async function addPhotoRow(
  supabase: Client,
  productId: string,
  storagePath: string,
  position: number,
): Promise<PhotoRow> {
  const { data, error } = await supabase
    .from("product_photos")
    .insert({ product_id: productId, storage_path: storagePath, position, width: null, height: null })
    .select("*")
    .single();
  if (error) throw describe(error, "attach the photo");
  return data as PhotoRow;
}

export async function removePhotoRow(supabase: Client, photoId: string): Promise<void> {
  const { error } = await supabase.from("product_photos").delete().eq("id", photoId);
  if (error) throw describe(error, "remove the photo");
}

export async function addVideoRow(
  supabase: Client,
  productId: string,
  storagePath: string,
  position: number,
): Promise<VideoRow> {
  const { data, error } = await supabase
    .from("product_videos")
    .insert({ product_id: productId, storage_path: storagePath, position })
    .select("*")
    .single();
  if (error) throw describe(error, "attach the video");
  return data as VideoRow;
}

export async function removeVideoRow(supabase: Client, videoId: string): Promise<void> {
  const { error } = await supabase.from("product_videos").delete().eq("id", videoId);
  if (error) throw describe(error, "remove the video");
}

export async function isCodeTaken(
  supabase: Client,
  code: string,
  exceptId?: string,
): Promise<boolean> {
  let query = supabase.from("products").select("id").ilike("code", code.trim());
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query.limit(1);
  if (error) throw describe(error, "check the article code");
  return (data ?? []).length > 0;
}

/* ---------------------------------------------------------------- mapping */

function toProduct(
  row: ProductRow,
  rate: TradeRateRow | undefined,
  photos: PhotoRow[],
  videos: VideoRow[],
): Product {
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
    prices: {
      retail: row.retail_price,
      reseller: rate?.reseller ?? null,
      wholesale: rate?.wholesale ?? null,
    },
    moq: rate?.moq ?? null,
    notes: row.notes,
    published: row.published,
    photos: photos.map((p) => ({ id: p.id, path: p.storage_path, url: publicUrl(p.storage_path) })),
    videos: videos.map((v) => ({
      id: v.id,
      path: v.storage_path,
      url: publicVideoUrl(v.storage_path),
    })),
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Turns Postgres error codes into something a shopkeeper can act on. */
function describe(error: { code?: string; message: string }, action: string): Error {
  if (error.code === "23505") {
    return new Error("That article code is already in the catalogue.");
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    return new Error("Your account isn't allowed to do that.");
  }
  return new Error(`Couldn't ${action}. ${error.message}`);
}
