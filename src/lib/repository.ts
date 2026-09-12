import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession, GitHubSource } from "@/types/github";
import { buildFlatBookMigration } from "@/lib/library-tree";

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
  const [folders, documents, sources] = await Promise.all([
    db.folders.orderBy("order").toArray(),
    db.documents.orderBy("order").toArray(),
    db.githubSources.toArray()
  ]);

  return { folders, documents, sources };
}

export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  void parentId;
  return db.transaction("rw", db.folders, async () => {
    const timestamp = now();
    const order = await countFoldersByParent(null);
    const folder: Folder = {
      id: createId("folder"),
      name: name.trim() || "Untitled Book",
      parentId: null,
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
    name: name.trim() || "Untitled Book",
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
  await db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    const folder = await db.folders.get(id);
    if (!folder) throw new Error("Folder not found.");
    const source = await db.githubSources.where("rootFolderId").equals(id).first();
    if (source) {
      const replacement = (await db.folders.where("sourceId").equals(source.id).toArray())
        .filter((item) => item.id !== id)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))[0];
      if (replacement) await db.githubSources.update(source.id, { rootFolderId: replacement.id, updatedAt: now() });
      else {
        await db.documents.where("sourceId").equals(source.id).modify((document) => { delete document.sourceId; document.updatedAt = now(); });
        await db.githubSources.delete(source.id);
      }
    }
    await db.documents.where("folderId").equals(id).modify({ folderId: null, updatedAt: now() });
    await db.folders.delete(id);
  });
}

