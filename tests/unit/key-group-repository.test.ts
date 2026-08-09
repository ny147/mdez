import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, MdezDatabase } from "@/lib/db";
import { getGroupSnapshot } from "@/lib/key-group-client";
import { cacheGroupSnapshot, forgetGroup, loadCachedGroup, loadRememberedGroups, rememberGroup } from "@/lib/key-group-repository";
import type { GroupSnapshot } from "@/types/key-group";

const validKey = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
const timestamp = "2026-08-09T00:00:00.000Z";
const snapshot: GroupSnapshot = { group: { id: "g1", name: "Writers", revision: 1, deletedAt: null, purgeAfter: null, createdAt: timestamp, updatedAt: timestamp }, folders: [], documents: [] };

describe("remembered Key Groups", () => {
  beforeEach(async () => { await db.delete(); await db.open(); });
  afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });

  it("remembers a raw key locally and removes cache on leave", async () => {
    await rememberGroup({ groupId: "g1", name: "Writers", key: validKey, joinedAt: timestamp, lastOpenedAt: timestamp });
    await cacheGroupSnapshot(snapshot);
    expect(await loadRememberedGroups()).toEqual([expect.objectContaining({ key: validKey })]);
    await forgetGroup("g1");
    expect(await loadCachedGroup("g1")).toBeNull();
  });

  it("preserves version-3 Local and Quick Share rows during the upgrade", async () => {
    const databaseName = "mdez-version-3-key-groups-migration"; await Dexie.delete(databaseName);
    const legacy = new Dexie(databaseName);
    legacy.version(3).stores({ folders: "id, parentId, sourceId, order, updatedAt", documents: "id, folderId, sourceId, order, updatedAt", githubSources: "id, &normalizedUrl, rootFolderId, updatedAt", sharedLinks: "publicId, createdAt, expiresAt" });
    await legacy.open(); await legacy.table("documents").add({ id: "local", title: "Local", body: "safe", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp }); await legacy.table("sharedLinks").add({ publicId: "share", createdAt: timestamp }); legacy.close();
    const migrated = new MdezDatabase(databaseName);
    try { await migrated.open(); expect(await migrated.documents.get("local")).toEqual(expect.objectContaining({ body: "safe" })); expect(await migrated.sharedLinks.get("share")).toBeDefined(); }
    finally { migrated.close(); await Dexie.delete(databaseName); }
  });
});

it("sends the group key only in its private header", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 })));
  await getGroupSnapshot("g1", validKey);
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).not.toContain(validKey);
  expect(new Headers(init?.headers).get("x-mdez-group-key")).toBe(validKey);
});
