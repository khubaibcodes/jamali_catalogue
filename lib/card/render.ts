/**
 * Draws a shareable product card onto a canvas.
 *
 * The layout is a top-down flow: a fixed header, a fixed caption block, a fixed
 * footer, and a photo frame that absorbs whatever height is left over. Because
 * every block is measured before anything is painted, the same code produces a
 * balanced card at both aspect ratios without hand-tuned magic numbers.
 */

import { brand, palette } from "../brand";
import { joinParts, money } from "../format";
import type { PriceMode, Product } from "../types";
import {
  cornerMark,
  cssVar,
  divider,
  drawText,
  ensureFonts,
  fitText,
  goldSheen,
  grain,
  roundRect,
} from "./canvas";
import { loadForCanvas } from "../image";

export const CARD_FORMATS = {
  story: { label: "WhatsApp status", width: 1080, height: 1920, scale: 1 },
  post: { label: "Instagram post", width: 1080, height: 1350, scale: 0.78 },
} as const;

export type CardFormat = keyof typeof CARD_FORMATS;
export type PhotoFit = "contain" | "cover";

export interface CardOptions {
  format: CardFormat;
  priceMode: PriceMode;
  fit: PhotoFit;
  watermark: boolean;
  /** Index into `product.photos`. Falls back to the cover shot. */
  photoIndex: number;
}

export const defaultCardOptions: CardOptions = {
  format: "story",
  priceMode: "hidden",
  fit: "contain",
  watermark: false,
  photoIndex: 0,
};

const PRICE_LABEL: Partial<Record<PriceMode, string>> = {
  reseller: "RESELLER RATE",
  wholesale: "WHOLESALE RATE",
};

/** Resolved font families, read from the CSS variables next/font defines. */
function families() {
  return {
    display: cssVar("--font-display", "Georgia, 'Times New Roman', serif"),
    ui: cssVar("--font-ui", "system-ui, sans-serif"),
  };
}

