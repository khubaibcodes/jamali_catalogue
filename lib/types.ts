/** The shape of everything the catalogue stores. One product = one article. */

export const STITCH_OPTIONS = ["Unstitched", "Stitched"] as const;
export type Stitch = (typeof STITCH_OPTIONS)[number];

export const PIECE_OPTIONS = ["1-Piece", "2-Piece", "3-Piece", "4-Piece"] as const;
export type Pieces = (typeof PIECE_OPTIONS)[number];

export const STATUS_OPTIONS = ["Available", "New", "Low stock", "Sold out"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];

/** Which rate (if any) is printed on a shareable card. */
export const PRICE_MODES = ["hidden", "retail", "reseller", "wholesale"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

/** Who a WhatsApp reply is written for. Drives which rate is quoted. */
export const TIERS = ["retail", "reseller", "wholesale"] as const;
export type Tier = (typeof TIERS)[number];

export interface Prices {
  retail: number | null;
  reseller: number | null;
  wholesale: number | null;
}

export interface Product {
  id: string;
  /** Article code, e.g. JM-101. Uppercased, unique, required. */
  code: string;
  name: string;
  fabric: string;
  category: string;
  collection: string;
  stitch: Stitch;
  pieces: Pieces;
  prices: Prices;
  /** Minimum order quantity for wholesale. */
  moq: number | null;
  colours: string;
  status: Status;
  notes: string;
  /** Data URLs. The first one is the cover shot used on cards and thumbnails. */
  photos: string[];
  createdAt: number;
  updatedAt: number;
}

/** A product before it has an id or timestamps — i.e. what the form holds. */
export type ProductDraft = Omit<Product, "id" | "createdAt" | "updatedAt">;

export function emptyDraft(): ProductDraft {
  return {
    code: "",
    name: "",
    fabric: "",
    category: "Suit",
    collection: "",
    stitch: "Unstitched",
    pieces: "3-Piece",
    prices: { retail: null, reseller: null, wholesale: null },
    moq: null,
    colours: "",
    status: "Available",
    notes: "",
    photos: [],
  };
}
