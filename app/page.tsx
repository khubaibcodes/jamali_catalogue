import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { browseFacets, listArticles } from "@/lib/shop";
import { ArticleCard } from "@/components/shop/ArticleCard";
import { ShopFooter, ShopHeader } from "@/components/shop/ShopChrome";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    "Browse the Jamaali collection of unstitched and stitched eastern wear. Order on WhatsApp.",
  robots: { index: true, follow: true },
};

// The shopfront is rebuilt at most once a minute rather than on every visit,
// so a busy day doesn't turn into a query per page view.
export const revalidate = 60;

export default async function ShopPage({
  searchParams,
}: {
  // Async in Next 16 — reading it synchronously is no longer allowed.
  searchParams: Promise<{ category?: string; collection?: string }>;
}) {
  const filter = await searchParams;
  const [articles, facets] = await Promise.all([
    listArticles(filter),
    browseFacets(),
  ]);

  const filtering = Boolean(filter.category || filter.collection);

  return (
    <>
      <ShopHeader />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl">The Collection</h1>
          <div className="rule-gold mx-auto mt-5 w-52" />
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-sand-600">
            Every article is available to order on WhatsApp. Quote the article code and we&apos;ll
            reply with availability.
          </p>
        </section>

        {(facets.categories.length > 1 || facets.collections.length > 0) && (
          <nav
            aria-label="Filter the collection"
            className="mb-10 flex flex-wrap items-center justify-center gap-2"
          >
            <FilterLink label="All" href="/" active={!filtering} />
            {facets.collections.map((collection) => (
              <FilterLink
                key={collection}
                label={collection}
                href={`/?collection=${encodeURIComponent(collection)}`}
                active={filter.collection === collection}
              />
            ))}
            {facets.categories.map((category) => (
              <FilterLink
                key={category}
                label={category}
                href={`/?category=${encodeURIComponent(category)}`}
                active={filter.category === category}
              />
            ))}
          </nav>
        )}

        {articles.length === 0 ? (
          <div className="py-24 text-center">
            <h2 className="text-2xl">
              {filtering ? "Nothing in this collection yet" : "The collection is being prepared"}
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-sand-600">
              {filtering
                ? "Try another collection, or view everything."
                : "New articles are added regularly. Message us on WhatsApp and we'll send you what's in stock."}
            </p>
            {filtering && (
              <Link href="/" className="btn btn-quiet mt-6">
                View everything
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {articles.map((article, index) => (
              <li key={article.id}>
                <ArticleCard article={article} priority={index < 4} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <ShopFooter />
    </>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href} className="chip" aria-current={active ? "true" : undefined} data-active={active}>
      <span className={active ? "font-semibold text-emerald-800" : undefined}>{label}</span>
    </Link>
  );
}
