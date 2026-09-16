import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSharedPage } from "@/components/mdez/PublicSharedPage";

describe("PublicSharedPage", () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it("removes loaded Markdown when its deadline is reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publicId: "abc",
      title: "Guide",
      markdown: "# Private snapshot",
      createdAt: "2026-09-14T00:00:00Z",
      expiresAt: "2026-09-15T00:00:01.000Z"
    }), { status: 200 })));

    render(<PublicSharedPage publicId="abc" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "Private snapshot" })).toBeVisible();

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.queryByRole("heading", { name: "Private snapshot" })).toBeNull();
    expect(screen.getByText("This shared page has expired")).toBeVisible();
  });

  it.each([
    ["2026-09-14T23:59:59.999Z", "This shared page has expired"],
    ["invalid", "Could not load this shared page"]
  ])("does not render a stale payload with expiry %s", async (expiresAt, message) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publicId: "abc",
      title: "Guide",
      markdown: "# Private snapshot",
      createdAt: "2026-09-14T00:00:00Z",
      expiresAt
    }), { status: 200 })));

    render(<PublicSharedPage publicId="abc" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.queryByRole("heading", { name: "Private snapshot" })).toBeNull();
    expect(screen.getByText(message)).toBeVisible();
  });

  it("ignores an old request that resolves after the public ID changes", async () => {
    let resolveOld: ((response: Response) => void) | undefined;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/old")) return oldResponse;
      return Promise.resolve(new Response(JSON.stringify({
        publicId: "new",
        title: "New",
        markdown: "# New snapshot",
        createdAt: "2026-09-15T00:00:00Z",
        expiresAt: null
      }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<PublicSharedPage publicId="old" />);
    view.rerender(<PublicSharedPage publicId="new" />);
    expect(await screen.findByRole("heading", { name: "New snapshot" })).toBeVisible();

    await act(async () => {
      resolveOld?.(new Response(JSON.stringify({
        publicId: "old",
        title: "Old",
        markdown: "# Old snapshot",
        createdAt: "2026-09-14T00:00:00Z",
        expiresAt: null
      }), { status: 200 }));
      await oldResponse;
    });

    expect(screen.getByRole("heading", { name: "New snapshot" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Old snapshot" })).toBeNull();
  });
});
