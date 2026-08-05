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
      <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-sand-200 bg-sand-100">
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
          <span className="grid size-full place-items-center text-sand-300">
            <Icon name="image" size={26} />
          </span>
        )}

        {article.status !== "Available" && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide ${
              soldOut ? "bg-danger text-white" : "bg-gold-300 text-emerald-950"
            }`}
          >
            {article.status.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-ui text-sm font-semibold tracking-wide text-emerald-800">
            {article.code}
          </h3>
          <p className="numeric font-display text-lg text-sand-900">{money(article.retail)}</p>
        </div>
        {article.name && <p className="mt-0.5 text-sm text-sand-900">{article.name}</p>}
        <p className="mt-0.5 text-xs text-sand-600">
          {[article.fabric, article.stitch, article.pieces].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
