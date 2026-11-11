import type { BrowserContext } from "@playwright/test";
import type { GroupChange, GroupSnapshot } from "../../../src/types/key-group";
export type KeyGroupApiModel = { revision: number; snapshot: GroupSnapshot; key: string; deletedAt: string | null };
const logs = new WeakMap<KeyGroupApiModel, GroupChange[]>();
const timestamp = "2026-08-09T00:00:00.000Z";

export function resetKeyGroupApiModel(model: KeyGroupApiModel, snapshot: GroupSnapshot): void {
  model.snapshot = structuredClone(snapshot);
  model.revision = snapshot.group.revision;
  model.key = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
  model.deletedAt = null;
  logs.set(model, []);
}

export async function installKeyGroupApiModel(context: BrowserContext, model?: KeyGroupApiModel): Promise<KeyGroupApiModel> {
  const shared = model ?? { revision: 0, key: "", deletedAt: null, snapshot: { group: { id: "g1", name: "Writers", revision: 0, deletedAt: null, purgeAfter: null, createdAt: timestamp, updatedAt: timestamp }, folders: [], documents: [] } };
  if (!logs.has(shared)) logs.set(shared, []);
  await context.route("**/api/key-groups**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const key = request.headers()["x-mdez-group-key"] ?? "";
    if (path === "/api/key-groups" && request.method() === "POST") {
      shared.key = key; const input = request.postDataJSON() as { name: string; folders: Array<{ clientId: string; parentClientId: string | null; name: string; order: number; createdAt: string; updatedAt: string }>; documents: Array<{ clientId: string; folderClientId: string | null; title: string; body: string; order: number; createdAt: string; updatedAt: string }> };
      shared.snapshot = { group: { ...shared.snapshot.group, name: input.name }, folders: input.folders.map((item) => ({ id: item.clientId, parentId: item.parentClientId, name: item.name, order: item.order, version: 1, groupRevision: 0, createdAt: item.createdAt, updatedAt: item.updatedAt })), documents: input.documents.map((item) => ({ id: item.clientId, folderId: item.folderClientId, title: item.title, body: item.body, order: item.order, version: 1, groupRevision: 0, createdAt: item.createdAt, updatedAt: item.updatedAt })) };
      return route.fulfill({ status: 201, json: shared.snapshot });
    }
    if (!shared.key || key !== shared.key) return route.fulfill({ status: 401, json: { error: "Group key is invalid" } });
    if (path === "/api/key-groups/join" && request.method() === "POST") return route.fulfill({ status: 200, json: shared.snapshot });
    if (path.endsWith("/changes") && request.method() === "GET") {
      const after = Number(url.searchParams.get("after") ?? 0); const changes = (logs.get(shared) ?? []).filter((entry) => entry.revision > after); const changedIds = new Set(changes.filter((entry) => entry.entityType === "document" && entry.operation !== "delete").map((entry) => entry.entityId));
      const changedFolders = new Set(changes.filter((entry) => entry.entityType === "folder" && entry.operation !== "delete").map((entry) => entry.entityId));
      return route.fulfill({ status: 200, json: { status: "changes", revision: shared.revision, changes, records: { group: null, folders: shared.snapshot.folders.filter((item) => changedFolders.has(item.id)), documents: shared.snapshot.documents.filter((item) => changedIds.has(item.id)) } } });
    }
    const documentMatch = path.match(/\/documents\/([^/]+)$/);
    const folderMatch = path.match(/\/folders\/([^/]+)$/);
    const recordChange = (entityType: "document" | "folder", entityId: string, operation: "create" | "update" | "delete") => {
      shared.snapshot.group.revision = ++shared.revision;
      logs.get(shared)!.push({ revision: shared.revision, entityType, entityId, operation, changedAt: timestamp });
    };
    if (path.endsWith("/documents") && request.method() === "POST") {
      const input = request.postDataJSON();
      const id = `created-page-${shared.revision + 1}`;
      recordChange("document", id, "create");
      const created = { id, title: input.title, body: input.body, folderId: input.folderId, order: shared.snapshot.documents.length, version: 1, groupRevision: shared.revision, createdAt: timestamp, updatedAt: timestamp };
      shared.snapshot.documents.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if ((documentMatch || folderMatch) && request.method() === "DELETE") {
      const id = decodeURIComponent((documentMatch ?? folderMatch)![1]);
      const type = documentMatch ? "document" : "folder";
      const current = documentMatch ? shared.snapshot.documents.find((item) => item.id === id) : shared.snapshot.folders.find((item) => item.id === id);
      if (!current) return route.fulfill({ status: 404, json: { error: "Not found" } });
      const input = request.postDataJSON();
      if (input.expectedVersion !== current.version) return route.fulfill({ status: 409, json: { error: "VERSION_CONFLICT", conflict: { entityType: type, entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version } } });
      if (documentMatch) shared.snapshot.documents = shared.snapshot.documents.filter((item) => item.id !== id);
      else {
        for (const item of shared.snapshot.documents.filter((item) => item.folderId === id)) {
          recordChange("document", item.id, "update");
          Object.assign(item, { folderId: null, version: item.version + 1, groupRevision: shared.revision });
        }
        shared.snapshot.folders = shared.snapshot.folders.filter((item) => item.id !== id);
      }
      recordChange(type, id, "delete");
      return route.fulfill({ status: 200, json: { deleted: true } });
    }
    if (path.endsWith("/folders") && request.method() === "POST") {
      const input = request.postDataJSON(); const id = `created-book-${shared.revision + 1}`;
      recordChange("folder", id, "create");
      const created = { id, parentId: null, name: input.name, order: shared.snapshot.folders.length, version: 1, groupRevision: shared.revision, createdAt: timestamp, updatedAt: timestamp };
      shared.snapshot.folders.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (folderMatch && request.method() === "PATCH") {
      const id = decodeURIComponent(folderMatch[1]); const input = request.postDataJSON();
      const current = shared.snapshot.folders.find((item) => item.id === id);
      if (!current) return route.fulfill({ status: 404, json: { error: "Not found" } });
      if (input.expectedVersion !== current.version) return route.fulfill({ status: 409, json: { error: "VERSION_CONFLICT", conflict: { entityType: "folder", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version } } });
      recordChange("folder", id, "update"); Object.assign(current, { name: input.name ?? current.name, version: current.version + 1, groupRevision: shared.revision });
      return route.fulfill({ status: 200, json: current });
    }
    if (documentMatch && request.method() === "PATCH") {
      const id = decodeURIComponent(documentMatch[1]); const input = request.postDataJSON() as { body?: string; title?: string; expectedVersion: number }; const current = shared.snapshot.documents.find((item) => item.id === id);
      if (!current) return route.fulfill({ status: 404, json: { error: "Not found" } });
      if (current.version !== input.expectedVersion) return route.fulfill({ status: 409, json: { error: "VERSION_CONFLICT", conflict: { entityType: "document", entityId: id, expectedVersion: input.expectedVersion, currentVersion: current.version } } });
      shared.revision += 1; Object.assign(current, { body: input.body ?? current.body, title: input.title ?? current.title, version: current.version + 1, groupRevision: shared.revision, updatedAt: timestamp }); shared.snapshot.group.revision = shared.revision;
      logs.get(shared)!.push({ revision: shared.revision, entityType: "document", entityId: id, operation: "update", changedAt: timestamp });
      return route.fulfill({ status: 200, json: current });
    }
    if (path === "/api/key-groups/g1" && request.method() === "GET") return route.fulfill({ status: 200, json: shared.snapshot });
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return shared;
}


