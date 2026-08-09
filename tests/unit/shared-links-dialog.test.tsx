import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SharedLinksDialog } from "@/components/mdez/SharedLinksDialog";
import { deleteQuickShare } from "@/lib/quick-share-client";
import { forgetSharedLink, listSharedLinks } from "@/lib/shared-link-repository";

vi.mock("@/lib/quick-share-client", () => ({ deleteQuickShare: vi.fn() }));
vi.mock("@/lib/shared-link-repository", () => ({
  forgetSharedLink: vi.fn(),
  listSharedLinks: vi.fn()
}));

const link = {
  publicId: "abc",
  url: "/share/abc",
  title: "Guide",
  managementToken: "secret",
  createdAt: "2026-08-09T00:00:00Z",
  expiresAt: null
};

describe("SharedLinksDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSharedLinks).mockResolvedValue([link]);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  it("deletes with the locally stored management token", async () => {
    vi.mocked(deleteQuickShare).mockResolvedValue();
    render(<SharedLinksDialog open onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Guide shared link" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete link" }));

    await waitFor(() => expect(deleteQuickShare).toHaveBeenCalledWith("abc", "secret"));
    expect(forgetSharedLink).toHaveBeenCalledWith("abc");
    expect(screen.queryByText("Guide")).toBeNull();
  });

  it("keeps the local row when network deletion fails", async () => {
    vi.mocked(deleteQuickShare).mockRejectedValue(new Error("Could not delete shared page"));
    render(<SharedLinksDialog open onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Guide shared link" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete shared page");
    expect(screen.getByText("Guide")).toBeVisible();
    expect(forgetSharedLink).not.toHaveBeenCalled();
  });

  it("labels expired and never-expiring links", async () => {
    vi.mocked(listSharedLinks).mockResolvedValue([
      link,
      { ...link, publicId: "expired", title: "Old", expiresAt: "2020-01-01T00:00:00Z" }
    ]);
    render(<SharedLinksDialog open onClose={vi.fn()} />);
    expect(await screen.findByText("Never expires")).toBeVisible();
    expect(screen.getByText("Expired")).toBeVisible();
  });
});
