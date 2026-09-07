import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listBookmarks, setBookmark, getWorkspaceResume, recordWorkspaceOpened } = vi.hoisted(() => ({
  listBookmarks: vi.fn(),
  setBookmark: vi.fn(),
  getWorkspaceResume: vi.fn(),
  recordWorkspaceOpened: vi.fn()
}));

vi.mock("@/lib/page-bookmarks", () => ({ listBookmarks, setBookmark }));
vi.mock("@/lib/workspace-resume", () => ({ getWorkspaceResume, recordWorkspaceOpened }));

import { usePageBookmarks } from "@/hooks/usePageBookmarks";
import { useWorkspaceResume } from "@/hooks/useWorkspaceResume";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => vi.clearAllMocks());

describe("library metadata hooks", () => {
  it("does not let a stale workspace bookmark read overwrite the current workspace", async () => {
    const local = deferred<Array<{ documentId: string }>>();
    listBookmarks.mockReturnValueOnce(local.promise).mockResolvedValueOnce([{ documentId: "group-page" }]);
    const { result, rerender } = renderHook(({ workspaceId }) => usePageBookmarks(workspaceId), { initialProps: { workspaceId: "local" } });
    rerender({ workspaceId: "group:test" });
    await waitFor(() => expect(result.current.bookmarkedIds.has("group-page")).toBe(true));
    local.resolve([{ documentId: "local-page" }]);
    await act(async () => { await local.promise; });
    expect(result.current.bookmarkedIds.has("group-page")).toBe(true);
    expect(result.current.bookmarkedIds.has("local-page")).toBe(false);
  });

  it("awaits bookmark writes and surfaces a recoverable failure without claiming success", async () => {
    listBookmarks.mockResolvedValue([]);
    setBookmark.mockRejectedValueOnce(new Error("disk full"));
    const { result } = renderHook(() => usePageBookmarks("local"));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => {
      await expect(result.current.toggleBookmark("page")).rejects.toThrow("Bookmark could not be saved");
    });
    expect(result.current.bookmarkedIds.has("page")).toBe(false);
    expect(result.current.error).toMatch(/try again/i);
  });

  it("loads and records resume history for the active workspace", async () => {
    getWorkspaceResume.mockResolvedValue({ workspaceId: "local", documentId: "first", openedAt: "now" });
    recordWorkspaceOpened.mockResolvedValue(undefined);
    const { result } = renderHook(() => useWorkspaceResume("local"));
    await waitFor(() => expect(result.current.lastOpenedDocumentId).toBe("first"));
    await act(async () => { await result.current.recordOpened("second"); });
    expect(recordWorkspaceOpened).toHaveBeenCalledWith("local", "second");
    expect(result.current.lastOpenedDocumentId).toBe("second");
  });
});
