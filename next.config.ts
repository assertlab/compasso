import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  // Shown in the version label and footer (src/lib/app-info.ts); the year is the build year, so a deploy refreshes it.
  env: { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) },
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