export async function renderCard(
  canvas: HTMLCanvasElement,
  product: Product,
  options: CardOptions,
): Promise<void> {
  const { display, ui } = families();
  const serif = (size: number, weight = 400, italic = false) =>
    `${italic ? "italic " : ""}${weight} ${size}px ${display}`;
  const sans = (size: number, weight = 500) => `${weight} ${size}px ${ui}`;

  // Fonts and the photo are both async; start them together.
  const [, photo] = await Promise.all([
    ensureFonts([serif(60, 600), serif(40, 300), serif(30, 400, true), sans(28, 600)]),
    loadForCanvas((product.photos[options.photoIndex] ?? product.photos[0])?.url),
  ]);

  const { width: W, height: H, scale } = CARD_FORMATS[options.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const s = (n: number) => Math.round(n * scale);
  const contentX = 96;
  const contentW = W - contentX * 2;
  const centreX = W / 2;

  /* ---------------------------------------------------------------- ground */

  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, palette.cocoa);
  base.addColorStop(0.5, "#3D2922");
  base.addColorStop(1, palette.cocoaDeep);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // A soft halo behind the photo lifts the subject off the flat field.
  const halo = ctx.createRadialGradient(centreX, H * 0.4, 60, centreX, H * 0.42, W * 0.85);
  halo.addColorStop(0, "rgba(92,64,52,0.55)");
  halo.addColorStop(1, "rgba(20,16,14,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  /* ----------------------------------------------------------------- frame */

  const M = 46;
  ctx.strokeStyle = goldSheen(ctx, M, M, W - M, H - M);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(M, M, W - M * 2, H - M * 2);
  const arm = 26;
  const gold = "rgba(242,177,104,0.75)";
  cornerMark(ctx, M + 16, M + 16, 1, 1, arm, gold);
  cornerMark(ctx, W - M - 16, M + 16, -1, 1, arm, gold);
  cornerMark(ctx, M + 16, H - M - 16, 1, -1, arm, gold);
  cornerMark(ctx, W - M - 16, H - M - 16, -1, -1, arm, gold);

  /* ---------------------------------------------------------------- header */

  const headerEnd = s(292);
  drawText(ctx, brand.name, centreX, s(150), {
    font: serif(s(58), 600),
    fill: palette.paper,
    tracking: s(22),
  });
  divider(ctx, centreX, s(196), s(150), "rgba(242,177,104,0.5)", goldSheen(ctx, centreX - 8, s(190), centreX + 8, s(202)));
  drawText(ctx, brand.tagline, centreX, s(242), {
    font: serif(s(27), 400, true),
    fill: "rgba(242,177,104,0.9)",
    tracking: s(2),
  });

  /* ---------------------------------------------------------------- footer */

  const footerH = s(168);
  const footerBaseline = H - s(84);
  divider(ctx, centreX, H - s(140), s(180), "rgba(242,177,104,0.3)", "rgba(242,177,104,0.55)");
  drawText(ctx, brand.cardFooter, centreX, footerBaseline, {
    font: sans(s(23), 500),
    fill: "rgba(251,248,242,0.72)",
    tracking: s(3),
  });

  /* ------------------------------------------------------- caption metrics */

  // Colours are an array now; joining here stops it stringifying as "A,B".
  const meta = joinParts([product.pieces, product.colours.join(", ")]);
  const captionRows = [s(76), s(78), meta ? s(52) : 0, s(88)];
  const captionH = captionRows.reduce((a, b) => a + b, 0) + s(26);

  /* ----------------------------------------------------------------- photo */

  const px = contentX;
  const py = headerEnd;
  const pw = contentW;
  const ph = Math.max(s(320), H - headerEnd - captionH - footerH);

  // Gold edge, drawn as a filled rectangle one notch larger than the photo.
  ctx.fillStyle = goldSheen(ctx, px, py, px + pw, py + ph);
  ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  if (photo) {
    if (options.fit === "cover") {
      drawCover(ctx, photo, px, py, pw, ph);
    } else {
      drawContain(ctx, photo, px, py, pw, ph);
    }
    if (options.watermark) drawWatermark(ctx, px, py, pw, ph, serif(s(52), 600));
  } else {
    ctx.fillStyle = palette.cocoaMid;
    ctx.fillRect(px, py, pw, ph);
    drawText(ctx, "PHOTO NOT ADDED", centreX, py + ph / 2, {
      font: sans(s(28), 600),
      fill: "rgba(242,177,104,0.6)",
      tracking: s(6),
    });
  }

  // A gentle bottom shade so badges and the caption edge stay legible.
  const shade = ctx.createLinearGradient(0, py + ph - s(180), 0, py + ph);
  shade.addColorStop(0, "rgba(20,16,14,0)");
  shade.addColorStop(1, "rgba(20,16,14,0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(px, py + ph - s(180), pw, s(180));
  ctx.restore();

  /* ---------------------------------------------------------------- badges */

  const badgeY = py + s(24);
  pill(ctx, product.stitch.toUpperCase(), px + s(24), "left", badgeY, s(24), {
    background: goldSheen(ctx, px, badgeY, px + s(300), badgeY),
    text: palette.cocoaDeep,
    font: sans(s(24), 700),
  });
  if (product.status !== "Available") {
    pill(ctx, product.status.toUpperCase(), px + pw - s(24), "right", badgeY, s(24), {
      background: product.status === "Sold out" ? palette.danger : palette.success,
      text: "#FFFFFF",
      font: sans(s(24), 700),
    });
  }

  /* --------------------------------------------------------------- caption */

  let y = py + ph;

  y += captionRows[0];
  drawText(ctx, (product.fabric || "PREMIUM FABRIC").toUpperCase(), centreX, y, {
    font: sans(s(26), 600),
    fill: "rgba(242,177,104,0.92)",
    tracking: s(8),
  });

  y += captionRows[1];
  const title = joinParts([product.code, product.name], "  ·  ");
  const titleFit = fitText(ctx, title, contentW - s(40), (n) => serif(n, 500), s(70), s(38));
  drawText(ctx, titleFit.text, centreX, y, {
    font: serif(titleFit.size, 500),
    fill: palette.paper,
  });

  if (meta) {
    y += captionRows[2];
    const metaFit = fitText(ctx, meta, contentW - s(60), (n) => sans(n, 500), s(26), s(19), s(2));
    drawText(ctx, metaFit.text, centreX, y, {
      font: sans(metaFit.size, 500),
      fill: "rgba(251,248,242,0.66)",
      tracking: s(2),
    });
  }

  y += captionRows[3];
  drawPrice(ctx, product, options.priceMode, centreX, y, contentW, s, serif, sans);

  /* ------------------------------------------------------------------ film */

  grain(ctx, W, H);
}

/* ------------------------------------------------------------------ pieces */

function drawPrice(
  ctx: CanvasRenderingContext2D,
  product: Product,
  mode: PriceMode,
  cx: number,
  y: number,
  maxWidth: number,
  s: (n: number) => number,
  serif: (size: number, weight?: number, italic?: boolean) => string,
  sans: (size: number, weight?: number) => string,
): void {
  if (mode === "hidden") {
    drawText(ctx, "DM FOR PRICE", cx, y, {
      font: sans(s(38), 600),
      fill: "rgba(242,177,104,0.95)",
      tracking: s(10),
    });
    return;
  }

  const label = PRICE_LABEL[mode];
  if (label) {
    drawText(ctx, label, cx, y - s(58), {
      font: sans(s(20), 600),
      fill: "rgba(242,177,104,0.7)",
      tracking: s(6),
    });
  }

  const text = money(product.prices[mode as "retail" | "reseller" | "wholesale"]);
  const fit = fitText(ctx, text, maxWidth - s(80), (n) => serif(n, 600), s(84), s(46));
  drawText(ctx, fit.text, cx, y, {
    font: serif(fit.size, 600),
    fill: goldSheen(ctx, cx - s(220), y - fit.size, cx + s(220), y),
  });
}

interface PillStyle {
  background: string | CanvasGradient;
  text: string;
  font: string;
}

function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  anchor: "left" | "right",
  y: number,
  padding: number,
  style: PillStyle,
): void {
  ctx.save();
  ctx.font = style.font;
  const textWidth = ctx.measureText(text).width;
  const w = textWidth + padding * 2;
  const h = padding * 2 + 14;
  const boxX = anchor === "left" ? x : x - w;

  roundRect(ctx, boxX, y, w, h, h / 2);
  ctx.fillStyle = style.background;
  ctx.fill();

  ctx.fillStyle = style.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, boxX + padding, y + h / 2 + 1);
  ctx.restore();
}

