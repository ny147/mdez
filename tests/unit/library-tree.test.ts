import { describe, expect, it } from "vitest";
import { buildFlatBookMigration, generatedNameCandidate, generatedNameCollisionKey, naturalCompare } from "@/lib/library-tree";
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

  it("preserves duplicate root names and allocates generated collisions in stable ID order", () => {
    const input = [
      folder("root-b", "Notes", null),
      folder("root-a", "Notes", null),
      folder("reserved", "Notes / Ideas (2)", null),
      folder("child-b", "Ideas", "root-b"),
      folder("child-a", "Ideas", "root-a")
    ];
    const names = (items: Folder[]) => new Map(buildFlatBookMigration(items).map((item) => [item.id, item.name]));
    expect(names(input)).toEqual(names([...input].reverse()));
    expect(names(input)).toEqual(new Map([
      ["root-b", "Notes"], ["root-a", "Notes"], ["reserved", "Notes / Ideas (2)"],
      ["child-b", "Notes / Ideas (3)"], ["child-a", "Notes / Ideas"]
    ]));
  });

  it("reserves suffix room when limiting generated names", () => {
    expect(Array.from(generatedNameCandidate("x".repeat(323), 2, 300))).toHaveLength(300);
    expect(generatedNameCandidate("x".repeat(323), 2, 300).endsWith(" (2)")).toBe(true);
    const result = buildFlatBookMigration([
      folder("root", "x".repeat(160), null),
      folder("child", "y".repeat(160), "root")
    ], { maxGeneratedNameLength: 300 });
    expect(Array.from(result[1].name).length).toBe(300);
    expect(result[0].name).toBe("x".repeat(160));
  });

  it("uses the documented locale-independent ASCII collision key", () => {
    expect(generatedNameCollisionKey(" NOTES ")).toBe("notes");
    expect(generatedNameCollisionKey("İ")).toBe("İ");
    expect(generatedNameCollisionKey("I")).toBe("i");
  });
});
