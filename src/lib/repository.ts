import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import type { Document, Folder } from "@/types/content";

function now() {
  return new Date().toISOString();
}

function countFoldersByParent(parentId: string | null) {
  if (parentId === null) {
    return db.folders.filter((folder) => folder.parentId === null).count();
  }

  return db.folders.where("parentId").equals(parentId).count();
}

function countDocumentsByFolder(folderId: string | null) {
  if (folderId === null) {
    return db.documents.filter((document) => document.folderId === null).count();
  }

  return db.documents.where("folderId").equals(folderId).count();
}

export async function listContent() {
  const [folders, documents] = await Promise.all([db.folders.orderBy("order").toArray(), db.documents.orderBy("order").toArray()]);

  return { folders, documents };
}

export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  return db.transaction("rw", db.folders, async () => {
    const timestamp = now();
    const order = await countFoldersByParent(parentId);
    const folder: Folder = {
      id: createId("folder"),
      name: name.trim() || "Untitled Folder",
      parentId,
      order,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await db.folders.add(folder);
    return folder;
  });
}

export async function renameFolder(id: string, name: string) {
  const updatedCount = await db.folders.update(id, {
    name: name.trim() || "Untitled Folder",
    updatedAt: now()
  });

  if (updatedCount === 0) {
    throw new Error("Folder not found.");
  }

  const folder = await db.folders.get(id);

  if (!folder) {
    throw new Error("Folder not found.");
  }

  return folder;
}

export async function deleteFolder(id: string) {
  await db.folders.delete(id);
}

export async function createDocument(input: { title: string; body: string; folderId: string | null }): Promise<Document> {
  return db.transaction("rw", db.documents, async () => {
    const timestamp = now();
    const order = await countDocumentsByFolder(input.folderId);
    const document: Document = {
      id: createId("doc"),
      title: input.title.trim() || "Untitled Document",
      body: input.body,
      folderId: input.folderId,
      order,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await db.documents.add(document);
    return document;
  });
}

export async function createDocuments(inputs: { title: string; body: string }[], folderId: string | null): Promise<Document[]> {
  return db.transaction("rw", db.documents, async () => {
    const timestamp = now();
    const startingOrder = await countDocumentsByFolder(folderId);
    const documents = inputs.map((input, index): Document => {
      return {
        id: createId("doc"),
        title: input.title.trim() || "Untitled Document",
        body: input.body,
        folderId,
        order: startingOrder + index,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });

    for (const document of documents) {
      await db.documents.add(document);
    }

    return documents;
  });
}

export async function renameDocument(id: string, title: string) {
  const updatedCount = await db.documents.update(id, {
    title: title.trim() || "Untitled Document",
    updatedAt: now()
  });

  if (updatedCount === 0) {
    throw new Error("Document not found.");
  }

  const document = await db.documents.get(id);

  if (!document) {
    throw new Error("Document not found.");
  }

  return document;
}

export async function moveDocument(id: string, folderId: string | null) {
  return db.transaction("rw", db.documents, async () => {
    const document = await db.documents.get(id);

    if (!document) {
      throw new Error("Document not found.");
    }

    const order = document.folderId === folderId ? document.order : await countDocumentsByFolder(folderId);
    const updatedCount = await db.documents.update(id, { folderId, order, updatedAt: now() });

    if (updatedCount === 0) {
      throw new Error("Document not found.");
    }

    const updated = await db.documents.get(id);

    if (!updated) {
      throw new Error("Document not found.");
    }

    return updated;
  });
}

export async function updateDocumentBody(id: string, body: string) {
  const updatedCount = await db.documents.update(id, { body, updatedAt: now() });

  if (updatedCount === 0) {
    throw new Error("Document not found.");
  }

  const document = await db.documents.get(id);

  if (!document) {
    throw new Error("Document not found.");
  }

  return document;
}

export async function deleteDocument(id: string) {
  await db.documents.delete(id);
}
