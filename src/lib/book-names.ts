import type { Folder } from "@/types/content";

export const MAX_BOOK_NAME_LENGTH = 120;

export function normalizeBookName(value: string) {
  return value.trim();
}

export function validateBookName(
  value: string,
  folders: Folder[],
  parentId: string | null,
  excludeFolderId?: string
): string | null {
  const normalized = normalizeBookName(value);
  if (!normalized) return "Enter a book name.";
  if (normalized.length > MAX_BOOK_NAME_LENGTH) return `Book names must be ${MAX_BOOK_NAME_LENGTH} characters or fewer.`;

  const duplicate = folders.find((folder) =>
    folder.parentId === parentId
    && folder.id !== excludeFolderId
    && normalizeBookName(folder.name).localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0
  );
  return duplicate ? `A book named ${duplicate.name} already exists here.` : null;
}
