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
  /** Null can mean "not set" or "this account may not see it" — see `canSeeTradeRates`. */
  reseller: number | null;
  wholesale: number | null;
}

export interface Photo {
  id: string;
  /** Path inside the storage bucket. Needed to delete or replace the file. */
  path: string;
  /** Public URL for display and for drawing onto a card. */
  url: string;
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
  colours: string[];
  /** Customer-facing detail. Distinct from `notes`, which never leaves the shop. */
  designNotes: string;
  status: Status;
  /** Internal only — never sent to the public catalogue. */
  notes: string;
  /** The first is the cover shot used on cards and thumbnails. */
  photos: Photo[];
  /** Customers see this article only once it is switched on deliberately. */
  published: boolean;
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
    colours: [],
    designNotes: "",
    status: "Available",
    notes: "",
    photos: [],
    published: false,
  };
}

/** What the signed-in person is allowed to do. Derived from their profile role. */
export interface Session {
  userId: string;
  email: string;
  role: "owner" | "staff";
  /** Only owners. Staff read zero rows from the trade-rate table. */
  canSeeTradeRates: boolean;
  canDelete: boolean;
}
