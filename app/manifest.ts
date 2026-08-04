import type { MetadataRoute } from "next";
import { brand, palette } from "@/lib/brand";

// Required by `output: "export"` — metadata routes are dynamic by default, and
// a static build has nowhere to run them at request time.
export const dynamic = "force-static";

/**
 * Lets the catalogue be installed to a phone's home screen, where it opens
 * without browser chrome. Worth doing: the shop uses this standing at a rail
 * with one hand, not at a desk.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — ${brand.purpose}`,
    short_name: brand.name,
    description: "Article catalogue, rate book, and card maker for Jamaali.",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: palette.ivory,
    theme_color: palette.emerald,
    icons: [
      { src: "./icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
