import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth-dependent pages are rendered per request; we opt out of Cache Components to keep
  // session handling simple and avoid caching user data.
  cacheComponents: false,
  poweredByHeader: false,
  // pdfkit reads its own font metrics from node_modules at runtime; the report fonts ship in assets/fonts.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/analyses/[id]/export": ["./assets/fonts/**/*"],
    "/inceleme/[token]/pdf": ["./assets/fonts/**/*"],
  },
  // The analysis upload can carry still frames, a short 16 kHz audio clip and a landing screenshot.
  experimental: { proxyClientMaxBodySize: "16mb" },
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
