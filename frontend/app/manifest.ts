import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest and auto-linked by Next. Makes JharSetu
 * installable as an app: standalone display, themed splash, bridge icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JharSetu — Government of Jharkhand",
    short_name: "JharSetu",
    description:
      "See a need. Form a team. Close the loop. Report problems, verify them, and track the fix — for Jharkhand's districts.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F6F5",
    theme_color: "#0B2A4A",
    lang: "en",
    dir: "ltr",
    categories: ["government", "social", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
