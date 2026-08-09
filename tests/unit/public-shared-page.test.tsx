import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSharedPage } from "@/components/mdez/PublicSharedPage";

describe("PublicSharedPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders shared Markdown without editing controls or raw HTML", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publicId: "abc",
      title: "Guide",
      markdown: "# Hello\n<script>alert(1)</script>",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicSharedPage publicId="abc" />);
    expect(await screen.findByRole("heading", { name: "Hello" })).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/quick-shares/abc", {
      cache: "no-store",
      signal: expect.any(AbortSignal)
    });
  });

  it.each([
    [404, "Shared page not found"],
    [410, "This shared page has expired"]
  ])("shows a terminal state for %i", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    render(<PublicSharedPage publicId="abc" />);
    expect(await screen.findByText(message)).toBeVisible();
  });

  it("shows a safe retry message for other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    render(<PublicSharedPage publicId="abc" />);
    expect(await screen.findByText("Could not load this shared page")).toBeVisible();
  });
});
