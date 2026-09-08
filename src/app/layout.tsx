import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Manrope, Shippori_Mincho_B1 } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { appMetadata } from "@/app/metadata";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const jetBrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });
const shipporiMincho = Shippori_Mincho_B1({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = appMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = `${dmSans.variable} ${manrope.variable} ${jetBrainsMono.variable} ${shipporiMincho.variable}`;

  return (
    <html lang="en" className={fontVariables}>
      <body>
        {/*
          THESIS: A roomy working library where real books and pages lead; refuse the compact app-console frame.
          OWN-WORLD: Lavender shelving, ink-black type, muted pastel covers, crisp rules, and restrained rounded controls.
          STORY: Orient in a workspace, find or resume a page, then write, read, share, or export without losing local-first trust.
          FIRST VIEWPORT: A 238px library sidebar anchors an 80px breadcrumb/search header and a broad, scrollable shelf canvas.
          FORM: Desktop writing library, ranked first; seed key library-shelf-238.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
