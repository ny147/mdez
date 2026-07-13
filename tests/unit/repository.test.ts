import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createDocument,
  createDocuments,
  createFolder,
  deleteDocument,
  deleteFolder,
  listContent,
  moveDocument,
  renameDocument,
  renameFolder,
  updateDocumentBody
} from "@/lib/repository";

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

  it("uses fallback names and titles", async () => {
    const folder = await createFolder("   ", null);
    const document = await createDocument({ title: "   ", body: "", folderId: null });
    const renamedFolder = await renameFolder(folder.id, " ");
    const renamedDocument = await renameDocument(document.id, " ");

    expect(folder.name).toBe("Untitled Book");
    expect(document.title).toBe("untitled.md");
    expect(renamedFolder.name).toBe("Untitled Book");
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
});
