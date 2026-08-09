import type {
  GroupChangesResult,
  GroupConflict,
  GroupDocument,
  GroupFolder,
  GroupSnapshot,
  GroupSummary,
  LocalGroupImport,
} from "@/types/key-group";

export interface KeyGroupStore {
  createGroup(input: LocalGroupImport, keyDigest: Buffer): Promise<GroupSnapshot>;
  findGroupIdByDigest(keyDigest: Buffer): Promise<string | null>;
  getSnapshot(groupId: string): Promise<GroupSnapshot | null>;
  getChanges(groupId: string, afterRevision: number): Promise<GroupChangesResult>;
  createFolder(groupId: string, input: { name: string; parentId: string | null }): Promise<GroupFolder>;
  updateFolder(groupId: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder>;
  deleteFolder(groupId: string, id: string, expectedVersion: number): Promise<number>;
  createDocument(groupId: string, input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument>;
  updateDocument(groupId: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument>;
  deleteDocument(groupId: string, id: string, expectedVersion: number): Promise<number>;
  renameGroup(groupId: string, name: string): Promise<GroupSummary>;
  softDeleteGroup(groupId: string, now: Date): Promise<GroupSummary>;
  restoreGroup(groupId: string, now: Date): Promise<GroupSummary>;
  purgeDeletedGroups(now: Date): Promise<number>;
}

export type KeyGroupErrorCode = "INVALID_KEY" | "DELETED" | "NOT_FOUND" | "CONFLICT" | "LIMIT_EXCEEDED";

export class KeyGroupError extends Error {
  constructor(
    public readonly code: KeyGroupErrorCode,
    message: string,
    public readonly conflict?: GroupConflict,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "KeyGroupError";
  }
}
