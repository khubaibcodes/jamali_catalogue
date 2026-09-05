/**
 * Article video clips, in Supabase Storage.
 *
 * Videos live on the live site only. A PDF cannot embed one, so nothing here
 * is ever reached from lib/pdf/.
 *
 * Unlike photos, clips are uploaded as-is: re-encoding video in the browser
 * would need a WASM transcoder and take minutes on a phone. The size ceiling
 * below is what keeps that honest.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { slug } from "./format";
import type { Database } from "./supabase/database.types";

type Client = SupabaseClient<Database>;

export const VIDEO_BUCKET = "product-videos";

/** Matches the bucket's own file_size_limit — keep the two in step. */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/**
 * iPhones record .mov (video/quicktime), Android records .mp4. Both are in
 * the bucket's allowed_mime_types; anything else Storage would refuse anyway,
 * so it is rejected here first with a message a shopkeeper can act on.
 */
const ACCEPTED = ["video/mp4", "video/webm", "video/quicktime"];

export function publicVideoUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${VIDEO_BUCKET}/${storagePath}`;
}

/** Human-readable reason a clip can't be used, or null when it's fine. */
export function rejectVideo(file: File): string | null {
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(0);
    return `That clip is ${mb} MB. The limit is 25 MB — record a shorter one.`;
  }
  // Some Android pickers report an empty type; let Storage make the final call
  // rather than blocking a file that may well be valid.
  if (file.type && !ACCEPTED.includes(file.type)) {
    return "That file isn't a video the site can play. Use MP4 or MOV.";
  }
  return null;
}

export async function uploadVideo(
  supabase: Client,
  productCode: string,
  file: File,
): Promise<string> {
  const reason = rejectVideo(file);
  if (reason) throw new Error(reason);

  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${slug(productCode)}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
    contentType: file.type || "video/mp4",
    cacheControl: "31536000", // the filename is unique per upload
    upsert: false,
  });
  if (error) throw new Error(`Couldn't upload that video. ${error.message}`);
  return path;
}

/** Best-effort removal. A leftover file is untidy, not broken. */
export async function deleteVideoFiles(supabase: Client, paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(VIDEO_BUCKET).remove(paths);
}
