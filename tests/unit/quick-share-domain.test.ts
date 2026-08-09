import { describe, expect, it, vi } from "vitest";

import { expiryDate, validateQuickShareInput } from "@/lib/quick-share";
import { createOpaqueSecret, digestManagementToken } from "@/server/quick-shares/secrets";

vi.mock("server-only", () => ({}));

describe("Quick Share domain", () => {
  const now = new Date("2026-08-09T00:00:00.000Z");

  it.each([
    ["1h", "2026-08-09T01:00:00.000Z"],
    ["1d", "2026-08-10T00:00:00.000Z"],
    ["7d", "2026-08-16T00:00:00.000Z"],
    ["30d", "2026-09-08T00:00:00.000Z"]
  ] as const)("maps %s to an absolute expiry", (choice, expected) => {
    expect(expiryDate(choice, now)?.toISOString()).toBe(expected);
  });

  it("maps never to null", () => expect(expiryDate("never", now)).toBeNull());

  it("rejects Markdown above five MiB", () => {
    expect(() => validateQuickShareInput({
      title: "Large",
      markdown: "x".repeat(5 * 1024 * 1024 + 1),
      expiry: "7d"
    })).toThrow("Markdown must be 5 MiB or smaller");
  });

  it("creates 128-bit-or-stronger opaque secrets and stable HMAC digests", () => {
    process.env.MANAGEMENT_TOKEN_PEPPER = "a".repeat(32);
    const token = createOpaqueSecret();
    expect(Buffer.from(token, "base64url").byteLength).toBeGreaterThanOrEqual(16);
    expect(digestManagementToken(token)).toEqual(digestManagementToken(token));
    expect(digestManagementToken(token)).toHaveLength(32);
  });
});
