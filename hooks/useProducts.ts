"use client";

/**
 * The single owner of catalogue state, now backed by Supabase.
 *
 * Every mutation writes to the database first and only then updates React
 * state, so what's on screen always matches what's stored. The client is
 * created once per mount — a new one on every render would tear down and
 * rebuild the auth listener each time.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as repo from "@/lib/repository";
import { deletePhotoFiles, uploadPhoto } from "@/lib/photos";
import { browserClient } from "@/lib/supabase/clients";
import type { Product, ProductDraft, Session } from "@/lib/types";

export type LoadState = "loading" | "ready" | "error";

export function useProducts(session: Session) {
  const supabase = useMemo(() => browserClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await repo.fetchProducts(supabase);
    setProducts(rows);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    repo
      .fetchProducts(supabase)
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
  }, [supabase]);

  const upsert = useCallback(
    async (draft: ProductDraft, id?: string): Promise<Product> => {
      const saved = await repo.saveProduct(supabase, draft, id, session.canSeeTradeRates);
      setProducts((prev) =>
        [...prev.filter((p) => p.id !== saved.id), saved].sort(byCode),
      );
      return saved;
    },
    [supabase, session.canSeeTradeRates],
  );

  const duplicate = useCallback(
    async (source: Product): Promise<Product> => {
      const copy = await repo.saveProduct(
        supabase,
        {
          ...source,
          code: nextFreeCode(source.code, products),
          // Photos belong to the original; the copy starts without them rather
          // than silently sharing files that a later delete would pull away.
          photos: [],
          published: false,
        },
        undefined,
        session.canSeeTradeRates,
      );
      setProducts((prev) => [...prev, copy].sort(byCode));
      return copy;
    },
    [supabase, products, session.canSeeTradeRates],
  );

  const remove = useCallback(
    async (product: Product): Promise<void> => {
      await repo.deleteProduct(supabase, product.id);
      // Files are not cascaded by the database, so clear them separately.
      await deletePhotoFiles(supabase, product.photos.map((p) => p.path));
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    },
    [supabase],
  );

  const addPhoto = useCallback(
    async (product: Product, file: File): Promise<Product> => {
      const path = await uploadPhoto(supabase, product.code, file);
      const row = await repo.addPhotoRow(supabase, product.id, path, product.photos.length);
      const updated: Product = {
        ...product,
        photos: [...product.photos, { id: row.id, path, url: photoUrl(path) }],
      };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      return updated;
    },
    [supabase],
  );

  const removePhoto = useCallback(
    async (product: Product, photoId: string): Promise<Product> => {
      const photo = product.photos.find((p) => p.id === photoId);
      if (!photo) return product;
      await repo.removePhotoRow(supabase, photoId);
      await deletePhotoFiles(supabase, [photo.path]);
      const remaining = product.photos.filter((p) => p.id !== photoId);
      await repo.savePhotoOrder(supabase, product.id, remaining.map((p) => p.id));
      const updated = { ...product, photos: remaining };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      return updated;
    },
    [supabase],
  );

  const makeCover = useCallback(
    async (product: Product, photoId: string): Promise<Product> => {
      const picked = product.photos.find((p) => p.id === photoId);
      if (!picked) return product;
      const reordered = [picked, ...product.photos.filter((p) => p.id !== photoId)];
      await repo.savePhotoOrder(supabase, product.id, reordered.map((p) => p.id));
      const updated = { ...product, photos: reordered };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      return updated;
    },
    [supabase],
  );

  const codeTaken = useCallback(
    (code: string, exceptId?: string) => repo.isCodeTaken(supabase, code, exceptId),
    [supabase],
  );

  const categories = useMemo(() => unique(products.map((p) => p.category)), [products]);
  const collections = useMemo(() => unique(products.map((p) => p.collection)), [products]);

  return {
    supabase,
    products,
    state,
    error,
    categories,
    collections,
    reload,
    upsert,
    duplicate,
    remove,
    addPhoto,
    removePhoto,
    makeCover,
    codeTaken,
  };
}

/* ----------------------------------------------------------------- helpers */

const byCode = (a: Product, b: Product) =>
  a.code.localeCompare(b.code, "en", { numeric: true });

const photoUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-photos/${path}`;

const unique = (values: string[]): string[] =>
  [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** `JM-101` → `JM-102` when free, otherwise `JM-101 COPY 2`. */
function nextFreeCode(code: string, products: Product[]): string {
  const taken = new Set(products.map((p) => p.code.toUpperCase()));
  const match = code.match(/^(.*?)(\d+)$/);

  if (match) {
    const [, stem, digits] = match;
    for (let n = Number(digits) + 1; n < Number(digits) + 100; n++) {
      const candidate = `${stem}${String(n).padStart(digits.length, "0")}`;
      if (!taken.has(candidate.toUpperCase())) return candidate;
    }
  }
  for (let n = 2; ; n++) {
    const candidate = `${code} COPY ${n}`;
    if (!taken.has(candidate.toUpperCase())) return candidate;
  }
}
