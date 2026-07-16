export type MarkdownHeading = {
  depth: number;
  text: string;
  id: string;
};

function slugifyHeading(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();
  let fence: "```" | "~~~" | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] as "```" | "~~~";
      fence = fence === marker ? null : fence ?? marker;
      continue;
    }
    if (fence) continue;

    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const text = match[2].replace(/[*_`~]/g, "").trim();
    const base = slugifyHeading(text);
    const count = (slugCounts.get(base) ?? 0) + 1;
    slugCounts.set(base, count);
    headings.push({ depth: match[1].length, text, id: count === 1 ? base : `${base}-${count}` });
  }

  return headings;
}
