/**
 * Photo files in Supabase Storage.
 *
 * The bucket is public — the images *are* the shopfront — so display just uses
 * a plain URL with no signing round-trip. Only staff may write, which the
 * storage policies enforce.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { compress } from "./image";
import { slug } from "./format";
import { PHOTO_BUCKET, type Database } from "./supabase/database.types";

type Client = SupabaseClient<Database>;

/** Public URL for a stored object. Built by hand so it works server-side too. */
export function publicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}

/**
 * Downscales a picked file and uploads it.
 *
 * The same compression that protected the old browser database still applies:
 * a 12 MB phone photo becomes a few hundred kilobytes, which is the difference
 * between a catalogue that loads on mobile data and one that doesn't.
 */
export async function uploadPhoto(
  supabase: Client,
  productCode: string,
  file: File,
): Promise<string> {
  const dataUrl = await compress(file);
  const blob = await (await fetch(dataUrl)).blob();

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${slug(productCode)}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000", // immutable: the filename is unique per upload
    upsert: false,
  });
  if (error) throw new Error(`Couldn't upload that photo. ${error.message}`);
  return path;
}

/** Best-effort file removal. A leftover file is untidy, not broken. */
export async function deletePhotoFile(supabase: Client, path: string): Promise<void> {
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

export async function deletePhotoFiles(supabase: Client, paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}
