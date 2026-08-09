import "server-only";
import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";

import { GROUP_LIMITS, type GroupChangesResult, type GroupDocument, type GroupFolder, type GroupSnapshot, type GroupSummary, type LocalGroupImport } from "@/types/key-group";
import { KeyGroupError, type KeyGroupStore } from "./store";

type GroupRow = { id: string; name: string; revision: number | string; deleted_at: Date | null; purge_after: Date | null; created_at: Date; updated_at: Date };
type FolderRow = { id: string; parent_id: string | null; name: string; sort_order: number; version: number; group_revision: number | string; created_at: Date; updated_at: Date };
type DocumentRow = { id: string; folder_id: string | null; title: string; markdown: string; sort_order: number; version: number; group_revision: number | string; created_at: Date; updated_at: Date };
type ChangeRow = { revision: number | string; entity_type: "group" | "folder" | "document"; entity_id: string; operation: "create" | "update" | "delete"; changed_at: Date };

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

  async getChanges(groupId: string, afterRevision: number): Promise<GroupChangesResult> {
    return this.sql.begin(async (tx) => {
      const groups = await tx<GroupRow[]>`select id, name, revision, deleted_at, purge_after, created_at, updated_at from public.key_groups where id = ${groupId}`;
      if (!groups[0]) throw new KeyGroupError("NOT_FOUND", "Group not found");
      const revision = Number(groups[0].revision);
      const earliest = await tx<{ earliest_revision: number | string | null }[]>`select min(revision) as earliest_revision from public.group_change_log where group_id = ${groupId}`;
      const earliestRevision = earliest[0]?.earliest_revision === null ? null : Number(earliest[0]?.earliest_revision);
      if (earliestRevision !== null && afterRevision < earliestRevision - 1 && revision > afterRevision) {
        return { status: "reset_required", revision };
      }
      const changes = await tx<ChangeRow[]>`select revision, entity_type, entity_id, operation, changed_at from public.group_change_log where group_id = ${groupId} and revision > ${afterRevision} order by revision`;
      const folders = await tx<FolderRow[]>`select id, parent_id, name, sort_order, version, group_revision, created_at, updated_at from public.group_folders where group_id = ${groupId} and group_revision > ${afterRevision} order by sort_order, id`;
      const documents = await tx<DocumentRow[]>`select id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at from public.group_documents where group_id = ${groupId} and group_revision > ${afterRevision} order by sort_order, id`;
      return {
        status: "changes",
        revision,
        changes: changes.map((change) => ({ revision: Number(change.revision), entityType: change.entity_type, entityId: change.entity_id, operation: change.operation, changedAt: iso(change.changed_at) })),
        records: { group: changes.some((change) => change.entity_type === "group") ? mapGroup(groups[0]) : null, folders: folders.map(mapFolder), documents: documents.map(mapDocument) },
      };
    });
  }

  private async nextRevision(tx: TransactionSql, groupId: string): Promise<number> {
    const rows = await tx<{ revision: number | string; deleted_at: Date | null }[]>`select revision, deleted_at from public.key_groups where id = ${groupId} for update`;
    if (!rows[0]) throw new KeyGroupError("NOT_FOUND", "Group not found");
    if (rows[0].deleted_at) throw new KeyGroupError("DELETED", "Group is deleted");
    return Number(rows[0].revision) + 1;
  }

  private async finishMutation(tx: TransactionSql, groupId: string, revision: number, entityType: "group" | "folder" | "document", entityId: string, operation: "create" | "update" | "delete"): Promise<void> {
    await tx`update public.key_groups set revision = ${revision}, updated_at = now() where id = ${groupId}`;
    await tx`insert into public.group_change_log (group_id, revision, entity_type, entity_id, operation) values (${groupId}, ${revision}, ${entityType}, ${entityId}, ${operation})`;
  }

  async createFolder(groupId: string, input: { name: string; parentId: string | null }): Promise<GroupFolder> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const id = randomUUID();
      const orderRows = await tx<{ next_order: number }[]>`select coalesce(max(sort_order), -1) + 1 as next_order from public.group_folders where group_id = ${groupId} and parent_id is not distinct from ${input.parentId}`;
      const rows = await tx<FolderRow[]>`insert into public.group_folders (id, group_id, parent_id, name, sort_order, version, group_revision) values (${id}, ${groupId}, ${input.parentId}, ${input.name.trim()}, ${Number(orderRows[0]?.next_order ?? 0)}, 1, ${revision}) returning id, parent_id, name, sort_order, version, group_revision, created_at, updated_at`;
      await this.finishMutation(tx, groupId, revision, "folder", id, "create");
      return mapFolder(rows[0]);
    });
  }

  async updateFolder(groupId: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const currentRows = await tx<FolderRow[]>`select id, parent_id, name, sort_order, version, group_revision, created_at, updated_at from public.group_folders where group_id = ${groupId} and id = ${id} for update`;
      const current = currentRows[0];
      if (!current) throw new KeyGroupError("NOT_FOUND", "Folder not found");
      if (current.version !== input.expectedVersion) throw new KeyGroupError("CONFLICT", "Folder version conflict", { entityType: "folder", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version });
      if (input.parentId !== undefined) {
        const cycle = await tx<{ found: number }[]>`with recursive descendants as (select id from public.group_folders where group_id = ${groupId} and id = ${id} union all select child.id from public.group_folders child join descendants parent on child.parent_id = parent.id where child.group_id = ${groupId}) select 1 as found from descendants where id = ${input.parentId} limit 1`;
        if (cycle[0]) throw new Error("Folder hierarchy must not contain a cycle");
      }
      const rows = await tx<FolderRow[]>`update public.group_folders set name = ${input.name?.trim() ?? current.name}, parent_id = ${input.parentId === undefined ? current.parent_id : input.parentId}, sort_order = ${input.order ?? current.sort_order}, version = version + 1, group_revision = ${revision}, updated_at = now() where group_id = ${groupId} and id = ${id} and version = ${input.expectedVersion} returning id, parent_id, name, sort_order, version, group_revision, created_at, updated_at`;
      if (!rows[0]) throw new KeyGroupError("CONFLICT", "Folder version conflict", { entityType: "folder", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version });
      await this.finishMutation(tx, groupId, revision, "folder", id, "update");
      return mapFolder(rows[0]);
    });
  }

  async deleteFolder(groupId: string, id: string, expectedVersion: number): Promise<number> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const occupied = await tx<{ occupied: boolean }[]>`select exists(select 1 from public.group_folders where group_id = ${groupId} and parent_id = ${id}) or exists(select 1 from public.group_documents where group_id = ${groupId} and folder_id = ${id}) as occupied`;
      if (occupied[0]?.occupied) throw new Error("Move or delete its pages and subfolders first.");
      const current = await tx<{ version: number }[]>`select version from public.group_folders where group_id = ${groupId} and id = ${id}`;
      if (!current[0]) throw new KeyGroupError("NOT_FOUND", "Folder not found");
      const rows = await tx<FolderRow[]>`delete from public.group_folders where group_id = ${groupId} and id = ${id} and version = ${expectedVersion} returning id`;
      if (!rows[0]) throw new KeyGroupError("CONFLICT", "Folder version conflict", { entityType: "folder", entityId: id, expectedVersion, currentVersion: current[0].version });
      await this.finishMutation(tx, groupId, revision, "folder", id, "delete");
      return revision;
    });
  }

  async createDocument(groupId: string, input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const bytes = new TextEncoder().encode(input.body).byteLength;
      if (bytes > GROUP_LIMITS.pageBytes) throw new KeyGroupError("LIMIT_EXCEEDED", "Each group page must be 5 MiB or less");
      const totals = await tx<{ page_count: number | string; total_bytes: number | string }[]>`select count(*) as page_count, coalesce(sum(octet_length(markdown)), 0) as total_bytes from public.group_documents where group_id = ${groupId}`;
      if (Number(totals[0]?.page_count ?? 0) >= GROUP_LIMITS.pages || Number(totals[0]?.total_bytes ?? 0) + bytes > GROUP_LIMITS.totalBytes) throw new KeyGroupError("LIMIT_EXCEEDED", "Group content exceeds its storage limits");
      const orderRows = await tx<{ next_order: number }[]>`select coalesce(max(sort_order), -1) + 1 as next_order from public.group_documents where group_id = ${groupId} and folder_id is not distinct from ${input.folderId}`;
      const id = randomUUID();
      const rows = await tx<DocumentRow[]>`insert into public.group_documents (id, group_id, folder_id, title, markdown, sort_order, version, group_revision) values (${id}, ${groupId}, ${input.folderId}, ${input.title.trim()}, ${input.body}, ${Number(orderRows[0]?.next_order ?? 0)}, 1, ${revision}) returning id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at`;
      await this.finishMutation(tx, groupId, revision, "document", id, "create");
      return mapDocument(rows[0]);
    });
  }

  async updateDocument(groupId: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const currentRows = await tx<DocumentRow[]>`select id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at from public.group_documents where group_id = ${groupId} and id = ${id} for update`;
      const current = currentRows[0];
      if (!current) throw new KeyGroupError("NOT_FOUND", "Document not found");
      if (current.version !== input.expectedVersion) throw new KeyGroupError("CONFLICT", "Document version conflict", { entityType: "document", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version });
      const body = input.body ?? current.markdown;
      const bytes = new TextEncoder().encode(body).byteLength;
      const totals = await tx<{ total_bytes: number | string }[]>`select coalesce(sum(octet_length(markdown)), 0) as total_bytes from public.group_documents where group_id = ${groupId} and id <> ${id}`;
      if (bytes > GROUP_LIMITS.pageBytes || Number(totals[0]?.total_bytes ?? 0) + bytes > GROUP_LIMITS.totalBytes) throw new KeyGroupError("LIMIT_EXCEEDED", "Group content exceeds its storage limits");
      const rows = await tx<DocumentRow[]>`update public.group_documents set title = ${input.title?.trim() ?? current.title}, markdown = ${body}, folder_id = ${input.folderId === undefined ? current.folder_id : input.folderId}, sort_order = ${input.order ?? current.sort_order}, version = version + 1, group_revision = ${revision}, updated_at = now() where group_id = ${groupId} and id = ${id} and version = ${input.expectedVersion} returning id, folder_id, title, markdown, sort_order, version, group_revision, created_at, updated_at`;
      if (!rows[0]) throw new KeyGroupError("CONFLICT", "Document version conflict", { entityType: "document", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version });
      await this.finishMutation(tx, groupId, revision, "document", id, "update");
      return mapDocument(rows[0]);
    });
  }

  async deleteDocument(groupId: string, id: string, expectedVersion: number): Promise<number> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const current = await tx<{ version: number }[]>`select version from public.group_documents where group_id = ${groupId} and id = ${id}`;
      if (!current[0]) throw new KeyGroupError("NOT_FOUND", "Document not found");
      const rows = await tx<DocumentRow[]>`delete from public.group_documents where group_id = ${groupId} and id = ${id} and version = ${expectedVersion} returning id`;
      if (!rows[0]) throw new KeyGroupError("CONFLICT", "Document version conflict", { entityType: "document", entityId: id, expectedVersion, currentVersion: current[0].version });
      await this.finishMutation(tx, groupId, revision, "document", id, "delete");
      return revision;
    });
  }

  async renameGroup(groupId: string, name: string): Promise<GroupSummary> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const rows = await tx<GroupRow[]>`update public.key_groups set name = ${name.trim()}, revision = ${revision}, updated_at = now() where id = ${groupId} returning id, name, revision, deleted_at, purge_after, created_at, updated_at`;
      await tx`insert into public.group_change_log (group_id, revision, entity_type, entity_id, operation) values (${groupId}, ${revision}, 'group', ${groupId}, 'update')`;
      return mapGroup(rows[0]);
    });
  }

  async softDeleteGroup(groupId: string, now: Date): Promise<GroupSummary> {
    return this.sql.begin(async (tx) => {
      const revision = await this.nextRevision(tx, groupId);
      const purgeAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const rows = await tx<GroupRow[]>`update public.key_groups set deleted_at = ${now}, purge_after = ${purgeAfter}, revision = ${revision}, updated_at = ${now} where id = ${groupId} returning id, name, revision, deleted_at, purge_after, created_at, updated_at`;
      await tx`insert into public.group_change_log (group_id, revision, entity_type, entity_id, operation) values (${groupId}, ${revision}, 'group', ${groupId}, 'delete')`;
      return mapGroup(rows[0]);
    });
  }

  async restoreGroup(groupId: string, now: Date): Promise<GroupSummary> {
    return this.sql.begin(async (tx) => {
      const groups = await tx<GroupRow[]>`select id, name, revision, deleted_at, purge_after, created_at, updated_at from public.key_groups where id = ${groupId} for update`;
      const group = groups[0];
      if (!group) throw new KeyGroupError("NOT_FOUND", "Group not found");
      if (!group.deleted_at || !group.purge_after || group.purge_after <= now) throw new KeyGroupError("DELETED", "Group can no longer be restored");
      const revision = Number(group.revision) + 1;
      const rows = await tx<GroupRow[]>`update public.key_groups set deleted_at = null, purge_after = null, revision = ${revision}, updated_at = ${now} where id = ${groupId} returning id, name, revision, deleted_at, purge_after, created_at, updated_at`;
      await tx`insert into public.group_change_log (group_id, revision, entity_type, entity_id, operation) values (${groupId}, ${revision}, 'group', ${groupId}, 'update')`;
      return mapGroup(rows[0]);
    });
  }

  async purgeDeletedGroups(now: Date): Promise<number> {
    return (await this.purgeMaintenance(now)).groups;
  }

  async purgeMaintenance(now: Date): Promise<{ groups: number; changes: number }> {
    return this.sql.begin(async (tx) => {
      const deleted = await tx`delete from public.key_groups where purge_after is not null and purge_after <= ${now}`;
      const changes = await tx`delete from public.group_change_log log where changed_at < ${new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)} and id <> (select max(latest.id) from public.group_change_log latest where latest.group_id = log.group_id)`;
      return { groups: deleted.count, changes: changes.count };
    });
  }
}
