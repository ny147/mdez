import type { Metadata } from "next";

export const appMetadata: Metadata = {
  applicationName: "Mdez",
  title: {
    default: "Mdez",
    template: "%s · Mdez"
  },
  description: "A local-first Markdown reader, editor, and public GitHub importer.",
  icons: { icon: "/icon.svg" }
};
