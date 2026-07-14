import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import { appMetadata } from "@/app/metadata";
import manifest from "@/app/manifest";
import NotFound from "@/app/not-found";
import { maxDuration } from "@/app/api/github/archive/route";
import nextConfig from "../../next.config";

describe("production readiness", () => {
  it("publishes app metadata, a manifest, and a local icon", () => {
    expect(appMetadata).toMatchObject({
      applicationName: "Mdez",
      title: { default: "Mdez", template: "%s · Mdez" },
      icons: { icon: "/icon.svg" }
    });
    expect(manifest()).toMatchObject({
      name: "Mdez",
      short_name: "Mdez",
      display: "standalone",
      start_url: "/"
    });
    expect(readFileSync(resolve(process.cwd(), "src/app/icon.svg"), "utf8")).toContain("<svg");
  });

  it("provides recovery actions for application and missing-route errors", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();

    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Return to Mdez" })).toHaveAttribute("href", "/");
  });

  it("sets safe browser headers and a hosting duration above the route timeout", async () => {
    expect(maxDuration).toBe(20);
    const rules = await nextConfig.headers?.();
    const rootRule = rules?.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries(rootRule?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(headers).toMatchObject({
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
  });
});
