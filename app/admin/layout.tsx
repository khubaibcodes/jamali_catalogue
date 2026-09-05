import type { Metadata } from "next";

/**
 * Admin gets its own web manifest so it installs as a separate home-screen
 * app from the customer shopfront.
 *
 * `app/manifest.ts` is root-only in Next, and it belongs to the shopfront. A
 * second manifest therefore lives in public/ and is pointed at from here —
 * `metadata.manifest` just emits <link rel="manifest">, which is all that's
 * needed. Its `scope` is /admin, so installing it doesn't swallow the
 * customer site.
 */
export const metadata: Metadata = {
  title: "JAMAALI Admin",
  manifest: "/admin.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "JAMAALI Admin", statusBarStyle: "default" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
