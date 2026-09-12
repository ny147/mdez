import { describe, expect, it } from "vitest";
import { buildFlatBookMigration, naturalCompare } from "@/lib/library-tree";
import type { Folder } from "@/types/content";

const folder = (id: string, name: string, parentId: string | null): Folder => ({
  id, name, parentId, order: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

describe("flat library model", () => {
  it("sorts numbered titles naturally with stable ID ties", () => {
    const rows = [
      { id: "b", title: "Chapter 10" },
      { id: "c", title: "Same" },
      { id: "a", title: "Chapter 2" },
      { id: "b2", title: "Same" }
    ].sort((left, right) => naturalCompare(left.title, right.title) || left.id.localeCompare(right.id));
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "b2", "c"]);
  });

  it("flattens nested paths without changing top-level names", () => {
    const result = buildFlatBookMigration([
      folder("root", "Research", null),
      folder("child", "Sources", "root"),
      folder("deep", "Web", "child")
    ]);
    expect(result).toEqual([
      { id: "root", name: "Research" },
      { id: "child", name: "Research / Sources" },
      { id: "deep", name: "Research / Sources / Web" }
    ]);
  });

  it("reserves top-level names and suffixes collisions deterministically", () => {
    const result = buildFlatBookMigration([
      folder("existing", "Research / Sources", null),
      folder("root", "Research", null),
      folder("child-a", "Sources", "root"),
      folder("child-b", "Sources", "root")
    ]);
    expect(result).toEqual([
      { id: "existing", name: "Research / Sources" },
      { id: "root", name: "Research" },
      { id: "child-a", name: "Research / Sources (2)" },
      { id: "child-b", name: "Research / Sources (3)" }
    ]);
  });

  it("recovers orphaned and cyclic books without dropping them", () => {
    const result = buildFlatBookMigration([
      folder("orphan", "Loose", "missing"),
      folder("cycle-a", "Alpha", "cycle-b"),
      folder("cycle-b", "Beta", "cycle-a")
    ]);
    expect(result).toEqual([
      { id: "orphan", name: "Loose" },
      { id: "cycle-a", name: "Alpha / Beta / Alpha" },
      { id: "cycle-b", name: "Beta / Alpha / Beta" }
    ]);
  });
});