export async function createDocument(input: { title: string; body: string; folderId: string | null }): Promise<Document> {
  return db.transaction("rw", db.documents, async () => {
    const timestamp = now();
    const order = await countDocumentsByFolder(input.folderId);
    const document: Document = {
      id: createId("doc"),
      title: input.title.trim() || "untitled.md",
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
        title: input.title.trim() || "untitled.md",
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
    title: title.trim() || "untitled.md",
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

type SourceRecords = {
  folders: Folder[];
  documents: Document[];
};

function buildSourceRecords(
  session: GitHubImportSession,
  sourceId: string,
  root: Pick<Folder, "id" | "order" | "createdAt">,
  timestamp: string
): SourceRecords {
  const rootFolder: Folder = {
    id: root.id,
    name: session.repository.repository,
    parentId: null,
    sourceId,
    order: root.order,
    createdAt: root.createdAt,
    updatedAt: timestamp
  };
  const folders: Folder[] = [rootFolder];
  const folderIdsByPath = new Map<string, string>([["", root.id]]);
  const drafts = [...session.folders].sort(
    (left, right) =>
      left.path.split("/").length - right.path.split("/").length ||
      left.order - right.order ||
      left.path.localeCompare(right.path)
  );

  for (const draft of drafts) {
    if (folderIdsByPath.has(draft.path)) {
      throw new Error("The GitHub preview contains a duplicate folder.");
    }

    const parentKey = draft.parentPath ?? "";
    const parentId = folderIdsByPath.get(parentKey);

    if (!parentId) {
      throw new Error("The GitHub preview contains an invalid folder hierarchy.");
    }

    const id = createId("folder");
    folderIdsByPath.set(draft.path, id);
    folders.push({
      id,
      name: draft.name,
      parentId,
      sourceId,
      order: draft.order,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  const documents = session.documents.map((draft): Document => {
    const folderId = folderIdsByPath.get(draft.folderPath ?? "");

    if (!folderId) {
      throw new Error("The GitHub preview contains an invalid document hierarchy.");
    }

    return {
      id: createId("doc"),
      title: draft.title.trim() || "untitled.md",
      body: draft.body,
      folderId,
      sourceId,
      order: draft.order,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });

  return { folders, documents };
}

function importResult(source: GitHubSource, records: SourceRecords): GitHubImportResult {
  return {
    source,
    rootFolderId: source.rootFolderId,
    firstDocumentId: records.documents[0]?.id ?? null,
    folderCount: records.folders.length,
    documentCount: records.documents.length
  };
}

async function addSourceRecords(records: SourceRecords) {
  for (const folder of records.folders) {
    await db.folders.add(folder);
  }

  for (const document of records.documents) {
    await db.documents.add(document);
  }
}

function flattenSourceRecords(records: SourceRecords, existingFolders: Folder[]): SourceRecords {
  const names = new Map(buildFlatBookMigration([...existingFolders, ...records.folders]).map((item) => [item.id, item.name]));
  return {
    ...records,
    folders: records.folders.map((folder) => ({ ...folder, name: names.get(folder.id) ?? folder.name, parentId: null }))
  };
}

export async function importGitHubSource(session: GitHubImportSession): Promise<GitHubImportResult> {
  return db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    const normalizedUrl = session.repository.normalizedUrl;
    const duplicate = await db.githubSources
      .filter((source) => source.normalizedUrl.toLocaleLowerCase("en-US") === normalizedUrl.toLocaleLowerCase("en-US"))
      .first();

    if (duplicate) {
      throw new Error("This GitHub repository is already imported.");
    }

    const timestamp = now();
    const sourceId = createId("github");
    const rootFolderId = createId("folder");
    const rootOrder = await countFoldersByParent(null);
    const source: GitHubSource = {
      id: sourceId,
      owner: session.repository.owner,
      repository: session.repository.repository,
      normalizedUrl,
      branch: session.branch,
      rootFolderId,
      lastRefreshedAt: session.fetchedAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const records = flattenSourceRecords(buildSourceRecords(
      session,
      sourceId,
      { id: rootFolderId, order: rootOrder, createdAt: timestamp },
      timestamp
    ), await db.folders.toArray());

    await db.githubSources.add(source);
    await addSourceRecords(records);

    return importResult(source, records);
  });
}

export async function refreshGitHubSource(
  sourceId: string,
  session: GitHubImportSession
): Promise<GitHubImportResult> {
  return db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    const source = await db.githubSources.get(sourceId);

    if (!source) {
      throw new Error("GitHub source not found.");
    }

    if (
      source.normalizedUrl.toLocaleLowerCase("en-US") !==
      session.repository.normalizedUrl.toLocaleLowerCase("en-US")
    ) {
      throw new Error("The refresh preview belongs to a different GitHub repository.");
    }

    const rootFolder = await db.folders.get(source.rootFolderId);

    if (!rootFolder || rootFolder.sourceId !== sourceId) {
      throw new Error("GitHub source root not found.");
    }

    const timestamp = now();
    const updatedSource: GitHubSource = {
      ...source,
      owner: session.repository.owner,
      repository: session.repository.repository,
      branch: session.branch,
      lastRefreshedAt: session.fetchedAt,
      updatedAt: timestamp
    };
    const existingFolders = await db.folders.where("sourceId").notEqual(sourceId).toArray();
    const records = flattenSourceRecords(buildSourceRecords(
      session,
      sourceId,
      { id: rootFolder.id, order: rootFolder.order, createdAt: rootFolder.createdAt },
      timestamp
    ), existingFolders);
    const [folderIds, documentIds] = (await Promise.all([
      db.folders.where("sourceId").equals(sourceId).primaryKeys(),
      db.documents.where("sourceId").equals(sourceId).primaryKeys()
    ])) as [string[], string[]];

    await db.documents.bulkDelete(documentIds);
    await db.folders.bulkDelete(folderIds);
    await addSourceRecords(records);
    await db.githubSources.put(updatedSource);

    return importResult(updatedSource, records);
  });
}

export async function deleteGitHubSource(sourceId: string): Promise<void> {
  await db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    const source = await db.githubSources.get(sourceId);

    if (!source) {
      throw new Error("GitHub source not found.");
    }

    const [folderIds, documentIds] = (await Promise.all([
      db.folders.where("sourceId").equals(sourceId).primaryKeys(),
      db.documents.where("sourceId").equals(sourceId).primaryKeys()
    ])) as [string[], string[]];

    await db.documents.bulkDelete(documentIds);
    await db.folders.bulkDelete(folderIds);
    await db.githubSources.delete(sourceId);
  });
}
