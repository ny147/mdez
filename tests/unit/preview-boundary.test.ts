import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

const PREVIEW_MESSAGE = "Sharing is unavailable in this preview. Your local library still works.";

describe("preview sharing boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects sharing requests in Vercel Preview before route handling", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    const response = middleware();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: PREVIEW_MESSAGE });
  });

  it.each(["production", undefined])(
    "passes through sharing requests when VERCEL_ENV is %s",
    (environment) => {
      if (environment === undefined) vi.stubEnv("VERCEL_ENV", undefined);
      else vi.stubEnv("VERCEL_ENV", environment);

      const response = middleware();

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  );
});
