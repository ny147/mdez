import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Shippori_Mincho_B1, Space_Grotesk } from "next/font/google";
import "highlight.js/styles/github.css";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const jetBrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });
const shipporiMincho = Shippori_Mincho_B1({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Mdez",
  description: "A local-first Markdown easy reader and editor."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = `${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} ${shipporiMincho.variable}`;

  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
