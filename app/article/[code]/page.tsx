import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brand, whatsappLink } from "@/lib/brand";
import { money } from "@/lib/format";
import { findArticle, listArticles } from "@/lib/shop";
import { ArticleCard } from "@/components/shop/ArticleCard";
import { ShopFooter, ShopHeader } from "@/components/shop/ShopChrome";
import { Icon } from "@/components/ui/Icon";

export const revalidate = 60;

// `params` is a Promise in Next 16.
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const article = await findArticle(decodeURIComponent(code));
  if (!article) return { title: "Article not found" };

  const title = [article.code, article.name].filter(Boolean).join(" — ");
  return {
    title: `${title} · ${brand.name}`,
    description: [article.fabric, article.stitch, article.pieces].filter(Boolean).join(", "),
    // The cover photo doubles as the WhatsApp and Instagram link preview.
    openGraph: {
      title,
      images: article.photos[0] ? [{ url: article.photos[0].url }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { code } = await params;
  const article = await findArticle(decodeURIComponent(code));
  if (!article) notFound();

  const enquiry = whatsappLink(
    `Hello ${brand.name}, I'd like to order article *${article.code}*` +
      (article.name ? ` (${article.name})` : "") +
      ". Is it available?",
  );

  const related = (await listArticles({ collection: article.collection }))
    .filter((a) => a.id !== article.id)
    .slice(0, 4);

  const soldOut = article.status === "Sold out";

  return (
    <>
      <ShopHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-sand-600 hover:text-emerald-800">
          <span aria-hidden="true">←</span> The Collection
        </Link>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-3">
            {article.photos.length ? (
              article.photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative aspect-4/5 overflow-hidden rounded-lg border border-sand-200 bg-sand-100"
                >
                  <Image
                    src={photo.url}
                    alt={`${article.code}, photo ${index + 1}`}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    priority={index === 0}
                    className="object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="grid aspect-4/5 place-items-center rounded-lg border border-sand-200 bg-sand-100 text-sand-300">
                <Icon name="image" size={32} />
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="eyebrow">{article.fabric || "Premium fabric"}</p>
            <h1 className="mt-2 text-4xl">
              {article.code}
              {article.name && <span className="block text-2xl text-sand-600">{article.name}</span>}
            </h1>

            <p className="numeric mt-5 font-display text-3xl text-emerald-800">
              {money(article.retail)}
            </p>

            {article.status !== "Available" && (
              <p
                className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  soldOut ? "bg-danger-soft text-danger" : "bg-gold-300/30 text-gold-700"
                }`}
              >
                {article.status}
              </p>
            )}

            <dl className="mt-7 divide-y divide-sand-200 border-y border-sand-200 text-sm">
              <Detail term="Stitching" value={article.stitch} />
              <Detail term="Pieces" value={article.pieces} />
              {article.fabric && <Detail term="Fabric" value={article.fabric} />}
              {article.colours.length > 0 && (
                <Detail term="Colours" value={article.colours.join(", ")} />
              )}
              {article.collection && <Detail term="Collection" value={article.collection} />}
            </dl>

            <a
              href={enquiry}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary mt-7 w-full"
            >
              <Icon name="whatsapp" size={17} />
              {soldOut ? "Ask when it's back" : `Order ${article.code} on WhatsApp`}
            </a>

            <p className="mt-3 text-center text-xs leading-relaxed text-sand-500">
              Opens WhatsApp with the article code filled in.
            </p>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl">More from {article.collection}</h2>
            <div className="rule-gold mt-4 w-40" />
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
              {related.map((item) => (
                <li key={item.id}>
                  <ArticleCard article={item} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <ShopFooter />
    </>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-sand-600">{term}</dt>
      <dd className="text-right font-medium text-sand-900">{value}</dd>
    </div>
  );
}
