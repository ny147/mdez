import "server-only";

import { getDatabase } from "@/server/database";
import { consumeRateLimit, purgeExpiredRateLimitBuckets } from "@/server/rate-limit";
import type { GroupChangesResult, GroupDocument, GroupFolder, GroupSnapshot, GroupSummary, LocalGroupImport } from "@/types/key-group";
import { authorizeGroupKey } from "./authorize";
import { PostgresKeyGroupStore } from "./postgres-store";
import { createGroupService, getGroupSnapshotService, joinGroupService } from "./service";
import { KeyGroupError } from "./store";

function store() { return new PostgresKeyGroupStore(getDatabase()); }

async function authorized(groupId: string, key: string, address: string) {
  const groupStore = store();
  await authorizeGroupKey(key, { store: groupStore, address }, groupId);
  return groupStore;
}

async function mutationStore(groupId: string, key: string, address: string) {
  const groupStore = await authorized(groupId, key, address);
  const decision = await consumeRateLimit({ scope: "key-group-mutation", identifier: groupId, limit: 120, windowSeconds: 60 });
  if (!decision.allowed) throw new KeyGroupError("LIMIT_EXCEEDED", "Too many requests", undefined, decision.retryAfterSeconds);
  return groupStore;
}

export function createGroup(input: LocalGroupImport, key: string, address: string): Promise<GroupSnapshot> {
  return createGroupService({ key, import: input }, { store: store(), address });
}
export function joinGroup(key: string, address: string): Promise<GroupSnapshot> { return joinGroupService(key, { store: store(), address }); }
export function getGroupSnapshot(groupId: string, key: string, address: string): Promise<GroupSnapshot> { return getGroupSnapshotService(key, { store: store(), groupId, address }); }

export async function getGroupChanges(groupId: string, key: string, after: number, address: string): Promise<GroupChangesResult> {
  return (await authorized(groupId, key, address)).getChanges(groupId, after);
}
export async function renameGroup(groupId: string, key: string, name: string, address: string): Promise<GroupSummary> { return (await mutationStore(groupId, key, address)).renameGroup(groupId, name); }
export async function createFolder(groupId: string, key: string, input: { name: string; parentId: string | null }, address: string): Promise<GroupFolder> { return (await mutationStore(groupId, key, address)).createFolder(groupId, input); }
export async function updateFolder(groupId: string, key: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }, address: string): Promise<GroupFolder> { return (await mutationStore(groupId, key, address)).updateFolder(groupId, id, input); }
export async function deleteFolder(groupId: string, key: string, id: string, expectedVersion: number, address: string): Promise<void> { await (await mutationStore(groupId, key, address)).deleteFolder(groupId, id, expectedVersion); }
export async function createDocument(groupId: string, key: string, input: { title: string; body: string; folderId: string | null }, address: string): Promise<GroupDocument> { return (await mutationStore(groupId, key, address)).createDocument(groupId, input); }
export async function updateDocument(groupId: string, key: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }, address: string): Promise<GroupDocument> { return (await mutationStore(groupId, key, address)).updateDocument(groupId, id, input); }
export async function deleteDocument(groupId: string, key: string, id: string, expectedVersion: number, address: string): Promise<void> { await (await mutationStore(groupId, key, address)).deleteDocument(groupId, id, expectedVersion); }
export async function deleteGroup(groupId: string, key: string, address: string): Promise<GroupSummary> { return (await mutationStore(groupId, key, address)).softDeleteGroup(groupId, new Date()); }
export async function restoreGroup(groupId: string, key: string, address: string): Promise<GroupSummary> {
  const groupStore = await authorized(groupId, key, address);
  return groupStore.restoreGroup(groupId, new Date());
}
export async function purgeGroups(): Promise<{ groups: number; changes: number; buckets: number }> {
  const now = new Date();
  const [groups, buckets] = await Promise.all([store().purgeDeletedGroups(now), purgeExpiredRateLimitBuckets(now)]);
  return { groups, changes: 0, buckets };
}
