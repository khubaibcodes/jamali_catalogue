import type { Metadata, Viewport } from "next";
import { Montserrat, Poppins } from "next/font/google";
import { brand, palette } from "@/lib/brand";
import "./globals.css";

/**
 * Both faces are what jamaali.com itself serves, so the catalogue and the
 * storefront read as one brand. The wordmark is artwork, not type — see
 * components/shop/Wordmark.tsx.
 */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    "Browse the Jamaali collection of stitched and unstitched eastern wear. Download the catalogue as a PDF.",
  applicationName: brand.name,
  robots: { index: true, follow: true },
  icons: { icon: brand.logo.mark, apple: brand.logo.mark },
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: palette.paper,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
