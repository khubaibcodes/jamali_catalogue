"use client";

/**
 * The card studio. Pick an article, choose how it should look, export a PNG.
 *
 * Two things matter here and both were real defects in the previous version:
 *
 *  1. Renders are async (fonts + photo decode) and controls change fast. A
 *     monotonic token means only the newest render is allowed to reach the
 *     visible canvas; stale ones finish and are discarded.
 *  2. Export re-renders and *awaits* that render before reading pixels, so the
 *     PNG can never be captured mid-paint.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { download } from "@/lib/backup";
import { slug } from "@/lib/format";
import {
  CARD_FORMATS,
  defaultCardOptions,
  renderCard,
  type CardFormat,
  type CardOptions,
  type PhotoFit,
} from "@/lib/card/render";
import { PRICE_MODES, type PriceMode, type Product } from "@/lib/types";
import { EmptyState, Segmented } from "./ui/controls";
import { Icon } from "./ui/Icon";

const FORMAT_OPTIONS = (Object.keys(CARD_FORMATS) as CardFormat[]).map((value) => ({
  value,
  label: CARD_FORMATS[value].label,
}));

const FIT_OPTIONS: { value: PhotoFit; label: string }[] = [
  { value: "contain", label: "Whole garment" },
  { value: "cover", label: "Fill the frame" },
];

const PRICE_LABELS: Record<PriceMode, string> = {
  hidden: "DM for price",
  retail: "Retail",
  reseller: "Reseller",
  wholesale: "Wholesale",
};

export function CardStudio({
  products,
  selectedId,
  onSelect,
  onAdd,
  onNotify,
}: {
  products: Product[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onNotify: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [options, setOptions] = useState<CardOptions>(defaultCardOptions);
  const [exporting, setExporting] = useState(false);
  const [painting, setPainting] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  const product = products.find((p) => p.id === selectedId) ?? null;

  const set = <K extends keyof CardOptions>(key: K, value: CardOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  /**
   * Deleting a photo can leave `photoIndex` pointing past the end of the array.
   * Clamping here rather than in an effect keeps the render truthful — there is
   * never a frame drawn from an index that doesn't exist.
   */
  const settings = useMemo<CardOptions>(() => {
    const last = Math.max(0, (product?.photos.length ?? 1) - 1);
    return options.photoIndex > last ? { ...options, photoIndex: 0 } : options;
  }, [options, product]);

  /** Renders into `canvas`, ignoring the result if a newer render started. */
  const paint = useCallback(
    async (canvas: HTMLCanvasElement, target: Product, opts: CardOptions) => {
      const token = ++renderToken.current;
      // Draw off-screen, then blit — otherwise the visible canvas flickers
      // through a half-finished frame on every control change.
      const scratch = document.createElement("canvas");
      await renderCard(scratch, target, opts);
      if (token !== renderToken.current) return false;

      canvas.width = scratch.width;
      canvas.height = scratch.height;
      canvas.getContext("2d")?.drawImage(scratch, 0, 0);
      return true;
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !product) return;

    let live = true;
    setPainting(true);
    paint(canvas, product, settings)
      .then(() => live && setPainting(false))
      .catch(() => {
        if (!live) return;
        setPainting(false);
        onNotify("The preview couldn't be drawn.", "error");
      });
    return () => {
      live = false;
    };
  }, [product, settings, paint, onNotify]);

  async function exportCard() {
    const canvas = canvasRef.current;
    if (!canvas || !product) return;

    setExporting(true);
    try {
      // Re-render and wait: this is what guarantees a complete frame.
      await paint(canvas, product, settings);
      const blob = await toBlob(canvas);
      if (!blob) throw new Error("The browser refused to export the image.");

      const filename = `jamaali-${slug(product.code)}-${settings.format}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // On a phone the share sheet posts straight to WhatsApp or Instagram.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Jamaali ${product.code}` });
          return;
        } catch (error) {
          // A user who backs out of the sheet shouldn't then get a download.
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      download(blob, filename);
      onNotify("Card saved to your downloads.", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon="card"
        title="Nothing to design yet"
        body="Add an article with a photo and its rates, then come back to turn it into a card for WhatsApp status or Instagram."
        action={
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Icon name="plus" size={16} />
            Add an article
          </button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="eyebrow">Card studio</p>
        <h1 className="mt-1 text-3xl">Design a card to post</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:order-1">
          <Panel title="Article">
            <select
              className="input"
              aria-label="Choose an article"
              value={selectedId}
              onChange={(e) => {
                onSelect(e.target.value);
                set("photoIndex", 0);
              }}
            >
              <option value="">Choose an article…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.code, p.name].filter(Boolean).join(" — ")}
                </option>
              ))}
            </select>

            {product && product.photos.length > 1 && (
              <div className="mt-3">
                <span className="field-label">Photo</span>
                <div className="flex flex-wrap gap-2">
                  {product.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => set("photoIndex", index)}
                      aria-pressed={settings.photoIndex === index}
                      aria-label={`Use photo ${index + 1}`}
                      className={`size-14 overflow-hidden rounded-md border-2 transition-colors ${
                        settings.photoIndex === index
                          ? "border-ink-700"
                          : "border-shell-200 hover:border-shell-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Format">
            <Segmented
              label="Card format"
              options={FORMAT_OPTIONS}
              value={options.format}
              onChange={(v) => set("format", v)}
            />
            <p className="mt-2 text-xs leading-relaxed text-shell-600">
              Status is a tall 9:16. Instagram post is 4:5.
            </p>
          </Panel>

          <Panel title="Photo">
            <Segmented
              label="Photo fit"
              options={FIT_OPTIONS}
              value={options.fit}
              onChange={(v) => set("fit", v)}
            />
            <p className="mt-2 text-xs leading-relaxed text-shell-600">
              <strong className="font-semibold text-shell-900">Whole garment</strong> never crops —
              the gaps are filled with a blurred copy of the same photo.{" "}
              <strong className="font-semibold text-shell-900">Fill the frame</strong> goes edge to
              edge but may cut the sides.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-ink-800"
                checked={options.watermark}
                onChange={(e) => set("watermark", e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium">Watermark the photo</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-shell-600">
                  Tiles the wordmark faintly across the picture so other sellers can&apos;t reuse
                  your shot.
                </span>
              </span>
            </label>
          </Panel>

          <Panel title="Price on the card">
            <Segmented
              label="Price shown"
              options={PRICE_MODES.map((value) => ({ value, label: PRICE_LABELS[value] }))}
              value={options.priceMode}
              onChange={(v) => set("priceMode", v)}
            />
            {options.priceMode === "wholesale" || options.priceMode === "reseller" ? (
              <p className="mt-3 flex gap-2 rounded-md bg-danger-soft p-3 text-xs leading-relaxed text-danger">
                <Icon name="warning" size={15} className="mt-px shrink-0" />
                <span>
                  This card prints your {PRICE_LABELS[options.priceMode].toLowerCase()} rate. Send it
                  to a private list — never to a public status or feed.
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-shell-600">
                Safe for a public status or feed.
              </p>
            )}
          </Panel>
        </div>

        {/* -------------------------------------------------------- preview */}
        <div className="order-1 lg:order-2">
          {product ? (
            <div className="studio sticky top-6 p-5 shadow-studio sm:p-7">
              <div className="relative mx-auto max-w-sm">
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-lg shadow-studio"
                  aria-label={`Preview of the card for ${product.code}`}
                  role="img"
                />
                {painting && (
                  <div className="absolute inset-0 grid place-items-center rounded-lg bg-ink-950/45 text-xs tracking-widest text-amber-300">
                    DRAWING…
                  </div>
                )}
              </div>

              <div className="mx-auto mt-6 max-w-sm">
                <button
                  type="button"
                  className="btn btn-amber w-full"
                  onClick={exportCard}
                  disabled={exporting || painting}
                >
                  <Icon name="download" size={16} />
                  {exporting ? "Preparing…" : "Save / share card"}
                </button>
                <p className="mt-3 text-center text-xs leading-relaxed text-shell-50/60">
                  On a phone this opens the share sheet. On a computer it downloads a 1080-wide PNG.
                </p>
              </div>
            </div>
          ) : (
            <div className="plate grid min-h-80 place-items-center p-8 text-center text-sm text-shell-600">
              Choose an article to see its card.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- fragments */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="plate p-4">
      <h2 className="mb-3 font-ui text-xs font-semibold uppercase tracking-[0.08em] text-ink-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
