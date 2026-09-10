// Rebuild browser/application icons from the same vector data as BrandLogo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const mark = JSON.parse(await readFile(new URL("src/components/mdez/brand-mark.json", root), "utf8"));
const paths = (part) => mark[part].map(({ d, color }) => `<path d="${d}" fill="${mark.colors[color]}"/>`).join("");
const symbol = ["mascot", "book", "sparkle"].map((part) => `<g id="${part}">${paths(part)}</g>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" role="img" aria-label="Mdez">${symbol}</svg>\n`;
await mkdir(new URL("public/brand/", root), { recursive: true });
await writeFile(new URL("public/brand/prism-pages.svg", root), svg);
await writeFile(new URL("src/app/icon.svg", root), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Mdez"><rect width="128" height="128" rx="28" fill="#fbfafe"/><g transform="translate(8 -13) scale(1 1.15)">${paths("book")}</g></svg>\n`);
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#f2eefa"/><g transform="translate(80 66) scale(3.14)">${symbol}</g></svg>`;
for (const [name, size] of [["apple-touch-icon", 180], ["icon-192", 192], ["icon-512", 512]]) {
  await sharp(Buffer.from(iconSvg)).resize(size, size).png().toFile(fileURLToPath(new URL(`public/brand/${name}.png`, root)));
}
