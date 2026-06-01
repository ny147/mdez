import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { Document, Folder } from "@/types/content";
import { buildExportManifest, buildFolderExportEntries, createFolderZipBlob, getDocumentExportName } from "@/lib/export";

const folders: Folder[] = [
  { id: "f1", name: "Projects", parentId: null, order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "f2", name: "Launch", parentId: "f1", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

const documents: Document[] = [
  { id: "d1", title: "Plan", body: "# Plan", folderId: "f1", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "d2", title: "Checklist", body: "- [ ] Ship", folderId: "f2", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

function documentMetadata(document: Document) {
  return {
    id: document.id,
    title: document.title,
    folderId: document.folderId,
    order: document.order,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

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

  it("creates unique paths for duplicate document names in the same folder", () => {
    const duplicateDocuments: Document[] = [
      { ...documents[0], id: "d1", title: "Plan", body: "one", order: 0 },
      { ...documents[0], id: "d2", title: "Plan!", body: "two", order: 1 },
      { ...documents[0], id: "d3", title: "Plan", body: "three", order: 2 }
    ];

    expect(buildFolderExportEntries([folders[0]], duplicateDocuments, "f1")).toEqual([
      { path: "projects/plan.md", body: "one" },
      { path: "projects/plan-2.md", body: "two" },
      { path: "projects/plan-3.md", body: "three" }
    ]);
  });

  it("creates unique nested paths for duplicate slugged sibling folder names", () => {
    const siblingFolders: Folder[] = [
      folders[0],
      { ...folders[1], id: "f2", name: "Launch", parentId: "f1", order: 0 },
      { ...folders[1], id: "f3", name: "Launch!", parentId: "f1", order: 1 }
    ];
    const siblingDocuments: Document[] = [
      { ...documents[1], id: "d2", folderId: "f2", title: "Checklist", body: "first" },
      { ...documents[1], id: "d3", folderId: "f3", title: "Checklist", body: "second" }
    ];

    expect(buildFolderExportEntries(siblingFolders, siblingDocuments, "f1")).toEqual([
      { path: "projects/launch/checklist.md", body: "first" },
      { path: "projects/launch-2/checklist.md", body: "second" }
    ]);
  });

  it("throws a clear error when an export path has a parent cycle", () => {
    const cyclicFolders: Folder[] = [{ ...folders[0], parentId: "f1" }];
    const cyclicDocuments: Document[] = [{ ...documents[0], folderId: "f1" }];

    expect(() => buildFolderExportEntries(cyclicFolders, cyclicDocuments, "f1")).toThrow("Folder cycle detected while building export path.");
  });

  it("throws a clear error when the export root folder is missing", () => {
    expect(() => buildFolderExportEntries(folders, documents, "missing")).toThrow("Folder not found for export.");
    expect(() => buildExportManifest(folders, documents, "missing")).toThrow("Folder not found for export.");
  });

  it("omits document bodies from the manifest", () => {
    const manifest = buildExportManifest(folders, documents, "f1");

    expect(manifest.documents).toHaveLength(2);
    expect(manifest.documents[0]).not.toHaveProperty("body");
    expect(manifest.documents[1]).not.toHaveProperty("body");
  });

  it("creates a readable folder ZIP with markdown files and a manifest", async () => {
    const blob = await createFolderZipBlob(folders, documents, "f1");
    const zip = await JSZip.loadAsync(blob);

    await expect(zip.file("projects/plan.md")?.async("string")).resolves.toBe("# Plan");
    await expect(zip.file("projects/launch/checklist.md")?.async("string")).resolves.toBe("- [ ] Ship");

    const manifest = JSON.parse(await zip.file("projects/manifest.json")!.async("string"));
    expect(manifest).toMatchObject({
      app: "Mdez",
      exportedFolderId: "f1",
      folders,
      documents: documents.map(documentMetadata)
    });
  });
});
