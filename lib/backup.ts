/**
 * Backup and restore. The catalogue lives in one browser on one device, so a
 * portable file is the only thing standing between the shop and a cleared
 * cache. Photos travel inside the JSON, which makes the file large but
 * self-contained — no broken links after a restore.
 */

import { emptyDraft, type Product } from "./types";

const FORMAT = "jamaali-catalogue";
const VERSION = 1;

interface BackupFile {
  format: string;
  version: number;
  exportedAt: string;
  products: Product[];
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportBackup(products: Product[]): void {
  const payload: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    products,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  download(
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    `jamaali-backup-${stamp}.json`,
  );
}

/**
 * Reads a backup file. Unknown or malformed input is rejected loudly rather
 * than being half-imported, and every product is normalised against the current
 * schema so an older backup can't leave undefined fields behind.
 */
export async function parseBackup(file: File): Promise<Product[]> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const payload = data as Partial<BackupFile>;
  if (payload?.format !== FORMAT || !Array.isArray(payload.products)) {
    throw new Error("That doesn't look like a Jamaali backup.");
  }
  if ((payload.version ?? 0) > VERSION) {
    throw new Error("That backup came from a newer version of the app.");
  }

  const products = payload.products.map(normalise).filter((p): p is Product => p !== null);
  if (products.length === 0) throw new Error("The backup contained no articles.");
  return products;
}

/** Fills in anything a backup is missing so the rest of the app can trust it. */
function normalise(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!code) return null;

  const defaults = emptyDraft();
  const prices = (input.prices ?? {}) as Record<string, unknown>;
  const now = Date.now();

  return {
    ...defaults,
    ...input,
    id: typeof input.id === "string" && input.id ? input.id : newId(),
    code,
    prices: {
      retail: numberOrNull(prices.retail),
      reseller: numberOrNull(prices.reseller),
      wholesale: numberOrNull(prices.wholesale),
    },
    moq: numberOrNull(input.moq),
    photos: Array.isArray(input.photos) ? input.photos.filter((p) => typeof p === "string") : [],
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
  } as Product;
}

const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Short, sortable, collision-safe enough for a single-device catalogue. */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A spreadsheet-friendly rate sheet, for accountants and printers. */
export function exportCsv(products: Product[]): void {
  const header = [
    "Code",
    "Name",
    "Category",
    "Collection",
    "Fabric",
    "Stitch",
    "Pieces",
    "Colours",
    "Retail",
    "Reseller",
    "Wholesale",
    "MOQ",
    "Status",
    "Notes",
  ];
  const rows = products.map((p) => [
    p.code,
    p.name,
    p.category,
    p.collection,
    p.fabric,
    p.stitch,
    p.pieces,
    p.colours,
    p.prices.retail ?? "",
    p.prices.reseller ?? "",
    p.prices.wholesale ?? "",
    p.moq ?? "",
    p.status,
    p.notes,
  ]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  // The BOM makes Excel open UTF-8 without mangling accented characters.
  download(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), "jamaali-rates.csv");
}

const cell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
