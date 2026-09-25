import { generatedNameCollisionKey } from "@/lib/library-tree";
import type { ParsedWorkspaceBackup, PlannedBackupBook, PlannedBackupSource, WorkspaceRestorePlan } from "@/types/backup";
import type { Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

export type WorkspaceRestoreBase = { folders: Folder[]; sources: GitHubSource[] };

export function workspaceRestoreBaseSignature(input: WorkspaceRestoreBase) {
  return JSON.stringify({
    books: input.folders
      .map(({ id, name }) => ({ id, key: generatedNameCollisionKey(name) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    sources: input.sources
      .map(({ id, normalizedUrl }) => ({ id, url: normalizedUrl.toLocaleLowerCase("en-US") }))
      .sort((left, right) => left.id.localeCompare(right.id))
  });
}

function restoredBookName(name: string, reserved: Set<string>) {
  if (!reserved.has(generatedNameCollisionKey(name))) return name;
  let suffix = 1;
  let candidate: string;
  do {
    candidate = suffix === 1 ? `${name} (restored)` : `${name} (restored ${suffix})`;
    suffix += 1;
  } while (reserved.has(generatedNameCollisionKey(candidate)));
  return candidate;
}

export function createWorkspaceRestorePlan(parsed: ParsedWorkspaceBackup, existing: WorkspaceRestoreBase): WorkspaceRestorePlan {
  const parsedCopy = structuredClone(parsed);
  const reservedNames = new Set(existing.folders.map((folder) => generatedNameCollisionKey(folder.name)));
  const books: PlannedBackupBook[] = parsedCopy.manifest.books.map((book) => {
    const restoredName = restoredBookName(book.name, reservedNames);
    reservedNames.add(generatedNameCollisionKey(restoredName));
    return { ...book, restoredName, renamed: restoredName !== book.name };
  });
  const reservedUrls = new Set(existing.sources.map((source) => source.normalizedUrl.toLocaleLowerCase("en-US")));
  const sources: PlannedBackupSource[] = parsedCopy.manifest.githubSources.map((source) => {
    const key = source.normalizedUrl.toLocaleLowerCase("en-US");
    const action = reservedUrls.has(key) ? "detach" : "retain";
    reservedUrls.add(key);
    return { ...source, action };
  });
  const populatedBooks = new Set(parsedCopy.manifest.pages.flatMap((page) => page.bookId ? [page.bookId] : []));

  return {
    parsed: parsedCopy,
    baseSignature: workspaceRestoreBaseSignature(existing),
    books,
    sources,
    summary: {
      bookCount: books.length,
      emptyBookCount: books.filter((book) => !populatedBooks.has(book.id)).length,
      pageCount: parsedCopy.manifest.pages.length,
      unsortedPageCount: parsedCopy.manifest.pages.filter((page) => page.bookId === null).length,
      bookmarkCount: parsedCopy.manifest.bookmarks.length,
      totalMarkdownBytes: parsedCopy.totalMarkdownBytes
    }
  };
}
