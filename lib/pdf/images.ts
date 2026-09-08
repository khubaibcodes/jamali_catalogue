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

/**
 * A photo ready to place: an embeddable JPEG and the shape it actually is.
 *
 * The aspect ratio is the reason this type exists. The layout used to guess a
 * shape and mat every picture that disagreed against a grey box; now the frame
 * is derived from the picture. Since this function already decodes the image to
 * transcode it, the true dimensions are free — they were simply being discarded.
 */
export interface EmbeddedImage {
  dataUrl: string;
  /** width ÷ height. Portrait is < 1. */
  aspect: number;
}

const cache = new Map<string, Promise<EmbeddedImage | null>>();

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
 * Fetches a photo and returns a JPEG react-pdf can embed, with its true shape.
 * Returns null when the image cannot be read, so one broken file costs its own
 * picture rather than the whole document.
 */
export function toPdfImage(url: string): Promise<EmbeddedImage | null> {
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

      return { dataUrl: canvas.toDataURL("image/jpeg", QUALITY), aspect: w / h };
    } catch {
      return null;
    }
  })();

  cache.set(url, entry);
  return entry;
}

interface SourcePhoto {
  id: string;
  path: string;
  url: string;
}

type WithPhotos = { photos: SourcePhoto[] };

/** A photo the layout can measure: the source fields plus its true shape. */
export type PdfPhoto = SourcePhoto & { aspect: number };

/** An article whose photos are all embeddable and measured. */
export type PdfReady<T extends WithPhotos> = Omit<T, "photos"> & { photos: PdfPhoto[] };

/**
 * Rewrites every photo on a set of articles into an embeddable, measured one.
 * Photos that fail to convert are dropped, so the PDF still builds.
 *
 * Conversions run in parallel but are deduplicated by the cache above, which
 * matters for the full catalogue: the same cover appears in the index and again
 * on its own page.
 *
 * The return type is deliberately a different shape from the input. The layout
 * cannot place a photo whose proportions it doesn't know, and making that a
 * type error is cheaper than discovering it as a grey box in a printed page.
 */
export async function withEmbeddablePhotos<T extends WithPhotos>(
  articles: T[],
): Promise<PdfReady<T>[]> {
  return Promise.all(
    articles.map(async (article) => {
      const photos = await Promise.all(
        article.photos.map(async (photo) => {
          const embedded = await toPdfImage(photo.url);
          return embedded
            ? { ...photo, url: embedded.dataUrl, aspect: embedded.aspect }
            : null;
        }),
      );
      return {
        ...article,
        photos: photos.filter((p): p is PdfPhoto => p !== null),
      };
    }),
  );
}
