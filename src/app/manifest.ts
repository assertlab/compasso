import type { MetadataRoute } from "next";

// PWA manifest, served at /manifest.webmanifest.
// "maskable" icons keep the artwork inside the central safe zone so Android
// can crop them into circles or squircles without cutting the needle.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Compasso",
    short_name: "Compasso",
    description: "Registro de horas simples, robusto e sem paywall.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e2e47",
    theme_color: "#0e2e47",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
