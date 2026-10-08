import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Loaded from node_modules at runtime instead of being bundled (large CommonJS dependency tree).
  serverExternalPackages: ["exceljs", "@react-pdf/renderer"],
  // The PDF reads IBM Plex (node_modules) and the app icon at runtime; make sure the files ship with the route on Vercel.
  outputFileTracingIncludes: {
    "/relatorios/export": ["./node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-{400,600}-normal.woff", "./public/icons/icon-192.png"],
  },
  partialPrefetching: true,
  async headers() {
    return [
      {
        // The browser must always revalidate the worker script so updates reach installed PWAs.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
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
