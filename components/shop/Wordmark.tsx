import Image from "next/image";
import { brand } from "@/lib/brand";

/**
 * The Jamaali wordmark, using the real artwork rather than web type.
 *
 * The logo is a high-contrast serif with an amber trefoil above the double-A
 * and an amber full stop — no free web font reproduces it, and setting it in
 * Montserrat would quietly make the brand look wrong on every page. The PNG
 * is transparent, so it sits on any surface.
 */
export function Wordmark({
  height = 34,
  className = "",
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  // Intrinsic artwork is 1703×518.
  const width = Math.round(height * (1703 / 518));
  return (
    <Image
      src={brand.logo.wordmark}
      alt={brand.name}
      width={width}
      height={height}
      priority={priority}
      className={className}
      // Small, fixed-size and above the fold — resizing it buys nothing.
      unoptimized
    />
  );
}

/** The square trefoil mark on its own, for tight spaces and PDF covers. */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={brand.logo.mark}
      alt=""
      width={size}
      height={size}
      className={className}
      unoptimized
      aria-hidden="true"
    />
  );
}
