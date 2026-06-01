import { describe, expect, it } from "vitest";
import type { Document, Folder } from "@/types/content";
import { buildFolderTree, folderHasContent, getDescendantFolderIds } from "@/lib/tree";

const folders: Folder[] = [
  { id: "root-a", name: "Root A", parentId: null, order: 1, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "child-a", name: "Child A", parentId: "root-a", order: 1, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "child-b", name: "Child B", parentId: "child-a", order: 1, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
  { id: "root-b", name: "Root B", parentId: null, order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

const documents: Document[] = [
  { id: "doc-a", title: "Doc A", body: "", folderId: "child-b", order: 0, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" }
];

describe("folder tree logic", () => {
  it("builds ordered nested trees", () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.folder.id)).toEqual(["root-b", "root-a"]);
    expect(tree[1].children[0].folder.id).toBe("child-a");
    expect(tree[1].children[0].children[0].folder.id).toBe("child-b");
  });

  it("finds descendant folder ids", () => {
    expect(getDescendantFolderIds(folders, "root-a")).toEqual(["child-a", "child-b"]);
  });

  it("detects documents inside nested folders", () => {
    expect(folderHasContent(folders, documents, "root-a")).toBe(true);
    expect(folderHasContent(folders, documents, "root-b")).toBe(false);
  });
});
