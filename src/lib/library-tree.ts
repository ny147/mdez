import type { Document, Folder } from "@/types/content";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const UNSORTED_COLLECTION_ID = "__mdez_unsorted__";

export function naturalCompare(left: string, right: string): number {
  return collator.compare(left, right);
}

export function sortBooks(folders: Folder[]): Folder[] {
  return [...folders].sort((left, right) => naturalCompare(left.name, right.name) || left.id.localeCompare(right.id));
}

export function sortPages(documents: Document[]): Document[] {
  return [...documents].sort((left, right) => naturalCompare(left.title, right.title) || left.id.localeCompare(right.id));
}

// Match PostgreSQL's explicit ASCII folding exactly instead of relying on the
// host or database locale for generated-name collision allocation.
export const generatedNameCollisionKey = (value: string) => value.trim().replace(/[A-Z]/g, (character) => character.toLowerCase());
const truncateCodePoints = (value: string, length: number) => Array.from(value).slice(0, Math.max(0, length)).join("");

export function generatedNameCandidate(base: string, ordinal: number, max: number): string {
  const suffix = ordinal === 1 ? "" : ` (${ordinal})`;
  return truncateCodePoints(base, max - Array.from(suffix).length) + suffix;
}

export function buildFlatBookMigration(
  folders: Folder[],
  options: { maxGeneratedNameLength?: number } = {}
): Array<{ id: string; name: string }> {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const reserved = new Set(folders.filter((item) => item.parentId === null).map((item) => generatedNameCollisionKey(item.name)));

  function pathFor(folder: Folder): string {
    const names = [folder.name.trim() || "Untitled Book"];
    const visited = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name.trim() || "Untitled Book");
      if (visited.has(parent.id)) break;
      visited.add(parent.id);
      parentId = parent.parentId;
    }
    return names.join(" / ");
  }

  const generated = new Map<string, string>();
  const nested = folders.filter((folder) => folder.parentId !== null).sort((left, right) => left.id.localeCompare(right.id));
  for (const folder of nested) {
    const base = pathFor(folder);
    let ordinal = 1;
    let name = options.maxGeneratedNameLength
      ? generatedNameCandidate(base, ordinal, options.maxGeneratedNameLength)
      : base;
    while (reserved.has(generatedNameCollisionKey(name))) {
      ordinal += 1;
      name = options.maxGeneratedNameLength
        ? generatedNameCandidate(base, ordinal, options.maxGeneratedNameLength)
        : `${base} (${ordinal})`;
    }
    reserved.add(generatedNameCollisionKey(name));
    generated.set(folder.id, name);
  }
  return folders.map((folder) => ({ id: folder.id, name: folder.parentId === null ? folder.name : generated.get(folder.id) ?? folder.name }));
}

export function groupPagesByCollection(folders: Folder[], documents: Document[]) {
  const pages = new Map<string | null, Document[]>();
  pages.set(null, []);
  for (const folder of folders) pages.set(folder.id, []);
  for (const document of documents) (pages.get(document.folderId) ?? pages.get(null)!).push(document);
  for (const [key, value] of pages) pages.set(key, sortPages(value));
  return pages;
}
