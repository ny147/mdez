"use client";

import { useCallback, useEffect, useState } from "react";
import { getWorkspaceResume, recordWorkspaceOpened } from "@/lib/workspace-resume";

export function useWorkspaceResume(workspaceId: string): {
  lastOpenedDocumentId: string | null;
  isReady: boolean;
  error: string | null;
  recordOpened: (documentId: string) => Promise<void>;
} {
  const [lastOpenedDocumentId, setLastOpenedDocumentId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsReady(false);
    setError(null);
    setLastOpenedDocumentId(null);
    void getWorkspaceResume(workspaceId)
      .then((record) => {
        if (active) setLastOpenedDocumentId(record?.documentId ?? null);
      })
      .catch(() => {
        if (active) setError("Resume history is unavailable in this browser.");
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => { active = false; };
  }, [workspaceId]);

  const recordOpened = useCallback(async (documentId: string) => {
    try {
      await recordWorkspaceOpened(workspaceId, documentId);
      setLastOpenedDocumentId(documentId);
      setError(null);
    } catch {
      setError("Resume history could not be saved.");
      throw new Error("Resume history could not be saved.");
    }
  }, [workspaceId]);

  return { lastOpenedDocumentId, isReady, error, recordOpened };
}
