import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickShareDialog } from "@/components/mdez/QuickShareDialog";
import { createQuickShare } from "@/lib/quick-share-client";
import { rememberSharedLink } from "@/lib/shared-link-repository";

vi.mock("@/lib/quick-share-client", () => ({ createQuickShare: vi.fn() }));
vi.mock("@/lib/shared-link-repository", () => ({ rememberSharedLink: vi.fn() }));

describe("QuickShareDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  it("defaults to seven days and stores the returned creator token locally", async () => {
    vi.mocked(createQuickShare).mockResolvedValue({
      publicId: "abc",
      url: "https://mdez.app/share/abc",
      managementToken: "secret",
      title: "Guide",
      markdown: "# Guide",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: "2026-08-16T00:00:00Z"
    });
    render(
      <QuickShareDialog
        open
        document={{ title: "Guide", body: "# Guide" }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox", { name: "Link expiration" })).toHaveValue("7d");

    fireEvent.click(screen.getByRole("button", { name: "Create view-only link" }));

    await waitFor(() => expect(createQuickShare).toHaveBeenCalledWith({
      title: "Guide",
      markdown: "# Guide",
      expiry: "7d"
    }));
    expect(await screen.findByDisplayValue("https://mdez.app/share/abc")).toBeVisible();
    expect(rememberSharedLink).toHaveBeenCalledWith({
      publicId: "abc",
      url: "https://mdez.app/share/abc",
      title: "Guide",
      managementToken: "secret",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: "2026-08-16T00:00:00Z"
    });
  });

  it("copies the public URL and never renders the management token", async () => {
    vi.mocked(createQuickShare).mockResolvedValue({
      publicId: "abc",
      url: "https://mdez.app/share/abc",
      managementToken: "secret",
      title: "Guide",
      markdown: "# Guide",
      createdAt: "2026-08-09T00:00:00Z",
      expiresAt: null
    });
    render(<QuickShareDialog open document={{ title: "Guide", body: "# Guide" }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create view-only link" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy public link" }));
    await waitFor(() => expect(navigator.clipboard.writeText)
      .toHaveBeenCalledWith("https://mdez.app/share/abc"));
    expect(await screen.findByRole("status")).toHaveTextContent("Copied public link");
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("shows a retryable safe error", async () => {
    vi.mocked(createQuickShare).mockRejectedValue(new Error("Too many requests"));
    render(<QuickShareDialog open document={{ title: "Guide", body: "# Guide" }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create view-only link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Create view-only link" })).toBeEnabled();
  });
});
