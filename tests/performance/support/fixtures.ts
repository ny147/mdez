import type { GroupSnapshot, LocalGroupImport } from "../../../src/types/key-group";

export const fixtureSizes = {
  small: [3, 10, 2 * 1024],
  typical: [10, 100, 10 * 1024],
  large: [20, 1000, 40 * 1024],
  "single-page-limit": [1, 1, 5 * 1024 * 1024],
} as const;
export type FixtureSize = keyof typeof fixtureSizes;
export const fixtureSeed = 36;
const timestamp = "2026-11-11T00:00:00.000Z";
const markdown = "# Synthetic page\n\nDeterministic performance content.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst seed = 36;\n```\n\n$$x^2 + y^2 = z^2$$\n\n";

export function buildPerformanceFixture(size: FixtureSize): GroupSnapshot {
  const [books, pages, bytes] = fixtureSizes[size];
  const folders = Array.from({ length: books }, (_, index) => ({ id: `book-${index}`, parentId: null, name: `Book ${index}`, order: index, version: 1, groupRevision: 0, createdAt: timestamp, updatedAt: timestamp }));
  return {
    group: { id: "g1", name: "Performance library", revision: 0, deletedAt: null, purgeAfter: null, createdAt: timestamp, updatedAt: timestamp },
    folders,
    documents: Array.from({ length: pages }, (_, index) => {
      const content = markdown.replace("# Synthetic page\n", `# Synthetic page ${index}\n`);
      const body = content + "x".repeat(bytes - new TextEncoder().encode(content).length);
      const bookIndex = (index - Math.floor(index / 5) - 1) % books;
      return { id: `page-${index}`, folderId: index % 5 === 0 ? null : folders[bookIndex].id, title: `Page ${index}`, body, order: index, version: 1, groupRevision: 0, createdAt: timestamp, updatedAt: timestamp };
    }),
  };
}

export function fixtureImport(snapshot: GroupSnapshot): LocalGroupImport {
  return { name: snapshot.group.name,
    folders: snapshot.folders.map((item) => ({ clientId: item.id, parentClientId: null, name: item.name, order: item.order, createdAt: item.createdAt, updatedAt: item.updatedAt })),
    documents: snapshot.documents.map((item) => ({ clientId: item.id, folderClientId: item.folderId, title: item.title, body: item.body, order: item.order, createdAt: item.createdAt, updatedAt: item.updatedAt })),
  };
}
