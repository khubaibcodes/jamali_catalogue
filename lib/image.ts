/**
 * Photo intake. Phone cameras produce 4–12 MB files; storing those verbatim
 * fills the database and makes card rendering sluggish. Every upload is
 * downscaled and re-encoded before it is ever kept.
 */

const MAX_EDGE = 1400;
const QUALITY = 0.86;

/** WebP is ~30% smaller than JPEG at the same quality. Checked once, cached. */
let webpSupport: boolean | null = null;
function preferredType(): "image/webp" | "image/jpeg" {
  if (webpSupport === null) {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    webpSupport = probe.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport ? "image/webp" : "image/jpeg";
}

/** Reads a picked file and returns a downscaled data URL. */
export async function compress(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser blocked image processing.");

  // A white base keeps transparent PNGs from turning black once flattened.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close(); // frees the decoded bitmap immediately

  return canvas.toDataURL(preferredType(), QUALITY);
}

/** `createImageBitmap` is fast and off-thread; the <img> path covers Safari gaps. */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> decoder
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await loadElement(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Photos now come from Supabase Storage over HTTP. Drawing a cross-origin
    // image onto a canvas taints it, and a tainted canvas throws a
    // SecurityError from toBlob — which would break card export entirely.
    // Storage serves permissive CORS headers, so requesting the image
    // anonymously keeps the canvas clean and exportable.
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be read."));
    img.src = src;
  });
}

/**
 * Decodes a stored data URL for canvas drawing, memoised so that adjusting a
 * card control doesn't re-decode the same photo on every keystroke.
 */
const cache = new Map<string, Promise<HTMLImageElement>>();
const CACHE_LIMIT = 12;

export function loadForCanvas(dataUrl: string | undefined): Promise<HTMLImageElement | null> {
  if (!dataUrl) return Promise.resolve(null);
  let entry = cache.get(dataUrl);
  if (!entry) {
    entry = loadElement(dataUrl);
    entry.catch(() => cache.delete(dataUrl));
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(dataUrl, entry);
  }
  return entry.catch(() => null);
}

/** Rough on-disk size of a data URL, for the storage meter. */
export function byteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  return Math.round((dataUrl.length - comma - 1) * 0.75);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
