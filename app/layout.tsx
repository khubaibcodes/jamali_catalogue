import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { brand, palette } from "@/lib/brand";
import "./globals.css";

/**
 * Cormorant carries the brand voice — headings, prices, the wordmark, and the
 * text drawn onto exported cards. Inter does the working text, where clarity at
 * small sizes matters more than character.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.purpose}`,
  description:
    "Manage the Jamaali article catalogue, keep retail, reseller and wholesale rates in one place, and export ready-to-post cards for WhatsApp and Instagram.",
  applicationName: brand.name,
  // The shopfront wants to be found; /admin and /login opt out individually.
  robots: { index: true, follow: true },
  // Lets iOS open it full-screen once it's added to the home screen.
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: palette.emerald,
  // The card studio is a fixed-width design; pinching it should stay possible.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
