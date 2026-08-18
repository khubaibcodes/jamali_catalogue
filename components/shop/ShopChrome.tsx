import Link from "next/link";
import { brand } from "@/lib/brand";
import { Wordmark } from "./Wordmark";

/**
 * Shopfront header and footer.
 *
 * Carries no phone number, no WhatsApp link and no email — the public
 * catalogue is a lookbook, not a contact channel. Customers who want to order
 * already know where to find the shop.
 */

export function ShopHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-shell-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-4 sm:py-5">
        <Link href="/" aria-label={`${brand.name} home`}>
          <Wordmark height={30} priority className="h-6 w-auto sm:h-8" />
        </Link>
      </div>
      <div className="rule-amber" />
    </header>
  );
}

export function ShopFooter() {
  return (
    <footer className="mt-24 border-t border-shell-200 px-4 py-12 text-center">
      <Wordmark height={26} className="mx-auto h-5 w-auto opacity-90" />
      <p className="mt-4 text-xs tracking-[0.14em] text-shell-500 uppercase">{brand.website}</p>
    </footer>
  );
}
