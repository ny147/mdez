import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mdez",
    short_name: "Mdez",
    description: "A local-first Markdown reader, editor, and public GitHub importer.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdfd",
    theme_color: "#8053c8",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
