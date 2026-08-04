import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole catalogue runs in the browser — storage, image processing and
  // card rendering all happen client-side, and nothing is fetched at request
  // time. Exporting to static files means `npm run build` produces a plain
  // folder that any host will serve, with no Node process to keep alive.
  output: "export",

  // This worktree sits inside a parent repo that has its own lockfile; without
  // this, Turbopack infers the parent directory as the workspace root.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
