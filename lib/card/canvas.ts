/**
 * Small, dependency-free canvas primitives used by the card renderer.
 * Nothing here knows anything about products — it just draws.
 */

export interface TextStyle {
  font: string;
  fill: string | CanvasGradient;
  /** Extra space between letters, in pixels. */
  tracking?: number;
  align?: "left" | "center" | "right";
}

/**
 * `ctx.letterSpacing` is not implemented everywhere, and where it is missing it
 * fails silently — the card would simply lose its spacing on those browsers.
 * When it's absent we place each glyph by hand instead.
 */
const NATIVE_TRACKING = (() => {
  if (typeof document === "undefined") return false;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return false;
    ctx.letterSpacing = "4px";
    return ctx.letterSpacing === "4px";
  } catch {
    return false;
  }
})();

/**
 * Width of `text` in the current font, including tracking.
 *
 * This applies the spacing itself rather than trusting the context to already
 * carry it. Measuring a tracked string without doing so under-reports its width
 * by `tracking × (length - 1)` — enough to let a long line sail past a
 * shrink-to-fit budget and overflow the card.
 */
export function measure(ctx: CanvasRenderingContext2D, text: string, tracking = 0): number {
  if (!tracking) return ctx.measureText(text).width;

  if (NATIVE_TRACKING) {
    const previous = ctx.letterSpacing;
    ctx.letterSpacing = `${tracking}px`;
    const width = ctx.measureText(text).width;
    ctx.letterSpacing = previous;
    return width;
  }
  return ctx.measureText(text).width + tracking * Math.max(0, text.length - 1);
}

/** Draws one line of text with optional letter-spacing. Returns its width. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): number {
  const { font, fill, tracking = 0, align = "center" } = style;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textBaseline = "alphabetic";

  if (tracking && NATIVE_TRACKING) ctx.letterSpacing = `${tracking}px`;

  const width = measure(ctx, text, tracking);
  const startX = align === "center" ? x - width / 2 : align === "right" ? x - width : x;

  if (tracking && !NATIVE_TRACKING) {
    // Manual placement. Trailing tracking is excluded so the run stays centred.
    ctx.textAlign = "left";
    let cursor = startX;
    for (const glyph of Array.from(text)) {
      ctx.fillText(glyph, cursor, y);
      cursor += ctx.measureText(glyph).width + tracking;
    }
  } else {
    ctx.textAlign = "left";
    ctx.fillText(text, startX, y);
  }

  ctx.restore();
  return width;
}

/**
 * Shrinks `text` until it fits `maxWidth`, then truncates with an ellipsis if
 * it still doesn't. Returns the font size that was used.
 */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  buildFont: (size: number) => string,
  maxSize: number,
  minSize: number,
  tracking = 0,
): { text: string; size: number } {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = buildFont(size);
    if (measure(ctx, text, tracking) <= maxWidth) return { text, size };
  }
  ctx.font = buildFont(minSize);
  let clipped = text;
  while (clipped.length > 1 && measure(ctx, `${clipped}…`, tracking) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return { text: `${clipped.trimEnd()}…`, size: minSize };
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** The brand's brushed-metal gold, as a gradient along the given axis. */
export function goldSheen(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, "#8A6D34");
  g.addColorStop(0.35, "#E3C88A");
  g.addColorStop(0.62, "#F3E4BC");
  g.addColorStop(1, "#A8843F");
  return g;
}

export function diamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A horizontal rule with a diamond at its centre — the brand's divider. */
export function divider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  halfWidth: number,
  stroke: string,
  gem: string | CanvasGradient,
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx - 20, y);
  ctx.moveTo(cx + 20, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.stroke();
  diamond(ctx, cx, y, 6, gem);
  ctx.restore();
}

/** An L-shaped tick in one corner of the frame. `sx`/`sy` are ±1 directions. */
export function cornerMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: 1 | -1,
  sy: 1 | -1,
  arm: number,
  stroke: string | CanvasGradient,
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(x, y + sy * arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + sx * arm, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Very fine luminance noise. Flat digital gradients band badly once WhatsApp
 * re-compresses them; a little grain hides that and reads as printed paper.
 */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.022): void {
  const tile = 128;
  const off = document.createElement("canvas");
  off.width = off.height = tile;
  const octx = off.getContext("2d");
  if (!octx) return;
  const data = octx.createImageData(tile, tile);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  octx.putImageData(data, 0, 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  const pattern = ctx.createPattern(off, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/**
 * Makes sure a webfont is actually rasterised before it's drawn. Canvas does
 * not trigger font loading the way the DOM does, so without this the first
 * render silently falls back to a system serif.
 */
export async function ensureFonts(specs: string[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all(specs.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  } catch {
    // A failed preload only costs us the fallback face; drawing still succeeds.
  }
}

/** Reads a CSS custom property off `<html>` — used to get next/font families. */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
