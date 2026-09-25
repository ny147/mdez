import Dexie from "dexie";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { usePageBookmarks } from "@/hooks/usePageBookmarks";

const timestamp = "2026-09-22T00:00:00.000Z";

describe("usePageBookmarks refresh", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(db.name);
  });

  it("reloads bookmarks written outside the hook", async () => {
    const { result } = renderHook(() => usePageBookmarks("local"));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await db.pageBookmarks.put({ workspaceId: "local", documentId: "restored", createdAt: timestamp });
    await act(() => result.current.refresh());
    expect(result.current.bookmarkedIds).toEqual(new Set(["restored"]));
  });

  it("keeps refreshed bookmark records isolated by workspace", async () => {
    await db.pageBookmarks.bulkPut([
      { workspaceId: "local", documentId: "local-page", createdAt: timestamp },
      { workspaceId: "group:one", documentId: "group-page", createdAt: timestamp }
    ]);
    const { result, rerender } = renderHook(({ workspaceId }) => usePageBookmarks(workspaceId), { initialProps: { workspaceId: "local" } });
    await waitFor(() => expect(result.current.bookmarkedIds).toEqual(new Set(["local-page"])));
    rerender({ workspaceId: "group:one" });
    await waitFor(() => expect(result.current.bookmarkedIds).toEqual(new Set(["group-page"])));
    await act(() => result.current.refresh());
    expect(result.current.bookmarkedIds).toEqual(new Set(["group-page"]));
  });
});
