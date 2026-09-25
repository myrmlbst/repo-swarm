import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // The monorepo root, one level up — npm workspaces hoist `next` (and
    // everything else shared across api/web/agents) to the root
    // node_modules, not web/node_modules, so Turbopack needs to look there.
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
