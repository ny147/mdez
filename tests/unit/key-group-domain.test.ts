import { describe, expect, it, vi } from "vitest";

import {
  buildLocalGroupCreation,
  generateGroupKey,
  isValidGroupKey,
  validateLocalGroupCreation,
} from "@/lib/key-group";
import { digestGroupKey } from "@/server/key-groups/secrets";

vi.mock("server-only", () => ({}));

const validKey = "mdez-group-AAAAAAAAAAAAAAAAAAAAAA";
const timestamp = "2026-08-09T00:00:00Z";

describe("Key Group domain", () => {
  it("generates a copyable key with at least 128 random bits", () => {
    const key = generateGroupKey();
    expect(key).toMatch(/^mdez-group-[A-Za-z0-9_-]{22}$/);
    expect(isValidGroupKey(key)).toBe(true);
  });

  it("copies hierarchy and Markdown but strips GitHub source metadata", () => {
    const input = buildLocalGroupCreation(
      "Writers",
      validKey,
      [{ id: "f1", parentId: null, name: "Book", order: 0, sourceId: "gh", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" }],
      [{ id: "d1", folderId: "f1", title: "one.md", body: "# One", order: 0, sourceId: "gh", createdAt: "2026-08-03T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" }],
    );

    expect(input.import.folders[0]).toEqual({ clientId: "f1", parentClientId: null, name: "Book", order: 0, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" });
    expect(input.import.documents[0]).toEqual({ clientId: "d1", folderClientId: "f1", title: "one.md", body: "# One", order: 0, createdAt: "2026-08-03T00:00:00Z", updatedAt: "2026-08-04T00:00:00Z" });
    expect(JSON.stringify(input)).not.toContain("sourceId");
  });

  it("rejects more than 50 MiB total before upload", () => {
    const documents = Array.from({ length: 11 }, (_, index) => ({ clientId: `d${index}`, folderClientId: null, title: `${index}.md`, body: "x".repeat(5 * 1024 * 1024), order: index, createdAt: timestamp, updatedAt: timestamp }));
    expect(() => validateLocalGroupCreation({ key: validKey, import: { name: "Large", folders: [], documents } })).toThrow("Group Markdown must total 50 MiB or less");
  });

  it("rejects folder cycles", () => {
    expect(() => validateLocalGroupCreation({
      key: validKey,
      import: {
        name: "Cyclic",
        folders: [
          { clientId: "a", parentClientId: "b", name: "A", order: 0, createdAt: timestamp, updatedAt: timestamp },
          { clientId: "b", parentClientId: "a", name: "B", order: 1, createdAt: timestamp, updatedAt: timestamp },
        ],
        documents: [],
      },
    })).toThrow("Folder hierarchy must not contain a cycle");
  });

  it("creates stable HMAC digests without accepting a short pepper", () => {
    process.env.GROUP_KEY_PEPPER = "a".repeat(32);
    expect(digestGroupKey(validKey)).toEqual(digestGroupKey(validKey));
    expect(digestGroupKey(validKey)).toHaveLength(32);
    process.env.GROUP_KEY_PEPPER = "short";
    expect(() => digestGroupKey(validKey)).toThrow("GROUP_KEY_PEPPER must contain at least 32 bytes");
  });
});
