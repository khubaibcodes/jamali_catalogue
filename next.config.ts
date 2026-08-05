import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: "export"` was removed when the catalogue moved to Supabase.
  // Sessions and server-side filtering of private data both need a server, and
  // filtering on the server is the whole reason customers can't see trade
  // rates. Vercel serves this the same way; the deploy flow is unchanged.

  images: {
    // Product photos are served from Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "ngnlmlrevtyqdbkalvjn.supabase.co" }],
  },

  // This worktree sits inside a parent repo that has its own lockfile; without
  // this, Turbopack infers the parent directory as the workspace root.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
