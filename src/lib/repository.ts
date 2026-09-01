import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { normalizeBookName, validateBookName } from "@/lib/book-names";
import type { Document, Folder } from "@/types/content";
import type { GitHubImportResult, GitHubImportSession, GitHubSource } from "@/types/github";
import type { PreparedWorkspaceRestore } from "@/types/backup";

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
  return db.transaction("rw", db.folders, async () => {
    const timestamp = now();
    const folders = await db.folders.toArray();
    const validationMessage = validateBookName(name, folders, parentId);
    if (validationMessage) throw new Error(validationMessage);
    const order = await countFoldersByParent(parentId);
    const folder: Folder = {
      id: createId("folder"),
      name: normalizeBookName(name),
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
  return db.transaction("rw", db.folders, async () => {
    const folder = await db.folders.get(id);
    if (!folder) throw new Error("Folder not found.");
    const folders = await db.folders.toArray();
    const validationMessage = validateBookName(name, folders, folder.parentId, folder.id);
    if (validationMessage) throw new Error(validationMessage);
    const timestamp = now();
    const normalizedName = normalizeBookName(name);
    await db.folders.update(id, { name: normalizedName, updatedAt: timestamp });
    return { ...folder, name: normalizedName, updatedAt: timestamp };
  });
}

export async function restoreWorkspaceBackup(prepared: PreparedWorkspaceRestore) {
  return db.transaction("rw", db.folders, db.documents, db.githubSources, async () => {
    await db.folders.bulkAdd(prepared.folders);
    await db.documents.bulkAdd(prepared.documents);
    if (prepared.githubSources.length > 0) await db.githubSources.bulkAdd(prepared.githubSources);
    return {
      folderCount: prepared.folders.length,
      documentCount: prepared.documents.length,
      firstDocumentId: prepared.firstDocumentId
    };
  });
}

export async function deleteFolder(id: string) {
  const source = await db.githubSources.where("rootFolderId").equals(id).first();

  if (source) {
    await deleteGitHubSource(source.id);
    return;
  }

  await db.folders.delete(id);
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
    const records = buildSourceRecords(
      session,
      sourceId,
      { id: rootFolderId, order: rootOrder, createdAt: timestamp },
      timestamp
    );

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
    const records = buildSourceRecords(
      session,
      sourceId,
      { id: rootFolder.id, order: rootFolder.order, createdAt: rootFolder.createdAt },
      timestamp
    );
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
