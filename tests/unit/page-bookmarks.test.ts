import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MdezDatabase } from "@/lib/db";
import { listBookmarks, setBookmark } from "@/lib/page-bookmarks";

const databases: string[] = [];
const createDatabase = () => {
  const name = `mdez-bookmarks-${crypto.randomUUID()}`;
  databases.push(name);
  return new MdezDatabase(name);
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((name) => Dexie.delete(name)));
});

describe("personal page bookmarks", () => {
  it("migrates version-4 content exactly and creates empty personal metadata tables", async () => {
    const name = `mdez-migrate-${crypto.randomUUID()}`;
    databases.push(name);
    const legacy = new Dexie(name);
    legacy.version(4).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt",
      sharedLinks: "publicId, createdAt, expiresAt",
      rememberedGroups: "groupId, lastOpenedAt",
      cachedGroups: "groupId, cachedAt"
    });
    const folder = { id: "folder", name: "Legacy", parentId: null, order: 0, createdAt: "a", updatedAt: "b" };
    const document = { id: "document", title: "Keep", body: "exact", folderId: "folder", order: 0, createdAt: "a", updatedAt: "b" };
    await legacy.open();
    await legacy.table("folders").add(folder);
    await legacy.table("documents").add(document);
    legacy.close();

    const migrated = new MdezDatabase(name);
    await migrated.open();
    expect(await migrated.folders.get("folder")).toEqual(folder);
    expect(await migrated.documents.get("document")).toEqual(document);
    expect(await migrated.pageBookmarks.count()).toBe(0);
    expect(await migrated.workspaceResume.count()).toBe(0);
    migrated.close();
  });

  it("toggles idempotently and isolates the same document ID by workspace", async () => {
    const database = createDatabase();
    await setBookmark("local", "same", true, database);
    await setBookmark("local", "same", true, database);
    await setBookmark("group:test", "same", true, database);
    expect((await listBookmarks("local", database)).map((item) => item.documentId)).toEqual(["same"]);
    expect((await listBookmarks("group:test", database)).map((item) => item.documentId)).toEqual(["same"]);
    await setBookmark("local", "same", false, database);
    expect(await listBookmarks("local", database)).toEqual([]);
    expect(await listBookmarks("group:test", database)).toHaveLength(1);
    database.close();
  });

  it("rejects failed writes", async () => {
    const database = createDatabase();
    vi.spyOn(database.pageBookmarks, "put").mockRejectedValueOnce(new Error("disk full"));
    await expect(setBookmark("local", "page", true, database)).rejects.toThrow("disk full");
    database.close();
  });
});
