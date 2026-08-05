/**
 * Export, and the one-off import that carries the old browser catalogue into
 * the database.
 *
 * The old app kept everything in IndexedDB with photos inlined as data URLs.
 * Its backup file is therefore a complete catalogue, and importing it is how
 * the existing articles move across — nothing is retyped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import * as repo from "./repository";
import { PHOTO_BUCKET, type Database } from "./supabase/database.types";
import { slug } from "./format";
import type { Product } from "./types";

type Client = SupabaseClient<Database>;

const FORMAT = "jamaali-catalogue";

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

/**
 * A readable snapshot of the catalogue. Photos are referenced by URL rather
 * than embedded — the database is the source of truth now, and Supabase keeps
 * its own backups, so this is for reference and spreadsheets, not disaster
 * recovery.
 */
export function exportBackup(products: Product[]): void {
  const payload = {
    format: FORMAT,
    version: 2,
    exportedAt: new Date().toISOString(),
    products: products.map((p) => ({ ...p, photos: p.photos.map((photo) => photo.url) })),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `jamaali-catalogue-${stamp}.json`,
  );
}

/* ---------------------------------------------------------------- import */

export interface ImportOutcome {
  imported: number;
  skipped: string[];
  photosUploaded: number;
  photosFailed: number;
}

/**
 * Reads a backup produced by the old browser-based catalogue and writes it
 * into the database.
 *
 * Articles whose code already exists are skipped rather than overwritten —
 * re-running an import must never quietly clobber edits made since.
 */
export async function importBackup(
  supabase: Client,
  file: File,
  canWriteTradeRates: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportOutcome> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const payload = parsed as { format?: string; products?: unknown };
  if (payload?.format !== FORMAT || !Array.isArray(payload.products)) {
    throw new Error("That doesn't look like a Jamaali backup.");
  }

  const rows = payload.products as Record<string, unknown>[];
  const outcome: ImportOutcome = { imported: 0, skipped: [], photosUploaded: 0, photosFailed: 0 };

  for (const [index, raw] of rows.entries()) {
    const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";
    if (!code) continue;

    if (await repo.isCodeTaken(supabase, code)) {
      outcome.skipped.push(code);
      onProgress?.(index + 1, rows.length);
      continue;
    }

    const prices = (raw.prices ?? {}) as Record<string, unknown>;
    const saved = await repo.saveProduct(
      supabase,
      {
        code,
        name: str(raw.name),
        fabric: str(raw.fabric),
        category: str(raw.category),
        collection: str(raw.collection),
        stitch: raw.stitch === "Stitched" ? "Stitched" : "Unstitched",
        pieces: pieces(raw.pieces),
        colours: str(raw.colours),
        status: status(raw.status),
        prices: {
          retail: num(prices.retail),
          reseller: num(prices.reseller),
          wholesale: num(prices.wholesale),
        },
        moq: num(raw.moq),
        notes: str(raw.notes),
        photos: [],
        // Imported articles stay off the shopfront until reviewed.
        published: false,
      },
      undefined,
      canWriteTradeRates,
    );
    outcome.imported += 1;

    // Old backups inline photos as data URLs; version 2 exports store URLs.
    // Either can be fetched into a blob and uploaded.
    const photos = Array.isArray(raw.photos) ? (raw.photos as unknown[]) : [];
    for (const [position, source] of photos.entries()) {
      if (typeof source !== "string" || !source) continue;
      try {
        const blob = await (await fetch(source)).blob();
        const extension = blob.type.includes("webp") ? "webp" : "jpg";
        const path = `${slug(code)}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);
        await repo.addPhotoRow(supabase, saved.id, path, position);
        outcome.photosUploaded += 1;
      } catch {
        // One bad photo shouldn't abandon the rest of the import.
        outcome.photosFailed += 1;
      }
    }

    onProgress?.(index + 1, rows.length);
  }

  return outcome;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const pieces = (v: unknown) =>
  v === "1-Piece" || v === "2-Piece" || v === "4-Piece" ? v : ("3-Piece" as const);

const status = (v: unknown) =>
  v === "New" || v === "Low stock" || v === "Sold out" ? v : ("Available" as const);

/* ------------------------------------------------------------------- csv */

export function exportCsv(products: Product[], includeTradeRates: boolean): void {
  const header = [
    "Code", "Name", "Category", "Collection", "Fabric", "Stitch", "Pieces",
    "Colours", "Retail", ...(includeTradeRates ? ["Reseller", "Wholesale", "MOQ"] : []),
    "Status", "Published", "Notes",
  ];
  const rows = products.map((p) => [
    p.code, p.name, p.category, p.collection, p.fabric, p.stitch, p.pieces,
    p.colours, p.prices.retail ?? "",
    ...(includeTradeRates ? [p.prices.reseller ?? "", p.prices.wholesale ?? "", p.moq ?? ""] : []),
    p.status, p.published ? "yes" : "no", p.notes,
  ]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  // The BOM makes Excel read UTF-8 without mangling accented characters.
  download(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), "jamaali-rates.csv");
}

const cell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