/** Fills the frame edge to edge, cropping the overflow. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * Shows the whole garment with nothing cropped. The leftover space is filled
 * with a blurred, darkened copy of the same photo rather than black bars — the
 * trick magazines use, and the reason a tall dress shot survives a square frame.
 */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  if (supportsFilter()) {
    ctx.filter = "blur(38px) brightness(0.5) saturate(1.2)";
    // Overdraw slightly so the blur kernel never samples past the frame edge.
    const bleed = 48;
    drawCover(ctx, img, x - bleed, y - bleed, w + bleed * 2, h + bleed * 2);
  } else {
    ctx.globalAlpha = 0.4;
    drawCover(ctx, img, x, y, w, h);
  }
  ctx.restore();

  // Emerald wash keeps the backdrop on-brand whatever the photo's colours are.
  ctx.save();
  ctx.fillStyle = "rgba(46,31,26,0.5)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

let filterSupport: boolean | null = null;
function supportsFilter(): boolean {
  if (filterSupport === null) {
    try {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return (filterSupport = false);
      ctx.filter = "blur(2px)";
      filterSupport = ctx.filter === "blur(2px)";
    } catch {
      filterSupport = false;
    }
  }
  return filterSupport;
}

/** Repeating diagonal wordmark — discourages other sellers reusing the photo. */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  font: string,
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const span = Math.hypot(w, h);
  const stepY = 200;
  const stepX = 460;
  for (let row = -span / 2; row <= span / 2; row += stepY) {
    const offset = ((row / stepY) % 2 === 0 ? 0 : stepX / 2) - span / 2;
    for (let col = offset; col <= span / 2; col += stepX) {
      ctx.fillText(brand.name, col, row);
    }
  }
  ctx.restore();
}
