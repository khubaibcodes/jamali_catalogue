"use client";

/**
 * PDF download buttons.
 *
 * @react-pdf/renderer is ~350 KB, so it is imported dynamically at click time
 * rather than shipped with the shopfront. A customer who only browses never
 * downloads it.
 *
 * Photos come from Supabase Storage as WebP, which react-pdf cannot decode, so
 * they are transcoded to JPEG first — see lib/pdf/images.ts. Storage serves
 * permissive CORS headers, which is what makes that canvas step legal; it is
 * the same constraint that governs the card export.
 */

import { useState } from "react";
import { brand } from "@/lib/brand";
import { slug } from "@/lib/format";
import type { ShopArticle } from "@/lib/shop";
import { Icon } from "@/components/ui/Icon";

/** Absolute URL — react-pdf cannot resolve a root-relative path. */
const absolute = (path: string) =>
  typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ArticlePdfButton({ article }: { article: ShopArticle }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { ArticleDocument }, { withEmbeddablePhotos }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/documents"),
        import("@/lib/pdf/images"),
      ]);
      // Photos are stored as WebP, which react-pdf cannot decode. Transcode
      // before rendering or the pages come out blank.
      const [ready] = await withEmbeddablePhotos([article]);
      const blob = await pdf(
        <ArticleDocument article={ready} logoUrl={absolute(brand.logo.wordmark)} />,
      ).toBlob();
      save(blob, `jamaali-${slug(article.code)}.pdf`);
    } catch {
      setError("The PDF couldn't be built. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={download} disabled={busy} className="btn btn-primary mt-7 w-full">
        <Icon name="download" size={16} />
        {busy ? "Preparing PDF…" : "Download PDF"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}

export function CataloguePdfButton({ articles }: { articles: ShopArticle[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { CatalogueDocument }, { withEmbeddablePhotos }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/documents"),
        import("@/lib/pdf/images"),
      ]);
      const ready = await withEmbeddablePhotos(articles);
      const blob = await pdf(
        <CatalogueDocument articles={ready} logoUrl={absolute(brand.logo.wordmark)} />,
      ).toBlob();
      const stamp = new Date().toISOString().slice(0, 7);
      save(blob, `jamaali-catalogue-${stamp}.pdf`);
    } catch {
      // Most likely cause on a phone: the tab ran out of memory embedding
      // every photo. Say so rather than blaming the network.
      setError("Couldn't build the catalogue — try again on a computer.");
    } finally {
      setBusy(false);
    }
  }

  if (articles.length === 0) return null;

  return (
    <div className="text-center">
      <button type="button" onClick={download} disabled={busy} className="btn btn-quiet btn-sm" aria-live="polite">
        <Icon name="download" size={15} />
        {busy ? `Building ${articles.length}-article PDF…` : "Download the full catalogue"}
      </button>
      <p className="mt-2 text-xs text-shell-500">
        {busy ? "This can take up to a minute. Keep this tab open." : `${articles.length} articles · PDF`}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
