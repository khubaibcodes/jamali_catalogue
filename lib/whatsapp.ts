/**
 * Ready-made WhatsApp replies. Three tiers, three rates — a reply written for a
 * retail buyer must never leak the wholesale rate, so the tier picks exactly
 * one number and nothing else.
 */

import { brand } from "./brand";
import { joinParts, money } from "./format";
import type { Product, Tier } from "./types";

const TIER_LABEL: Record<Tier, string> = {
  retail: "Price",
  reseller: "Reseller rate",
  wholesale: "Wholesale rate",
};

export function replyFor(product: Product, tier: Tier): string {
  const rate = product.prices[tier];
  const lines = [
    `*${brand.name}*`,
    joinParts([`Article: *${product.code}*`, product.name]),
    joinParts([product.fabric, product.stitch, product.pieces]),
    product.colours ? `Colours: ${product.colours}` : null,
    `${TIER_LABEL[tier]}: *${money(rate)}*`,
    tier === "wholesale" && product.moq ? `Minimum order: ${product.moq} pcs` : null,
    product.status === "Sold out" ? "Status: currently sold out" : null,
    product.notes || null,
    `Order: ${brand.website}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** A whole-catalogue rate list, for broadcasting to a reseller group. */
export function rateList(products: Product[], tier: Tier): string {
  const rows = products.map((p) =>
    joinParts([p.code, p.fabric, money(p.prices[tier])], "  ·  "),
  );
  return [`*${brand.name} — ${TIER_LABEL[tier]}s*`, "", ...rows, "", `Order: ${brand.website}`].join(
    "\n",
  );
}

/** Copies text, falling back to a hidden textarea where the API is blocked. */
export async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or insecure context — use the legacy path
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}
