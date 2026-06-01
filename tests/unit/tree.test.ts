import { describe, expect, it } from "vitest";
import type { Document, Folder } from "@/types/content";
import { buildFolderTree, folderHasContent, getDescendantFolderIds } from "@/lib/tree";

const timestamp = "2026-06-01T00:00:00.000Z";

function makeFolder(folder: Pick<Folder, "id" | "name" | "parentId" | "order">): Folder {
  return {
    ...folder,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function makeDocument(document: Pick<Document, "id" | "title" | "folderId" | "order">): Document {
  return {
    ...document,
    body: "",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

const folders: Folder[] = [
  makeFolder({ id: "root-a", name: "Root A", parentId: null, order: 1 }),
  makeFolder({ id: "child-a", name: "Child A", parentId: "root-a", order: 1 }),
  makeFolder({ id: "child-b", name: "Child B", parentId: "child-a", order: 1 }),
  makeFolder({ id: "root-b", name: "Root B", parentId: null, order: 0 })
];

const documents: Document[] = [
  makeDocument({ id: "doc-a", title: "Doc A", folderId: "child-b", order: 0 })
];

describe("folder tree logic", () => {
  it("builds ordered nested trees", () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.folder.id)).toEqual(["root-b", "root-a"]);
    expect(tree[1].children[0].folder.id).toBe("child-a");
    expect(tree[1].children[0].children[0].folder.id).toBe("child-b");
  });

  it("does not mutate the input folders array when building trees", () => {
    const unorderedFolders = [
      makeFolder({ id: "beta", name: "Beta", parentId: null, order: 1 }),
      makeFolder({ id: "alpha", name: "Alpha", parentId: null, order: 0 })
    ];
    const originalOrder = unorderedFolders.map((folder) => folder.id);

    buildFolderTree(unorderedFolders);

    expect(unorderedFolders.map((folder) => folder.id)).toEqual(originalOrder);
  });

  it("sorts same-order siblings by name", () => {
    const siblingFolders = [
      makeFolder({ id: "root", name: "Root", parentId: null, order: 0 }),
      makeFolder({ id: "z-child", name: "Z Child", parentId: "root", order: 1 }),
      makeFolder({ id: "a-child", name: "A Child", parentId: "root", order: 1 })
    ];

    const tree = buildFolderTree(siblingFolders);

    expect(tree[0].children.map((node) => node.folder.id)).toEqual(["a-child", "z-child"]);
  });

  it("finds descendant folder ids", () => {
    expect(getDescendantFolderIds(folders, "root-a")).toEqual(["child-a", "child-b"]);
  });

  it("detects documents inside nested folders", () => {
    expect(folderHasContent(folders, documents, "root-a")).toBe(true);
    expect(folderHasContent(folders, documents, "root-b")).toBe(false);
  });

  it("detects documents directly inside the target folder", () => {
    expect(folderHasContent(folders, [makeDocument({ id: "doc-root", title: "Doc Root", folderId: "root-b", order: 0 })], "root-b")).toBe(true);
  });

  it("detects direct empty child folder branches as content", () => {
    expect(folderHasContent(folders, [], "root-a")).toBe(true);
  });

  it("skips self-parenting folders during descendant traversal", () => {
    const cyclicFolders = [
      makeFolder({ id: "self", name: "Self", parentId: "self", order: 0 })
    ];

    expect(getDescendantFolderIds(cyclicFolders, "self")).toEqual([]);
    expect(folderHasContent(cyclicFolders, [makeDocument({ id: "doc-self", title: "Doc Self", folderId: "self", order: 0 })], "self")).toBe(true);
    expect(folderHasContent(cyclicFolders, [], "self")).toBe(false);
  });

  it("skips already visited folders while building trees", () => {
    const cyclicFolders = [
      makeFolder({ id: "cycle-a", name: "Cycle A", parentId: "cycle-b", order: 0 }),
      makeFolder({ id: "cycle-b", name: "Cycle B", parentId: "cycle-a", order: 0 })
    ];

    const tree = buildFolderTree(cyclicFolders, "cycle-a");

    expect(tree).toHaveLength(1);
    expect(tree[0].folder.id).toBe("cycle-b");
    expect(tree[0].children).toEqual([]);
  });
});
