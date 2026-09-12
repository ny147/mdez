import { describe, expect, it, vi } from "vitest";
import { loadExpandedCollection, loadLastContentMode, saveExpandedCollection, saveLastContentMode } from "@/lib/workspace-ui-preferences";

describe("workspace UI preferences", () => {
  it("isolates expanded collections by workspace and ignores removed books", () => {
    const storage = new Map<string, string>();
    const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
    saveExpandedCollection("local", "book-a", api);
    saveExpandedCollection("group-1", "book-b", api);
    expect(loadExpandedCollection("local", new Set(["book-a"]), api)).toBe("book-a");
    expect(loadExpandedCollection("group-1", new Set(), api)).toBeNull();
  });

  it("falls back safely when storage access is denied", () => {
    const denied = { getItem: vi.fn(() => { throw new Error("denied"); }), setItem: vi.fn(() => { throw new Error("denied"); }) };
    expect(loadExpandedCollection("local", new Set(), denied)).toBeNull();
    expect(() => saveExpandedCollection("local", "book-a", denied)).not.toThrow();
    expect(loadLastContentMode("local", denied)).toBe("editor");
    expect(() => saveLastContentMode("local", "split", denied)).not.toThrow();
  });

  it("stores the last content mode independently for each workspace", () => {
    const storage = new Map<string, string>();
    const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
    saveLastContentMode("local", "preview", api);
    saveLastContentMode("group:1", "split", api);
    expect(loadLastContentMode("local", api)).toBe("preview");
    expect(loadLastContentMode("group:1", api)).toBe("split");
  });
});
