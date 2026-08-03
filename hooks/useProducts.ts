"use client";

/**
 * The single owner of catalogue state. Every mutation writes to IndexedDB first
 * and only updates React state once that succeeds, so what's on screen always
 * matches what's on disk.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { newId } from "@/lib/backup";
import * as store from "@/lib/storage";
import type { Product, ProductDraft } from "@/lib/types";

export type LoadState = "loading" | "ready" | "error";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store
      .readAll()
      .then((rows) => {
        if (cancelled) return;
        setProducts(rows);
        setState("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upsert = useCallback(async (draft: ProductDraft, id?: string): Promise<Product> => {
    const now = Date.now();
    const existing = id ? products.find((p) => p.id === id) : undefined;
    const product: Product = {
      ...draft,
      code: draft.code.trim().toUpperCase(),
      id: id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await store.write(product);
    setProducts((prev) => [...prev.filter((p) => p.id !== product.id), product].sort(store.byCode));
    return product;
    // `products` is read only to preserve createdAt; a stale read is harmless.
  }, [products]);

  const duplicate = useCallback(async (source: Product): Promise<Product> => {
    const now = Date.now();
    const copy: Product = {
      ...source,
      id: newId(),
      code: nextFreeCode(source.code, products),
      createdAt: now,
      updatedAt: now,
    };
    await store.write(copy);
    setProducts((prev) => [...prev, copy].sort(store.byCode));
    return copy;
  }, [products]);

  const remove = useCallback(async (id: string): Promise<void> => {
    await store.remove(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const restore = useCallback(async (rows: Product[]): Promise<void> => {
    await store.replaceAll(rows);
    setProducts([...rows].sort(store.byCode));
  }, []);

  /** Codes must stay unique — they're what a customer quotes when ordering. */
  const isCodeTaken = useCallback(
    (code: string, exceptId?: string) => {
      const target = code.trim().toUpperCase();
      return products.some((p) => p.code === target && p.id !== exceptId);
    },
    [products],
  );

  const categories = useMemo(
    () => unique(products.map((p) => p.category)),
    [products],
  );
  const collections = useMemo(
    () => unique(products.map((p) => p.collection)),
    [products],
  );

  return {
    products,
    state,
    error,
    categories,
    collections,
    upsert,
    duplicate,
    remove,
    restore,
    isCodeTaken,
  };
}

const unique = (values: string[]): string[] =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** `JM-101` → `JM-102` when free, otherwise `JM-101 COPY 2`. */
function nextFreeCode(code: string, products: Product[]): string {
  const taken = new Set(products.map((p) => p.code));
  const match = code.match(/^(.*?)(\d+)$/);

  if (match) {
    const [, stem, digits] = match;
    for (let n = Number(digits) + 1; n < Number(digits) + 100; n++) {
      const candidate = `${stem}${String(n).padStart(digits.length, "0")}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
  for (let n = 2; ; n++) {
    const candidate = `${code} COPY ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
