"use client";

import { useCallback, useEffect, useState } from "react";
import { listBookmarks, setBookmark } from "@/lib/page-bookmarks";

export function usePageBookmarks(workspaceId: string): {
  bookmarkedIds: ReadonlySet<string>;
  isReady: boolean;
  error: string | null;
  toggleBookmark: (documentId: string) => Promise<void>;
} {
  const [bookmarkedIds, setBookmarkedIds] = useState<ReadonlySet<string>>(new Set());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsReady(false);
    setError(null);
    setBookmarkedIds(new Set());
    void listBookmarks(workspaceId)
      .then((records) => {
        if (active) setBookmarkedIds(new Set(records.map((record) => record.documentId)));
      })
      .catch(() => {
        if (active) setError("Bookmarks are unavailable in this browser.");
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => { active = false; };
  }, [workspaceId]);

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

  return { bookmarkedIds, isReady, error, toggleBookmark };
}
