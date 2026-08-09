import type { GroupChangesResult, GroupConflict, GroupDocument, GroupFolder, GroupSnapshot, GroupSummary, LocalGroupCreation } from "@/types/key-group";

export class KeyGroupConflictError extends Error {
  constructor(public readonly conflict: GroupConflict) {
    super("This item changed in the group");
    this.name = "KeyGroupConflictError";
  }
}

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { error?: unknown; conflict?: unknown };
    if (response.status === 409 && body.conflict && typeof body.conflict === "object") return new KeyGroupConflictError(body.conflict as GroupConflict);
    if (typeof body.error === "string" && body.error.trim()) return new Error(body.error);
  } catch { /* Use the safe fallback. */ }
  return new Error(fallback);
}

async function request<T>(path: string, key: string, init: RequestInit, fallback: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-mdez-group-key", key);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) throw await errorFrom(response, fallback);
  return response.json() as Promise<T>;
}

const groupPath = (groupId: string) => `/api/key-groups/${encodeURIComponent(groupId)}`;
const json = (value: unknown) => JSON.stringify(value);

export function createKeyGroup(input: LocalGroupCreation): Promise<GroupSnapshot> { const { key, import: payload } = input; return request("/api/key-groups", key, { method: "POST", body: json(payload) }, "Could not create group"); }
export function joinKeyGroup(key: string): Promise<GroupSnapshot> { return request("/api/key-groups/join", key, { method: "POST" }, "Group key is invalid"); }
export function getGroupSnapshot(groupId: string, key: string): Promise<GroupSnapshot> { return request(groupPath(groupId), key, { method: "GET" }, "Could not load group"); }
export function getGroupChanges(groupId: string, key: string, after: number): Promise<GroupChangesResult> { return request(`${groupPath(groupId)}/changes?after=${after}`, key, { method: "GET" }, "Could not refresh group"); }
export function renameKeyGroup(groupId: string, key: string, name: string): Promise<GroupSummary> { return request(groupPath(groupId), key, { method: "PATCH", body: json({ name }) }, "Could not rename group"); }
export function createGroupFolder(groupId: string, key: string, input: { name: string; parentId: string | null }): Promise<GroupFolder> { return request(`${groupPath(groupId)}/folders`, key, { method: "POST", body: json(input) }, "Could not create folder"); }
export function updateGroupFolder(groupId: string, key: string, id: string, input: { name?: string; parentId?: string | null; order?: number; expectedVersion: number }): Promise<GroupFolder> { return request(`${groupPath(groupId)}/folders/${encodeURIComponent(id)}`, key, { method: "PATCH", body: json(input) }, "Could not update folder"); }
export async function deleteGroupFolder(groupId: string, key: string, id: string, expectedVersion: number): Promise<void> { await request(`${groupPath(groupId)}/folders/${encodeURIComponent(id)}`, key, { method: "DELETE", body: json({ expectedVersion }) }, "Could not delete folder"); }
export function createGroupDocument(groupId: string, key: string, input: { title: string; body: string; folderId: string | null }): Promise<GroupDocument> { return request(`${groupPath(groupId)}/documents`, key, { method: "POST", body: json(input) }, "Could not create document"); }
export function updateGroupDocument(groupId: string, key: string, id: string, input: { title?: string; body?: string; folderId?: string | null; order?: number; expectedVersion: number }): Promise<GroupDocument> { return request(`${groupPath(groupId)}/documents/${encodeURIComponent(id)}`, key, { method: "PATCH", body: json(input) }, "Could not update document"); }
export async function deleteGroupDocument(groupId: string, key: string, id: string, expectedVersion: number): Promise<void> { await request(`${groupPath(groupId)}/documents/${encodeURIComponent(id)}`, key, { method: "DELETE", body: json({ expectedVersion }) }, "Could not delete document"); }
export function deleteKeyGroup(groupId: string, key: string): Promise<GroupSummary> { return request(groupPath(groupId), key, { method: "DELETE" }, "Could not delete group"); }
export function restoreKeyGroup(groupId: string, key: string): Promise<GroupSummary> { return request(groupPath(groupId), key, { method: "PATCH", body: json({ restore: true }) }, "Could not restore group"); }
