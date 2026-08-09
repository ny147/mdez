import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_CRON } from "@/app/api/cron/quick-shares/route";
import { DELETE, GET } from "@/app/api/quick-shares/[publicId]/route";
import { POST } from "@/app/api/quick-shares/route";
import { requestAddress } from "@/server/request-address";
import { createShare, deleteShare, purgeShares, readShare } from "@/server/quick-shares/runtime";

vi.mock("server-only", () => ({}));
vi.mock("@/server/quick-shares/runtime", () => ({
  createShare: vi.fn(),
  readShare: vi.fn(),
  deleteShare: vi.fn(),
  purgeShares: vi.fn()
}));

describe("Quick Share routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a share and never echoes a digest", async () => {
    vi.mocked(createShare).mockResolvedValue({
      publicId: "public",
      managementToken: "private",
      url: "https://mdez.app/share/public",
      title: "T",
      markdown: "M",
      createdAt: "2026-08-09T00:00:00.000Z",
      expiresAt: null
    });
    const response = await POST(new Request("https://mdez.app/api/quick-shares", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      body: JSON.stringify({ title: "T", markdown: "M", expiry: "never" })
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(expect.objectContaining({ managementToken: "private" }));
    expect(createShare).toHaveBeenCalledWith(
      { title: "T", markdown: "M", expiry: "never" },
      { origin: "https://mdez.app", address: "203.0.113.5" }
    );
  });

  it.each([
    [new Error("Choose a valid expiry"), 400],
    [new Error("Markdown must be 5 MiB or smaller"), 413],
    [Object.assign(new Error("Too many requests"), { code: "RATE_LIMITED", retryAfterSeconds: 9 }), 429]
  ])("maps create failures to safe responses", async (error, status) => {
    vi.mocked(createShare).mockRejectedValue(error);
    const response = await POST(new Request("https://mdez.app/api/quick-shares", {
      method: "POST",
      body: JSON.stringify({ title: "T", markdown: "M", expiry: "never" })
    }));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: error.message });
    if (status === 429) expect(response.headers.get("retry-after")).toBe("9");
  });

  it.each([
    ["NOT_FOUND", 404],
    ["EXPIRED", 410],
    ["RATE_LIMITED", 429]
  ])("maps %s reads to %i with no-store", async (code, status) => {
    vi.mocked(readShare).mockRejectedValue(Object.assign(new Error(code), {
      code,
      retryAfterSeconds: 7
    }));
    const response = await GET(
      new Request("https://mdez.app/api/quick-shares/x"),
      { params: Promise.resolve({ publicId: "x" }) }
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the management token only through a header", async () => {
    vi.mocked(deleteShare).mockResolvedValue();
    const response = await DELETE(
      new Request("https://mdez.app/api/quick-shares/x", {
        method: "DELETE",
        headers: { "x-mdez-management-token": "private" }
      }),
      { params: Promise.resolve({ publicId: "x" }) }
    );
    expect(response.status).toBe(204);
    expect(deleteShare).toHaveBeenCalledWith("x", "private");
  });

  it("protects the cleanup route with the cron bearer secret", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const unauthorized = await GET_CRON(new Request("https://mdez.app/api/cron/quick-shares"));
    expect(unauthorized.status).toBe(401);

    vi.mocked(purgeShares).mockResolvedValue({ shares: 2, buckets: 3 });
    const response = await GET_CRON(new Request("https://mdez.app/api/cron/quick-shares", {
      headers: { authorization: "Bearer cron-secret" }
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shares: 2, buckets: 3 });
  });
});

describe("requestAddress", () => {
  it("prefers the first forwarded address", () => {
    expect(requestAddress(new Headers({
      "x-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-real-ip": "198.51.100.1"
    }))).toBe("203.0.113.5");
  });

  it("falls back to the real IP and then unknown", () => {
    expect(requestAddress(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(requestAddress(new Headers())).toBe("unknown");
  });
});
