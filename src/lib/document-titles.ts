import type { Document } from "@/types/content";

type DocumentTitleScope = Pick<Document, "folderId" | "title">;

export function nextUntitledPageTitle(documents: DocumentTitleScope[], folderId: string | null) {
  const existingTitles = new Set(
    documents
      .filter((document) => document.folderId === folderId)
      .map((document) => document.title.trim().toLocaleLowerCase())
  );

  if (!existingTitles.has("untitled.md")) return "untitled.md";

  let suffix = 2;
  while (existingTitles.has(`untitled-${suffix}.md`)) suffix += 1;
  return `untitled-${suffix}.md`;
}
