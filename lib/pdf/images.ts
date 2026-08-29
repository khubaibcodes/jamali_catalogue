/**
 * Photo preparation for PDF export.
 *
 * Why this exists: uploads are re-encoded to WebP (lib/image.ts picks WebP
 * wherever the browser's canvas supports it, which is every current browser).
 * WebP is ~30% smaller and perfect for the shopfront — but @react-pdf/renderer
 * only decodes JPEG and PNG. Handed a WebP URL it silently renders nothing, so
 * articles photographed after the move to Supabase came out of the PDF blank
 * while the PNG wordmark kept working. That is the "sometimes no picture" bug.
 *
 * Rather than downgrade storage to JPEG and lose the size win on every page
 * view, photos are transcoded to JPEG here, at export time only.
 *
 * Browser-only: this touches document and canvas.
 */

/** Same longest-edge budget as the gallery pages; larger is wasted in an A4. */
const MAX_EDGE = 1600;
const QUALITY = 0.85;

const cache = new Map<string, Promise<string | null>>();

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Storage serves permissive CORS headers. Without this the canvas is
    // tainted and toDataURL throws a SecurityError.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });
}

/**
 * Fetches a photo and returns a JPEG data URL react-pdf can embed.
 * Returns null when the image cannot be read, so one broken file costs its own
 * picture rather than the whole document.
 */
export function toPdfImage(url: string): Promise<string | null> {
  let entry = cache.get(url);
  if (entry) return entry;

  entry = (async () => {
    try {
      const img = await load(url);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return null;

      const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // JPEG has no alpha; without a white base, transparency flattens to black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL("image/jpeg", QUALITY);
    } catch {
      return null;
    }
  })();

  cache.set(url, entry);
  return entry;
}

type WithPhotos = { photos: { id: string; path: string; url: string }[] };

/**
 * Rewrites every photo URL on a set of articles to an embeddable data URL.
 * Photos that fail to convert are dropped, so the PDF still builds.
 *
 * Conversions run in parallel but are deduplicated by the cache above, which
 * matters for the full catalogue: the same cover appears in the grid and again
 * on its own page.
 */
export async function withEmbeddablePhotos<T extends WithPhotos>(
  articles: T[],
): Promise<T[]> {
  return Promise.all(
    articles.map(async (article) => {
      const photos = await Promise.all(
        article.photos.map(async (photo) => {
          const url = await toPdfImage(photo.url);
          return url ? { ...photo, url } : null;
        }),
      );
      return { ...article, photos: photos.filter((p) => p !== null) };
    }),
  );
}
