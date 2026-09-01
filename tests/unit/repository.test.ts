import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, MdezDatabase } from "@/lib/db";
import {
  createDocument,
  createDocuments,
  createFolder,
  deleteDocument,
  deleteFolder,
  deleteGitHubSource,
  importGitHubSource,
  listContent,
  moveDocument,
  refreshGitHubSource,
  renameDocument,
  renameFolder,
  updateDocumentBody
} from "@/lib/repository";
import type { GitHubImportSession } from "@/types/github";

function githubSession(overrides: Partial<GitHubImportSession> = {}): GitHubImportSession {
  const repository = overrides.repository ?? {
    owner: "openai",
    repository: "codex",
    normalizedUrl: "https://github.com/openai/codex"
  };

  return {
    repository,
    branch: "main",
    markdownCount: 2,
    ignoredCount: 0,
    totalMarkdownBytes: 15,
    folders: [
      { path: "guides", name: "guides", parentPath: null, order: 0 }
    ],
    documents: [
      {
        path: "readme.md",
        title: "readme",
        body: "# Read me",
        folderPath: null,
        order: 0,
        byteSize: 9
      },
      {
        path: "guides/setup.md",
        title: "setup",
        body: "# Setup",
        folderPath: "guides",
        order: 0,
        byteSize: 7
      }
    ],
    ignoredEntries: [],
    fetchedAt: "2026-07-14T00:00:00.000Z",
    ...overrides
  };
}
describe("repository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates and lists folders and documents", async () => {
    const folder = await createFolder("Notes", null);
    const document = await createDocument({ title: "Hello", body: "# Hello", folderId: folder.id });
    const content = await listContent();

    expect(content.folders).toHaveLength(1);
    expect(content.documents).toHaveLength(1);
    expect(content.documents[0].id).toBe(document.id);
  });

  it("creates multiple documents in one folder transaction", async () => {
    const folder = await createFolder("Imports", null);
    const existing = await createDocument({ title: "Existing", body: "", folderId: folder.id });

    const imported = await createDocuments(
      [
        { title: "First", body: "# First" },
        { title: "Second", body: "# Second" }
      ],
      folder.id
    );

    expect(imported).toHaveLength(2);
    expect(imported[0]).toMatchObject({ title: "First", body: "# First", folderId: folder.id, order: 1 });
    expect(imported[1]).toMatchObject({ title: "Second", body: "# Second", folderId: folder.id, order: 2 });
    expect(existing.order).toBe(0);
  });

  it("rolls back all imported documents when a batch insert fails", async () => {
    const originalAdd = db.documents.add.bind(db.documents);
    let addCount = 0;

    vi.spyOn(db.documents, "add").mockImplementation(((document) => {
      addCount += 1;

      if (addCount === 2) {
        throw new Error("Insert failed.");
      }

      return originalAdd(document);
    }) as typeof db.documents.add);

    await expect(
      createDocuments(
        [
          { title: "First", body: "# First" },
          { title: "Second", body: "# Second" }
        ],
        null
      )
    ).rejects.toThrow("Insert failed.");

    expect((await listContent()).documents).toHaveLength(0);
  });

  it("updates document body and timestamps", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const document = await createDocument({ title: "Draft", body: "before", folderId: null });

    vi.setSystemTime(new Date("2026-01-01T00:01:00.000Z"));
    const updated = await updateDocumentBody(document.id, "after");

    expect(updated.body).toBe("after");
    expect(updated.updatedAt).toBe("2026-01-01T00:01:00.000Z");
    expect(updated.updatedAt).not.toBe(document.updatedAt);
  });

  it("renames folders", async () => {
    const folder = await createFolder("Before", null);
    const renamed = await renameFolder(folder.id, "After");

    expect(renamed.name).toBe("After");
  });

  it("throws when renaming a missing folder", async () => {
    await expect(renameFolder("missing", "After")).rejects.toThrow("Folder not found.");
  });

  it("renames documents", async () => {
    const document = await createDocument({ title: "Before", body: "", folderId: null });
    const renamed = await renameDocument(document.id, "After");

    expect(renamed.title).toBe("After");
  });

  it("throws when renaming a missing document", async () => {
    await expect(renameDocument("missing", "After")).rejects.toThrow("Document not found.");
  });

  it("throws when updating the body of a missing document", async () => {
    await expect(updateDocumentBody("missing", "after")).rejects.toThrow("Document not found.");
  });

  it("preserves body edits that interleave with title updates", async () => {
    const document = await createDocument({ title: "Before", body: "before", folderId: null });
    const originalPut = db.documents.put.bind(db.documents);
    let releaseFirstPut: (() => void) | undefined;
    const firstPutStarted = new Promise<void>((resolve) => {
      vi.spyOn(db.documents, "put").mockImplementation(((updatedDocument) => {
        if (!releaseFirstPut) {
          return new Promise<void>((release) => {
            releaseFirstPut = release;
            resolve();
          }).then(() => originalPut(updatedDocument)) as ReturnType<typeof db.documents.put>;
        }

        return originalPut(updatedDocument);
      }) as typeof db.documents.put);
    });

    const renamePromise = renameDocument(document.id, "After");
    await Promise.race([firstPutStarted, renamePromise]);
    await updateDocumentBody(document.id, "after");
    releaseFirstPut?.();
    await renamePromise;

    const content = await listContent();

    expect(content.documents[0]).toMatchObject({
      id: document.id,
      title: "After",
      body: "after"
    });
  });

  it("moves documents to another folder with next sibling order", async () => {
    const folder = await createFolder("Target", null);
    const existing = await createDocument({ title: "Existing", body: "", folderId: folder.id });
    const document = await createDocument({ title: "Draft", body: "", folderId: null });

    const moved = await moveDocument(document.id, folder.id);

    expect(moved.folderId).toBe(folder.id);
    expect(moved.order).toBe(1);
    expect(existing.order).toBe(0);
  });

  it("throws when moving a missing document", async () => {
    await expect(moveDocument("missing", null)).rejects.toThrow("Document not found.");
  });

  it("keeps order when moving a document to its current folder", async () => {
    const first = await createDocument({ title: "First", body: "", folderId: null });
    const second = await createDocument({ title: "Second", body: "", folderId: null });

    const moved = await moveDocument(first.id, null);

    expect(moved.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it("deletes folders", async () => {
    const folder = await createFolder("Notes", null);
    await deleteFolder(folder.id);

    expect((await listContent()).folders).toHaveLength(0);
  });

  it("deletes documents", async () => {
    const document = await createDocument({ title: "Draft", body: "", folderId: null });
    await deleteDocument(document.id);

    expect((await listContent()).documents).toHaveLength(0);
  });

  it("rejects blank book names while preserving fallback page titles", async () => {
    await expect(createFolder("   ", null)).rejects.toThrow("Enter a book name.");
    const folder = await createFolder("Research", null);
    const document = await createDocument({ title: "   ", body: "", folderId: null });
    await expect(renameFolder(folder.id, " ")).rejects.toThrow("Enter a book name.");
    const renamedDocument = await renameDocument(document.id, " ");

    expect(folder.name).toBe("Research");
    expect(document.title).toBe("untitled.md");
    expect(renamedDocument.title).toBe("untitled.md");
  });

  it("assigns sibling order by folder", async () => {
    const parent = await createFolder("Parent", null);
    const rootFolder = await createFolder("Root", null);
    const childFolder = await createFolder("Child", parent.id);
    const firstRootDocument = await createDocument({ title: "Root 1", body: "", folderId: null });
    const secondRootDocument = await createDocument({ title: "Root 2", body: "", folderId: null });
    const childDocument = await createDocument({ title: "Child", body: "", folderId: parent.id });

    expect(parent.order).toBe(0);
    expect(rootFolder.order).toBe(1);
    expect(childFolder.order).toBe(0);
    expect(firstRootDocument.order).toBe(0);
    expect(secondRootDocument.order).toBe(1);
    expect(childDocument.order).toBe(0);
  });
  it("migrates version-1 local content without adding source ownership", async () => {
    const databaseName = "mdez-version-1-migration";
    await Dexie.delete(databaseName);
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores({
      folders: "id, parentId, order, updatedAt",
      documents: "id, folderId, order, updatedAt"
    });
    await legacy.open();
    await legacy.table("folders").add({
      id: "legacy-folder",
      name: "Legacy",
      parentId: null,
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    await legacy.table("documents").add({
      id: "legacy-document",
      title: "Legacy",
      body: "preserved",
      folderId: "legacy-folder",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    legacy.close();

    const migrated = new MdezDatabase(databaseName);

    try {
      await migrated.open();
      const migratedFolder = await migrated.folders.get("legacy-folder");
      const migratedDocument = await migrated.documents.get("legacy-document");
      expect(migratedFolder).toMatchObject({ name: "Legacy" });
      expect(migratedFolder).not.toHaveProperty("sourceId");
      expect(migratedDocument).toMatchObject({ body: "preserved" });
      expect(migratedDocument).not.toHaveProperty("sourceId");
      expect(await migrated.githubSources.count()).toBe(0);
    } finally {
      migrated.close();
      await Dexie.delete(databaseName);
    }
  });

  it("imports a GitHub source transactionally while preserving local content", async () => {
    const localFolder = await createFolder("Local", null);
    const localDocument = await createDocument({ title: "Local", body: "keep", folderId: localFolder.id });

    const result = await importGitHubSource(githubSession());
    const content = await listContent();
    const root = content.folders.find((folder) => folder.id === result.rootFolderId);
    const guide = content.folders.find((folder) => folder.name === "guides");

    expect(result).toMatchObject({ folderCount: 2, documentCount: 2 });
    expect(result.firstDocumentId).not.toBeNull();
    expect(content.sources).toHaveLength(1);
    expect(content.sources[0]).toMatchObject({
      id: result.source.id,
      normalizedUrl: "https://github.com/openai/codex",
      rootFolderId: result.rootFolderId,
      branch: "main"
    });
    expect(root).toMatchObject({ name: "codex", parentId: null, sourceId: result.source.id });
    expect(guide).toMatchObject({ parentId: root?.id, sourceId: result.source.id });
    expect(content.documents.filter((document) => document.sourceId === result.source.id)).toHaveLength(2);
    expect(content.documents.find((document) => document.title === "setup")?.folderId).toBe(guide?.id);
    expect(content.folders.find((folder) => folder.id === localFolder.id)?.sourceId).toBeUndefined();
    expect(content.documents.find((document) => document.id === localDocument.id)?.body).toBe("keep");
  });

  it("rejects a duplicate repository without creating partial content", async () => {
    await importGitHubSource(githubSession());

    await expect(importGitHubSource(githubSession())).rejects.toThrow(/already imported/i);

    const content = await listContent();
    expect(content.sources).toHaveLength(1);
    expect(content.folders.filter((folder) => folder.sourceId)).toHaveLength(2);
    expect(content.documents.filter((document) => document.sourceId)).toHaveLength(2);
  });

  it("refreshes only the selected source and preserves its root identity and unrelated data", async () => {
    const localDocument = await createDocument({ title: "Local", body: "keep", folderId: null });
    const first = await importGitHubSource(githubSession());
    const secondSession = githubSession({
      repository: {
        owner: "example",
        repository: "notes",
        normalizedUrl: "https://github.com/example/notes"
      }
    });
    const second = await importGitHubSource(secondSession);
    const oldFirstDocumentIds = (await listContent()).documents
      .filter((document) => document.sourceId === first.source.id)
      .map((document) => document.id);
    const rootBefore = await db.folders.get(first.rootFolderId);

    const refreshed = await refreshGitHubSource(
      first.source.id,
      githubSession({
        branch: "release",
        markdownCount: 1,
        totalMarkdownBytes: 9,
        folders: [],
        documents: [
          {
            path: "readme.md",
            title: "readme",
            body: "# Updated",
            folderPath: null,
            order: 0,
            byteSize: 9
          }
        ],
        fetchedAt: "2026-07-14T01:00:00.000Z"
      })
    );

    const content = await listContent();
    const refreshedRoot = content.folders.find((folder) => folder.id === first.rootFolderId);
    const refreshedDocuments = content.documents.filter((document) => document.sourceId === first.source.id);

    expect(refreshed.rootFolderId).toBe(first.rootFolderId);
    expect(refreshedRoot).toMatchObject({ id: rootBefore?.id, order: rootBefore?.order });
    expect(refreshedDocuments).toHaveLength(1);
    expect(refreshedDocuments[0].body).toBe("# Updated");
    expect(oldFirstDocumentIds).not.toContain(refreshedDocuments[0].id);
    expect(content.sources.find((source) => source.id === first.source.id)).toMatchObject({
      branch: "release",
      lastRefreshedAt: "2026-07-14T01:00:00.000Z"
    });
    expect(content.sources.some((source) => source.id === second.source.id)).toBe(true);
    expect(content.documents.some((document) => document.sourceId === second.source.id)).toBe(true);
    expect(content.documents.find((document) => document.id === localDocument.id)?.body).toBe("keep");
  });

  it("rolls back a failed refresh and leaves the previous source intact", async () => {
    const imported = await importGitHubSource(githubSession());
    const before = await listContent();
    const originalAdd = db.documents.add.bind(db.documents);

    vi.spyOn(db.documents, "add").mockImplementation(((document) => {
      if (document.title === "Broken") {
        throw new Error("Insert failed.");
      }

      return originalAdd(document);
    }) as typeof db.documents.add);

    await expect(
      refreshGitHubSource(
        imported.source.id,
        githubSession({
          markdownCount: 1,
          folders: [],
          documents: [
            {
              path: "broken.md",
              title: "Broken",
              body: "broken",
              folderPath: null,
              order: 0,
              byteSize: 6
            }
          ]
        })
      )
    ).rejects.toThrow("Insert failed.");

    expect(await listContent()).toEqual(before);
  });

  it("deletes only records owned by the selected GitHub source", async () => {
    const localDocument = await createDocument({ title: "Local", body: "keep", folderId: null });
    const first = await importGitHubSource(githubSession());
    const second = await importGitHubSource(
      githubSession({
        repository: {
          owner: "example",
          repository: "notes",
          normalizedUrl: "https://github.com/example/notes"
        }
      })
    );

    await deleteGitHubSource(first.source.id);

    const content = await listContent();
    expect(content.sources.some((source) => source.id === first.source.id)).toBe(false);
    expect(content.folders.some((folder) => folder.sourceId === first.source.id)).toBe(false);
    expect(content.documents.some((document) => document.sourceId === first.source.id)).toBe(false);
    expect(content.sources.some((source) => source.id === second.source.id)).toBe(true);
    expect(content.documents.some((document) => document.sourceId === second.source.id)).toBe(true);
    expect(content.documents.find((document) => document.id === localDocument.id)?.body).toBe("keep");
  });
  it("removes source metadata when its root book is deleted", async () => {
    const localDocument = await createDocument({ title: "Local", body: "keep", folderId: null });
    const imported = await importGitHubSource(githubSession());

    await deleteFolder(imported.rootFolderId);

    const content = await listContent();
    expect(content.sources.some((source) => source.id === imported.source.id)).toBe(false);
    expect(content.folders.some((folder) => folder.sourceId === imported.source.id)).toBe(false);
    expect(content.documents.some((document) => document.sourceId === imported.source.id)).toBe(false);
    expect(content.documents.find((document) => document.id === localDocument.id)?.body).toBe("keep");
  });
});
