import { describe, expect, it } from "vitest";
import type { Document, Folder } from "@/types/content";
import { buildExportManifest, buildFolderExportEntries, getDocumentExportName } from "@/lib/export";

const folders: Folder[] = [
  { id: "f1", name: "Projects", parentId: null, order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "f2", name: "Launch", parentId: "f1", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

const documents: Document[] = [
  { id: "d1", title: "Plan", body: "# Plan", folderId: "f1", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "d2", title: "Checklist", body: "- [ ] Ship", folderId: "f2", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

describe("export helpers", () => {
  it("creates a safe document export name", () => {
    expect(getDocumentExportName({ ...documents[0], title: "Roadmap / Q3" })).toBe("roadmap-q3.md");
  });

  it("creates folder ZIP entries with nested paths", () => {
    expect(buildFolderExportEntries(folders, documents, "f1")).toEqual([
      { path: "projects/plan.md", body: "# Plan" },
      { path: "projects/launch/checklist.md", body: "- [ ] Ship" }
    ]);
  });

  it("creates a manifest with metadata and original relationships", () => {
    const manifest = buildExportManifest(folders, documents, "f1");
    expect(manifest.exportedFolderId).toBe("f1");
    expect(manifest.folders.map((folder) => folder.id)).toEqual(["f1", "f2"]);
    expect(manifest.documents.map((document) => document.id)).toEqual(["d1", "d2"]);
  });
});
