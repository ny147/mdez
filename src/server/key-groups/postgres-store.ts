import "server-only";
import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";

import { GROUP_LIMITS, type GroupChangesResult, type GroupDocument, type GroupFolder, type GroupSnapshot, type GroupSummary, type LocalGroupImport } from "@/types/key-group";
import { KeyGroupError, type KeyGroupStore } from "./store";

type GroupRow = { id: string; name: string; revision: number | string; deleted_at: Date | null; purge_after: Date | null; created_at: Date; updated_at: Date };
type FolderRow = { id: string; parent_id: string | null; name: string; sort_order: number; version: number; group_revision: number | string; created_at: Date; updated_at: Date };
type DocumentRow = { id: string; folder_id: string | null; title: string; markdown: string; sort_order: number; version: number; group_revision: number | string; created_at: Date; updated_at: Date };

function iso(value: Date): string { return value.toISOString(); }
function mapGroup(row: GroupRow): GroupSummary {
  return { id: row.id, name: row.name, revision: Number(row.revision), deletedAt: row.deleted_at ? iso(row.deleted_at) : null, purgeAfter: row.purge_after ? iso(row.purge_after) : null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function mapFolder(row: FolderRow): GroupFolder {
  return { id: row.id, parentId: row.parent_id, name: row.name, order: row.sort_order, version: row.version, groupRevision: Number(row.group_revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function mapDocument(row: DocumentRow): GroupDocument {
  return { id: row.id, folderId: row.folder_id, title: row.title, body: row.markdown, order: row.sort_order, version: row.version, groupRevision: Number(row.group_revision), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

async function readSnapshot(tx: TransactionSql, groupId: string): Promise<GroupSnapshot | null> {
  const groups = await tx<GroupRow[]>`select id, name, revision, deleted_at, purge_after, created_at, updated_at from public.key_groups where id = ${groupId}`;
  if (!groups[0]) return null;
  const folders = await tx<FolderRow[]>`select id, parent_id, name, sort_order, version, group_revision, created_at, updated_at from public.group_folders where group_id = ${groupId} order by sort_order, id`;
  const documents = await tx<DocumentRow[]>`select id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at from public.group_documents where group_id = ${groupId} order by sort_order, id`;
  return { group: mapGroup(groups[0]), folders: folders.map(mapFolder), documents: documents.map(mapDocument) };
}

function pending(): never { throw new Error("Key Group mutation is not implemented yet"); }

export class PostgresKeyGroupStore implements KeyGroupStore {
  constructor(private readonly sql: Sql) {}

  async createGroup(input: LocalGroupImport, keyDigest: Buffer): Promise<GroupSnapshot> {
    const pageBytes = input.documents.map((document) => new TextEncoder().encode(document.body).byteLength);
    if (input.documents.length > GROUP_LIMITS.pages || pageBytes.some((size) => size > GROUP_LIMITS.pageBytes) || pageBytes.reduce((sum, size) => sum + size, 0) > GROUP_LIMITS.totalBytes) {
      throw new KeyGroupError("LIMIT_EXCEEDED", "Group content exceeds its storage limits");
    }
    return this.sql.begin(async (tx) => {
      const groupId = randomUUID();
      await tx`insert into public.key_groups (id, name, key_digest) values (${groupId}, ${input.name}, ${keyDigest})`;
      const folderIds = new Map<string, string>();
      const pendingFolders = [...input.folders];
      while (pendingFolders.length) {
        const index = pendingFolders.findIndex((folder) => folder.parentClientId === null || folderIds.has(folder.parentClientId));
        if (index < 0) throw new Error("Folder hierarchy cannot be imported");
        const [folder] = pendingFolders.splice(index, 1);
        const id = randomUUID();
        folderIds.set(folder.clientId, id);
        await tx`insert into public.group_folders (id, group_id, parent_id, name, sort_order, version, group_revision, created_at, updated_at) values (${id}, ${groupId}, ${folder.parentClientId ? folderIds.get(folder.parentClientId)! : null}, ${folder.name}, ${folder.order}, 1, 0, ${new Date(folder.createdAt)}, ${new Date(folder.updatedAt)})`;
      }
      for (const document of input.documents) {
        await tx`insert into public.group_documents (id, group_id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at) values (${randomUUID()}, ${groupId}, ${document.folderClientId ? folderIds.get(document.folderClientId)! : null}, ${document.title}, ${document.body}, ${document.order}, 1, 0, ${new Date(document.createdAt)}, ${new Date(document.updatedAt)})`;
      }
      const snapshot = await readSnapshot(tx, groupId);
      if (!snapshot) throw new Error("Created group could not be read");
      return snapshot;
    });
  }

  async findGroupIdByDigest(keyDigest: Buffer): Promise<string | null> {
    const rows = await this.sql<{ id: string }[]>`select id from public.key_groups where key_digest = ${keyDigest} limit 1`;
    return rows[0]?.id ?? null;
  }

  getSnapshot(groupId: string): Promise<GroupSnapshot | null> { return this.sql.begin((tx) => readSnapshot(tx, groupId)); }
  getChanges(_groupId: string, _afterRevision: number): Promise<GroupChangesResult> { return pending(); }
  createFolder(_groupId: string, _input: { name: string; parentId: string | null }): Promise<GroupFolder> { return pending(); }
  updateFolder(_groupId: string, _id: string, _input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder> { return pending(); }
  deleteFolder(_groupId: string, _id: string, _expectedVersion: number): Promise<number> { return pending(); }
  createDocument(_groupId: string, _input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument> { return pending(); }
  updateDocument(_groupId: string, _id: string, _input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument> { return pending(); }
  deleteDocument(_groupId: string, _id: string, _expectedVersion: number): Promise<number> { return pending(); }
  renameGroup(_groupId: string, _name: string): Promise<GroupSummary> { return pending(); }
  softDeleteGroup(_groupId: string, _now: Date): Promise<GroupSummary> { return pending(); }
  restoreGroup(_groupId: string, _now: Date): Promise<GroupSummary> { return pending(); }
  purgeDeletedGroups(_now: Date): Promise<number> { return pending(); }
}
