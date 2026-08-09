import type { Sql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostgresQuickShareStore } from "@/server/quick-shares/postgres-store";
import { consumeRateLimit, purgeExpiredRateLimitBuckets } from "@/server/rate-limit";

const { databaseSql } = vi.hoisted(() => ({ databaseSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ getDatabase: () => databaseSql }));

describe("PostgresQuickShareStore", () => {
  it("maps database rows without exposing persistence field names", async () => {
    const digest = Buffer.alloc(32, 7);
    const sql = vi.fn().mockResolvedValue([{
      public_id: "public-id",
      management_token_digest: digest,
      title: "Guide",
      markdown: "# Guide",
      size_bytes: 7,
      created_at: new Date("2026-08-09T00:00:00Z"),
      expires_at: null
    }]);
    const store = new PostgresQuickShareStore(sql as unknown as Sql);

    await expect(store.findByPublicId("public-id")).resolves.toEqual({
      publicId: "public-id",
      managementTokenDigest: digest,
      title: "Guide",
      markdown: "# Guide",
      sizeBytes: 7,
      createdAt: new Date("2026-08-09T00:00:00Z"),
      expiresAt: null
    });
  });

  it("does not delete when the supplied digest differs", async () => {
    const storedDigest = Buffer.alloc(32, 1);
    const sql = vi.fn().mockResolvedValueOnce([{ management_token_digest: storedDigest }]);
    const store = new PostgresQuickShareStore(sql as unknown as Sql);

    await expect(store.deleteByPublicIdAndDigest("public-id", Buffer.alloc(32, 2)))
      .resolves.toBe("forbidden");
    expect(sql).toHaveBeenCalledTimes(1);
  });
});

describe("consumeRateLimit", () => {
  beforeEach(() => {
    databaseSql.mockReset();
    process.env.RATE_LIMIT_PEPPER = "r".repeat(32);
  });

  it("stores an HMAC bucket key and returns the atomic bucket decision", async () => {
    databaseSql.mockResolvedValue([{
      request_count: 3,
      expires_at: new Date("2026-08-09T01:00:00Z")
    }]);

    await expect(consumeRateLimit({
      scope: "quick-share:create",
      identifier: "203.0.113.5",
      limit: 20,
      windowSeconds: 3600
    }, new Date("2026-08-09T00:00:00Z"))).resolves.toEqual({
      allowed: true,
      remaining: 17,
      retryAfterSeconds: 3600
    });

    const values = databaseSql.mock.calls[0].slice(1);
    expect(values.some((value) => value === "203.0.113.5")).toBe(false);
    expect(values.some((value) => Buffer.isBuffer(value) && value.byteLength === 32)).toBe(true);
  });

  it("purges expired rate-limit buckets for the cleanup job", async () => {
    databaseSql.mockResolvedValue(Object.assign([], { count: 4 }));

    await expect(purgeExpiredRateLimitBuckets(new Date("2026-08-09T00:00:00Z")))
      .resolves.toBe(4);
  });
});
