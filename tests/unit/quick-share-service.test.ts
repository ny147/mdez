import { describe, expect, it, vi } from "vitest";

import {
  createQuickShareService,
  deleteQuickShareService,
  readQuickShareService
} from "@/server/quick-shares/service";
import type { QuickShareRecord, QuickShareStore } from "@/server/quick-shares/store";

vi.mock("server-only", () => ({}));

function memoryStore(): QuickShareStore & { rows: Map<string, QuickShareRecord> } {
  const rows = new Map<string, QuickShareRecord>();
  return {
    rows,
    insert: async (row) => {
      rows.set(row.publicId, row);
      return row;
    },
    findByPublicId: async (id) => rows.get(id) ?? null,
    deleteByPublicIdAndDigest: async (id, digest) => {
      const row = rows.get(id);
      if (!row) return "not_found";
      if (!row.managementTokenDigest.equals(digest)) return "forbidden";
      rows.delete(id);
      return "deleted";
    },
    purgeExpired: async () => 0
  };
}

describe("Quick Share services", () => {
  it("creates an immutable snapshot and returns the raw management token once", async () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "p".repeat(32);
    const store = memoryStore();
    const result = await createQuickShareService(
      { title: "Guide", markdown: "# Hello", expiry: "7d" },
      { store, now: () => new Date("2026-08-09T00:00:00Z"), origin: "https://mdez.app" }
    );
    expect(result.url).toBe(`https://mdez.app/share/${result.publicId}`);
    expect(store.rows.get(result.publicId)?.markdown).toBe("# Hello");
    expect(store.rows.get(result.publicId)?.managementTokenDigest).toHaveLength(32);
  });

  it("returns expired instead of the Markdown", async () => {
    const store = memoryStore();
    store.rows.set("gone", {
      publicId: "gone",
      managementTokenDigest: Buffer.alloc(32),
      title: "Gone",
      markdown: "secret",
      sizeBytes: 6,
      createdAt: new Date("2026-08-01Z"),
      expiresAt: new Date("2026-08-02Z")
    });
    await expect(readQuickShareService("gone", {
      store,
      now: () => new Date("2026-08-09Z")
    })).rejects.toMatchObject({ code: "EXPIRED" });
  });

  it("requires the matching management token to delete", async () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "p".repeat(32);
    const store = memoryStore();
    const created = await createQuickShareService(
      { title: "Delete", markdown: "text", expiry: "never" },
      { store, now: () => new Date("2026-08-09Z"), origin: "https://mdez.app" }
    );
    await expect(deleteQuickShareService(created.publicId, "wrong", { store }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteQuickShareService(created.publicId, created.managementToken, { store });
    expect(store.rows.size).toBe(0);
  });
});
