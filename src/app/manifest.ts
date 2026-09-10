import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mdez",
    short_name: "Mdez",
    description: "A local-first Markdown reader, editor, and public GitHub importer.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfafe",
    theme_color: "#6845ac",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
