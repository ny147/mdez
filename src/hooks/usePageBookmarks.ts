"use client";

import { useCallback, useEffect, useState } from "react";
import { listBookmarks, setBookmark } from "@/lib/page-bookmarks";

export function usePageBookmarks(workspaceId: string): {
  bookmarkedIds: ReadonlySet<string>;
  isReady: boolean;
  error: string | null;
  toggleBookmark: (documentId: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [bookmarkedIds, setBookmarkedIds] = useState<ReadonlySet<string>>(new Set());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const records = await listBookmarks(workspaceId);
      if (isActive()) {
        setBookmarkedIds(new Set(records.map((record) => record.documentId)));
        setError(null);
      }
    } catch (cause) {
      if (isActive()) setError("Bookmarks are unavailable in this browser.");
      throw cause;
    }
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    setIsReady(false);
    setError(null);
    setBookmarkedIds(new Set());
    void loadBookmarks(() => active)
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => { active = false; };
  }, [loadBookmarks, workspaceId]);

  const refresh = useCallback(async () => {
    await loadBookmarks();
  }, [loadBookmarks]);

  const toggleBookmark = useCallback(async (documentId: string) => {
    const enabled = !bookmarkedIds.has(documentId);
    try {
      await setBookmark(workspaceId, documentId, enabled);
      setBookmarkedIds((current) => {
        const next = new Set(current);
        if (enabled) next.add(documentId);
        else next.delete(documentId);
        return next;
      });
      setError(null);
    } catch {
      setError("Bookmark could not be saved. Try again.");
      throw new Error("Bookmark could not be saved.");
    }
  }, [bookmarkedIds, workspaceId]);

  return { bookmarkedIds, isReady, error, toggleBookmark, refresh };
}
