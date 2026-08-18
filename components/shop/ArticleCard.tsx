import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/format";
import type { ShopArticle } from "@/lib/shop";
import { Icon } from "@/components/ui/Icon";

/**
 * One tile in the shopfront grid.
 *
 * Photos go through next/image so a customer on mobile data gets a resized,
 * CDN-cached picture rather than the full upload. The first row is marked
 * priority so the largest visible image isn't lazy-loaded.
 */
export function ArticleCard({ article, priority }: { article: ShopArticle; priority?: boolean }) {
  const cover = article.photos[0];
  const soldOut = article.status === "Sold out";

  return (
    <Link
      href={`/article/${encodeURIComponent(article.code.toLowerCase())}`}
      className="group block"
    >
      <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-shell-200 bg-shell-100">
        {cover ? (
          <Image
            src={cover.url}
            alt={`${article.code}${article.name ? ` — ${article.name}` : ""}`}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid size-full place-items-center text-shell-300">
            <Icon name="image" size={26} />
          </span>
        )}

        {article.status !== "Available" && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide ${
              soldOut ? "bg-danger text-white" : "bg-amber-300 text-ink-950"
            }`}
          >
            {article.status.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mt-3">
        {article.name ? (
          <h3 className="text-sm font-medium leading-snug text-shell-900">{article.name}</h3>
        ) : (
          <h3 className="text-sm font-medium leading-snug text-shell-900">{article.code}</h3>
        )}

        <p className="mt-1 font-ui text-[0.6875rem] tracking-[0.12em] text-shell-500">
          {article.code}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {article.fabric && (
            <span className="rounded-full bg-shell-100 px-2 py-0.5 text-[0.625rem] text-shell-600">
              {article.fabric}
            </span>
          )}
          <span className="rounded-full bg-shell-100 px-2 py-0.5 text-[0.625rem] text-shell-600">
            {article.pieces}
          </span>
        </div>

        <p className="numeric mt-2 text-sm font-semibold text-ink-900">{money(article.retail)}</p>
      </div>
    </Link>
  );
}
