import type { MetadataRoute } from "next";

// Wird automatisch unter /manifest.webmanifest ausgeliefert.
// Sorgt im Safari/PWA-Modus und im WebView für ein "richtiges App"-Verhalten
// (Standalone-Anzeige ohne Browser-Leiste, eigene Farben).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fight Calendar",
    short_name: "Fight Cal",
    description: "NFT Köln — Wer kommt diese Woche?",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
