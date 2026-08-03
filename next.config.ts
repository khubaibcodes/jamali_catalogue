import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This worktree sits inside a parent repo that has its own lockfile; without
  // this, Turbopack infers the parent directory as the workspace root.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
