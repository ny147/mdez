import { beforeEach, describe, expect, it, vi } from "vitest";

import { createShare, purgeShares, readShare } from "@/server/quick-shares/runtime";
import { consumeRateLimit, purgeExpiredRateLimitBuckets } from "@/server/rate-limit";
import {
  createQuickShareService,
  purgeExpiredQuickShares,
  readQuickShareService
} from "@/server/quick-shares/service";

const { store } = vi.hoisted(() => ({ store: { name: "postgres-store" } }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ getDatabase: vi.fn(() => ({ name: "database" })) }));
vi.mock("@/server/quick-shares/postgres-store", () => ({
  PostgresQuickShareStore: vi.fn(() => store)
}));
vi.mock("@/server/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  purgeExpiredRateLimitBuckets: vi.fn()
}));
vi.mock("@/server/quick-shares/service", () => ({
  createQuickShareService: vi.fn(),
  readQuickShareService: vi.fn(),
  deleteQuickShareService: vi.fn(),
  purgeExpiredQuickShares: vi.fn()
}));

describe("Quick Share runtime composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rate-limits creates by HMAC-ready address before calling the service", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12
    });

    await expect(createShare(
      { title: "Guide", markdown: "# Guide", expiry: "7d" },
      { origin: "https://mdez.app", address: "203.0.113.5" }
    )).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 12 });
    expect(consumeRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      scope: "quick-share:create",
      identifier: "203.0.113.5",
      limit: 20,
      windowSeconds: 3600
    }));
    expect(createQuickShareService).not.toHaveBeenCalled();
  });

  it("rate-limits reads by the public-ID/address pair", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 119,
      retryAfterSeconds: 60
    });
    vi.mocked(readQuickShareService).mockResolvedValue({
      publicId: "abc",
      title: "Guide",
      markdown: "# Guide",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    });

    await readShare("abc", "203.0.113.5");
    expect(consumeRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      scope: "quick-share:read",
      identifier: "abc:203.0.113.5",
      limit: 120,
      windowSeconds: 60
    }));
  });

  it("purges expired shares and rate buckets together", async () => {
    vi.mocked(purgeExpiredQuickShares).mockResolvedValue(2);
    vi.mocked(purgeExpiredRateLimitBuckets).mockResolvedValue(3);
    await expect(purgeShares()).resolves.toEqual({ shares: 2, buckets: 3 });
  });
});
