import { describe, expect, it, vi } from "vitest";

import {
  createGroupService,
  getGroupSnapshotService,
  joinGroupService,
} from "@/server/key-groups/service";
import type { KeyGroupStore } from "@/server/key-groups/store";
import type { GroupSnapshot, LocalGroupImport } from "@/types/key-group";

vi.mock("server-only", () => ({}));

const validKey = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
const timestamp = "2026-08-09T00:00:00.000Z";
const validImport: LocalGroupImport = {
  name: "Writers",
  folders: [{ clientId: "f1", parentClientId: null, name: "Book", order: 0, createdAt: timestamp, updatedAt: timestamp }],
  documents: [{ clientId: "d1", folderClientId: "f1", title: "one.md", body: "# One", order: 0, createdAt: timestamp, updatedAt: timestamp }],
};

function snapshot(deleted = false): GroupSnapshot {
  return {
    group: { id: "g1", name: "Writers", revision: 0, deletedAt: deleted ? timestamp : null, purgeAfter: deleted ? "2026-08-16T00:00:00.000Z" : null, createdAt: timestamp, updatedAt: timestamp },
    folders: [{ id: "f1", parentId: null, name: "Book", order: 0, version: 1, groupRevision: 0, createdAt: timestamp, updatedAt: timestamp }],
    documents: [{ id: "d1", folderId: "f1", title: "one.md", body: "# One", order: 0, version: 1, groupRevision: 0, createdAt: timestamp, updatedAt: timestamp }],
  };
}

function fakeGroupStore(overrides: Partial<KeyGroupStore> = {}): KeyGroupStore {
  return {
    createGroup: vi.fn(async () => snapshot()),
    findGroupIdByDigest: vi.fn(async () => "g1"),
    getSnapshot: vi.fn(async () => snapshot()),
    getChanges: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    renameGroup: vi.fn(),
    softDeleteGroup: vi.fn(),
    restoreGroup: vi.fn(),
    purgeDeletedGroups: vi.fn(),
    ...overrides,
  };
}

const allowed = vi.fn(async () => ({ allowed: true, remaining: 4, retryAfterSeconds: 0 }));

describe("Key Group services", () => {
  it("creates one group and its complete snapshot in one store call", async () => {
    process.env.GROUP_KEY_PEPPER = "p".repeat(32);
    const store = fakeGroupStore();
    const result = await createGroupService({ key: validKey, import: validImport }, { store, address: "198.51.100.1", consumeRateLimit: allowed });
    expect(store.createGroup).toHaveBeenCalledOnce();
    expect(result.folders).toHaveLength(validImport.folders.length);
    expect(result.documents).toHaveLength(validImport.documents.length);
  });

  it("does not reveal whether a malformed or unknown key exists", async () => {
    process.env.GROUP_KEY_PEPPER = "p".repeat(32);
    const store = fakeGroupStore({ findGroupIdByDigest: vi.fn(async () => null) });
    await expect(joinGroupService("mdez-group-BBBBBBBBBBBBBBBBBBBBBB", { store, address: "198.51.100.1", consumeRateLimit: allowed }))
      .rejects.toMatchObject({ code: "INVALID_KEY", message: "Group key is invalid" });
    await expect(joinGroupService("malformed", { store, address: "198.51.100.1", consumeRateLimit: allowed }))
      .rejects.toMatchObject({ code: "INVALID_KEY", message: "Group key is invalid" });
  });

  it("allows a valid key to read a soft-deleted group for restoration", async () => {
    process.env.GROUP_KEY_PEPPER = "p".repeat(32);
    const store = fakeGroupStore({ getSnapshot: vi.fn(async () => snapshot(true)) });
    await expect(getGroupSnapshotService(validKey, { store, address: "198.51.100.1", consumeRateLimit: allowed }))
      .resolves.toMatchObject({ group: { deletedAt: expect.any(String) } });
  });

  it("rejects a valid key that belongs to a different requested group", async () => {
    process.env.GROUP_KEY_PEPPER = "p".repeat(32);
    const store = fakeGroupStore();
    await expect(getGroupSnapshotService(validKey, { store, groupId: "g2", address: "198.51.100.1", consumeRateLimit: allowed }))
      .rejects.toMatchObject({ code: "INVALID_KEY", message: "Group key is invalid" });
  });
});
