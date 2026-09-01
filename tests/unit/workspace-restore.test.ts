import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { createDocument, createFolder, listContent, restoreWorkspaceBackup } from "@/lib/repository";
import { prepareWorkspaceRestore } from "@/lib/workspace-backup";
import type { ParsedWorkspaceBackup } from "@/types/backup";
import type { Folder } from "@/types/content";

const timestamp = "2026-09-01T00:00:00.000Z";

function parsed(): ParsedWorkspaceBackup {
  return {
    manifest: {
      app: "Mdez", schemaVersion: 1, appVersion: "0.1.0", exportedAt: timestamp,
      workspace: { kind: "local", id: null, name: "Research" },
      folders: [
        { id: "old-root", name: "Notes", parentId: null, order: 0, sourceId: "old-source", createdAt: timestamp, updatedAt: timestamp },
        { id: "old-child", name: "Launch", parentId: "old-root", order: 0, sourceId: "old-source", createdAt: timestamp, updatedAt: timestamp }
      ],
      documents: [
        { id: "old-page", title: "Brief", folderId: "old-child", sourceId: "old-source", order: 0, createdAt: timestamp, updatedAt: timestamp, path: "notes/launch/brief.md" },
        { id: "old-loose", title: "Loose", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp, path: "pages-without-book/loose.md" }
      ],
      githubSources: [{ id: "old-source", owner: "openai", repository: "codex", normalizedUrl: "https://github.com/openai/codex", branch: "main", rootFolderId: "old-root", lastRefreshedAt: timestamp, createdAt: timestamp, updatedAt: timestamp }]
    },
    documents: [
      { id: "old-page", title: "Brief", body: "# Brief", folderId: "old-child", sourceId: "old-source", order: 0, createdAt: timestamp, updatedAt: timestamp, path: "notes/launch/brief.md" },
      { id: "old-loose", title: "Loose", body: "Loose", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp, path: "pages-without-book/loose.md" }
    ]
  };
}

const existing: Folder[] = [
  { id: "existing", name: "Research", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "existing-2", name: "Research (restored 2)", parentId: null, order: 1, createdAt: timestamp, updatedAt: timestamp }
];

describe("workspace restore", () => {
  beforeEach(async () => { await db.delete(); await db.open(); });
  afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });

  it("remaps every identity and relationship beneath a collision-safe root", () => {
    const source = parsed();
    const before = structuredClone(source);
    const prepared = prepareWorkspaceRestore(source, existing, timestamp);
    expect(prepared.rootLabel).toBe("Research (restored 3)");
    expect(prepared.folders.every((folder) => !source.manifest.folders.some((old) => old.id === folder.id))).toBe(true);
    const wrapper = prepared.folders.find((folder) => folder.name === prepared.rootLabel)!;
    const importedRoot = prepared.folders.find((folder) => folder.name === "Notes")!;
    const importedChild = prepared.folders.find((folder) => folder.name === "Launch")!;
    expect(importedRoot.parentId).toBe(wrapper.id);
    expect(importedChild.parentId).toBe(importedRoot.id);
    expect(prepared.documents.find((document) => document.title === "Loose")?.folderId).toBe(wrapper.id);
    expect(prepared.documents.find((document) => document.title === "Brief")?.folderId).toBe(importedChild.id);
    expect(prepared.githubSources[0].rootFolderId).toBe(importedRoot.id);
    expect(prepared.documents.find((document) => document.title === "Brief")?.sourceId).toBe(prepared.githubSources[0].id);
    expect(source).toEqual(before);
  });

  it("rolls back every table when a restore write fails", async () => {
    const existingFolder = await createFolder("Existing", null);
    await createDocument({ title: "Existing", body: "safe", folderId: existingFolder.id });
    const before = await listContent();
    const prepared = prepareWorkspaceRestore(parsed(), before.folders, timestamp);
    vi.spyOn(db.documents, "bulkAdd").mockRejectedValueOnce(new Error("forced failure"));
    await expect(restoreWorkspaceBackup(prepared)).rejects.toThrow("forced failure");
    const after = await listContent();
    expect(after.folders).toHaveLength(before.folders.length);
    expect(after.documents).toHaveLength(before.documents.length);
    expect(after.sources).toHaveLength(before.sources.length);
  });
});
