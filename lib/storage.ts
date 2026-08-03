/**
 * Product persistence.
 *
 * IndexedDB is the store: photos are base64 strings that run to hundreds of
 * kilobytes each, which overruns localStorage's ~5 MB budget after a dozen
 * articles. IndexedDB has no such practical ceiling.
 *
 * Every function resolves rather than throws on a missing/blocked database, so
 * the UI can report "couldn't save" instead of crashing.
 */

import type { Product } from "./types";

const DB_NAME = "jamaali-catalogue";
const DB_VERSION = 1;
const STORE = "products";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser has no IndexedDB support."));
  }
  if (!dbPromise) {
    const attempt = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open the database."));
      request.onblocked = () => reject(new Error("Close other Jamaali tabs and try again."));
    });
    dbPromise = attempt.catch((error: unknown) => {
      dbPromise = null; // let the next call retry a fresh open
      throw error;
    });
  }
  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        let result: T | undefined;
        if (request) request.onsuccess = () => (result = request.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? new Error("The database rejected that change."));
        tx.onabort = () =>
          reject(tx.error ?? new Error("Storage is full — remove some photos and try again."));
      }),
  );
}

export function readAll(): Promise<Product[]> {
  return runTransaction<Product[]>("readonly", (store) => store.getAll()).then((rows) =>
    (rows ?? []).sort(byCode),
  );
}

export function write(product: Product): Promise<void> {
  return runTransaction("readwrite", (store) => store.put(product) as IDBRequest<IDBValidKey>).then(
    () => undefined,
  );
}

export function remove(id: string): Promise<void> {
  return runTransaction("readwrite", (store) => store.delete(id) as IDBRequest<undefined>).then(
    () => undefined,
  );
}

/** Replaces the entire catalogue. Used when restoring a backup. */
export async function replaceAll(products: Product[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    for (const product of products) store.put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Restore failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Restore failed — not enough space."));
  });
}

export const byCode = (a: Product, b: Product) =>
  a.code.localeCompare(b.code, "en", { numeric: true });
