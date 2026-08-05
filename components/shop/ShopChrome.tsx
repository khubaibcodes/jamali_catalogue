import Link from "next/link";
import { brand, whatsappLink } from "@/lib/brand";
import { Icon } from "@/components/ui/Icon";

export function ShopHeader() {
  return (
    <header className="border-b border-sand-200 bg-sand-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="group">
          <p className="wordmark text-xl text-emerald-800 sm:text-2xl">{brand.name}</p>
          <p className="mt-1 text-[0.625rem] italic tracking-[0.14em] text-gold-700">
            {brand.tagline}
          </p>
        </Link>

        <a
          href={whatsappLink(`Hello ${brand.name}, I'd like to see your latest collection.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          <Icon name="whatsapp" size={15} />
          <span className="max-sm:sr-only">Order on WhatsApp</span>
        </a>
      </div>
      <div className="rule-gold" />
    </header>
  );
}

export function ShopFooter() {
  return (
    <footer className="mt-20 border-t border-sand-200 px-4 py-10 text-center">
      <p className="wordmark text-base text-emerald-800">{brand.name}</p>
      <p className="mt-2 text-xs italic text-gold-700">{brand.tagline}</p>
      <p className="mt-4 text-xs text-sand-500">
        Order on WhatsApp · {brand.website}
      </p>
    </footer>
  );
}
