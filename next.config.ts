import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth-dependent pages are rendered per request; we opt out of Cache Components to keep
  // session handling simple and avoid caching user data.
  cacheComponents: false,
  poweredByHeader: false,
  // Lets the end-to-end suite run an isolated demo-mode server next to a dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
