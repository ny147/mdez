import Dexie from "dexie";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, MdezDatabase } from "@/lib/db";
import { createQuickShare, deleteQuickShare } from "@/lib/quick-share-client";
import {
  forgetSharedLink,
  listSharedLinks,
  rememberSharedLink
} from "@/lib/shared-link-repository";

describe("creator-owned shared links", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  it("keeps the management token only in the creator browser", async () => {
    await rememberSharedLink({
      publicId: "abc",
      url: "https://mdez.app/share/abc",
      title: "Guide",
      managementToken: "private",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    });
    expect(await listSharedLinks()).toEqual([
      expect.objectContaining({ publicId: "abc", managementToken: "private" })
    ]);
    await forgetSharedLink("abc");
    expect(await listSharedLinks()).toEqual([]);
  });

  it("lists newest links first", async () => {
    await rememberSharedLink({
      publicId: "older",
      url: "/share/older",
      title: "Older",
      managementToken: "older-token",
      createdAt: "2026-08-08T00:00:00Z",
      expiresAt: null
    });
    await rememberSharedLink({
      publicId: "newer",
      url: "/share/newer",
      title: "Newer",
      managementToken: "newer-token",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    });

    expect((await listSharedLinks()).map((link) => link.publicId)).toEqual(["newer", "older"]);
  });

  it("preserves version-2 local content during the shared-links upgrade", async () => {
    const databaseName = "mdez-version-2-shared-links-migration";
    await Dexie.delete(databaseName);
    const legacy = new Dexie(databaseName);
    legacy.version(2).stores({
      folders: "id, parentId, sourceId, order, updatedAt",
      documents: "id, folderId, sourceId, order, updatedAt",
      githubSources: "id, &normalizedUrl, rootFolderId, updatedAt"
    });
    await legacy.open();
    await legacy.table("documents").add({
      id: "legacy-document",
      title: "Legacy",
      body: "preserved",
      folderId: null,
      order: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    });
    legacy.close();

    const migrated = new MdezDatabase(databaseName);
    try {
      await migrated.open();
      expect(await migrated.documents.get("legacy-document"))
        .toEqual(expect.objectContaining({ body: "preserved" }));
      expect(await migrated.sharedLinks.count()).toBe(0);
    } finally {
      migrated.close();
      await Dexie.delete(databaseName);
    }
  });
});

describe("Quick Share browser client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a create request and returns the creator result", async () => {
    const result = {
      publicId: "abc",
      url: "https://mdez.app/share/abc",
      title: "Guide",
      markdown: "# Guide",
      managementToken: "private",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify(result),
      { status: 201, headers: { "content-type": "application/json" } }
    ));

    await expect(createQuickShare({ title: "Guide", markdown: "# Guide", expiry: "7d" }))
      .resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/quick-shares", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ title: "Guide", markdown: "# Guide", expiry: "7d" })
    }));
  });

  it("deletes with the management token in a header, never the URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, {
      status: 204
    }));

    await deleteQuickShare("abc", "private");
    expect(fetchMock).toHaveBeenCalledWith("/api/quick-shares/abc", {
      method: "DELETE",
      headers: { "x-mdez-management-token": "private" }
    });
  });
});
